<p align="center">
  <img src="public/favicon.ico" alt="Afloat logo" width="128" height="128">
</p>

<h1 align="center">AFLOAT V1</h1>

<p align="center">
  <img src="docs/v1/assets/welcome_page.png" alt="Afloat welcome page" width="720">
</p>

> 一个承诺观察系统：它读取日历中的计划与偏移记录，算出事实时间和派生视图，再用一个镜像页展示时间最终流向。

## 运行

```bash
pnpm install
pnpm dev
```

开发服务默认运行在 `http://localhost:3000`。

## 部署到 Vercel

Afloat 可以部署到 Vercel，但它不是纯静态应用。部署前需要准备 Postgres；Vercel 构建阶段会自动执行 Drizzle 迁移。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fukiyo-dev%2Fafloat&project-name=afloat&repository-name=afloat&env=DATABASE_URL,AFLOAT_OWNER_PASSWORD,AFLOAT_INSTANCE_SECRET&envDescription=Afloat%20requires%20Postgres%20and%20owner%20login%20secrets.)

### 1. 准备数据库

创建一个 Postgres 数据库，例如 Vercel Postgres、Neon 或 Supabase Postgres，并取得连接字符串。

连接字符串需要填入 Vercel 环境变量：

```text
DATABASE_URL=postgres://...
```

### 2. 生成实例密钥

`AFLOAT_INSTANCE_SECRET` 用于登录 session 和 CalDAV 凭证加密。生产环境必须固定配置，不能每次部署随机变化。

```bash
openssl rand -base64 32
```

将输出填入 Vercel 环境变量：

```text
AFLOAT_INSTANCE_SECRET=...
AFLOAT_OWNER_PASSWORD=你的访问密码
```

可选的 CalDAV 环境变量：

```text
CALDAV_SERVER_URL=https://caldav.example.com
CALDAV_USERNAME=...
CALDAV_PASSWORD=...
```

也可以不配置这三个变量，部署后登录 `/settings` 在界面里保存 CalDAV 凭证。

### 3. 一键部署

点击本章节中的 **Deploy with Vercel** 按钮，按提示导入仓库并填写环境变量。

如果使用 Vercel 数据库集成，也可以先创建数据库，再让 Vercel 自动注入 `DATABASE_URL`。

### 4. 首次访问

部署完成后访问：

```text
https://你的域名/login
```

使用 `AFLOAT_OWNER_PASSWORD` 登录，然后进入 `/settings` 配置 CalDAV 和语义日历映射。

### 5. 迁移说明

仓库根目录的 `vercel.json` 会让 Vercel 在每次构建时先运行：

```bash
pnpm db:migrate && pnpm build
```

这可以避免首次部署后手动迁移数据库。注意事项：

- `DATABASE_URL` 必须在构建环境可用，否则部署会失败。
- Preview 和 Production 如果共用同一个 `DATABASE_URL`，Preview 部署也会对同一个数据库执行迁移。
- 个人自托管通常可以接受；如果后续多人协作或多环境发布，建议为 Preview 和 Production 使用不同数据库。

### 6. 同步说明

日常同步使用 `/api/sync/recent` 或 Dashboard 上的同步操作。首次重新校准会扫描较大的历史范围，部署在 Vercel Functions 上可能遇到函数超时；真实数据较多时建议先用近期同步验证，或后续改成分片重校准。

## 脚本

- `pnpm dev` - 启动开发服务
- `pnpm build` - 生产构建
- `pnpm lint` - TypeScript 类型检查
- `pnpm test` - 运行测试
- `pnpm db:generate` - 生成 Drizzle 迁移
- `pnpm db:migrate` - 执行数据库迁移
- `pnpm dev:caldav:reset` - 重置本地 CalDAV 测试账号
- `pnpm dev:caldav:seed` - 填充 CalDAV 测试事件
- `pnpm dev:caldav:sync` - 触发一次最近同步

## 环境变量

常用配置放在 `.env.local`：

- `DATABASE_URL`
- `AFLOAT_OWNER_PASSWORD`
- `AFLOAT_INSTANCE_SECRET`

## 目录

- `src/app` - Next.js 页面、布局和 API 路由
- `src/components` - 前端组件
- `src/server/domain` - 纯领域逻辑
- `src/server/services` - 服务层
- `src/server/db` - 数据库 schema、查询和迁移
- `src/server/views` - 派生视图计算
- `docs/v1` - v1 规范文档

## 文档

详细产品规则见 `docs/v1/README.md`。
