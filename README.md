# ES Server

`es-server` 是一个基于 NestJS、Fastify 和 Drizzle ORM 的服务端 monorepo，当前包含管理端 API、用户端 API、共享业务库与数据库层。

## 目录概览

- `apps/admin-api`：管理端 API 入口。
- `apps/app-api`：用户端 API 入口。
- `libs/*`：共享业务模块、平台能力与 DTO 契约。
- `db/*`：Drizzle schema、数据库核心能力、扩展与 seed。
- `docs/*`：审计、任务单和说明性文档。
- `.trae/rules/*`：仓库级规范事实源。

## 初始化

```bash
pnpm install
cp .env.example .env
```

如需完整启动本地环境，请根据 `.env.example` 准备数据库、Redis 和其他外部依赖。

## 常用命令

```bash
# 本地开发
pnpm start:admin
pnpm start:app

# 构建
pnpm build:admin
pnpm build:app

# 验证
pnpm type-check
pnpm test
pnpm test:cov

# 数据库
pnpm db:generate
pnpm db:migrate
pnpm db:comments:check
pnpm db:studio

# API 发布
pnpm publish-api:admin
pnpm publish-api:app
```

## 提交与验证约定

- 提交信息使用 Conventional Commits。
- 仓库当前没有 `pnpm run commit` 脚本，请直接使用 `git commit`。
- 仓库内存在 `.husky/pre-commit` 与 `.husky/commit-msg` 文件，但本地是否生效取决于 Git hooks 配置；不要把钩子当作跳过手工验证的前提。
- 正式 `*.spec.ts` 是仓库资产，不因任务完成而删除；只删除临时探针、一次性脚本或明确标记为临时的验证文件。
- `pnpm test:e2e` 当前不作为默认验证命令；对应配置 `apps/akaiito-server-nestjs/test/jest-e2e.json` 尚不存在。

## 规范入口

- 项目级最小约束：[AGENTS.md](./AGENTS.md)
- 规则索引：[.trae/rules/RULE_INDEX.md](./.trae/rules/RULE_INDEX.md)
- 仓库地图：[.codex/skills/es-server-standards/references/repo-map.md](./.codex/skills/es-server-standards/references/repo-map.md)

规则发生冲突时，优先保护当前稳定运行的共享抽象与对外契约，再在交付说明中记录冲突点与暂行决策。
