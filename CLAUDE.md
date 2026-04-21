# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

Node.js 工具，把 Shopify 订单通过 GraphQL Admin API 拉下来，按类目（drapery / roman_shade / hardware / hanwoven_shade / roller_blind / other_shade / others / refund / secondary_order）分流构造后，推送到不同的钉钉多维表 webhook。运行形态是一个长驻调度器（`scheduler.js`）或一次性 CLI（`index.js`）。

## 常用命令

```bash
# 启动调度器（生产入口）—— 按 SYNC_INTERVAL_MINUTES 轮询，一轮内先普通订单后 refund
npm start

# 手动单次执行
node index.js                          # 跑所有已配置好 webhook + keyword 的类型
node index.js refund                   # 仅跑退款
node index.js drapery roman_shade      # 跑指定类型（空格分隔）

# 单订单调试脚本（不走游标，按订单 ID 取数）
node scripts/test_single_order_sync.js <orderId> <type> [--sync] [--compact]
node scripts/test_fetch_single_order.js
node scripts/test_refund_sync.js <orderId> [--cursor <iso>] [--sync]

# 历史数据回填（时间区间强制拉取）
node scripts/sync_drapery_history.js <type> [--sync]

# 给指定 webhook 发固定 payload（调通流程用）
node scripts/push_to_dingtalk.js

# Docker 构建 / 部署（内网镜像仓库 192.168.1.252:15000）
./build_and_push.bat      # Windows 本地构建推送
./deploy.sh               # 服务器拉镜像 + docker-compose up
```

仓库里没有自动化测试（`npm test` 是占位），验证靠 `scripts/` 下的手工脚本。`--sync` 标志会真的往钉钉发，不加只做 dry-run 打印；测试脚本的 webhook 从 `.env.test.local` 读，和生产 `.env` 分离，修改时注意别混。

## 架构关键点

**单次拉取，多路分流**。`index.js` 的 `runOrderSync` 只调一次 Shopify `orders(query: "created_at:>...")` 分页拿全量增量订单，然后对 `targetTypes` 里的每个类型分别用 `buildThirdOrders` / `buildSecondOrders` 重塑结构后推钉钉。新增类型不需要额外拉数，只需要在 `COLLECTION_MAP` 里补 `id` / `sourceKeyWord` / `dingtalk_webhook` / `suffix`，`TYPES_TO_SYNC` 会自动把同时配好 `sourceKeyWord` 和 `dingtalk_webhook` 的条目纳入默认范围。

**游标与 refund 的双游标**。三个状态文件都在仓库根目录、被 docker-compose 以单文件挂载进容器，别当普通缓存删：
- `.global_last_sync_time` — 普通订单，推进用 `order.createdAt`（`runOrderSync`）
- `.global_refund_sync_time` — 退款事件游标，推进用 `refund.createdAt`（`runRefundSync`）
- `.global_refund_scan_time` — 候选订单扫描游标，推进用 `order.updatedAt`

refund 链路是：外层按 `updated_at:>refund_scan` 查候选订单 → 内层 `buildRefundOrders` 按 `refund.createdAt > refund_sync` 过滤出真正的新退款，每条展开成独立对象推送。两层游标分开推进的目的是：退款事件可能晚于订单创建，用 `updatedAt` 扫描面 + `createdAt` 判重，避免漏退或重推。

**类型的三档差异**，改 `configValidator.js` / `buildOrders.js` 时要守住：
- 常规类型（drapery 等）：有固定 collection id + suffix，`buildThirdOrders` 按 collection id 匹配生成三级单号
- `secondary_order`：没有 collection id / suffix，按订单聚合出二级结构，构造时需查 USD→RMB 汇率（`src/exchangeRate.js`，内网接口 `http://192.168.1.252:5000`），并且折扣后总价要先扣 GiftCard 抵扣金额
- `others`：fallback 桶，把不落入 `OTHERS_FALLBACK_BASE_COLLECTION_IDS` 的 lineItem 归到这里；没有 collection id
- `refund`：没有 collection id / suffix，按 refund 事件展开而非按订单展开

**配置校验是延迟的**。`validateRuntimeConfig` 只在 `run()` 收到显式 `types` 参数时触发；默认 `node index.js`（无参）跳过严格校验，靠 `TYPES_TO_SYNC` 自动过滤已配好 webhook+keyword 的类型。新增类型在未配齐 webhook 前不会炸，但也不会被同步——想排查“为什么某类型没推”，先看 `.env` 里两个 key 是否都非空。

**Shopify 客户端的重试**。`src/shopifyClient.js` 对 429 / 5xx / 网络类错误做指数退避（500/1000/2000ms），默认最多 3 次；分页之间 `index.js` 另加 500ms sleep 主动限速。改查询时保持 `first: 50` 和 `sortKey: CREATED_AT / reverse: false`，游标推进逻辑依赖升序。

## 代码风格与协作约定（来自 AGENTS.md）

- **默认中文回复**，先结论/计划再改动。
- 改动文件必须 **UTF-8**，不要引入其他编码。
- 只做明确提出的需求，**最小 diff**，不要发散重构；新增依赖 / 改公共 API / 改目录结构 / 新增脚本**需要先确认**。
- 优先**向后兼容**，保持现有命名风格。
- 不要把 `npm run test` 当作每次改动后的固定检查——指定了再跑。
