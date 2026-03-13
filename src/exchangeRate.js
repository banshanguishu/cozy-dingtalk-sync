const axios = require("axios");

const EXCHANGE_RATE_API_URL = "http://192.168.1.252:5000/omc/doService";

/**
 * 查询汇率
 * @param {string} [inputDate] - 日期，格式示例：2026-03-13，默认当天
 * @param {string} [currency="USD"] - 源币种
 * @param {string} [targetCurrency="RMB"] - 目标币种
 * @returns {Promise<any>}
 */
async function queryExchangeRate(inputDate, currency = "USD", targetCurrency = "RMB") {
  const dateString = inputDate || new Date().toISOString().slice(0, 10);
  if (typeof dateString !== "string") {
    throw new Error("dateString must be a string");
  }

  const requestTime = Math.floor(Date.now() / 1000);
  const salt = Math.random().toString().substr(2, 6);

  const dataObject = {
    dateString,
    currency,
    targetCurrency,
    username: "",
    comradesName: "",
    os: "web",
    token: "",
    uid: 300922,
    guid: "web",
    channel: "web",
  };

  const payload = {
    data: JSON.stringify(dataObject),
    salt,
    service: "exchangeRateService",
    test: true,
    time: requestTime,
    version: "1.0",
    token: "",
  };

  const response = await axios.post(EXCHANGE_RATE_API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = response.data;
  if (result && result.code === 200) {
    return result.data?.rate ?? null;
  }
  return null;
}

module.exports = {
  queryExchangeRate,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const dateString = args[0];
  const currency = args[1] || "USD";
  const targetCurrency = args[2] || "RMB";
  queryExchangeRate(dateString, currency, targetCurrency)
    .then((data) => {
      console.log(JSON.stringify(data, null, 2));
    })
    .catch((error) => {
      const msg = error?.response?.data || error?.message || String(error);
      console.error("❌ queryExchangeRate failed:", typeof msg === "string" ? msg : JSON.stringify(msg, null, 2));
      console.error("Usage: node src/exchangeRate.js [dateString] [currency] [targetCurrency]");
      process.exit(1);
    });
}
