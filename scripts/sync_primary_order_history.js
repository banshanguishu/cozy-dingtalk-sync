const axios = require("axios");
require("dotenv").config();

const { buildPrimaryOrders } = require("../src/buildOrders");
const { appendToLog } = require("../src/fileManager");

const {
  SHOPIFY_STORE_URL,
  SHOPIFY_ADMIN_API_ACCESS_TOKEN,
  SHOPIFY_API_VERSION,
  DINGTALK_WEBHOOK_URL_PRIMARYORDER_HISTORY,
  DINGTALK_PRIMARYORDER_HISTORY_KEYWORD,
} = process.env;

/**
 * 按 createdAt 时间区间 + limit 分批，把 Shopify 订单构造成「一级订单(primary_order)」结构后推送到钉钉多维表。
 * 通用工具：可用于历史全量回填，也可用于任意时间区间的按需补推 / 重推。
 * 不进调度器、不读写主流程游标（.global_last_sync_time 等）；webhook / keyword 从 .env 读取。
 *
 * 参数：
 *   --start <iso>   起始时间，严格大于（不含该时刻）。必填（或在 CONFIG.startCreatedAt 配置）。
 *   --end   <iso>   截止时间，闭区间（含该时刻）。可选，默认脚本运行时刻。
 *   --limit <n>     本批拉取条数上限，默认 100；计的是“拉取数”（含取消单，取消单不推送），凑够即停、不做同秒补全。
 *   --sync          真正推送到钉钉；不加则干跑（只构造 + 打印前几条样例 + 写 output，不推送）。
 *
 * 分批续跑：每批跑完会打印并写日志「下一批 --start」（= 本批最后一条 createdAt），复制到下批命令即可无缝接续
 *   （严格 > 推进，不重不漏；同秒边界可能漏一两条，业务可接受）。某批拉取不足 limit 即表示区间已到末尾。
 *   跨批可随意改 limit，衔接正确性不受影响。
 *
 * 输出口径：与线上 primary_order 完全一致（每张订单一条、productType 为数组、金额 = 订单总价扣礼品卡），
 *   额外附带字段 westCoastTime（美西日期 YYYY-MM-DD，取自 order.createdAt）。
 *
 * 示例：
 *   node scripts/sync_primary_order_history.js --start "2024-06-01T00:00:00Z" --limit 100          # 干跑预览
 *   node scripts/sync_primary_order_history.js --start "2024-06-01T00:00:00Z" --limit 500 --sync   # 真推
 */

