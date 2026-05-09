# 技术架构路线

Afloat v1 推荐采用：

> 代码架构按 Cloud Run / VPS 可移植来设计，默认部署走 Vercel + Neon。

目标是同时满足两个方向：

- 早期开源与自部署足够低摩擦
- 后续升级 SaaS 时不需要重写核心架构

## 推荐技术栈

v1 默认技术栈：

```text
Next.js
TypeScript
Drizzle ORM
Postgres
Vercel
Neon
CalDAV
```

本地开发：

```text
pnpm dev
docker compose up postgres
```

生产默认：

```text
Vercel + Neon
```

Vercel 提供 Next.js 托管与公网入口，Neon 提供 Serverless Postgres。

## 基本架构

```text
Browser
  ↓
Next.js Server Layer
  ↓
Postgres
  ↓
CalDAV Server
```

浏览器前端不直接连接数据库。

数据库、CalDAV 凭证、原始日历事件、完整镜像派生视图都只能由服务端访问。

部署实例只需要配置一个长期稳定的实例密钥：

```text
AFLOAT_INSTANCE_SECRET
```

Afloat 从该实例密钥派生不同用途的子 key：

- owner session 签名
- CalDAV 凭证加密

生产环境必须显式配置 `AFLOAT_INSTANCE_SECRET`。开发环境可以临时生成内存密钥，但重启后登录态会失效，且使用临时密钥保存的 CalDAV 凭证无法稳定解密。

Next.js 同时承担：

- 页面渲染
- API Route
- 手动同步入口
- 派生视图读取

## 代码分层

建议目录结构：

```text
src/
  app/
    dashboard/
    public/[id]/
    api/
  server/
    db/
    calendar/
    sync/
    domain/
    views/
  components/
```

职责：

- `server/db`：数据库连接、schema、query
- `server/calendar`：CalDAV adapter
- `server/sync`：近期同步、重新校准、同步锁
- `server/domain`：标题解析、覆盖计算、线程、可行性
- `server/views`：派生视图生成
- `app/api`：薄路由，只调用 server 层能力
- `components`：展示组件，只接收派生视图 payload

业务规则不要写进 route handler。Route handler 只负责鉴权、调用服务、返回结果。

镜像页本人模式读取派生视图时，应支持两类请求：

- 单日本地日期：服务默认 1 日主视图和上一天、下一天切换
- 本地日期范围：服务自定义开始日/结束日统计，以及最近 7d、最近 30d 快捷范围

日期范围语义属于 view query，不是新的事实源。开始日和结束日按用户本地日历日闭区间计算。

## 数据原则

v1 使用 Postgres，即使当前是单用户。

核心表：

```text
owners
settings
calendar_sources
calendar_events_raw
thread_declarations
notes
computed_views
sync_runs
calendar_credentials
```

所有核心表都应预留 `owner_id`。

即使 v1 只有一个 owner，所有查询也必须 owner-scoped。

不要长期保存：

```text
parsed_blocks
fact_blocks
thread_views
```

这些都是派生视图生成时的中间结构。

## 派生视图

数据库只保存事实源与派生视图。

事实源包括：

- 原始日历事件缓存
- 日历语义映射
- 线程声明
- 每日笔记
- 设置

派生视图是结构化展示数据，不是事实源。

每次更新后，从本地事实源全量重算派生视图。

```text
facts
  ↓
domain computation
  ↓
computed_views
  ↓
pages
```

该原则未来 SaaS 化后仍然保持。性能优化只能改变物理计算方式，不能改变结果语义：

> 派生视图必须等价于从事实源全量计算的结果。

## 同步策略

v1 默认手动同步，并且只实现 password/token-based CalDAV 只读同步。

镜像页本人模式提供：

```text
POST /api/sync/recent
POST /api/sync/recalibrate
```

近期同步：

```text
过去 30 天 + 未来 30 天
```

重新校准用于首次绑定、规则升级、映射变化或用户手动校准。

