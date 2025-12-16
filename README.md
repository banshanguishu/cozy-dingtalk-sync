# Shopify Order Sync

这是一个 Node.js 工具，用于从 Shopify 获取订单数据并同步到钉钉多维表（开发中）。

## 📁 目录结构

```
shopify_query/
├── src/
│   ├── shopifyClient.js        # Shopify GraphQL API 客户端封装
│   ├── fileManager.js          # 文件读写操作封装
│   ├── stateManager.js         # 同步状态时间持久化
│   ├── dingtalkClient.js       # 钉钉SDK封装工具
│   └── buildThirdOrders.js     # 构造三级单号工具
├── output/                     # 运行时生成的数据文件 (已忽略)
├── index.js                    # 主程序入口
├── .env                        # 环境变量配置 (已忽略，需自行创建)
├── .env.example                # 环境变量配置示例文件
└── package.json
```

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
DINGTALK_WEBHOOK_URL=https://connector.dingtalk.com/webhook/flow/xxxxxxxxxxxx

# 钉钉触发关键词 (用于安全校验或流触发)
DINGTALK_KEYWORD=

# 钉钉触发关键词，细化到Drapery (用于安全校验或流触发)
DINGTALK_DRAPERY_KEYWORD=

```

### 3. 配置便携式运行环境 (可选)

如果运行本工具的电脑未安装 Node.js，可以采用“便携模式”运行：

1.  **下载 Node.js 可执行文件**：
    *   访问 Node.js 官网下载页：[https://nodejs.org/dist/latest-v20.x/win-x64/](https://nodejs.org/dist/latest-v20.x/win-x64/)
    *   找到并下载 `node.exe` 文件。
2.  **放置文件**：
    *   在本项目根目录下创建一个名为 `bin` 的文件夹。
    *   将下载好的 `node.exe` 放入该文件夹中 (路径应为 `/bin/node.exe`)。
3.  **启动**：
    *   直接双击运行 `start.bat` 即可。

### 4. 运行项目

```bash
node index.js
```

运行成功后，订单数据将保存到 `output/`。

## 📝 功能列表

- [x] 通过 Shopify GraphQL Admin API 获取订单数据
- [x] 将订单数据保存为本地 JSON 文件
- [x] 同步数据到钉钉多维表
