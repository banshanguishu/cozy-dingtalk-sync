require("dotenv").config();

const { DINGTALK_DRAPERY_KEYWORD } = process.env;

const COLLECTION_MAP = {
  drapery: {
    id: "474551189822",
    name: "Drapery",
    suffix: "-C",
    sourceKeyWord: DINGTALK_DRAPERY_KEYWORD,
  },
  roman_shades: {
    id: "492919062846",
    name: "Roman Shades",
    suffix: "-S",
  },
  hardware: {
    id: "474667417918",
    name: "Hardware",
    suffix: "-H",
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
