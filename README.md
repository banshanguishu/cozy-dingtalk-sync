# Shopify Order Sync

这是一个 Node.js 工具，用于从 Shopify 获取订单数据并同步到钉钉多维表。

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入以下信息：

```ini
# Shopify 店铺地址 (例如: my-shop.myshopify.com)
SHOPIFY_STORE_URL=

# Shopify Admin API Access Token (以 shpat_ 开头)
# 需要 read_orders 权限
SHOPIFY_ADMIN_API_ACCESS_TOKEN=

# Shopify API 版本 (例如: 2024-01)
SHOPIFY_API_VERSION=2024-01

# 钉钉多维表 Webhook 地址
DINGTALK_WEBHOOK_URL_DRAPERY=https://connector.dingtalk.com/webhook/flow/xxxxxxxxxxxx
DINGTALK_WEBHOOK_URL_ROMANSHADE=https://connector.dingtalk.com/webhook/flow/xxxxxxxxxxxx
DINGTALK_WEBHOOK_URL_HARDWARE=https://connector.dingtalk.com/webhook/flow/xxxxxxxxxxxx
DINGTALK_WEBHOOK_URL_HANWOVENSHADE=https://connector.dingtalk.com/webhook/flow/xxxxxxxxxxxx
DINGTALK_WEBHOOK_URL_SECONDARYORDER=https://connector.dingtalk.com/webhook/flow/xxxxxxxxxxxx
DINGTALK_WEBHOOK_URL_ROLLERBLIND=https://connector.dingtalk.com/webhook/flow/xxxxxxxxxxxx
DINGTALK_WEBHOOK_URL_OTHERSHADE=https://connector.dingtalk.com/webhook/flow/xxxxxxxxxxxx
DINGTALK_WEBHOOK_URL_OTHERS=https://connector.dingtalk.com/webhook/flow/xxxxxxxxxxxx
DINGTALK_WEBHOOK_URL_REFUND=https://connector.dingtalk.com/webhook/flow/xxxxxxxxxxxx

# 钉钉触发关键词
DINGTALK_DRAPERY_KEYWORD=drapery_order_sync
DINGTALK_ROMANSHADE_KEYWORD=romanshade_order_sync
DINGTALK_HARDWARE_KEYWORD=hardware_order_sync
DINGTALK_HANWOVENSHADE_KEYWORD=hanwovenshade_order_sync
DINGTALK_ROLLERBLIND_KEYWORD=rollerblind_order_sync
DINGTALK_OTHERSHADE_KEYWORD=othershade_order_sync
DINGTALK_OTHERS_KEYWORD=others_order_sync
DINGTALK_SECONDARYORDER_KEYWORD=secondary_order_sync
DINGTALK_REFUND_KEYWORD=refund_sync

# 定时任务分钟数
SYNC_INTERVAL_MINUTES=10

```

### 3. 运行项目

```bash
npm start
```

当前默认启动 `scheduler.js`，按统一间隔执行两段任务：
1. 普通订单增量同步
2. refund 增量同步

也可以手动运行：

```bash
node index.js
node index.js refund
```

运行成功后，构造结果会保存到 `output/`，同步日志会写入 `logs/`。

### 4. refund 说明

- refund 使用独立游标文件：`.global_refund_sync_time`
- 外层按 `orders(query: "updated_at:>...")` 查候选订单
- 内层按 `refund.createdAt > refundCursor` 判断是否为新退款
- 每条新退款会展开成独立对象同步，而不是直接同步原始订单结构

## 📝 功能列表

- [x] 通过 Shopify GraphQL Admin API 获取订单数据
- [x] 将订单数据保存为本地 JSONL 文件
- [x] 同步数据到钉钉多维表
- [x] 支持 `secondary_order` 二级订单构造
- [x] 支持 refund 增量同步
