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

- 所有应用与迁移只使用 `DATABASE_URL` 指向唯一业务数据库 `foo`；`.env.example` 仅提供无凭据占位形式。
- 标准流程是 `pnpm db:generate` → 审查新增 SQL → `pnpm db:migration:check` → `pnpm db:comments:check` → `pnpm db:migrate`。`db:migrate` 直接运行 `drizzle-kit migrate --config=drizzle.config.ts`，并要求 `DATABASE_URL`。
- 当前 initial migration 从 `db/schema/index.ts` 生成；提交后 migration history 严格 append-only。已有旧 migration line 的数据库没有原地升级、数据转换、旧 journal 接管、兼容 view 或双读写路径；需要重置时必须取得明确授权并在独立维护流程中执行。
- initial migration 会在首个 trigram index 前创建 `pg_trgm` version `1.6`；执行迁移的角色必须拥有相应权限。migration SQL 不得包含自己的 transaction control，schema comments 必须作为受审查的 `COMMENT ON` DDL 进入 migration。
- 本仓库不使用数据库外键，也不使用 `drizzle-kit push` / `push --force`。部署编排必须保证单一 migration job，应用启动、compose 与普通验证均不隐式执行 migration、reset、seed 或 bootstrap。
- reference bootstrap 可通过 `pnpm db:bootstrap:reference` 显式执行；demo seed 仅能通过 `pnpm db:seed:demo` 显式执行，并要求 `ALLOW_DB_SEED=true`。

## 规范入口

- 项目级最小约束：`AGENTS.md`
- 单一规范事实源：`.trae/rules/PROJECT_RULES.md`
- 仓库地图：`.codex/skills/es-server-standards/references/repo-map.md`

规则发生冲突时，优先保护当前稳定运行的共享抽象与对外契约，再在交付说明中记录冲突点与暂行决策。
