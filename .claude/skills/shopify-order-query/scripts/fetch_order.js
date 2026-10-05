#!/usr/bin/env node
// 零运行时依赖脚本。需要 Node 18+（使用全局 fetch）。
//
// 用法:
//   node fetch_order.js <orderId> [--pretty]
//
// <orderId> 支持两种形式：
//   - 完整 gid： gid://shopify/Order/6852990173502
//   - 纯数字后缀：6852990173502（脚本会自动拼成 gid 形式）
//
// 默认输出单行 JSON；仅当传入 --pretty 时输出缩进 JSON。
//
// 凭据来源（按优先级）：
//   1. 真实进程环境变量（process.env）
//   2. 当前工作目录下的 .env 文件（需要在 repo 根目录运行）
// 需要用到的 key：
//   SHOPIFY_STORE_URL / SHOPIFY_ADMIN_API_ACCESS_TOKEN / SHOPIFY_API_VERSION

const fs = require("fs");
const path = require("path");

function parseDotenvLine(line) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!m) return null;
  let value = m[2];
  const quoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
  if (!quoted) {
    const hashIdx = value.indexOf(" #");
    if (hashIdx !== -1) value = value.slice(0, hashIdx).trim();
  } else {
    value = value.slice(1, -1);
  }
  return { key: m[1], value };
}

function loadDotenv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const result = {};
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*#.*$/, "");
    const entry = parseDotenvLine(line);
    if (entry) result[entry.key] = entry.value;
  }
  return result;
}

function resolveCredentials() {
  const envFromFile = loadDotenv(path.join(process.cwd(), ".env"));
  const read = (key) => (process.env[key] && process.env[key].trim()) || (envFromFile[key] && envFromFile[key].trim()) || "";
  return {
    SHOPIFY_STORE_URL: read("SHOPIFY_STORE_URL"),
    SHOPIFY_ADMIN_API_ACCESS_TOKEN: read("SHOPIFY_ADMIN_API_ACCESS_TOKEN"),
    SHOPIFY_API_VERSION: read("SHOPIFY_API_VERSION") || "2024-01",
  };
}

// ============================
// GraphQL 查询（与 scripts/test_fetch_single_order.js 的字段集合对齐）
// ============================
const QUERY = `
query($id: ID!) {
  order(id: $id) {
    id
    name
    createdAt
    displayFinancialStatus
    disputes {
      id
      status
      initiatedAs
    }
    displayFulfillmentStatus
    cancelledAt
    cancelReason
    closedAt
    discountCode
    note
    email
    customer {
      displayName
      firstName
      lastName
      phone
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
    transactions {
      id
      kind
      status
      gateway
      formattedGateway
      paymentId
      createdAt
      processedAt
      amountSet {
        shopMoney {
          amount
          currencyCode
        }
      }
    }
    discountApplications(first: 20) {
      edges {
        node {
          index
          __typename
          ... on DiscountCodeApplication {
            code
          }
          value {
            __typename
            ... on PricingPercentageValue {
              percentage
            }
            ... on MoneyV2 {
              amount
              currencyCode
            }
          }
          ... on AutomaticDiscountApplication {
            title
          }
          ... on ManualDiscountApplication {
            title
          }
        }
      }
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
            presentmentMoney {
              amount
              currencyCode
            }
          }
          variantTitle
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
  let orderId = "";
  let pretty = false;
  for (const arg of args) {
    if (arg === "--pretty") {
      pretty = true;
      continue;
    }
    if (!orderId) orderId = arg;
  }
  return { orderId, pretty };
}

function validateCredentials(creds) {
  if (!creds.SHOPIFY_STORE_URL) {
    throw new Error("缺少 SHOPIFY_STORE_URL：请在当前工作目录 .env 或环境变量中配置（示例：my-shop.myshopify.com）");
  }
  if (!creds.SHOPIFY_ADMIN_API_ACCESS_TOKEN) {
    throw new Error("缺少 SHOPIFY_ADMIN_API_ACCESS_TOKEN：请在当前工作目录 .env 或环境变量中配置（shpat_ 开头）");
  }
}

function getApiUrl(creds) {
  const shopUrl = creds.SHOPIFY_STORE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${shopUrl}/admin/api/${creds.SHOPIFY_API_VERSION}/graphql.json`;
}

async function main() {
  const { orderId: rawOrderId, pretty } = parseArgs(process.argv);
  if (!rawOrderId) {
    console.error("用法: node fetch_order.js <orderId> [--pretty]");
    console.error("  <orderId> 支持完整 gid 或纯数字后缀");
    process.exit(1);
  }

  const creds = resolveCredentials();
  validateCredentials(creds);

  const orderId = normalizeOrderId(rawOrderId);
  const apiUrl = getApiUrl(creds);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": creds.SHOPIFY_ADMIN_API_ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: QUERY, variables: { id: orderId } }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`HTTP ${response.status} ${response.statusText}: ${text}`);
    process.exit(1);
  }

  const payload = await response.json();
  if (payload.errors) {
    console.error("GraphQL errors:", JSON.stringify(payload.errors));
    process.exit(1);
  }

  const order = payload && payload.data && payload.data.order;
  if (!order) {
    console.error(`未找到订单: ${orderId}`);
    process.exit(1);
  }

  process.stdout.write(pretty ? JSON.stringify(order, null, 2) : JSON.stringify(order));
  process.stdout.write("\n");
}

main().catch((err) => {
  console.error("执行失败:", err.message);
  process.exit(1);
});
