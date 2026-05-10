# 浮生～时间的永恒镜像

Afloat 是一个承诺观察系统。它读取日历中的计划与偏移记录，重算事实层和派生视图，再用一个镜像页展示时间最终流向。

## 运行

```bash
pnpm install
pnpm dev
```

开发服务默认运行在 `http://localhost:3000`。

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
