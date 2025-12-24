const axios = require("axios");
const { COLLECTION_MAP } = require("./mapping/collectionMap");
const { highlightTerminalContent } = require("./utlis");
const { appendToLog } = require("./fileManager");
require("dotenv").config();

/**
 * 将单个订单推送到钉钉
 * @param {Object} order - Shopify 订单数据
 */
async function pushOrderToDingTalk(order, webhook) {
  try {
    const response = await axios.post(webhook, order, {
      headers: { "Content-Type": "application/json" },
    });

    // 钉钉接口通常返回 200，即使业务逻辑有误也可能返回 200，需根据实际情况判断
    // 这里假设 HTTP 200 即为成功
    console.log(`[DingTalk] ✅ 订单 ${highlightTerminalContent(order.thirdName || order.parentName)} 同步成功`);
    return true;
  } catch (error) {
    console.error(`[DingTalk] ❌ 订单 ${order.name} 同步失败:`, error.message);
    if (error.response) {
      console.error("响应详情:", JSON.stringify(error.response.data));
    }
    return false;
  }
}

/**
 * 批量同步订单到钉钉
 * @param {Array} orders - 订单数组
 */
async function syncOrdersToDingTalk(orders, type) {
  const webhook = COLLECTION_MAP[type].dingtalk_webhook;
  if (!webhook) {
    console.warn(`⚠️ 未配置 ${type} 的 webhook，跳过钉钉同步。`);
    return false;
  }
  console.log(`开始同步 ${highlightTerminalContent(orders.length)} 个订单到钉钉...`);

  let successCount = 0;
  let failCount = 0;

  // 串行发送，避免触发限流
  for (const order of orders) {
    const success = await pushOrderToDingTalk(order, webhook);
    
    // 记录文件日志
    const orderName = order.thirdName || order.parentName || order.name || "Unknown";
    const resultStr = success ? "同步成功" : "同步失败";
    const time = new Date().toISOString();
    const logLine = `[${time}] | 三级单号：${orderName} | 结果：${resultStr}\n`;
    
    appendToLog('logs', type, logLine, 'log');

    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    // 简单的延时，防止请求过快 (可选)
    // await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`钉钉同步完成: ✅ ${successCount}, ❌ ${failCount}\n`);
  return { successCount, failCount };
}

module.exports = {
  syncOrdersToDingTalk,
};

