require("dotenv").config();

const {
  DINGTALK_WEBHOOK_URL_DRAPERY,
  DINGTALK_WEBHOOK_URL_ROMANSHADE,
  DINGTALK_DRAPERY_KEYWORD,
  DINGTALK_ROMANSHADE_KEYWORD,
  DINGTALK_HARDWARE_KEYWORD,
  DINGTALK_WEBHOOK_URL_HARDWARE,
  DINGTALK_HANWOVENSHADE_KEYWORD,
  DINGTALK_WEBHOOK_URL_HANWOVENSHADE,
  DINGTALK_SECONDARYORDER_KEYWORD,
  DINGTALK_WEBHOOK_URL_SECONDARYORDER,
  DINGTALK_ROLLERBLIND_KEYWORD,
  DINGTALK_OTHERSHADE_KEYWORD,
  DINGTALK_WEBHOOK_URL_ROLLERBLIND,
  DINGTALK_WEBHOOK_URL_OTHERSHADE,
} = process.env;

const COLLECTION_MAP = {
  drapery: {
    id: "474551189822",
    name: "Drapery",
    cnName: "窗帘",
    suffix: "-C",
    sourceKeyWord: DINGTALK_DRAPERY_KEYWORD,
    dingtalk_webhook: DINGTALK_WEBHOOK_URL_DRAPERY,
  },
  roman_shade: {
    id: "492919062846",
    name: "Roman Shades",
    cnName: "罗马帘",
    suffix: "-S",
    sourceKeyWord: DINGTALK_ROMANSHADE_KEYWORD,
    dingtalk_webhook: DINGTALK_WEBHOOK_URL_ROMANSHADE,
  },
  hardware: {
    id: "474667417918",
    name: "Hardware",
    suffix: "-H",
    cnName: "配件",
    sourceKeyWord: DINGTALK_HARDWARE_KEYWORD,
    dingtalk_webhook: DINGTALK_WEBHOOK_URL_HARDWARE,
  },
  free_swatches: {
    id: "499489243454",
    name: "Free Swatches",
    cnName: "样品",
    suffix: "-X",
  },
  hanwoven_shade: {
    id: "492918997310",
    name: "Hanwoven Shade",
    suffix: "-W",
    cnName: "麻草帘",
    sourceKeyWord: DINGTALK_HANWOVENSHADE_KEYWORD,
    dingtalk_webhook: DINGTALK_WEBHOOK_URL_HANWOVENSHADE,
  },
  other_shade: {
    id: "499488358718",
    name: "Other Shade",
    cnName: "其他帘子",
    suffix: "-Q",
    sourceKeyWord: DINGTALK_OTHERSHADE_KEYWORD,
    dingtalk_webhook: DINGTALK_WEBHOOK_URL_OTHERSHADE,
  },
  roller_blind: {
    id: "497516085566",
    name: "Roller Blind",
    cnName: "卷帘",
    suffix: "-R",
    sourceKeyWord: DINGTALK_ROLLERBLIND_KEYWORD,
    dingtalk_webhook: DINGTALK_WEBHOOK_URL_ROLLERBLIND,
  },
  secondary_order: {
    name: "Secondary Order",
    cnName: "二级订单",
    sourceKeyWord: DINGTALK_SECONDARYORDER_KEYWORD,
    dingtalk_webhook: DINGTALK_WEBHOOK_URL_SECONDARYORDER,
  },
};

const COLLECTION_TYPE_IDS = Object.values(COLLECTION_MAP).map((colle) => colle.id).filter(Boolean);

const COLLECTION_TYPE_NAMES = Object.values(COLLECTION_MAP).map((colle) => colle.name);

const COLLECTION_TYPE_NAMES_DEV = Object.keys(COLLECTION_MAP);

const COLLECTION_ID_MAP_CONFIG = Object.values(COLLECTION_MAP).reduce((prev, cur) => {
  if (!cur.id) return prev;
  const { id, ...rest } = cur;
  prev[id] = rest;
  return prev;
}, {});

module.exports = {
  COLLECTION_MAP,
  COLLECTION_TYPE_IDS,
  COLLECTION_TYPE_NAMES,
  COLLECTION_TYPE_NAMES_DEV,
  COLLECTION_ID_MAP_CONFIG,
};
