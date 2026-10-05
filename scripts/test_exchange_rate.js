// 汇率缓存 + 回退逻辑单元测试（内置 node:test，无新增依赖）
// 运行：node --test scripts/test_exchange_rate.js
//
// 思路：
// - stub 掉 axios.post（singleton，patch 共享对象的方法即可拦截 queryExchangeRate 的网络调用），
//   用受控响应模拟「成功 / 服务无数据(code!=200) / 超时(throw)」三种情况，全程不打真实接口。
// - 测试前备份、测试后还原真实的 .global_exchange_rate_cache，避免污染生产状态文件。
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const sm = require("../src/stateManager");
const { resolveUsdToRmbRate } = require("../src/exchangeRate");

const CACHE = path.join(__dirname, "..", ".global_exchange_rate_cache");

// 与 exchangeRate.js 完全一致的 UTC 日期口径，避免边界错位
const NOW = new Date();
const dStr = (offset) => {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
};
const TODAY = dStr(0);

const writeCache = (obj) => fs.writeFileSync(CACHE, JSON.stringify(obj), "utf8");

// ---- axios.post 打桩 ----
const realPost = axios.post;
let postCalls = 0;
function stubPost(impl) {
  postCalls = 0;
  axios.post = async (...args) => {
    postCalls += 1;
    return impl(...args);
  };
}
const respOk = (rate) => () => ({ data: { code: 200, data: { rate } } }); // 接口成功
const respNoData = () => ({ data: { code: 500 } }); // 服务在线但当天无数据 → queryExchangeRate 返回 null
const respTimeout = () => {
  throw new Error("timeout of 5000ms exceeded"); // 服务宕机/超时 → 抛异常
};

let originalCache = null;
before(() => {
  originalCache = fs.existsSync(CACHE) ? fs.readFileSync(CACHE, "utf8") : null;
});
after(() => {
  axios.post = realPost;
  if (originalCache === null) {
    try {
      fs.unlinkSync(CACHE);
    } catch {}
  } else {
    fs.writeFileSync(CACHE, originalCache, "utf8");
  }
});

// ===================== resolveUsdToRmbRate =====================

test("当天命中缓存 → 直接返回，不调接口", async () => {
  writeCache({ [TODAY]: 7.1 });
  stubPost(() => {
    throw new Error("命中缓存时不应调用接口");
  });
  const r = await resolveUsdToRmbRate();
  assert.strictEqual(r, 7.1);
  assert.strictEqual(postCalls, 0);
});

test("当天未缓存 + 接口成功 → 返回并写入缓存", async () => {
  writeCache({});
  stubPost(respOk(7.25));
  const r = await resolveUsdToRmbRate();
  assert.strictEqual(r, 7.25);
  assert.strictEqual(postCalls, 1);
  assert.strictEqual(sm.getExchangeRateMap()[TODAY], 7.25);
});

test("当天接口返回 null → 回退昨天，且 null 不落盘", async () => {
  writeCache({ [dStr(1)]: 7.18 });
  stubPost(respNoData);
  const r = await resolveUsdToRmbRate();
  assert.strictEqual(r, 7.18);
  assert.strictEqual(sm.getExchangeRateMap()[TODAY], undefined); // 关键：null 不写入，保留当天自愈能力
});

test("接口超时(抛异常) → 回退命中昨天", async () => {
  writeCache({ [dStr(1)]: 7.18 });
  stubPost(respTimeout);
  const r = await resolveUsdToRmbRate();
  assert.strictEqual(r, 7.18);
});

test("回退边界：第 5 天命中", async () => {
  writeCache({ [dStr(5)]: 7.05 });
  stubPost(respNoData);
  assert.strictEqual(await resolveUsdToRmbRate(), 7.05);
});

test("回退超过 5 天不命中 → null", async () => {
  writeCache({ [dStr(6)]: 7.0 });
  stubPost(respNoData);
  assert.strictEqual(await resolveUsdToRmbRate(), null);
});

test("当天 null 且缓存全空 → null", async () => {
  writeCache({});
  stubPost(respNoData);
  assert.strictEqual(await resolveUsdToRmbRate(), null);
});

// ===================== stateManager 缓存读写 =====================

test("updateExchangeRateForDate：写入有效值、忽略 null/undefined、不覆盖其它日期", () => {
  writeCache({ "2026-06-15": 7.17 });
  sm.updateExchangeRateForDate("2026-06-16", 7.19);
  sm.updateExchangeRateForDate("2026-06-17", null);
  sm.updateExchangeRateForDate("2026-06-18", undefined);
  const m = sm.getExchangeRateMap();
  assert.strictEqual(m["2026-06-15"], 7.17);
  assert.strictEqual(m["2026-06-16"], 7.19);
  assert.strictEqual(m["2026-06-17"], undefined);
  assert.strictEqual(m["2026-06-18"], undefined);
});

test("getExchangeRateMap：空文件返回 {}", () => {
  fs.writeFileSync(CACHE, "", "utf8");
  assert.deepStrictEqual(sm.getExchangeRateMap(), {});
});

test("getExchangeRateMap：损坏 JSON 返回 {}（会打一条 warn，属预期）", () => {
  fs.writeFileSync(CACHE, "{not json", "utf8");
  assert.deepStrictEqual(sm.getExchangeRateMap(), {});
});
