/* 数据拉取测试脚本 */
const axios = require("axios");
require("dotenv").config();

const { SHOPIFY_STORE_URL, SHOPIFY_ADMIN_API_ACCESS_TOKEN, SHOPIFY_API_VERSION } = process.env;

const apiUrl = `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

const graphql = `
    {
      orders(id:=gid://shopify/Order/6676078231870) {
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
            lineItems(first: 50) {
              edges {
                node {
                  title
                  quantity
                  sku
                }
              }
            }
          }
        }
      }
    }
  `;

async function testFetchOneOrder() {
  try {
    const response = await axios({
      url: apiUrl,
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_ACCESS_TOKEN,
      },
      data: {
        query: graphqlQuery,
      },
    });

    if (response.data.errors) {
      throw new Error(`GraphQL 查询错误: ${JSON.stringify(response.data.errors, null, 2)}`);
    }

    const data = response.data.data.orders;
    const orders = data.edges.map((edge) => edge.node);

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
