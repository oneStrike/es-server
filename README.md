# ES Server

`es-server` 是一个基于 NestJS、Fastify 和 Drizzle ORM 的服务端 monorepo，当前包含管理端 API、用户端 API、共享业务库与数据库层。

## 目录概览

- `apps/admin-api`：管理端 API 入口。
- `apps/app-api`：用户端 API 入口。
- `libs/*`：共享业务模块、平台能力与 DTO 契约。
- `db/*`：Drizzle schema、数据库核心能力、扩展与 seed。
- `docs/*`：审计、任务单和说明性文档。
- `.trae/rules/PROJECT_RULES.md`：仓库级规范入口。

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

# 数据库：只读检查
pnpm db:core:check
pnpm db:migration:check
pnpm db:comments:check

# API 发布
pnpm publish-api:admin
pnpm publish-api:app
```

## 提交与验证约定

- 提交信息使用 Conventional Commits。
- 仓库当前没有 `pnpm run commit` 脚本，请直接使用 `git commit`。
- 仓库通过 `simple-git-hooks` 配置 `pre-commit`（lint-staged）与 `commit-msg`（commitlint）；本地是否生效取决于 hooks 是否安装，不要把钩子当作跳过手工验证的前提。
- 仓库不保留任何测试文件；开发中临时创建的 `*.spec.ts`、`*.test.ts`、`*.e2e.spec.ts`、探针脚本或测试目录必须在交付前删除。
- `pnpm test`、`pnpm test:cov`、`pnpm test:e2e` 不作为默认交付验证命令；交付验证以 `pnpm type-check` 及必要的 lint、build、静态检查为准。

## 数据库迁移与初始化

- `pnpm db:migrate` 只面向明确登记的本地 disposable target，必须显式传入 `--mode active` 和 `--target-id`；它不是生产部署别名。
- 数据库 migration/static gate 的 operational owner 位于 `db/operations/**`，target guard 位于 `db/targets/**`；`scripts/` 只保留数据库注释与 Admin RBAC 入口。
- 本仓库不使用数据库外键，不使用 `drizzle-kit push` / `push --force` 作为交付路径。
- 迁移、停写、数据导入、发布与回滚都不是 compose 或本地脚本的隐式副作用，必须由对应环境的操作流程明确执行。
- reference bootstrap 可通过 `pnpm db:bootstrap:reference -- --target-id <target>` 显式执行；demo seed 仅能通过 `pnpm db:seed:demo:target -- --target-id <target>` 对登记的本地 target 执行，并要求 `ALLOW_DB_SEED=true`。

## 规范入口

- 项目级最小约束：`AGENTS.md`
- 单一规范事实源：`.trae/rules/PROJECT_RULES.md`
- 仓库地图：`.codex/skills/es-server-standards/references/repo-map.md`

规则发生冲突时，优先保护当前稳定运行的共享抽象与对外契约，再在交付说明中记录冲突点与暂行决策。
