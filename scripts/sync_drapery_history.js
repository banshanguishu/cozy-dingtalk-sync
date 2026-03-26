const axios = require("axios");
require("dotenv").config();

const { buildThirdOrders } = require("../src/buildOrders");
const { appendToLog } = require("../src/fileManager");

const { SHOPIFY_STORE_URL, SHOPIFY_ADMIN_API_ACCESS_TOKEN, SHOPIFY_API_VERSION } = process.env;

/**
 * 用法：
 * node scripts/sync_drapery_history.js <type>
 * node scripts/sync_drapery_history.js <type> --sync
 */

const HISTORY_SYNC_CONFIG = {
  drapery: {
    historyLogType: "drapery_history",
    startCreatedAt: "2024-06-20T01:49:25Z",
    endCreatedAt: "2025-07-17T03:37:23Z",
    dingtalkWebhookUrl: "https://connector.dingtalk.com/webhook/flow/1037e8a3d5802132f5d7000i",
    dingtalkSourceKeyword: "drapery_history_sync",
  },
  roman_shade: {
    historyLogType: "roman_shade_history",
    startCreatedAt: "2024-06-20T01:49:25",
    endCreatedAt: "2025-08-24T01:29:22Z",
    dingtalkWebhookUrl: "https://connector.dingtalk.com/webhook/flow/1037ed3644de0bfb41a40006",
    dingtalkSourceKeyword: "roman_shade_history_sync",
  },
};

const RANGE_QUERY = `
query($query: String!, $after: String) {
  orders(first: 50, sortKey: CREATED_AT, reverse: false, query: $query, after: $after) {
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
        lineItems(first: 50) {
          edges {
            node {
              id
              title
              quantity
              currentQuantity
              sku
              originalTotalSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
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

function parseArgs(argv) {
  const args = argv.slice(2);
  let syncType = "";
  let sync = false;

  for (const arg of args) {
    if (arg === "--sync") {
      sync = true;
      continue;
    }
    if (!syncType) {
      syncType = arg;
    }
  }
  return { syncType, sync };
}

function validateEnv(selectedConfig) {
  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_ACCESS_TOKEN) {
    throw new Error("缺少环境变量 SHOPIFY_STORE_URL 或 SHOPIFY_ADMIN_API_ACCESS_TOKEN");
  }
  if (!selectedConfig) {
    throw new Error(`未知 type，请传入: ${Object.keys(HISTORY_SYNC_CONFIG).join(", ")}`);
  }
  if (!selectedConfig.startCreatedAt || !selectedConfig.endCreatedAt) {
    throw new Error("请先填写脚本顶部对应 type 的 startCreatedAt 和 endCreatedAt");
  }
}

function getApiUrl() {
  const shopUrl = SHOPIFY_STORE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION || "2024-01"}/graphql.json`;
}

