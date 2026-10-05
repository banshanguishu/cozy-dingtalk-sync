FROM node:18-alpine

WORKDIR /app

# 设置时区为上海
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 复制依赖文件
COPY package*.json ./

# 安装生产依赖
RUN npm install --only=production

# 复制源代码
COPY . .

# 环境变量 (可以在运行容器时覆盖)
ENV NODE_ENV=production

# 启动调度器
CMD ["node", "scheduler.js"]