同步完成后立即全量重算派生视图。

自动定时同步不是 v1 必需能力。后续可以添加 Vercel Cron 或外部 cron，但核心路径不能依赖它。

## CalDAV 范围

v1 只做 password/token-based CalDAV provider。

支持：

- 用户输入 CalDAV server URL
- 用户输入 username
- 用户输入 app password / token
- 服务端加密保存凭证
- discovery calendar home
- 列出 calendar collections
- 用户将 collections 映射到 Afloat 语义
- 按时间范围读取 VEVENT
- 保存原始 iCalendar payload
- 近期同步
- 重新校准

不做：

- 写回事件
- 创建日历
- 删除事件
- provider push sync
- Google Calendar API
- Google OAuth
- OAuth-based CalDAV
- 多 provider 并存

CalDAV adapter 应暴露平台无关接口：

```ts
interface CalendarProvider {
  listCalendars(): Promise<CalendarSource[]>
  listEvents(calendarId: string, range: DateRange): Promise<RawCalendarEvent[]>
}
```

v1 只有一个实现：

```text
CalDavProvider
```

Google Calendar 不是 v1 目标 provider。Google 支持后置到 SaaS OAuth 或高级 Google provider。

## Serverless 约束

Vercel + Neon 的主要代价：

- Serverless 函数存在超时
- 重新校准可能需要分批
- 数据库连接需要使用 serverless-friendly 方式
- 免费额度不是无限资源
- 后台 worker 能力较弱
- 平台能力可能造成 lock-in
- CalDAV provider 差异可能导致同步耗时和兼容问题

因此 v1 需要避免：

- 依赖 Vercel Cron 作为核心功能
- 使用 Edge runtime 访问数据库
- 浏览器直接连接 Neon
- 把同步设计成长时间阻塞任务
- 把业务逻辑绑定到 Vercel 专有 API

## Cloud Run 兼容

虽然默认部署走 Vercel + Neon，代码应保持 Cloud Run / VPS 兼容。

要求：

- 使用标准 Postgres
- 服务端逻辑按普通 Node runtime 编写
- 规则引擎是纯 TypeScript 函数
- 同步逻辑可从 API route 移到 worker
- Next.js 支持 standalone build
- 环境变量不依赖 Vercel 专有命名

后续可以补：

```text
Dockerfile
docker-compose.yml
Cloud Run deployment guide
VPS deployment guide
```

## 演进路线

### Phase 1：开源 MVP

- Next.js + TypeScript
- Drizzle + Postgres
- Vercel + Neon
- CalDAV only
- no OAuth-based calendar provider
- 单用户
- 手动同步
- 派生视图全量重算
- 无 worker
- 无 SaaS 多用户

### Phase 2：增强自托管

- 添加 Dockerfile
- 添加 docker-compose
- 支持 Cloud Run、VPS、Render、Railway、Fly.io
- 保持同一套业务代码

### Phase 3：小规模 SaaS

引入：

- Auth
- 多 owner
- 后台 job
- worker service
- scheduled sync
- billing
- admin
- optional Google Calendar API provider

推荐 SaaS 架构：

```text
Cloud Run web service
Cloud Run worker service
Cloud Tasks
Cloud Scheduler
Postgres
```

同步流程从请求内执行演进为：

```text
用户点击同步
  ↓
创建 sync job
  ↓
worker 执行同步和派生视图计算
  ↓
页面读取 sync_runs 和 computed_views
```

## v1 不做

技术架构 v1 不做：

- 多租户 SaaS
- 队列 worker
- 分布式锁
- 自动定时同步作为必需功能
- 平台专用存储
- 浏览器直连数据库
- 前端解释原始日历事件
- Google OAuth
- Google Calendar API
- 多日历 provider

v1 的目标是：

> 用低摩擦方式发布一个可自部署的单用户 Afloat，同时让核心计算和数据边界能平滑迁移到未来 SaaS。
