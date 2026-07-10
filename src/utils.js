/**
 * 使用 ANSI 转义码高亮显示 (Cyan + Bold)
 * @param {String} content
 * @returns
 */
const highlightTerminalContent = (content) => {
  if (!content) return "";
  return `\x1b[36m\x1b[1m ${content} \x1b[0m`;
};

/**
 * 将 Shopify 的 UTC 时间转换为美西时间字符串
 * @param {String} createdAt ISO 8601 时间，例如 2026-03-20T01:27:22Z
 * @param {Boolean} [includeTime=false] 是否附带时分。false 只返回日期 YYYY-MM-DD；true 返回 YYYY-MM-DD HH:mm（24 小时制）
 * @returns {String|null} 美西时间字符串，无效输入返回 null
 */
const formatWestCoastDate = (createdAt, includeTime = false) => {
  if (!createdAt) return null;

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;

  const options = {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  if (includeTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
    options.hourCycle = "h23"; // 24 小时制，规避午夜被格式化为 24:00
  }

  const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  if (!includeTime) return dateStr;
  return `${dateStr} ${get("hour")}:${get("minute")}`;
};

// 测试用例
// const utc = "2026-03-20T01:27:22Z"
// console.log(formatWestCoastDate(utc))       // 2026-03-19
// console.log(formatWestCoastDate(utc, true)) // 2026-03-19 18:27

module.exports = {
  formatWestCoastDate,
  highlightTerminalContent,
};
