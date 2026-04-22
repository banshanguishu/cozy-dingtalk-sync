---
name: shopify-order-query
description: 用于 Shopify **订单**相关查询场景 —— 按订单号取订单数据，或查某个订单字段的含义/用法。仅当请求明确涉及订单（订单/单号/order/order id/line item/refund/fulfillment 等）时触发；非订单话题或通用编码任务不应触发本 skill。
---

# shopify-order-query

## 触发场景

命中（示例）：
- "帮我查一下订单 6852990173502 的退款情况"
- "`gid://shopify/Order/6852990173502` 这单的 lineItems 里有几条 roller blind？"
- "Order 的 `displayFinancialStatus` 枚举都有哪些？`PAID` 和 `PARTIALLY_PAID` 的区别是什么？"
- "`lineItem.currentQuantity` 和 `quantity` 有什么区别？"
- "refund 对象上的 `note` 是什么意思？"

不命中（示例）：
- "帮我初始化一个 Shopify App"
- "Shopify Admin API 的限流策略是怎样的？"（与具体订单/订单字段无关）
- "写一个扫描商品库存的脚本"（products 域，不是订单域）

## 两条能力分支

### 模式 A：按订单号取数

用户给了订单号（完整 gid 或纯数字后缀），想要某张订单的实际数据。

执行：`node <skill 根目录>/scripts/fetch_order.js <orderId> [--pretty]`
- `<orderId>` 支持两种形式：
  - 完整 gid：`gid://shopify/Order/6852990173502`
  - 纯数字后缀：`6852990173502`（脚本内部会自动拼成 gid 形式）
- 默认输出**单行 JSON**（便于程序消费）。只有当用户明确说要"美化/格式化/展开"输出时，才加 `--pretty` 得到缩进 JSON。
- 脚本零运行时依赖（Node 18+ 内置 `fetch`），不需要 `npm install`。
- 凭据读取顺序：先取真实 `process.env`，其次取 `process.cwd()/.env` 文件中的同名 key（`SHOPIFY_STORE_URL` / `SHOPIFY_ADMIN_API_ACCESS_TOKEN` / `SHOPIFY_API_VERSION`）。**使用前请确保在 repo 根目录（有 `.env`）下执行脚本**，或者事先把环境变量显式导出。
- 抓到数据后**不要把整个 JSON 原样贴给用户**，而是基于数据回答用户的具体问题（比如只抽取涉及的字段、做简单聚合/格式化）。用户要原始 JSON 时再给。

### 模式 B：字段含义/用法查阅

用户问某个订单字段或关联对象字段的含义、类型、枚举、用法差异。此时**不需要调脚本**，应使用 WebFetch 实时拉取 Shopify 官方文档并据此作答。

详细流程与入口 URL 见 `references/fields-lookup.md`。要点：
- 权威入口是 `https://shopify.dev/docs/api/admin-graphql/latest/queries/order`。
- 允许顺链追查 `Order` / `LineItem` / `Refund` / `Fulfillment` / `OrderTransaction` 等关联对象页面，均在 `shopify.dev/docs/api/admin-graphql/latest/` 域下。
- 不缓存文档内容，每次都走实时 WebFetch。

### 两模式可叠加

如果用户的问题既涉及"这单的实际情况"又涉及"某字段是什么意思"，先走模式 A 拿真实数据，再用模式 B 把字段语义讲清楚，然后把两者结合起来答复。

## 注意事项

- 本 skill 仅针对 **Shopify 订单域**。如果对话漂移到商品、客户、库存、配送或 App 开发等非订单话题，不再沿用本 skill 的脚本和文档入口。
- 脚本的 GraphQL 查询已对齐当前仓库 `scripts/test_fetch_single_order.js` 的字段集合，覆盖订单主体 + 客户 + 地址 + 交易 + 折扣 + 行项目 + 产品/变体/自定义属性。需要未覆盖的字段（如 `fulfillments` / `refunds` / `shippingLines` 明细）时，按需在脚本 `QUERY` 里追加。
