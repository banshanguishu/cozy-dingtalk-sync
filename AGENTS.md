# 项目 Codex 工作约定（Project AGENTS）

## 回复与沟通
- 默认用中文回复，除非我明确要求英文。
- 先给简短结论/计划，再给具体改动或补丁。

## 范围与改动边界
- 改动文件时，字符编码必须为 UTF-8，不能使用其他编码。
- 只做我明确提出的需求；不要发散新增功能、不要头脑风暴扩需求。
- 尽量最小改动（minimal diff），避免大规模重构。
- 如需新增依赖、修改公共 API、改动目录结构或新增脚本：必须先征得我确认。

## 代码规范
- 遵循项目现有代码风格与命名习惯，不要引入新的风格体系。
- 修改时优先保持向后兼容，避免破坏现有行为。

## 验证
- 默认不要执行 `npm run test` 作为每次代码更新后的固定检查。
- 如果我明确要求，再执行指定测试/检查命令并汇报结果。

## 新增模块说明
- 汇率查询模块位于 `src/exchangeRate.js`。
- 对外方法：`queryExchangeRate(inputDate, currency = "USD", targetCurrency = "RMB")`。
- 返回规则：接口响应 `code === 200` 时返回 `rate` 数值，否则返回 `null`。
- 支持 CLI 直接运行：`node src/exchangeRate.js [dateString] [currency] [targetCurrency]`。

## 当前调度与 refund 约定
- `scheduler.js` 使用单一 `setInterval` 轮询。
- 每轮按顺序执行：先 `run()` 普通订单同步，再 `run("refund")` 退款同步。
- 普通订单与 refund 使用同一个 `SYNC_INTERVAL_MINUTES`。
- refund 使用独立游标文件 `.global_refund_sync_time`。
- refund 外层候选订单按 `updated_at` 查询，内层新退款按 `refund.createdAt` 判断。

## 当前目录结构（简版）
```
cozy-dingtalk-sync/
├── .global_last_sync_time
├── .global_refund_sync_time
├── AGENTS.md
├── README.md
├── VIBE_CODING.md
├── index.js
├── scheduler.js
├── deploy.sh
├── build_and_push.bat
├── docker-compose.yml
├── Dockerfile
├── package.json
├── scripts/
│   ├── test_fetch_single_order.js
│   ├── test_refund_sync.js
│   └── test_single_order_sync.js
├── seed/
│   ├── drapery.jsonl
│   ├── romanShade.json
│   ├── hanwovenShade.json
│   ├── hardware.json
│   ├── rollerBlind.json
│   ├── otherShade.json
│   ├── others.json
│   ├── refund.json
│   └── secondaryOrder.json
├── src/
│   ├── buildOrders.js
│   ├── configValidator.js
│   ├── dingtalkClient.js
│   ├── exchangeRate.js
│   ├── fileManager.js
│   ├── shopifyClient.js
│   ├── stateManager.js
│   ├── utils.js
│   └── mapping/
│       └── collectionMap.js
```
