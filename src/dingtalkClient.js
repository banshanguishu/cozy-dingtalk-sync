const axios = require("axios");
const { COLLECTION_MAP } = require("./mapping/collectionMap");
const { appendToLog } = require("./fileManager");
require("dotenv").config();

/**
 * 将单个订单推送到钉钉
 * @param {Object} order - Shopify 订单数据
 */
async function pushOrderToDingTalk(order, webhook, orderName, productType) {
  try {
    const response = await axios.post(webhook, order, {
      headers: { "Content-Type": "application/json" },
    });

    // 钉钉接口通常返回 200，即使业务逻辑有误也可能返回 200，需根据实际情况判断
    // 这里假设 HTTP 200 即为成功
    console.log(`✅[DingTalk] 订单 【${orderName}】 【${productType}】 同步成功`);
    return true;
  } catch (error) {
    console.error(`❌[DingTalk] 订单 【${orderName}】 【${productType}】 同步失败:`, error.message);
    return false;
  }
}

/**
 * 批量同步订单到钉钉
 * @param {Array} orders - 订单数组
 */
async function syncOrdersToDingTalk(orders, type) {
  const webhook = COLLECTION_MAP[type].dingtalk_webhook;

  let successCount = 0;
  let failCount = 0;

  // 串行发送，避免触发限流
  for (const order of orders) {
    let orderName = order.thirdName || order.parentName || order.name || "Unknown";
    let productType = "";
    if (type === "secondary_order") {
      orderName = order.parentName || order.name || "Unknown";
      productType = order.productType || "Unknown";
    }
    if (type === "refund") {
      orderName = order.orderName || order.name || "Unknown";
      productType = order.productType || "退款";
    }
    const success = await pushOrderToDingTalk(order, webhook, orderName, productType);

    // 记录文件日志
    const resultStr = success ? "同步成功" : "同步失败";
    const time = new Date().toISOString();

    let logLine = `【${time}】 | 三级单号：${orderName} | 结果：${resultStr}\n`;
    if (type === "secondary_order") {
      logLine = `【${time}】 | 二级单号：${orderName} | 类型：${productType} | 结果：${resultStr}\n`;
    }
    if (type === "refund") {
      logLine = `【${time}】 | 订单号：${orderName} | 类型：${productType} | 退款时间：${order.refundTime || "/"} | 结果：${resultStr}\n`;
    }

    appendToLog("logs", type, logLine, "log");

    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    // 简单的延时，防止请求过快 (可选)
    // await new Promise(resolve => setTimeout(resolve, 200));
  }


  return { successCount, failCount };
}

module.exports = {
  syncOrdersToDingTalk,
};
