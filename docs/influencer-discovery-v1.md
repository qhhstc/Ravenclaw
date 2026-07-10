# 红人发现与评分 V1

面向 Ravenclaw 订单利润管理系统的红人营销子功能，挂在现有 `/influencers`（红人合作）模块下。目标链路：

**输入网站 URL → 分析网站 → 生成品牌/产品/受众/红人画像 + 推荐平台与关键词 → 导入/管理候选红人 → 可解释评分 → 输出推荐红人列表 → 一键转为合作记录。**

---

## 1. 功能范围

### V1 做什么
- 输入品牌官网 URL，创建一次分析任务（Discovery Run）
- 抓取网站首页 + 最多 5 个同域内部链接，AI（或规则 fallback）分析
- 生成品牌画像、产品画像、目标受众、红人画像
- 生成推荐平台与搜索关键词（含排除关键词）
- 手工新增候选红人
- CSV 导入候选红人（两阶段：预览 → 确认）
- 候选红人可解释评分（8 维度 + 风险扣分，后端确定性裁决）
- 候选红人列表按 score / tier / platform / status 筛选排序
- 一键把候选红人转为 `InfluencerCollaboration` 合作记录

### V1 明确不做
- 不做自动群发邮件
- 不做 Instagram / TikTok 私信自动化
- 不做平台自动爬取（不自动抓 IG/TikTok/YouTube 红人）
- 不做 Shopify 归因
- 不做大规模 DM
- 不承诺找到全网所有红人的真实粉丝与邮箱

「找红人」在 V1 的实现方式：根据网站分析生成推荐平台与搜索关键词，人工在各平台检索后通过 CSV 导入，或手工新增。YouTube API 等第三方数据源以 feature flag（`YOUTUBE_API_KEY`）预留，未配置时页面提示「未配置数据源」而不报错。

---

## 2. 新增数据库表

全部为增量新增，`Int` 自增主键，不使用 enum（状态/类型用 string 常量约束）。不改动任何现有业务表。

| 表 | 用途 |
| --- | --- |
| `InfluencerDiscoveryRun` | 一次网站分析任务。存网站 URL、状态（pending/analyzing/completed/failed）、品牌/产品/受众/红人画像文本、关键词 JSON、AI 原始输出 JSON、错误信息、创建人。 |
| `InfluencerCandidate` | 候选红人。存平台/账号/主页/邮箱/国家、粉丝/均播/互动率等指标、标签/关键词/受众 JSON、评分与明细、等级、推荐合作方式、AI 理由、风险提示、状态、来源。可选绑定 `discoveryRunId`。 |
| `InfluencerScoringRule` | 评分规则表（预留可扩展）。V1 使用内置默认权重，此表暂不接管理 UI。 |

关系：`InfluencerDiscoveryRun.createdById → User`（onDelete: SetNull，relation `DiscoveryRunCreator`）；`InfluencerCandidate.discoveryRunId → InfluencerDiscoveryRun`（onDelete: SetNull）。

迁移文件：`prisma/migrations/20260710023909_add_influencer_discovery_scoring/`，仅含 3 个 CREATE TABLE + 2 个 ADD FOREIGN KEY（作用于新表）+ 索引，无任何破坏性语句。

---

## 3. 新增 API 路由

所有路由：读操作要求登录（`requireApiSession`），写操作额外要求 `canManageInfluencerDiscovery`（admin/sales）。响应格式沿用项目惯例：`{ item }` / `{ items, total, page, pageSize }` / `{ ok: true }`；错误 `{ message }`。

| 方法与路径 | 用途 |
| --- | --- |
| `POST /api/influencers/discovery-runs` | 创建分析任务，body `{ websiteUrl }`。 |
| `GET /api/influencers/discovery-runs` | 分析任务列表（分页，含候选数）。 |
| `GET /api/influencers/discovery-runs/[id]` | 任务详情 + 该任务下候选红人列表。 |
| `POST /api/influencers/discovery-runs/[id]/analyze` | 同步执行网站抓取 + AI 分析，写回画像。 |
| `POST /api/influencers/discovery-runs/[id]/score-all` | 批量对该任务下所有候选红人评分。 |
| `GET /api/influencers/candidates` | 候选红人列表，支持 status/tier/platform/minScore/keyword/discoveryRunId 筛选与 score/followers/avgViews/updatedAt 排序。 |
| `POST /api/influencers/candidates` | 手工新增候选红人。 |
| `GET /api/influencers/candidates/[id]` | 候选红人详情。 |
| `PATCH /api/influencers/candidates/[id]` | 更新状态、备注、部分字段（白名单）。 |
| `POST /api/influencers/candidates/[id]/score` | 对单个候选红人重新评分。 |
| `POST /api/influencers/candidates/import/preview` | CSV 导入预览：解析 + 校验，不写库。 |
| `POST /api/influencers/candidates/import/confirm` | CSV 导入确认：重新解析原始 CSV，只写入有效行。 |
| `POST /api/influencers/candidates/[id]/convert` | 转为 `InfluencerCollaboration` 合作记录。 |

---

## 4. 评分规则

默认 100 分制，8 个正向维度 + 风险扣分。各维度满分：

| 维度 | 键 | 满分 |
| --- | --- | --- |
| 内容匹配度 | `contentFit` | 25 |
| IP/产品匹配度 | `ipProductFit` | 15 |
| 数据质量 | `dataQuality` | 15 |
| 互动质量 | `engagementQuality` | 10 |
| 受众匹配 | `audienceFit` | 10 |
| 商业转化潜力 | `commercePotential` | 10 |
| 成本效率 | `costEfficiency` | 10 |
| 联系可达性 | `contactability` | 5 |
| 风险扣分 | `riskPenalty` | 0 ~ -10 |

