const { COLLECTION_MAP, COLLECTION_TYPE_NAMES_DEV } = require("./mapping/collectionMap");

function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeTypes(types) {
  if (Array.isArray(types)) return types;
  if (!types) return [];
  return [types];
}

function validateRuntimeConfig(types) {
  const targetTypes = normalizeTypes(types);
  const errors = [];

  if (targetTypes.length === 0) {
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

    // 二级订单同步类型，不需要校验id和suffix
    const isSecOrder = type === "secondary_order";

    if (!isSecOrder && !hasText(config.id)) {
      errors.push(`Type "${type}" missing collection id`);
    }
    if (!isSecOrder && !hasText(config.suffix)) {
      errors.push(`Type "${type}" missing suffix`);
    }
    if (!hasText(config.sourceKeyWord)) {
      errors.push(`Type "${type}" missing source keyword env mapping`);
    }
    if (!hasText(config.dingtalk_webhook)) {
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

