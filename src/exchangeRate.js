const axios = require("axios");
const { getExchangeRateMap, updateExchangeRateForDate } = require("./stateManager");

const EXCHANGE_RATE_API_URL = "http://192.168.1.252:5000/omc/doService";

// 当天取不到汇率时，最多向前回退几天到缓存里找第一个非空值
const MAX_FALLBACK_DAYS = 5;
const toDateString = (d) => d.toISOString().slice(0, 10);
const isValidRate = (v) => v != null && Number.isFinite(Number(v));

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
    timeout: 5000, // 服务宕机时（如断电）快速失败，避免卡住整轮同步，立即走缓存回退
  });

  const result = response.data;
  if (result && result.code === 200) {
    return result.data?.rate ?? null;
  }
  return null;
}

/**
 * 解析当前轮次的 USD->RMB 汇率（带按日期缓存 + 最多 5 天回退兜底）
 * - 当天已有非空缓存：直接返回，不调接口（同一天只请求一次）
 * - 当天无缓存：调接口，非空则写入缓存并返回；返回 null 不落盘（保留当天重试/自愈能力）
 * - 当天为 null：按天递减最多 MAX_FALLBACK_DAYS，取缓存中第一个非空值
 * - 都没有：返回 null
 * @returns {Promise<number|null>}
 */
async function resolveUsdToRmbRate() {
  const today = new Date();
  const todayStr = toDateString(today);
  const map = getExchangeRateMap();

  // 1) 当天缓存命中（非空）→ 直接用，不调接口
  if (isValidRate(map[todayStr])) {
    return Number(map[todayStr]);
  }

  // 2) 当天无缓存 → 调接口；非空写入缓存，null 不写
  try {
    const rate = await queryExchangeRate(todayStr, "USD", "RMB");
    if (isValidRate(rate)) {
      updateExchangeRateForDate(todayStr, rate);
      return Number(rate);
    }
  } catch (error) {
    console.warn(`⚠️ 汇率查询异常(${todayStr}): ${error.message}`);
  }

  // 3) 当天为 null → 纯查缓存，按天递减找第一个非空值
  for (let offset = 1; offset <= MAX_FALLBACK_DAYS; offset++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - offset);
    const dateStr = toDateString(d);
    if (isValidRate(map[dateStr])) {
      console.warn(`⚠️ 当天汇率缺失，回退使用 ${dateStr} 的汇率: ${map[dateStr]}`);
      return Number(map[dateStr]);
    }
  }

  // 4) 最近 MAX_FALLBACK_DAYS 天内均无可用汇率
  console.error(`🚨 汇率不可用且最近 ${MAX_FALLBACK_DAYS} 天无缓存，本轮 usdToRmbRate = null`);
  return null;
}

module.exports = {
  queryExchangeRate,
  resolveUsdToRmbRate,
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
