# Shopify Orders 字段查阅指南

用户问某个**订单字段**的含义、类型、枚举值或用法差异时，走这里的流程。不缓存文档内容，**每次都用 `WebFetch` 实时拉取 Shopify 官方页面**。

## 权威入口 URL

- 单个订单查询： `https://shopify.dev/docs/api/admin-graphql/latest/queries/order`
- 订单列表查询： `https://shopify.dev/docs/api/admin-graphql/latest/queries/orders`

## 关联对象类型（按需追查）

Order 字段经常指向其他 GraphQL 对象类型，必要时顺链追查对应页面：

- `Order`：`https://shopify.dev/docs/api/admin-graphql/latest/objects/Order`
- `LineItem`：`https://shopify.dev/docs/api/admin-graphql/latest/objects/LineItem`
- `Refund`：`https://shopify.dev/docs/api/admin-graphql/latest/objects/Refund`
- `Fulfillment`：`https://shopify.dev/docs/api/admin-graphql/latest/objects/Fulfillment`
- `OrderTransaction`：`https://shopify.dev/docs/api/admin-graphql/latest/objects/OrderTransaction`
- `DiscountApplication` 接口：`https://shopify.dev/docs/api/admin-graphql/latest/interfaces/DiscountApplication`
- `DiscountAllocation`：`https://shopify.dev/docs/api/admin-graphql/latest/objects/DiscountAllocation`
- `MailingAddress`：`https://shopify.dev/docs/api/admin-graphql/latest/objects/MailingAddress`
- `Customer`：`https://shopify.dev/docs/api/admin-graphql/latest/objects/Customer`
- `ProductVariant`：`https://shopify.dev/docs/api/admin-graphql/latest/objects/ProductVariant`

遇到更冷门的类型时，URL 规律是：`https://shopify.dev/docs/api/admin-graphql/latest/objects/<TypeName>`（对象）或 `.../interfaces/<InterfaceName>`（接口）/ `.../enums/<EnumName>`（枚举）。

## 工作流程

1. 从用户提问里锁定字段名（如 `refund.note`、`lineItem.currentQuantity`、`discountApplications` 下的 `DiscountCodeApplication`）。
2. 判断该字段属于哪个对象类型 —— 优先落到最贴近的专门页面；找不到时回到上一层（比如不确定时先打开 `Order` 页面按字段名检索）。
3. 用 `WebFetch` 拉取对应 URL 的页面内容，定位字段说明段落。
4. 用**中文**向用户总结以下要点：
   - 字段的 GraphQL 类型（Scalar / Object / Enum / Connection 等）
   - 字段含义
   - 如果是枚举，列出所有取值及其业务含义
   - 和同类字段的差异（例如 `quantity` vs `currentQuantity`、`originalTotalSet` vs `discountedTotalSet`）
   - 是否需要额外 scope（如 `lineItem.product` 需要 `read_products` 权限）
5. 若字段与当前业务行为直接相关，可顺带引用 `scripts/fetch_order.js` 的实际返回数据做佐证（先跑脚本取数）。

## 注意事项

- 所有 URL **固定在 `shopify.dev/docs/api/admin-graphql/latest/`** 这一级；**不要抓取第三方博客或 StackOverflow**。
- `latest` 会跟随 Shopify 当前稳定版。本项目实际调用的 API 版本是 `2024-01`（见 `.env` 的 `SHOPIFY_API_VERSION`）。遇到"字段在 latest 存在、在 2024-01 不存在"这种差异时，把 URL 的 `latest` 替换成 `2024-01` 再抓一次确认。
- 页面结构里字段说明通常在"Fields"/"Arguments"/"Possible types"章节下，`WebFetch` 的 prompt 里直接让它定位具体字段名即可。
