const axios = require("axios");

// 填写实际 webhook
const WEBHOOK_URL = "https://connector.dingtalk.com/webhook/flow/1037edb1ecb82107e07b000x";

// 填写实际推送参数
const PAYLOAD = {
    thirdName: "3909-C1",
    discountCode: "JKKSS;ASD",
    source: "drapery_update"
};

async function main() {
  if (!WEBHOOK_URL) {
    throw new Error("请先填写 WEBHOOK_URL");
  }

  const response = await axios.post(WEBHOOK_URL, PAYLOAD, {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });

  console.log("✅ 钉钉请求已发送");
  console.log(JSON.stringify(response.data, null, 2));
}

main().catch((error) => {
  if (error.response) {
    console.error("❌ 钉钉请求失败:", error.response.status, JSON.stringify(error.response.data));
    process.exit(1);
  }

  console.error("❌ 钉钉请求失败:", error.message);
  process.exit(1);
});
