# 部署与数据库初始化说明

## Seed 模式

项目 seed 已拆分为两种模式：

- `prod`：正式初始化，只创建系统运行所需的基础数据。
- `demo`：演示数据，用于本地开发、测试和客户演示。

默认 `npx prisma db seed` 等同于 `prod`，避免生产环境误导入演示订单。

## 生产环境首次初始化

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed:prod
npm run build
pm2 restart order-profit-system --update-env
```

`prod` seed 会初始化：

- 管理员账号：`admin@example.com / admin123456 / admin`
- 业务员账号：`sales1@example.com / sales123456 / sales`、`sales2@example.com / sales123456 / sales`
- 财务账号：`finance@example.com / finance123456 / finance`
- 必要国家/地区
- 必要币种
- 基础汇率
- 基础平台
- 1 个默认品牌
- 1 个默认店铺/站点
- 1 个默认渠道
- 少量默认供应商分类

`prod` seed 不会创建：

- 测试订单
- 测试客户
- 测试询盘
- 测试报价
- 测试收款/支出
- 测试附件
- 演示产品
- 演示渠道周报数据
- 演示利润报表数据

## 本地演示环境

```bash
npm run db:seed:demo
```

`demo` seed 会创建完整演示数据，包括示例产品、供应商、客户、询盘、报价、订单、成本、附件、四板块经营数据、渠道经营数据和利润报表测试数据。

## 生产环境禁止操作

客户正式录入真实数据后，生产环境禁止执行：

```bash
npm run db:seed:demo
npx prisma migrate reset
npx prisma migrate reset --force
```

## 当前新服务器清理测试数据流程

仅当服务器尚未正式录入客户真实数据时，可以执行一次清库重建：

```bash
cd /www/order-system
mkdir -p /www/backups
mysqldump -uorder_user -p order_system > /www/backups/order_system_$(date +%Y%m%d_%H%M%S).sql

git fetch origin main
git reset --hard origin/main
npm install
npx prisma generate
npx prisma migrate reset --force
npm run db:seed:prod
npm run build
pm2 restart order-profit-system --update-env
```

如果生产环境已经有真实业务数据，只能使用：

```bash
npx prisma migrate deploy
npm run db:seed:prod
```

不要 reset。

## HTTP 测试部署 Cookie

如果暂时使用 `http://服务器IP` 访问，服务器 `.env` 需要：

```bash
COOKIE_SECURE="false"
```

绑定域名并启用 HTTPS 后，可以改为：

```bash
COOKIE_SECURE="true"
```

## AI 经营分析配置

AI 分析只在用户点击按钮时由后端 API 调用，前端不会直接访问 Claude，也不会暴露 Token。

PackyApi / Claude-compatible 中转推荐配置：

```bash
AI_PROVIDER="anthropic_compatible"
AI_ANALYSIS_ENABLED="true"
ANTHROPIC_BASE_URL="https://www.packyapi.com"
ANTHROPIC_AUTH_TOKEN="真实 PackyApi token"
ANTHROPIC_MODEL="claude-opus-4-7"
AI_AUTH_MODE="auth_token"
AI_API_ENDPOINT="/v1/messages"
```

如果服务商要求不同鉴权头，只改：

```bash
AI_AUTH_MODE="bearer"
# 或
AI_AUTH_MODE="x_api_key"
```

官方 Anthropic API 可使用：

```bash
AI_PROVIDER="anthropic"
AI_ANALYSIS_ENABLED="true"
ANTHROPIC_API_KEY="真实 key"
ANTHROPIC_MODEL="服务商支持的模型名"
```

修改服务器 `/www/order-system/.env` 后执行：

```bash
git pull
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart order-profit-system --update-env
```

不要把真实 `ANTHROPIC_AUTH_TOKEN` 或 `ANTHROPIC_API_KEY` 写入仓库。

## Nginx 性能建议

建议生产环境 Nginx 至少包含以下配置，减少首屏静态资源加载时间：

```nginx
gzip on;
gzip_comp_level 5;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript application/xml image/svg+xml;

server {
    listen 80;
    server_name _;
    client_max_body_size 50M;

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

不要在已有正式服务上直接覆盖 Nginx 配置；先 `nginx -t` 校验，再 `systemctl reload nginx`。
