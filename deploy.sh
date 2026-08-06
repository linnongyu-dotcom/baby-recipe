#!/bin/bash
# 饭小宝一键部署到腾讯云 CloudBase
set -e

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "用法: bash deploy.sh <SecretId> <SecretKey>"
  exit 1
fi

echo "构建..."
npm run build

echo "上传并配置 SPA 路由回退..."
TCB_SECRET_ID="$1" TCB_SECRET_KEY="$2" node scripts/deploy-cloudbase.cjs

echo ""
echo "部署完成！"
