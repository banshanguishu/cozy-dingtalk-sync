// 测试脚本 - 调用 Webhook 推送订单数据到多维表
require("dotenv").config();
const axios = require("axios");

// 获取钉钉多维表Webhook和keyword
const { DINGTALK_WEBHOOK_URL, DINGTALK_KEYWORD } = process.env;

async function testWebhook() {
  // TODO: 钉钉webhook名称发生了改变，当前测试脚本还未修改正确的webhook值，暂时return
  return
  console.log("🚀 开始测试钉钉 Webhook 推送...");
  console.log(`目标 URL: ${DINGTALK_WEBHOOK_URL}`);

  // 构造测试数据
  // 根据用户描述，需要包含 id 和 name
  // 同时为了满足关键词校验，我们在 payload 中包含关键词
  const payload = {
    devTypeId: "474551189822",
    parentId: "gid://shopify/Order/6684866150718",
    parentName: "2756",
    thirdId: "gid://shopify/LineItem/16296864481598",
    thirdName: "2756-C1",
    createdAt: "2025-12-14",
    updatedAt: "2025-12-15",
    quantity: 2,
    collection: "Layla",
    color: "Mist Blue-L1213",
    width: 25,
    length: 108,
    header: "Triple French Pleat (Bottom)",
    liner: "Unlined",
    tieBack: "No Tieback",
    memoryShape: "Yes",
    roomDescription: "",
    source: "drapery_order_sync",
  };

  console.log("📤 发送 Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(DINGTALK_WEBHOOK_URL, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("\n✅ 推送成功!");
    console.log("状态码:", response.status);
    console.log("响应数据:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("\n❌ 推送失败");
    if (error.response) {
      console.error("状态码:", error.response.status);
      console.error("错误响应:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("错误信息:", error.message);
    }
  }
}

testWebhook();
