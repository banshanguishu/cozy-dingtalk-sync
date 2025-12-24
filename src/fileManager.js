const fs = require('fs');
const path = require('path');

// 默认三级单号数据输出目录
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

// 默认日志输出目录
const LOGS_DIR = path.join(__dirname, '..', 'logs');

/**
 * 追加写入文件（通用方法）
 * @param {string} type - 'logs' | 'output' (默认 'output')
 * @param {string} syncType - 同步类型 (例如 'drapery' 或 'roman_shade')
 * @param {string} data - 要追加的原始字符串数据
 * @param {string} extension - 文件扩展名 (默认 'jsonl'，日志建议用 'log')
 */
function appendToLog(type = 'output', syncType, data, extension = 'jsonl') {
  const baseDir = type === 'logs' ? LOGS_DIR : OUTPUT_DIR;

  // 确保目录存在
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  
  // 动态生成文件名: YYYY-MM-DD_{syncType}_sync.{extension}
  const dateStr = new Date().toISOString().split("T")[0];
  const fileName = `${dateStr}_${syncType}_sync.${extension}`;
  const filePath = path.join(baseDir, fileName);

  try {
    fs.appendFileSync(filePath, data, 'utf8');
    // 只有在 output 模式下才打印详细路径，避免日志模式刷屏
    if (type === 'output') {
      console.log(`📋 数据已追加到文件: ${filePath}\n`);
    }
    return filePath;
  } catch (error) {
    console.error(`❌ 追加文件失败: ${error.message}\n`);
    return null; 
  }
}

module.exports = {
  appendToLog
};