async function postGraphQL(query, variables = {}) {
  const response = await axios.post(
    getApiUrl(),
    { query, variables },
    {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );

  if (response.data?.errors) {
    throw new Error(`GraphQL 查询错误: ${JSON.stringify(response.data.errors)}`);
  }

  return response.data?.data || null;
}

function buildRangeFilter(startCreatedAt, endCreatedAt) {
  return `created_at:>='${startCreatedAt}' AND created_at:<='${endCreatedAt}'`;
}

async function fetchOrdersByCreatedAtRange(startCreatedAt, endCreatedAt) {
  const queryFilter = buildRangeFilter(startCreatedAt, endCreatedAt);
  const result = [];
  let cancelledOrderCount = 0;
  let hasNextPage = true;
  let after = null;

  while (hasNextPage) {
    const data = await postGraphQL(RANGE_QUERY, { query: queryFilter, after });
    const ordersConnection = data?.orders;
    if (!ordersConnection) {
      throw new Error("未获取到 orders 查询结果");
    }

    const currentOrders = (ordersConnection.edges || [])
      .map((edge) => edge.node)
      .filter((order) => {
        if (order.cancelledAt !== null) {
          cancelledOrderCount++;
          return false;
        }
        const createdTime = new Date(order.createdAt).getTime();
        return createdTime >= new Date(startCreatedAt).getTime() && createdTime <= new Date(endCreatedAt).getTime();
      });

    result.push(...currentOrders);

    hasNextPage = ordersConnection.pageInfo?.hasNextPage === true;
    after = hasNextPage ? ordersConnection.pageInfo?.endCursor || null : null;
  }

  return {
    orders: result,
    cancelledOrderCount,
  };
}

async function syncBuiltOrdersToDingTalk(builtOrders, selectedConfig) {
  if (!selectedConfig.dingtalkWebhookUrl) {
    throw new Error("请先填写脚本顶部对应 type 的 dingtalkWebhookUrl");
  }

  let successCount = 0;
  let failCount = 0;

  for (const order of builtOrders) {
    const orderName = order.thirdName || order.parentName || "Unknown";

    try {
      await axios.post(selectedConfig.dingtalkWebhookUrl, order, {
        headers: { "Content-Type": "application/json" },
      });
      successCount++;
      appendToLog(
        "logs",
        selectedConfig.historyLogType,
        `【${new Date().toISOString()}】 | 三级单号：${orderName} | 结果：同步成功\n`,
        "log"
      );
    } catch (error) {
      failCount++;
      appendToLog(
        "logs",
        selectedConfig.historyLogType,
        `【${new Date().toISOString()}】 | 三级单号：${orderName} | 结果：同步失败 | 原因：${error.message}\n`,
        "log"
      );
    }
  }

  return { successCount, failCount };
}

async function main() {
  const { syncType, sync } = parseArgs(process.argv);
  const selectedConfig = HISTORY_SYNC_CONFIG[syncType];

  validateEnv(selectedConfig);

  console.log(`🚀 开始执行 ${syncType} 历史数据同步`);
  console.log(`🕒 开始时间: ${selectedConfig.startCreatedAt}`);
  console.log(`🕒 结束时间: ${selectedConfig.endCreatedAt}`);
  console.log(`📮 实际推送: ${sync ? "开启" : "关闭"}`);

  const startCreatedAt = selectedConfig.startCreatedAt;
  const endCreatedAt = selectedConfig.endCreatedAt;
  const { orders: originOrders, cancelledOrderCount } = await fetchOrdersByCreatedAtRange(startCreatedAt, endCreatedAt);
  console.log(`✅ 命中时间区间订单数: ${originOrders.length}`);
  console.log(`ℹ️ 时间区间内被过滤的取消订单数: ${cancelledOrderCount}`);

  const builtOrders = buildThirdOrders(originOrders, syncType).map((item) => ({
    ...item,
    source: selectedConfig.dingtalkSourceKeyword || item.source || "",
  }));

  console.log(`✅ 构造出的 ${syncType} 订单数: ${builtOrders.length}`);

  if (!builtOrders.length) {
    console.log(`✅ 当前区间内没有需要同步的 ${syncType} 订单。`);
    return;
  }

  const content = builtOrders.map((item) => JSON.stringify(item)).join("\n") + "\n";
  appendToLog("output", selectedConfig.historyLogType, content, "jsonl");

  if (!sync) {
    console.log("ℹ️ 当前为仅构造模式，未推送到钉钉。");
    console.log(JSON.stringify({
      startCreatedAt,
      endCreatedAt,
      originOrderCount: originOrders.length,
      cancelledOrderCount,
      builtOrderCount: builtOrders.length,
    }, null, 2));
    return;
  }

  const { successCount, failCount } = await syncBuiltOrdersToDingTalk(builtOrders, selectedConfig);
  console.log(`✅ ${successCount}, ❌ ${failCount}`);
}

main().catch((error) => {
  console.error("❌ 历史同步失败:", error.message);
  process.exit(1);
});
