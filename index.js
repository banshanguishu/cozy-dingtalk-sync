require("dotenv").config();
const { fetchOrdersPage } = require("./src/shopifyClient");
const { appendToLog } = require("./src/fileManager");
const { syncOrdersToDingTalk } = require("./src/dingtalkClient");
const { getLastSyncTime, updateLastSyncTime } = require("./src/stateManager");
const { buildThirdOrders, buildSecondOrders } = require("./src/buildOrders");
const { COLLECTION_TYPE_NAMES_DEV, COLLECTION_MAP } = require("./src/mapping/collectionMap");
const { validateRuntimeConfig } = require("./src/configValidator");

// 默认同步类型（由 run 内部统一驱动）
const TYPES_TO_SYNC = ["drapery", "roman_shade", "hardware", "hanwoven_shade", "secondary_order"];
const GLOBAL_CURSOR_KEY = "global";

// 简单的延时函数，防止 API 速率限制
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 从订单列表中找出最大的 createdAt
 * @param {Array} orders
 */
function getMaxCreatedAt(orders) {
  if (!orders || orders.length === 0) return null;
  return orders.reduce((max, order) => {
    return !max || order.createdAt > max ? order.createdAt : max;
  }, null);
}

function normalizeTypes(types) {
  if (!types) return TYPES_TO_SYNC;
  if (Array.isArray(types)) return types;
  return [types];
}

/**
 * 同步数据（单次拉取 + 分流处理）
 * @param {string|string[]} [types]
 */
async function run(types) {
  const targetTypes = normalizeTypes(types);

  if (!targetTypes.length) {
    console.log("\n❌ 缺少需要同步的类型，程序终止！\n");
    return;
  }

  for (const type of targetTypes) {
    if (!COLLECTION_TYPE_NAMES_DEV.includes(type)) {
      console.log(`\n❌ 类型不正确: ${type}，程序终止！\n`);
      return;
    }
  }

  // 运行前校验当前任务所需配置
  validateRuntimeConfig(targetTypes);

  console.log(`\n🚀 开始增量查询并分流同步，类型: ${targetTypes.join(", ")}\n`);

  // 1. 读取全局游标，作为本轮唯一查询基准
  const queryTime = getLastSyncTime(GLOBAL_CURSOR_KEY);
  console.log(`📮 上次全局同步时间点: ${queryTime} (本次查询基准，每页查询 50 条)\n`);

  let hasNext = true;
  let cursor = null;
  let pageCount = 0;
  const allOriginOrders = [];

  try {
    // 2. 单次分页拉取 Shopify 增量订单
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
      console.log("✅ 本轮没有新增订单需要同步。\n");
      return;
    }

    console.log(`✅ Shopify 拉取完成，共 ${allOriginOrders.length} 条增量订单，开始分流处理。\n`);

    // 3. 按 type 分流并复用现有构造/推送/日志逻辑
    for (const type of targetTypes) {
      const typeName = COLLECTION_MAP[type].cnName || COLLECTION_MAP[type].name;
      console.log(`------------> 正在同步: ${type} (${typeName})`);

      const buildedOrder =
        type === "secondary_order"
          ? buildSecondOrders(allOriginOrders, type)
          : buildThirdOrders(allOriginOrders, type);

      if (!buildedOrder || buildedOrder.length === 0) {
        console.log(`✅ ${type} 无需同步的数据\n`);
        continue;
      }

      await syncOrdersToDingTalk(buildedOrder, type);

      const content = buildedOrder.map((item) => JSON.stringify(item)).join("\n") + "\n";
      appendToLog("output", type, content, "jsonl");

      console.log(`<------------ 完成同步: ${type}\n`);
    }

    // 4. 整轮成功后，推进全局游标
    const maxTime = getMaxCreatedAt(allOriginOrders);
    if (maxTime) {
      updateLastSyncTime(maxTime, GLOBAL_CURSOR_KEY);
      const logLine = `【${new Date().toISOString()}】| 🔄 全局游标已更新至: ${maxTime}\n`;
      appendToLog("logs", GLOBAL_CURSOR_KEY, logLine, "log");
      console.log(`✅ 全局游标更新完成: ${maxTime}\n`);
    }
  } catch (error) {
    console.error("\n❌ 任务异常终止:", error.message);
    throw error;
  }
}

// 直接执行脚本时，支持可选 type 参数（兼容本地单类型调试）
const args = process.argv.slice(2);
const inputType = args[0];

if (require.main === module) {
  run(inputType).catch((error) => {
    console.error("\n❌ 启动前配置校验或任务执行失败:", error.message);
    process.exit(1);
  });
}

module.exports = {
  run,
};
