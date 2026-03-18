const { COLLECTION_MAP, COLLECTION_TYPE_NAMES_DEV } = require("./mapping/collectionMap");

function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function validateRuntimeConfig(targetTypes) {
  const errors = [];

  if (!Array.isArray(targetTypes) || targetTypes.length === 0) {
    errors.push("Missing sync types for config validation");
  }

  for (const type of targetTypes) {
    if (!COLLECTION_TYPE_NAMES_DEV.includes(type)) {
      errors.push(`Invalid sync type: ${type}`);
    }
  }

  const requiredEnvKeys = ["SHOPIFY_STORE_URL", "SHOPIFY_ADMIN_API_ACCESS_TOKEN"];
  for (const key of requiredEnvKeys) {
    if (!hasText(process.env[key])) {
      errors.push(`Missing env: ${key}`);
    }
  }

  for (const type of targetTypes) {
    const config = COLLECTION_MAP[type];
    if (!config) continue;

    // secondary_order / others / refund 不是按固定 collection id 匹配，不校验 id
    const isNoCollectionIdType = type === "secondary_order" || type === "others" || type === "refund";
    const isNoSuffixType = type === "secondary_order" || type === "refund";
    const isRefund = type === "refund";

    if (!isNoCollectionIdType && !hasText(config.id)) {
      errors.push(`Type "${type}" missing collection id`);
    }
    if (!isNoSuffixType && !hasText(config.suffix)) {
      errors.push(`Type "${type}" missing suffix`);
    }
    if (!isRefund && !hasText(config.sourceKeyWord)) {
      errors.push(`Type "${type}" missing source keyword env mapping`);
    }
    if (!isRefund && !hasText(config.dingtalk_webhook)) {
      errors.push(`Type "${type}" missing dingtalk webhook env mapping`);
    }
  }

  if (errors.length > 0) {
    const detail = errors.map((msg, index) => `${index + 1}. ${msg}`).join("\n");
    throw new Error(`Configuration validation failed:\n${detail}`);
  }
}

module.exports = {
  validateRuntimeConfig,
};
