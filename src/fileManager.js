const fs = require("fs");
const path = require("path");

// 默认三级单号数据输出目录
const OUTPUT_DIR = path.join(__dirname, "..", "output");

// 默认日志输出目录
const LOGS_DIR = path.join(__dirname, "..", "logs");

/**
 * 追加写入文件（通用方法）
 * @param {string} type - 'logs' | 'output' (默认 'output')
 * @param {string} syncType - 同步类型 (例如 'drapery' 或 'roman_shade')
 * @param {string} data - 要追加的原始字符串数据
 * @param {string} extension - 文件扩展名 (默认 'jsonl'，日志建议用 'log')
 */
function appendToLog(type = "output", syncType, data, extension = "jsonl") {
  const baseDir = type === "logs" ? LOGS_DIR : OUTPUT_DIR;

  // 确保目录存在
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // logs 目录按类型固定文件名，避免按日期不断生成新文件
  const fileName =
    type === "logs" ? `${syncType}_sync.${extension}` : `${new Date().toISOString().split("T")[0]}_${syncType}_sync.${extension}`;
  const filePath = path.join(baseDir, fileName);

  try {
    fs.appendFileSync(filePath, data, "utf8");
    // 只有在 output 模式下才打印详细路径，避免日志模式刷屏
    if (type === "output") {
      console.log(`📋 数据已追加到文件: ${filePath}`);
    }
    return filePath;
  } catch (error) {
    console.error(`❌ 追加文件失败: ${error.message}`);
    return null;
  }
}

module.exports = {
  appendToLog,
};
