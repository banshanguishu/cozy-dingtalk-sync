const axios = require("axios");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
require("dotenv").config();

/**
 * 用法：
 * node scripts/test_refund_sync.js
 * node scripts/test_refund_sync.js 6811244527934
 * node scripts/test_refund_sync.js 6811244527934 --cursor 2026-03-18T10:00:00Z
 * node scripts/test_refund_sync.js 6811244527934 --cursor 2026-03-18T10:00:00Z --sync
 */

const { buildRefundOrders } = require("../src/buildOrders");

const { SHOPIFY_STORE_URL, SHOPIFY_ADMIN_API_ACCESS_TOKEN, SHOPIFY_API_VERSION } = process.env;
const TEST_WEBHOOK_FILE = path.join(process.cwd(), ".env.test.local");

const DEFAULT_ORDER_ID = "6811244527934";
const DEFAULT_TYPE = "refund";

const ORDER_QUERY = `
query($id: ID!) {
  order(id: $id) {
    id
    name
    updatedAt
    refunds(first: 50) {
      edges {
        node {
          id
          legacyResourceId
          createdAt
          updatedAt
          note
          totalRefundedSet {
            shopMoney {
              amount
              currencyCode
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
  let pretty = true;
  let sync = false;
  let refundCursor = "";

  const positionalArgs = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--compact") {
      pretty = false;
      continue;
    }
    if (arg === "--sync") {
      sync = true;
      continue;
    }
    if (arg === "--cursor" && i + 1 < args.length) {
      refundCursor = args[++i];
      continue;
    }
    positionalArgs.push(arg);
  }

  if (positionalArgs[0]) orderId = positionalArgs[0];

  return { orderId, pretty, sync, refundCursor };
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

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  return dotenv.parse(raw);
}

function getRefundTestWebhook() {
  const envMap = parseEnvFile(TEST_WEBHOOK_FILE);
  return String(envMap.DINGTALK_WEBHOOK_URL_REFUND || "").trim();
}

async function syncRefundsToDingTalk(refunds) {
  const webhook = getRefundTestWebhook();
  if (!webhook) {
    throw new Error("未在 .env.test.local 中配置 DINGTALK_WEBHOOK_URL_REFUND");
  }

  let successCount = 0;
  let failCount = 0;

  for (const refund of refunds) {
    try {
      await axios.post(webhook, refund, {
        headers: { "Content-Type": "application/json" },
      });
      successCount++;
    } catch (error) {
      failCount++;
      console.error(`❌ 退款同步失败: ${refund.orderName || "Unknown"} | ${error.message}`);
    }
  }

  return { successCount, failCount };
}

async function main() {
  const { orderId: rawOrderId, pretty, sync, refundCursor } = parseArgs(process.argv);
  const orderId = normalizeOrderId(rawOrderId);

  validateEnv();
  console.log(`🔍 测试订单: ${orderId}`);
  console.log(`🔀 测试类型: ${DEFAULT_TYPE}`);
  console.log(`🕒 退款游标: ${refundCursor || "(空，表示不过滤)"}`);

  const order = await fetchOrder(orderId);
  if (!order) {
    throw new Error("未找到目标订单，请确认订单ID");
  }

  const builtRefunds = buildRefundOrders([order], refundCursor, DEFAULT_TYPE);
  const result = {
    orderId,
    orderName: order.name,
    type: DEFAULT_TYPE,
    refundCursor: refundCursor || null,
    syncEnabled: sync,
    matchedCount: builtRefunds.length,
    builtOrders: builtRefunds,
  };

  if (sync) {
    if (!fs.existsSync(TEST_WEBHOOK_FILE)) {
      throw new Error(`缺少测试 webhook 配置文件: ${TEST_WEBHOOK_FILE}`);
    }
    const syncResult = await syncRefundsToDingTalk(builtRefunds);
    result.syncResult = syncResult;
  }

  console.log(pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result));
}

main().catch((error) => {
  console.error("❌ 测试失败:", error.message);
  process.exit(1);
});
