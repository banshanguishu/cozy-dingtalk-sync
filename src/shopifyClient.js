const axios = require("axios");
const { appendToLog } = require("./fileManager");
require("dotenv").config();

/* 环境变量 */
const { SHOPIFY_STORE_URL, SHOPIFY_ADMIN_API_ACCESS_TOKEN, SHOPIFY_API_VERSION } = process.env;
const SHOPIFY_REQUEST_TIMEOUT_MS = 15000;
const SHOPIFY_MAX_RETRIES = 3;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableError(error) {
  const code = error?.code;
  if (code && ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ECONNABORTED"].includes(code)) {
    return true;
  }

  const status = error?.response?.status;
  if (status && (status === 429 || status >= 500)) {
    return true;
  }

  return false;
}

function getBackoffMs(attempt) {
  // 500ms, 1000ms, 2000ms
  return 500 * Math.pow(2, Math.max(0, attempt - 1));
}

/* 环境变量必须配置校验 */
function validateConfig() {
  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_ACCESS_TOKEN) {
    throw new Error("配置错误: 请确保 .env 文件中配置了 SHOPIFY_STORE_URL 和 SHOPIFY_ADMIN_API_ACCESS_TOKEN");
  }
}

/* 获取 shopify GraphQL API URL */
function getApiUrl() {
  const shopUrl = SHOPIFY_STORE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION || "2024-01"}/graphql.json`;
}

/**
 * 构建 GraphQL 查询语句
 * @param {string} queryFilter - 搜索过滤条件 (例如 "updated_at:>=2023-01-01")
 * @param {string|null} afterCursor - 分页游标
 * @returns {string}
 */
function buildQuery(queryFilter, afterCursor) {
  const args = [
    "first: 50", // 默认每页 50 条
    "sortKey: CREATED_AT", // 默认按创建时间排序
    "reverse: false", // 升序 (旧 -> 新)
    `query: "${queryFilter}"`,
  ];

  if (afterCursor) {
    args.push(`after: "${afterCursor}"`);
  }

  return `
    query {
      orders(${args.join(", ")}) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          cursor
          node {
            id
            name
            legacyResourceId
            createdAt
            updatedAt
            cancelledAt
            closedAt
            processedAt
            discountCode
            note
            currencyCode
            displayFulfillmentStatus
            displayFinancialStatus
            totalWeight
            email
            customer {
              displayName
              firstName
              lastName
              phone
            }
            shippingAddress {
              name
              phone
              address1
              address2
              city
              province
              provinceCode
              zip
              country
              countryCode
            }
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalShippingPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            lineItems(first: 50) {
              edges {
                node {
                  id
                  title
                  quantity
                  currentQuantity
                  sku
                  # 行级原总价（已乘以数量）
                  originalTotalSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  # 行级折扣后总价（已乘以数量）
                  discountedTotalSet(withCodeDiscounts: true) {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  product {
                    title
                    collections(first: 50) {
                      edges {
                        node {
                          id
                        }
                      }
                    }
                  }
                  variantTitle
                  variant {
                    title
                    selectedOptions {
                      name
                      value
                    }
                  }
                  customAttributes {
                    key
                    value
                  }
                  discountAllocations {
                    allocatedAmount {
                      amount
                      currencyCode
                    }
                    discountApplication {
                      index
                      __typename
                      ... on DiscountCodeApplication {
                        code
                        value {
                          __typename
                          ... on MoneyV2 {
                            amount
                            currencyCode
                          }
                          ... on PricingPercentageValue {
                            percentage
                          }
                        }
                      }
                      ... on AutomaticDiscountApplication {
                        title
                        value {
                          __typename
                          ... on MoneyV2 {
                            amount
                            currencyCode
                          }
                          ... on PricingPercentageValue {
                            percentage
                          }
                        }
                      }
                      ... on ManualDiscountApplication {
                        title
                        value {
                          __typename
                          ... on MoneyV2 {
                            amount
                            currencyCode
                          }
                          ... on PricingPercentageValue {
                            percentage
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
}

/**
 * 获取 Shopify 订单（分页模式）
 * @param {string} lastSyncTime - 上次同步时间 (ISO 8601)
 * @param {string|null} cursor - 分页游标
 * @returns {Promise<{orders: Array, pageInfo: Object}>}
 */
async function fetchOrdersPage(lastSyncTime, cursor = null) {
  validateConfig();
  const apiUrl = getApiUrl();

  const queryFilter = `created_at:>'${lastSyncTime}'`;
  const graphqlQuery = buildQuery(queryFilter, cursor);

  try {
    let response = null;
    let lastError = null;

    for (let attempt = 1; attempt <= SHOPIFY_MAX_RETRIES; attempt++) {
      try {
        response = await axios.post(
          apiUrl,
          { query: graphqlQuery },
          {
            timeout: SHOPIFY_REQUEST_TIMEOUT_MS,
            headers: {
              "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_ACCESS_TOKEN,
              "Content-Type": "application/json",
            },
          }
        );
        break;
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt === SHOPIFY_MAX_RETRIES) {
          throw error;
        }
        const backoffMs = getBackoffMs(attempt);
        console.warn(
          `⚠️ Shopify 请求失败，准备重试(${attempt}/${SHOPIFY_MAX_RETRIES})，` +
            `code=${error.code || "N/A"} status=${error.response?.status || "N/A"}，` +
            `等待 ${backoffMs}ms`
        );
        await delay(backoffMs);
      }
    }

    if (!response) {
      throw lastError || new Error("Shopify 请求失败：未知错误");
    }

    if (response.data.errors) {
      const time = new Date().toISOString();
      const logLine = `【${time}】| 获取shopify订单失败 | 原因：${JSON.stringify(response.data.errors)}\n`;
      appendToLog("logs", "global", logLine, "log");
      throw new Error(`GraphQL 查询错误: ${JSON.stringify(response.data.errors, null, 2)}`);
    }

    const data = response.data.data.orders;
    // 过滤掉已取消的订单 (cancelledAt 不为 null 的)
    // 同时手动过滤掉 createdAt <= lastSyncTime 的订单，因为 Shopify 的 API 在处理时间精度时可能存在问题
    const orders = data.edges
      .map((edge) => edge.node)
      .filter((order) => {
        // 1. 过滤已取消订单
        if (order.cancelledAt !== null) return false;

        // 2. 过滤掉时间小于等于 lastSyncTime 的订单 (严格增量)
        if (new Date(order.createdAt) <= new Date(lastSyncTime)) return false;
        return true;
      });

    return {
      orders,
      pageInfo: data.pageInfo,
    };
  } catch (error) {
    if (error.response) {
      throw new Error(`API 请求失败: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    if (error.code) {
      throw new Error(
        `API 网络请求失败: code=${error.code} address=${error.address || "N/A"} port=${error.port || "N/A"} message=${error.message}`
      );
    }
    throw error;
  }
}

module.exports = {
  fetchOrdersPage,
};
