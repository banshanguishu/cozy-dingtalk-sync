require("dotenv").config();
const { fetchOrdersPage, fetchRefundOrdersPage } = require("./src/shopifyClient");
const { appendToLog } = require("./src/fileManager");
const { syncOrdersToDingTalk } = require("./src/dingtalkClient");
const { getLastSyncTime, updateLastSyncTime } = require("./src/stateManager");
const { buildThirdOrders, buildSecondOrders, buildRefundOrders } = require("./src/buildOrders");
const { COLLECTION_MAP } = require("./src/mapping/collectionMap");
const { validateRuntimeConfig } = require("./src/configValidator");
const { queryExchangeRate } = require("./src/exchangeRate");

// 默认同步类型（由 run 内部统一驱动）
// 从映射中自动收集已完成同步配置的 type，避免新增类型时遗漏
const TYPES_TO_SYNC = Object.entries(COLLECTION_MAP)
  .filter(([type, config]) => type !== "refund" && config && config.sourceKeyWord && config.dingtalk_webhook)
  .map(([type]) => type);
const GLOBAL_CURSOR_KEY = "global";
const REFUND_CURSOR_KEY = "refund";

// 简单的延时函数，防止 API 速率限制
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getMaxFieldTime(orders, fieldName) {
  if (!orders || orders.length === 0) return null;
  return orders.reduce((max, order) => {
    const current = order?.[fieldName];
    return !current || (max && current <= max) ? max : current;
  }, null);
}

function normalizeTypes(types) {
  if (!types) return TYPES_TO_SYNC;
  if (Array.isArray(types)) return types;
  return [types];
}

async function runRefundSync() {
  const refundQueryTime = getLastSyncTime(REFUND_CURSOR_KEY);
  console.log(`🚀 开始退款增量查询，上次退款同步时间点: 【${refundQueryTime}】`);

  let hasNext = true;
  let cursor = null;
  const refundOrders = [];

  try {
    while (hasNext) {
      const { orders, pageInfo } = await fetchRefundOrdersPage(refundQueryTime, cursor);
      refundOrders.push(...orders);

      hasNext = pageInfo.hasNextPage === true;
      if (hasNext) {
        cursor = pageInfo.endCursor;
        await delay(500);
      } else {
        break;
      }
    }

    if (refundOrders.length === 0) {
      console.log("✅ 本轮没有新增退款订单需要查询。");
      return;
    }

    console.log(`✅ Shopify 退款增量订单拉取完成，共【${refundOrders.length}】条候选订单。`);

    const buildedRefundOrders = buildRefundOrders(refundOrders, refundQueryTime, REFUND_CURSOR_KEY);
    if (!buildedRefundOrders.length) {
      console.log("✅ 本轮没有新增退款记录需要同步。");
      return;
    }

    const { successCount, failCount } = await syncOrdersToDingTalk(buildedRefundOrders, REFUND_CURSOR_KEY);
    console.log(`✅ ${successCount}, ❌ ${failCount}`);

    const content = buildedRefundOrders.map((item) => JSON.stringify(item)).join("\n") + "\n";
    appendToLog("output", REFUND_CURSOR_KEY, content, "jsonl");

    const maxRefundTime = getMaxFieldTime(buildedRefundOrders, "refundTime");
    if (maxRefundTime) {
      updateLastSyncTime(maxRefundTime, REFUND_CURSOR_KEY);
      const refundLogLine = `【${new Date().toISOString()}】| 🔄 退款游标已更新至: ${maxRefundTime}\n`;
      appendToLog("logs", REFUND_CURSOR_KEY, refundLogLine, "log");
      console.log(`✅ 退款游标更新至【${maxRefundTime}】`);
    }
  } catch (error) {
    console.error("❌ 退款查询任务异常终止:", error.message);
    throw error;
  }
}

async function runOrderSync(targetTypes) {
  const queryTime = getLastSyncTime(GLOBAL_CURSOR_KEY);
  console.log(`🚀 开始增量查询并分流同步，上次全局同步时间点: 【${queryTime}】`);

  let hasNext = true;
  let cursor = null;
  let pageCount = 0;
  const allOriginOrders = [];
  let usdToRmbRate = null;

  try {
    while (hasNext) {
      pageCount++;
      const { orders: originOrders, pageInfo } = await fetchOrdersPage(queryTime, cursor);
      allOriginOrders.push(...originOrders);

      hasNext = pageInfo.hasNextPage === true;
      if (hasNext) {
        cursor = pageInfo.endCursor;
        await delay(500);
      } else {
        break;
      }
    }

    if (allOriginOrders.length === 0) {
      console.log("✅ 本轮没有新增订单需要同步。");
      return;
    }

    console.log(`✅ Shopify 拉取完成，共【${allOriginOrders.length}】条增量订单，开始分流处理。`);

    if (targetTypes.includes("secondary_order")) {
      try {
        usdToRmbRate = await queryExchangeRate(undefined, "USD", "RMB");
        console.log(`💱 本轮 USD->RMB 汇率: ${usdToRmbRate}`);
      } catch (error) {
        console.warn(`⚠️ 汇率查询失败，本轮 secondary_order 将使用空汇率: ${error.message}`);
      }
    }

    for (const type of targetTypes) {
      const typeName = COLLECTION_MAP[type].cnName || COLLECTION_MAP[type].name;
      console.log(`📮开始分流同步【${typeName}】的订单`);

      const buildedOrder =
        type === "secondary_order" ? buildSecondOrders(allOriginOrders, type, usdToRmbRate) : buildThirdOrders(allOriginOrders, type);

      if (!buildedOrder || buildedOrder.length === 0) {
        console.log(`✅ 没有需要同步的【${typeName}】订单`);
        continue;
      }

      const { successCount, failCount } = await syncOrdersToDingTalk(buildedOrder, type);
      console.log(`✅ ${successCount}, ❌ ${failCount}`);

      const content = buildedOrder.map((item) => JSON.stringify(item)).join("\n") + "\n";
      appendToLog("output", type, content, "jsonl");
    }

    const maxTime = getMaxFieldTime(allOriginOrders, "createdAt");
    if (maxTime) {
      updateLastSyncTime(maxTime, GLOBAL_CURSOR_KEY);
      const logLine = `【${new Date().toISOString()}】| 🔄 全局游标已更新至: ${maxTime}\n`;
      appendToLog("logs", GLOBAL_CURSOR_KEY, logLine, "log");
      console.log(`✅ 全局游标更新至【${maxTime}】`);
    }
  } catch (error) {
    console.error("❌ 任务异常终止:", error.message);
    throw error;
  }
}

/**
 * 同步数据（单次拉取 + 分流处理）
 * @param {string|string[]} [types]
 */
async function run(types) {
  const targetTypes = normalizeTypes(types);
  const hasExplicitTypes = Boolean(types);
  const refundOnly = targetTypes.length === 1 && targetTypes[0] === "refund";

  // 显式指定 type 时，才执行严格配置校验
  if (hasExplicitTypes) {
    validateRuntimeConfig(targetTypes);
  }

  if (refundOnly) {
    return runRefundSync();
  }
  return runOrderSync(targetTypes);
}

// 直接执行脚本时，支持可选 type 参数（兼容本地单类型调试）
const args = process.argv.slice(2);
const inputType = args.length > 1 ? args : args[0];

if (require.main === module) {
  run(inputType).catch((error) => {
    console.error("\n❌ 启动前配置校验或任务执行失败:", error.message);
    process.exit(1);
  });
}

module.exports = {
  run,
};