`total = 8 个正向维度之和 - riskPenalty`，clamp 到 [0, 100]。

关键原则（`src/lib/influencer-discovery/scoring.ts`）：
- **AI 只作为 hint**。`scoreCandidateWithAi` 返回的各维度分是参考值。
- 后端对每个维度 clamp 到合法范围（0 ~ 该维度满分），AI 给的越界值被裁剪。
- **后端重新计算 total，不直接相信 AI 返回的 total**（即便 AI 返回 `total: 999` 也会被忽略，由后端按 clamp 后的维度重算）。
- `tier` 和 `recommendedOffer` 由最终 total 推导，而非 AI 指定。
- **成本未知时 `costEfficiency` 给中性分 5，不直接给 0**（V1 候选红人无报价字段，成本默认未知）。

评分明细以 `scoreDetailsJson` 存库并在候选详情页展示（各维度进度条 + 总分）。

---

## 5. 分层与推荐合作方式

| 总分 | 等级 | 推荐合作方式 |
| --- | --- | --- |
| 85 - 100 | A | paid / affiliate |
| 70 - 84 | B | gifted / affiliate |
| 55 - 69 | C | nurture |
| 0 - 54 | D | reject |

推荐合作方式还会结合成本已知度微调（有报价倾向 paid/affiliate，无报价倾向 affiliate/gifted）。

---

## 6. CSV 导入格式

示例：

```csv
platform,handle,profileUrl,email,country,followers,avgViews,engagementRate,nicheTags
TikTok,anime_test,https://www.tiktok.com/@anime_test,test@example.com,US,80000,32000,5.2%,"anime,genshin,unboxing"
YouTube,figure_review,https://www.youtube.com/@figure_review,review@example.com,US,22000,9000,3.8%,"figure,honkai,collector"
```

解析能力（`src/lib/influencer-discovery/csv.ts`）：
- 支持 UTF-8 BOM（自动剥离）
- 支持空行（自动跳过）
- 支持双引号包裹字段与字段内逗号（如 `"anime,genshin,unboxing"`）
- 支持百分号互动率（`5.2%` → 5.2；无百分号且 ≤1 视为小数比例，`0.052` → 5.2）
- 支持中英文列名（如 `平台/账号/粉丝` 等）
- `nicheTags` 支持 `;`、`,`、`、`、`|` 分隔
- 列名大小写不敏感
- 字段内换行（跨行引号）**不支持**，遇到时报明确行号错误

字段校验：账号（handle）、主页链接（profileUrl）、名称（displayName）至少填写一项（仅有平台名不足以定位红人）；profileUrl 必须 http/https；email 需合法格式。

**两阶段安全**：preview 与 confirm 都接收原始 CSV 文件。confirm 阶段**重新解析原始 CSV 并重新校验，只写入有效行，绝不信任前端回传的 preview rows**。

---

## 7. 权限规则

集中在 `src/lib/permissions.ts` 新增 `canManageInfluencerDiscovery`（admin/sales 返回 true）。

- **读操作**（列表、详情）：要求登录（`requireApiSession`）。
- **写操作**（创建 run、analyze、score-all、新增/更新候选、单个 score、CSV preview/confirm、convert）：要求 `canManageInfluencerDiscovery`。
- **admin / sales**：可写。
- **finance / viewer**：只读。前端不显示写按钮，即便绕过前端，后端仍返回 403。
- **候选红人团队共享**：不按创建人隔离，admin/sales 都可管理全部候选。

后端是唯一信任边界，前端权限开关仅控制 UI 可见性。

---

## 8. 生产部署方式

允许流程（本次不执行）：

```bash
git pull origin main
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart order-profit-system --update-env
```

**明确禁止**：

```bash
npx prisma db push        # 禁止
npx prisma migrate reset  # 禁止
# 禁止删除任何表
# 禁止修改已有真实数据
```

如需启用 YouTube 数据源，在服务器 `.env` 追加 `YOUTUBE_API_KEY`（当前 V1 仅预留占位，未接入实际拉取）。

---

## 9. 手动验收清单

本项目暂无自动化测试体系，交付前请按以下清单人工验收（本地 `npm run dev`，用 admin 账号）：

1. 从 `/influencers` 进入红人发现（顶部入口卡片可见）。
2. 在 `/influencers/discovery` 输入 `https://bahomu.com` 创建分析任务。
3. 执行分析（或自动触发），看到品牌画像、产品/受众/红人画像和推荐关键词。
4. 手工新增一个候选红人。
5. CSV 导入若干候选红人（含预览校验，错误行有提示）。
6. 对单个候选红人评分，看到分数/等级/推荐合作方式。
7. 在任务详情页批量评分。
8. 候选红人列表按 score / tier / platform / status 筛选排序。
9. 候选详情页看到评分明细（各维度）与 AI 理由。
10. 点「转为合作记录」，候选状态变为「已转合作」。
11. 回到「红人合作」列表，确认出现新记录（带评分/推荐/来源信息在备注里）。
12. 用 finance / viewer 角色登录，确认写按钮不显示；直接调用写 API 返回 403。
13. 确认订单、利润、CRM、财务页面不受影响（新增均为独立表/路由/API）。

### AI 关闭 / 失败时的预期
- `AI_ANALYSIS_ENABLED=false` 或 AI 调用失败/超时：网站分析走规则化 fallback（基于标题/关键词），页面不报错。
- 网站抓取失败（无法访问、超时、非 HTML、命中 SSRF 拦截）：任务状态置为 `failed` 并写入 `errorMessage`，不会永久卡在 `analyzing`。
- 任务状态最终只会是 `completed` 或 `failed`，不会长期停留在 `pending` / `analyzing`。
