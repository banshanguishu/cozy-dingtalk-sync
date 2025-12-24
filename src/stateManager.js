const fs = require("fs");
const path = require("path");

// 状态文件路径
const STATE_FILE = (type) => path.join(__dirname, "..", "sync-time", `.${type}_last_sync_time`);

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
function getLastSyncTime(type) {
  try {    
    const stateFile = STATE_FILE(type);
    
    // 确保目录存在
    ensureDirExists(stateFile);

    // 如果文件不存在，创建并写入当前时间
    if (!fs.existsSync(stateFile)) {
      const now = new Date().toISOString().split('.')[0] + "Z";
      fs.writeFileSync(stateFile, now, "utf8");
      return now;
    }

    const time = fs.readFileSync(stateFile, "utf8").trim();
        console.log("timetime", time);
    // 简单的格式校验，Date.parse()转成时间戳
    if (time && !isNaN(Date.parse(time))) {
      return time;
    }
  } catch (error) {
    console.warn("读取状态文件失败，使用默认时间:", error.message);
  }
  return new Date().toISOString();
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
    // console.log(`状态已更新: ${time}`); // 可选日志
  } catch (error) {
    console.error("更新状态文件失败:", error.message);
  }
}

module.exports = {
  getLastSyncTime,
  updateLastSyncTime,
};
