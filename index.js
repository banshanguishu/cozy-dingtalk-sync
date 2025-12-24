require("dotenv").config();
const { fetchOrdersPage } = require("./src/shopifyClient");
const { appendToLog } = require("./src/fileManager");
const { syncOrdersToDingTalk } = require("./src/dingtalkClient");
const { getLastSyncTime, updateLastSyncTime } = require("./src/stateManager");
const { buildThirdOrders } = require("./src/buildThirdOrders");
const { COLLECTION_TYPE_NAMES_DEV, COLLECTION_MAP } = require("./src/mapping/collectionMap");
const { highlightTerminalContent } = require("./src/utlis");

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
    console.log("\n❌ 缺少collection type字段或者字段值不正确，程序终止！\n");
    return;
  }
  const typeName = highlightTerminalContent(COLLECTION_MAP[type].cnName || COLLECTION_MAP[type].name);

  console.log(`\n🚀 开始增量查询${typeName}同步任务...\n`);

  // 1. 获取一次 当前type类型 同步的时间点，并锁定作为本次运行的查询基准
  let lastSyncTime = getLastSyncTime(type);
  const queryTime = lastSyncTime;

  console.log(`📅 上次${typeName}同步时间点: ${highlightTerminalContent(queryTime)} (本次查询基准，每页查询50条)\n`);

  let hasNext = true;
  let cursor = null;
  let totalProcessed = 0;
  let pageCount = 0;

  try {
    while (hasNext) {
      pageCount++;
      // console.log(`📄 正在处理 ${type} 第 ${pageCount} 页 (Cursor: ${cursor ? "..." + cursor.slice(-10) : "Start"})...`);

      // 2. 拉取一页数据
      const { orders: originOrders, pageInfo } = await fetchOrdersPage(queryTime, cursor, type);

      // console.log(`📥 ${type} 第 ${pageCount} 页获取到 ${originOrders.length} 个订单，pageInfo为：${JSON.stringify(pageInfo)}`);

      // 组装数据为对应type多维表所需要格式(细化到三级)
      const thirdOrders = buildThirdOrders(originOrders, type);

      if (thirdOrders.length === 0) {
        // ⚠️
        console.log(`✅ 第 ${pageCount} 页没有更多符合要求的三级订单\n`);
      } else {
        // 3. 推送到钉钉
        await syncOrdersToDingTalk(thirdOrders, type);
      }

      // 4. 追加日志，组装后数据 (本地存档)
      if (thirdOrders.length > 0) {
        // 转换数据格式
        const content = thirdOrders.map((item) => JSON.stringify(item)).join("\n") + "\n";
        appendToLog("output", type, content, "jsonl");
      }

      // 5. 更新时间游标 (关键!)
      // 取本页中最新的时间，立即更新到文件，确保断点续传。（注意：使用的是原始订单数据，而非构造的三级订单）
      const maxTime = getMaxCreatedAt(originOrders);
      if (maxTime) {
        updateLastSyncTime(maxTime, type);
        lastSyncTime = maxTime; // 更新内存变量
        const logLine = `[${new Date().toISOString().split("T")[0]}] | 🔖 ${typeName} 游标已更新至: ${maxTime}\n`;
        appendToLog("logs", type, logLine, "log"); // 添加游标更新日志
      }

      totalProcessed += originOrders.length;

      // 准备下一页
      hasNext = pageInfo.hasNextPage === true; // 强制转换为布尔值，防止 undefined/"false" 等意外

      if (hasNext) {
        cursor = pageInfo.endCursor;
        // 稍微休息一下，避免触发 API 速率限制
        await delay(500);
      } else {
        console.log("✅ 没有更多新订单需要同步。\n");
        break; // 显式退出循环，双重保险
      }
    }

    // console.log(`\n✅ 同步完成! 共处理 ${totalProcessed} 个订单。`);
  } catch (error) {
    console.error("\n❌ 任务异常终止:", error.message);
    process.exit(1);
  }
}

// html调用方式，获取命令行参数，默认为 drapery
const args = process.argv.slice(2);
const type = args[0] || "drapery";

// 如果是直接执行该脚本，则运行
if (require.main === module) {
  run(type);
}

module.exports = { run };

// 开发调试，命令行方式
// node index.js roman_shade
// node index.js drapery
