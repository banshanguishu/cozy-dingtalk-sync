const axios = require("axios");
const { COLLECTION_MAP } = require("./mapping/collectionMap")
require("dotenv").config();

/* 环境变量 */
const { SHOPIFY_STORE_URL, SHOPIFY_ADMIN_API_ACCESS_TOKEN, SHOPIFY_API_VERSION } = process.env;

/* 环境变量必须配置验证 */
function validateConfig() {
  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_ACCESS_TOKEN) {
    throw new Error("配置错误: 请确保 .env 文件中配置了 SHOPIFY_STORE_URL 和 SHOPIFY_ADMIN_API_ACCESS_TOKEN");
  }
}

/* 获取 shopify SDK */
function getApiUrl() {
  const shopUrl = SHOPIFY_STORE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION || "2024-01"}/graphql.json`;
}

/**
 * 构建 GraphQL 查询语句
 * @param {string} queryFilter - 搜索过滤条件 (如 "updated_at:>=2023-01-01")
 * @param {string|null} afterCursor - 分页游标
 * @returns {string} 完整的 GraphQL 语句
 */
function buildQuery(queryFilter, afterCursor) {
  // 构造参数部分
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
    query($collectionQuery: String) {
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
            currencyCode
            displayFulfillmentStatus
            displayFinancialStatus
            totalWeight
            shippingAddress {
              country
            }
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            # 默认查询订单下面的50条商品（基本来说就是全量，就不做分页）TODO: 待确认订单下最大商品数量考虑是否分页
            lineItems(first: 50) {
              edges {
                node {
                  # 商品ID
                  id
                  # 商品名称
                  title
                  # 数量
                  quantity
                  # SKU
                  sku

                  # 产品信息 (需 read_products 权限)
                  product {
                    # productType
                    title
                    # 产品类别
                    # category {
                    #   name
                    #   isLeaf
                    #   level
                    #   parentId
                    # }
                    # 产品系列 (Collection) - 匹配指定ID
                    collections(first: 50, query: $collectionQuery) {
                      edges {
                        node {
                          id
                        }
                      }
                    }
                  }

                  # 变体标题 (快照，通常包含规格简写，如 "L / Red")
                  variantTitle

                  # 变体详情 (需 read_products 权限)
                  variant {
                    title
                    selectedOptions {
                      name
                      value
                    }
                  }

                  # 自定义属性 (关键字段：宽度、高度、room、花边型号等通常存储于此)
                  customAttributes {
                    key
                    value
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
 * 获取 Shopify 订单 (分页模式)
 * @param {string} lastSyncTime - 上次同步时间 (ISO 8601)
 * @param {string|null} cursor - 分页游标
 * @returns {Promise<{orders: Array, pageInfo: Object}>}
 */
async function fetchOrdersPage(lastSyncTime, cursor = null, type) {
  validateConfig();
  const apiUrl = getApiUrl();

  const queryFilter = `created_at:>'${lastSyncTime}'`;
  const graphqlQuery = buildQuery(queryFilter, cursor);

  // 取出当前type的id，构造id:xxx的查询参数，用于查询订单各个商品所属的合集，用于构造三级单号类型
  const collectionQuery = `id:${COLLECTION_MAP[type].id}`

  try {
    const response = await axios.post(
      apiUrl,
      {
        query: graphqlQuery,
        variables: {
          collectionQuery: collectionQuery,
        },
      },
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.errors) {
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
    } else {
      throw error;
    }
  }
}

module.exports = {
  fetchOrdersPage,
};
