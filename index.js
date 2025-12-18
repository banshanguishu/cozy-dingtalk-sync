require("dotenv").config();
const { fetchOrdersPage } = require("./src/shopifyClient");
const { appendToLog } = require("./src/fileManager");
const { syncOrdersToDingTalk } = require("./src/dingtalkClient");
const { getLastSyncTime, updateLastSyncTime } = require("./src/stateManager");
const { buildThirdOrders } = require("./src/buildThirdOrders")
const { COLLECTION_TYPE_NAMES_DEV } = require("./src/mapping/collectionMap")

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

/**
 * 同步数据
 * @param {*} type
 * type.drapery
 * type.roman_shade
 */
async function run(type) {
  if (!type || !COLLECTION_TYPE_NAMES_DEV.includes(type)) {
    console.log("❌ 缺少collection type字段或者字段值不正确，程序终止！");
    return;
  }
  console.log(`🚀 开始增量 ${type} 同步任务...`);

  // 1. 获取一次 当前type类型 同步的时间点，并锁定作为本次运行的查询基准
  let lastSyncTime = getLastSyncTime(type);
  const queryTime = lastSyncTime;

  console.log(`📅 ${type}上次同步时间点: ${queryTime} (本次查询基准)`);

  let hasNext = true;
  let cursor = null;
  let totalProcessed = 0;
  let pageCount = 0;

  try {
    while (hasNext) {
      pageCount++;
      console.log(`\n📄 正在处理 ${type} 第 ${pageCount} 页 (Cursor: ${cursor ? "..." + cursor.slice(-10) : "Start"})...`);

      // 2. 拉取一页数据
      const { orders: originOrders, pageInfo } = await fetchOrdersPage(queryTime, cursor, type);

      if (originOrders.length === 0) {
        console.log("✅ 没有更多新订单需要同步。");
        break;
      }

      // console.log(`📥 ${type} 第 ${pageCount} 页获取到 ${originOrders.length} 个订单，pageInfo为：${JSON.stringify(pageInfo)}`);

      // 组装数据为对应type多维表所需要格式(细化到三级)
      const thirdOrders = buildThirdOrders(originOrders, type)

      if (thirdOrders.length === 0) {
        console.log("✅ 没有更多三级单号新订单需要同步。");
        break;
      }

      // 3. 推送到钉钉
      await syncOrdersToDingTalk(thirdOrders);

      // 4. 追加日志，原始订单数据和组装后数据 (本地存档)
      const originLogFileName = `${new Date().toISOString().split("T")[0]}_sync_log.jsonl`;
      appendToLog(originLogFileName, originOrders);
      const buildlLogFileName = `${new Date().toISOString().split("T")[0]}_${type}_sync_log.jsonl`;
      appendToLog(buildlLogFileName, thirdOrders);

      // 5. 更新时间游标 (关键!)
      // 取本页中最新的时间，立即更新到文件，确保断点续传
      const maxTime = getMaxCreatedAt(originOrders);
      if (maxTime) {
        updateLastSyncTime(maxTime, type);
        lastSyncTime = maxTime; // 更新内存变量
        console.log(`🔖 ${type} 游标已更新至: ${maxTime}`);
      }

      totalProcessed += originOrders.length;

      // 准备下一页
      hasNext = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;

      if (hasNext) {
        // 稍微休息一下，避免触发 API 速率限制
        await delay(500);
      }
    }

    // console.log(`\n✅ 同步完成! 共处理 ${totalProcessed} 个订单。`);
  } catch (error) {
    console.error("\n❌ 任务异常终止:", error.message);
    process.exit(1);
  }
}

run("drapery")
