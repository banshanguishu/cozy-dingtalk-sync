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

## 当前目录结构（简版）
```
cozy-dingtalk-sync/
├── AGENTS.md
├── README.md
├── VIBE_CODING.md
├── index.js
├── scheduler.js
├── server.js
├── deploy.sh
├── build_and_push.sh
├── docker-compose.yml
├── Dockerfile
├── package.json
├── scripts/
│   └── test_fetch_single_order.js
├── seed/
│   ├── drapery.jsonl
│   ├── romanShade.json
│   ├── hanwovenShade.json
│   ├── hardware.json
│   ├── rollerBlind.json
│   ├── otherShade.json
│   └── secondaryOrder.json
├── src/
│   ├── buildOrders.js
│   ├── configValidator.js
│   ├── dingtalkClient.js
│   ├── fileManager.js
│   ├── shopifyClient.js
│   ├── stateManager.js
│   ├── utlis.js
│   └── mapping/
│       └── collectionMap.js
└── public/
    └── index.html
```
