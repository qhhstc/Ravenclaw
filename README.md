## 数据库初始化

Seed 已拆分为正式初始化和演示数据两种模式。默认 `prisma db seed` 使用 `prod` 模式，避免生产环境误导入测试订单。

### 生产环境

```bash
npm run db:seed:prod
```

生产模式只初始化系统运行必需的基础数据：管理员、业务员、财务账号、国家地区、币种、基础汇率、品牌、平台、店铺、渠道和基础供应商分类。生产环境不要执行 demo seed。

默认基础账号：

```text
admin@example.com / admin123456
sales1@example.com / sales123456
sales2@example.com / sales123456
finance@example.com / finance123456
```

### 本地演示环境

```bash
npm run db:seed:demo
```

演示模式会导入示例产品、供应商、客户、询盘、报价、订单、成本、附件、四板块经营数据、渠道经营数据和利润报表测试数据，仅用于本地开发、测试和客户演示。

### 直接使用 Prisma

```bash
SEED_MODE=prod npx prisma db seed
SEED_MODE=demo npx prisma db seed
```

如果未设置 `SEED_MODE`，系统按 `prod` 模式执行。

### HTTP 测试部署 Cookie

如果生产环境暂时只通过 `http://服务器IP` 访问，需要在服务器 `.env` 设置：

```bash
COOKIE_SECURE="false"
```

绑定域名并启用 HTTPS 后，再改为：

```bash
COOKIE_SECURE="true"
```

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
