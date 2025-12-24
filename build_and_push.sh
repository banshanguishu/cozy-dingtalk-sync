#!/bin/bash

# 设置镜像名称和标签
IMAGE_NAME="192.168.1.252:15000/cozy-dingtalk-sync"
TAG="latest"
FULL_IMAGE_NAME="${IMAGE_NAME}:${TAG}"

echo "🚀 开始构建镜像: ${FULL_IMAGE_NAME}"

# 构建镜像
docker build -t ${FULL_IMAGE_NAME} .

if [ $? -eq 0 ]; then
    echo "✅ 镜像构建成功!"
    echo "📤 开始推送镜像到远程仓库..."
    
    # 推送镜像
    docker push ${FULL_IMAGE_NAME}
    
    if [ $? -eq 0 ]; then
        echo "✅ 镜像推送成功!"
        echo "🎉 部署脚本执行完毕。"
    else
        echo "❌ 镜像推送失败，请检查网络或仓库权限。"
        exit 1
    fi
else
    echo "❌ 镜像构建失败，请检查 Dockerfile。"
    exit 1
fi
