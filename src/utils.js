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
 * 将 Shopify 的 UTC 时间转换为美西日期字符串
 * @param {String} createdAt ISO 8601 时间，例如 2026-03-20T01:27:22Z
 * @returns {String|null} 美西日期，格式 YYYY-MM-DD
 */
const formatWestCoastDate = (createdAt) => {
  if (!createdAt) return null;

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
};

const utc = "2026-03-20T01:27:22Z"
const westCoastDate = formatWestCoastDate(utc)
console.log(westCoastDate)

module.exports = {
  formatWestCoastDate,
  highlightTerminalContent,
};
