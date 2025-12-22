/**
 * 使用 ANSI 转义码高亮显示 (Cyan + Bold)
 * @param {String} content
 * @returns
 */
const highlightTerminalContent = (content) => {
  if (!content) return "";
  return `\x1b[36m\x1b[1m ${content} \x1b[0m`;
};

module.exports = {
  highlightTerminalContent,
};
