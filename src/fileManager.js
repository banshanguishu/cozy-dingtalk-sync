const fs = require('fs');
const path = require('path');

// 默认输出目录
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

/**
 * 确保输出目录存在
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * 追加写入日志文件
 * @param {string} fileName - 文件名 (例如 'sync_log.jsonl')
 * @param {Array} data - 要追加的数据数组
 */
function appendToLog(fileName, data) {
  ensureOutputDir();
  
  const filePath = path.join(OUTPUT_DIR, fileName);
  try {
    // 使用 JSONL 格式 (每行一个 JSON 对象)，方便追加和读取
    const content = data.map(item => JSON.stringify(item)).join('\n') + '\n';
    
    fs.appendFileSync(filePath, content, 'utf8');
    console.log(`📋 数据已追加到日志: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`❌ 追加日志失败: ${error.message}`);
    // 日志写入失败不应阻断主流程
    return null; 
  }
}

module.exports = {
  appendToLog
};
