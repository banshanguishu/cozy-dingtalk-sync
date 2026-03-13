const axios = require("axios");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
require("dotenv").config();

const { buildThirdOrders, buildSecondOrders } = require("../src/buildOrders");
const { queryExchangeRate } = require("../src/exchangeRate");
const { COLLECTION_MAP } = require("../src/mapping/collectionMap");

const { SHOPIFY_STORE_URL, SHOPIFY_ADMIN_API_ACCESS_TOKEN, SHOPIFY_API_VERSION } = process.env;
const TEST_WEBHOOK_FILE = path.join(process.cwd(), ".env.test.local");

const DEFAULT_ORDER_ID = "6811243774270";
const DEFAULT_TYPE = "secondary_order";

const ORDER_QUERY = `
query($id: ID!) {
  order(id: $id) {
    id
    name
    createdAt
    updatedAt
    cancelledAt
    processedAt
    discountCode
    note
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
`;

function normalizeOrderId(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.startsWith("gid://shopify/Order/")) return value;
  if (/^\d+$/.test(value)) return `gid://shopify/Order/${value}`;
  return value;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let orderId = DEFAULT_ORDER_ID;
  let type = DEFAULT_TYPE;
  let pretty = true;
  let sync = false;

  const positionalArgs = [];
  for (const arg of args) {
    if (arg === "--compact") {
      pretty = false;
      continue;
    }
    if (arg === "--sync") {
      sync = true;
      continue;
    }
    positionalArgs.push(arg);
  }

  if (positionalArgs[0]) orderId = positionalArgs[0];
  if (positionalArgs[1]) type = positionalArgs[1];

  return { orderId, type, pretty, sync };
}

function validateEnv() {
  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_ACCESS_TOKEN) {
    throw new Error("缺少环境变量 SHOPIFY_STORE_URL 或 SHOPIFY_ADMIN_API_ACCESS_TOKEN");
  }
}

function getApiUrl() {
  const shopUrl = SHOPIFY_STORE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION || "2024-01"}/graphql.json`;
}

async function fetchOrder(orderId) {
  const apiUrl = getApiUrl();
  const response = await axios.post(
    apiUrl,
    {
      query: ORDER_QUERY,
      variables: { id: orderId },
    },
    {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.data.errors) {
    throw new Error(`GraphQL 查询错误: ${JSON.stringify(response.data.errors)}`);
  }
  return response.data?.data?.order || null;
}

async function buildByType(order, type) {
  if (!COLLECTION_MAP[type]) {
    throw new Error(`未知类型: ${type}`);
  }
  if (type === "secondary_order") {
    let usdToRmbRate = null;
    try {
      usdToRmbRate = await queryExchangeRate(undefined, "USD", "RMB");
      console.log(`💱 当前测试 USD->RMB 汇率: ${usdToRmbRate}`);
    } catch (error) {
      console.warn(`⚠️ 汇率查询失败，secondary_order 将使用空汇率: ${error.message}`);
    }
    return { builtOrders: buildSecondOrders([order], type, usdToRmbRate), usdToRmbRate };
  }
  return { builtOrders: buildThirdOrders([order], type), usdToRmbRate: null };
}

async function syncBuiltOrdersToDingTalk(builtOrders, type) {
  const webhook = getTestWebhookByType(type);
  if (!webhook) {
    throw new Error(`类型 ${type} 未在 .env.test.local 中配置测试 webhook`);
  }

  let successCount = 0;
  let failCount = 0;

  for (const order of builtOrders) {
    try {
      await axios.post(webhook, order, {
        headers: { "Content-Type": "application/json" },
      });
      successCount++;
    } catch (error) {
      failCount++;
      console.error(`❌ 钉钉同步失败: ${order.thirdName || order.parentName || "Unknown"} | ${error.message}`);
    }
  }

  return { successCount, failCount };
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  return dotenv.parse(raw);
}

function getTestWebhookByType(type) {
  const envMap = parseEnvFile(TEST_WEBHOOK_FILE);
  const typeToWebhookEnvKey = {
    drapery: "DINGTALK_WEBHOOK_URL_DRAPERY",
    roman_shade: "DINGTALK_WEBHOOK_URL_ROMANSHADE",
    hardware: "DINGTALK_WEBHOOK_URL_HARDWARE",
    hanwoven_shade: "DINGTALK_WEBHOOK_URL_HANWOVENSHADE",
    roller_blind: "DINGTALK_WEBHOOK_URL_ROLLERBLIND",
    other_shade: "DINGTALK_WEBHOOK_URL_OTHERSHADE",
    others: "DINGTALK_WEBHOOK_URL_OTHERS",
    secondary_order: "DINGTALK_WEBHOOK_URL_SECONDARYORDER",
  };
  const key = typeToWebhookEnvKey[type];
  if (!key) return "";
  const value = String(envMap[key] || "").trim();
  return value;
}

async function main() {
  const { orderId: rawOrderId, type, pretty, sync } = parseArgs(process.argv);
  const orderId = normalizeOrderId(rawOrderId);

  validateEnv();
  console.log(`🔍 测试订单: ${orderId}`);
  console.log(`🔀 测试类型: ${type}`);

  const order = await fetchOrder(orderId);
  if (!order) {
    throw new Error("未找到目标订单，请确认订单ID");
  }

  const { builtOrders: built, usdToRmbRate } = await buildByType(order, type);
  const result = {
    orderId,
    orderName: order.name,
    type,
    syncEnabled: sync,
    usdToRmbRate,
    matchedCount: built.length,
    builtOrders: built,
  };

  if (sync) {
    if (!fs.existsSync(TEST_WEBHOOK_FILE)) {
      throw new Error(`缺少测试 webhook 配置文件: ${TEST_WEBHOOK_FILE}`);
    }
    const syncResult = await syncBuiltOrdersToDingTalk(built, type);
    result.syncResult = syncResult;
  }

  console.log(pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result));
}

main().catch((error) => {
  console.error("❌ 测试失败:", error.message);
  process.exit(1);
});
