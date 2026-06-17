const fs = require("fs");
const path = require("path");

// 状态文件路径
function STATE_FILE(type) {
  if (type === "refund") {
    return path.join(__dirname, "..", ".global_refund_sync_time");
  }
  if (type === "refund_scan") {
    return path.join(__dirname, "..", ".global_refund_scan_time");
  }
  return path.join(__dirname, "..", ".global_last_sync_time");
}

/**
 * 确保文件的目录存在
 * @param {string} filePath
 */
function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 读取上次同步的时间游标
 * @returns {string} ISO 8601 时间字符串
 */
function getLastSyncTime(type, defaultTime) {
  try {
    const stateFile = STATE_FILE(type);

    // 确保目录存在
    ensureDirExists(stateFile);

    const fallbackTime =
      defaultTime && !isNaN(Date.parse(defaultTime)) ? defaultTime : new Date().toISOString().split(".")[0] + "Z";

    // 如果文件不存在，创建并写入当前时间
    if (!fs.existsSync(stateFile)) {
      fs.writeFileSync(stateFile, fallbackTime, "utf8");
      return fallbackTime;
    }

    const time = fs.readFileSync(stateFile, "utf8").trim();
    // 简单格式校验：可被 Date.parse 解析
    if (time && !isNaN(Date.parse(time))) {
      return time;
    }
    fs.writeFileSync(stateFile, fallbackTime, "utf8");
    return fallbackTime;
  } catch (error) {
    console.warn("读取状态文件失败，使用默认时间:", error.message);
  }
  return defaultTime && !isNaN(Date.parse(defaultTime)) ? defaultTime : new Date().toISOString();
}

/**
 * 更新同步时间游标
 * @param {string} time - ISO 8601 时间字符串
 */
function updateLastSyncTime(time, type) {
  try {
    if (!time) return;
    const stateFile = STATE_FILE(type);
    // 确保目录存在
    ensureDirExists(stateFile);
    fs.writeFileSync(stateFile, time, "utf8");
  } catch (error) {
    console.error("更新状态文件失败:", error.message);
  }
}

// 汇率缓存文件：按日期存储成功取到的汇率（{ "2026-06-17": 7.18 }），docker 单文件挂载持久化
const EXCHANGE_RATE_CACHE_FILE = path.join(__dirname, "..", ".global_exchange_rate_cache");

/**
 * 读取按日期存储的汇率缓存 map
 * @returns {Record<string, number>} 读取失败 / 文件为空时返回 {}
 */
function getExchangeRateMap() {
  try {
    if (!fs.existsSync(EXCHANGE_RATE_CACHE_FILE)) return {};
    const raw = fs.readFileSync(EXCHANGE_RATE_CACHE_FILE, "utf8").trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("读取汇率缓存失败:", error.message);
    return {};
  }
}

/**
 * 写入某天的汇率（仅在 rate 为有效数值时写入，null 不落盘）
 * @param {string} date - 日期，格式示例：2026-06-17
 * @param {number} rate
 */
function updateExchangeRateForDate(date, rate) {
  try {
    if (!date || rate == null || !Number.isFinite(Number(rate))) return;
    ensureDirExists(EXCHANGE_RATE_CACHE_FILE);
    const map = getExchangeRateMap();
    map[date] = Number(rate);
    fs.writeFileSync(EXCHANGE_RATE_CACHE_FILE, JSON.stringify(map), "utf8");
  } catch (error) {
    console.error("更新汇率缓存失败:", error.message);
  }
}

module.exports = {
  getLastSyncTime,
  updateLastSyncTime,
  getExchangeRateMap,
  updateExchangeRateForDate,
};
