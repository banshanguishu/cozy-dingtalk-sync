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
    id: "481652998462",
    name: "Free Swatches",
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
  accessories: {
    id: "495589982526",
    name: "Accessories",
    suffix: "-O",
  },
};

const COLLECTION_TYPE_IDS = Object.values(COLLECTION_MAP).map((colle) => colle.id);

const COLLECTION_TYPE_NAMES = Object.values(COLLECTION_MAP).map((colle) => colle.name);

const COLLECTION_TYPE_NAMES_DEV = Object.keys(COLLECTION_MAP);

module.exports = {
  COLLECTION_MAP,
  COLLECTION_TYPE_IDS,
  COLLECTION_TYPE_NAMES,
  COLLECTION_TYPE_NAMES_DEV,
};