// webhook / keyword 从 .env 读取；时间区间一般用 --start / --end 传入
const CONFIG = {
  historyLogType: "primary_order_history",
  startCreatedAt: "", // 起始时间(严格>)，一般用 --start 传；留空则必须用 --start 指定
  endCreatedAt: "", // 可留空，留空则默认取脚本运行时刻（上界 <=）
  dingtalkWebhookUrl: DINGTALK_WEBHOOK_URL_PRIMARYORDER_HISTORY, // 新多维表 webhook（.env）
  dingtalkSourceKeyword: DINGTALK_PRIMARYORDER_HISTORY_KEYWORD, // 新表同步关键字（.env）
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
        createdAt
        cancelledAt
        email
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        transactions {
          id
          paymentId
          gateway
          kind
          status
          amountSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
        lineItems(first: 50) {
          edges {
            node {
              id
              title
              quantity
              currentQuantity
              product {
                collections(first: 50) {
                  edges {
                    node {
                      id
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
  let sync = false;
  let start = "";
  let end = "";
  let limit = 100;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--sync") {
      sync = true;
      continue;
    }
    if (arg === "--start") {
      start = args[i + 1] || "";
      i++;
      continue;
    }
    if (arg === "--end") {
      end = args[i + 1] || "";
      i++;
      continue;
    }
    if (arg === "--limit") {
      const n = Number(args[i + 1]);
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
      i++;
      continue;
    }
  }
  return { sync, start, end, limit };
}

function validateConfig(startCreatedAt) {
  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_ACCESS_TOKEN) {
    throw new Error("缺少环境变量 SHOPIFY_STORE_URL 或 SHOPIFY_ADMIN_API_ACCESS_TOKEN");
  }
  if (!startCreatedAt || Number.isNaN(Date.parse(startCreatedAt))) {
    throw new Error("请提供合法的起始时间（CONFIG.startCreatedAt 或 --start），例如 2024-06-20T01:49:25Z");
  }
  if (!CONFIG.dingtalkWebhookUrl) {
    throw new Error("请先填写 CONFIG.dingtalkWebhookUrl（新多维表 webhook）");
  }
  if (!CONFIG.dingtalkSourceKeyword) {
    throw new Error("请先填写 CONFIG.dingtalkSourceKeyword（新表同步关键字）");
  }
}

function getApiUrl() {
  const shopUrl = SHOPIFY_STORE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION || "2024-01"}/graphql.json`;
}

// 与 src/shopifyClient.js 对齐的重试策略：网络类错误 + 429/5xx 才重试
const SHOPIFY_MAX_RETRIES = 3;

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

async function postGraphQL(query, variables = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= SHOPIFY_MAX_RETRIES; attempt++) {
    try {
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

      // GraphQL 业务错误（字段/权限等）不属于可重试范畴，直接抛出
      if (response.data?.errors) {
        throw new Error(`GraphQL 查询错误: ${JSON.stringify(response.data.errors)}`);
      }

      return response.data?.data || null;
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === SHOPIFY_MAX_RETRIES) {
        throw error;
      }
      const backoffMs = getBackoffMs(attempt);
      console.warn(
        `⚠️ Shopify 请求失败，准备重试(${attempt}/${SHOPIFY_MAX_RETRIES})，` +
          `code=${error.code || "N/A"} status=${error.response?.status || "N/A"}，等待 ${backoffMs}ms`
      );
      await delay(backoffMs);
    }
  }

  throw lastError || new Error("Shopify 请求失败：未知错误");
}

function buildRangeFilter(startCreatedAt, endCreatedAt) {
  // start 严格 >（下批游标 > 上批末条时间，避免重拉）；end 闭区间 <=
  return `created_at:>'${startCreatedAt}' AND created_at:<='${endCreatedAt}'`;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchOrdersBatch(startCreatedAt, endCreatedAt, limit) {
  const queryFilter = buildRangeFilter(startCreatedAt, endCreatedAt);
  const collected = [];
  let hasNextPage = true;
  let after = null;
  let page = 0;

  const startMs = new Date(startCreatedAt).getTime();
  const endMs = new Date(endCreatedAt).getTime();

  // 凑够 limit 条（拉取数，含取消单）就停；不做同秒补全（同秒边界可能漏一两条，业务可接受）
  while (hasNextPage && collected.length < limit) {
    const data = await postGraphQL(RANGE_QUERY, { query: queryFilter, after });
    const ordersConnection = data?.orders;
    if (!ordersConnection) {
      throw new Error("未获取到 orders 查询结果");
    }

    // 仅按时间过滤：start 严格 >，end 闭 <=；取消单保留在此计入 limit，构造前再剔除
    const pageOrders = (ordersConnection.edges || [])
      .map((edge) => edge.node)
      .filter((order) => {
        const t = new Date(order.createdAt).getTime();
        return t > startMs && t <= endMs;
      });

    collected.push(...pageOrders);
    page++;
    console.log(`  第 ${page} 页：累计拉取 ${collected.length} 条（目标 ${limit}）`);

    hasNextPage = ordersConnection.pageInfo?.hasNextPage === true;
    after = hasNextPage ? ordersConnection.pageInfo?.endCursor || null : null;
    if (hasNextPage && collected.length < limit) await delay(500); // 主动限速
  }

  // 砍到 limit 条为本批；不足 limit 即说明区间已到末尾
  const reachedEnd = collected.length < limit;
  const orders = collected.slice(0, limit);
  const batchMaxCreatedAt = orders.length ? orders[orders.length - 1].createdAt : null;

  return { orders, reachedEnd, batchMaxCreatedAt };
}

async function syncBuiltOrdersToDingTalk(builtOrders) {
  let successCount = 0;
  let failCount = 0;

  for (const order of builtOrders) {
    const orderName = order.name || "Unknown";
    try {
      await axios.post(CONFIG.dingtalkWebhookUrl, order, {
        headers: { "Content-Type": "application/json" },
      });
      successCount++;
      appendToLog(
        "logs",
        CONFIG.historyLogType,
        `【${new Date().toISOString()}】 | 一级单号：${orderName} | 结果：同步成功\n`,
        "log"
      );
    } catch (error) {
      failCount++;
      appendToLog(
        "logs",
        CONFIG.historyLogType,
        `【${new Date().toISOString()}】 | 一级单号：${orderName} | 结果：同步失败 | 原因：${error.message}\n`,
        "log"
      );
    }
    await delay(200); // 串行推送，轻微限速
  }

  return { successCount, failCount };
}

// 下批游标提示（A 方案：打印到控制台 + 写日志，由你手动填到下批 --start）
function reportNextCursor(reachedEnd, batchMaxCreatedAt, fetchedCount, limit) {
  if (reachedEnd) {
    console.log(`🏁 本批拉取 ${fetchedCount} 条（未满 limit ${limit}），已到区间末尾，回填完成。`);
    appendToLog(
      "logs",
      CONFIG.historyLogType,
      `【${new Date().toISOString()}】| 🏁 回填完成（本批拉取 ${fetchedCount} 条，未满 limit ${limit}）\n`,
      "log"
    );
    return;
  }
  console.log(`👉 下一批请用： --start '${batchMaxCreatedAt}'`);
  appendToLog(
    "logs",
    CONFIG.historyLogType,
    `【${new Date().toISOString()}】| ➡️ 下批游标(--start)：${batchMaxCreatedAt}（本批拉取 ${fetchedCount} 条）\n`,
    "log"
  );
}

async function main() {
  const { sync, start, end, limit } = parseArgs(process.argv);

  const startCreatedAt = start || CONFIG.startCreatedAt;
  const endCreatedAt = end || CONFIG.endCreatedAt || new Date().toISOString();

  validateConfig(startCreatedAt);

  console.log("🚀 开始执行 primary_order 历史回填（按 limit 分批）");
  console.log(`🕒 起始时间(严格 >): ${startCreatedAt}`);
  console.log(`🕒 截止时间(<=): ${endCreatedAt}`);
  console.log(`🔢 本批 limit(拉取数): ${limit}`);
  console.log(`📮 实际推送: ${sync ? "开启" : "关闭（干跑）"}`);

  const { orders: batchOrders, reachedEnd, batchMaxCreatedAt } = await fetchOrdersBatch(startCreatedAt, endCreatedAt, limit);

  if (batchOrders.length === 0) {
    console.log("✅ 该区间内已没有订单，回填完成（无需推进游标）。");
    return;
  }

  // limit 计的是“拉取数”（含取消单）；取消单不推送，与线上口径一致
  const activeOrders = batchOrders.filter((o) => o.cancelledAt === null);
  const cancelledOrders = batchOrders.filter((o) => o.cancelledAt !== null);
  const cancelledOrderCount = cancelledOrders.length;
  const cancelledNames = cancelledOrders.map((o) => (o.name || "").replace(/^#/, "")).filter(Boolean);
  console.log(`✅ 本批拉取 ${batchOrders.length} 条（取消单 ${cancelledOrderCount} 条不推送）`);
  if (cancelledOrderCount) {
    console.log(`   ⛔ 被剔除的取消单编号：${cancelledNames.join(", ")}`);
    appendToLog(
      "logs",
      CONFIG.historyLogType,
      `【${new Date().toISOString()}】| ⛔ 本批剔除取消单 ${cancelledOrderCount} 条：${cancelledNames.join(", ")}\n`,
      "log"
    );
  }

  // 逐单构造：复用线上 buildPrimaryOrders（已含 westCoastTime 美西日期），仅把 source 覆盖为 history 表关键字
  const builtOrders = [];
  for (const o of activeOrders) {
    const [item] = buildPrimaryOrders([o], "primary_order");
    if (!item) continue; // 无有效 lineItem 的订单会被 build 跳过
    builtOrders.push({
      ...item,
      source: CONFIG.dingtalkSourceKeyword,
    });
  }

  console.log(`✅ 构造出的一级订单数: ${builtOrders.length}`);

  if (builtOrders.length) {
    const content = builtOrders.map((item) => JSON.stringify(item)).join("\n") + "\n";
    appendToLog("output", CONFIG.historyLogType, content, "jsonl");
  }

  if (!sync) {
    console.log("ℹ️ 当前为干跑模式，未推送到钉钉。样例（前 3 条）：");
    console.log(JSON.stringify(builtOrders.slice(0, 3), null, 2));
    console.log(
      JSON.stringify(
        {
          startCreatedAt,
          endCreatedAt,
          limit,
          fetchedCount: batchOrders.length,
          cancelledOrderCount,
          builtOrderCount: builtOrders.length,
          reachedEnd,
          nextStart: reachedEnd ? null : batchMaxCreatedAt,
        },
        null,
        2
      )
    );
    reportNextCursor(reachedEnd, batchMaxCreatedAt, batchOrders.length, limit);
    return;
  }

  if (builtOrders.length) {
    const { successCount, failCount } = await syncBuiltOrdersToDingTalk(builtOrders);
    console.log(`✅ 同步完成：成功 ${successCount}，失败 ${failCount}`);
  } else {
    console.log("✅ 本批没有需要推送的有效订单。");
  }

  reportNextCursor(reachedEnd, batchMaxCreatedAt, batchOrders.length, limit);
}

main().catch((error) => {
  console.error("❌ 历史回填失败:", error.message);
  process.exit(1);
});
