const fs = require("fs");
const path = require("path");

// 状态文件路径
const STATE_FILE = (type) => path.join(__dirname, "..", `.${type}_last_sync_time`);

// 默认初始时间 (如果从未同步过)
// 不同类型不同默认初始时间
const DEFAULT_START_TIME = {
  drapery: "2025-12-11T00:00:00Z",
};

/**
 * 读取上次同步的时间游标
 * @returns {string} ISO 8601 时间字符串
 */
function getLastSyncTime(type) {
  try {
    const stateFile = STATE_FILE(type)
    if (fs.existsSync(stateFile)) {
      const time = fs.readFileSync(stateFile, "utf8").trim();
      // 简单的格式校验，Date.parse()转成时间戳
      if (time && !isNaN(Date.parse(time))) {
        return time;
      }
    }
  } catch (error) {
    console.warn("读取状态文件失败，使用默认时间:", error.message);
  }
  return DEFAULT_START_TIME[type];
}

/**
 * 更新同步时间游标
 * @param {string} time - ISO 8601 时间字符串
 */
function updateLastSyncTime(time, type) {
  try {
    if (!time) return;
    fs.writeFileSync(STATE_FILE(type), time, "utf8");
    // console.log(`状态已更新: ${time}`); // 可选日志
  } catch (error) {
    console.error("更新状态文件失败:", error.message);
  }
}

module.exports = {
  getLastSyncTime,
  updateLastSyncTime,
};

