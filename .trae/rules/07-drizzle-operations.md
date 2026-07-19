# Drizzle 操作附录

本文件只定义真实存在的受控命令和顺序；数据建模与 RQB v2 规则以
[07-drizzle.md](./07-drizzle.md) 为准。

## 常规 schema 变更

```bash
pnpm db:generate
pnpm db:migration:check
pnpm db:comments:check
pnpm db:migrate
```

`db:generate` 从 `db/schema/index.ts` 生成新的 Drizzle SQL migration。它会写入
`db/migration`，因此不是只读验证命令；生成后必须审查 SQL，并确认迁移目录只包含
Drizzle 生成的 `migration.sql` 与 `snapshot.json`。生成过程出现交互时立即停止，不代为
选择或猜测。

`db:migration:check` 与 `db:comments:check` 是只读 gate。前者使用
`drizzle.config.ts` 检查 migration history，后者确认 `db/comments/generated.sql`
与 schema comments artifact 一致且 warnings 为 0；两者都不连接数据库。

`db:migrate` 直接执行：

```bash
drizzle-kit migrate --config=drizzle.config.ts
```

所有 drizzle-kit 子命令共用 `drizzle.config.ts`。该配置 best-effort 加载 `.env`，
并在 `DATABASE_URL` 可用时注入 `dbCredentials`；generate/check 不连库也不要求
`DATABASE_URL`，migrate 连库。不提供 `mode`、目标别名、旧 journal 解释器、
reconcile/rollback helper 或迁移兼容分支。

部署编排必须保证每个环境同一时间只有一个 migration job，应用启动不得执行 migration。
`pnpm db:migrate`、compose 和普通验证命令都不执行 reset、seed 或 bootstrap。

## 当前 `foo` migration boundary

当前项目唯一业务数据库是 `foo`。本次已授权的破坏性重置以当前 initial migration 建立
新的 migration line；物理 reset 是独立维护流程，不是 package script 或应用启动能力。
它只能在明确授权、精确项目数据库 allowlist、只读 preflight、维护窗口隔离和终态验证都
通过后执行。

新的 initial migration 提交后，后续 schema 与 comments 变更严格 append-only：只能新增
直接 sibling migration directory，不能改写、删除或移动已提交 migration。已运行旧 line
的数据库没有原地升级、旧 journal 接管、数据转换、兼容 view、双读写或 migration alias
路径；需要新的破坏性重置时必须形成新的显式决策和授权。

initial migration 会在首个 trigram index 前创建 `pg_trgm` version `1.6`。迁移角色必须具备
该扩展所需权限。migration SQL 不得自行控制事务；`BEGIN`、`START TRANSACTION`、
`COMMIT`、`ROLLBACK`、savepoint 或 prepared transaction 均由完整性 gate 拒绝。

schema comments 是版本化 DDL：修改 schema comments 时，先刷新
`db/comments/generated.sql`，再把相同结构化 `COMMENT ON` statements 作为审查过的 migration
SQL 提交。generated artifact 不可在 migrate 后回写数据库，`--apply` 不是受支持入口。

## 启动期 RBAC 同步与 demo seed

```bash
pnpm db:seed:demo -- --check-env
pnpm db:seed:demo
```

迁移完成后，`admin-api` 在监听端口前扫描已加载 Controller 的权限装饰器，并在事务内同步
RBAC revision、内置角色、默认菜单、权限和角色默认授权。该启动期同步不创建管理员账号，
也不执行 migration、reset 或 demo seed。`app-api` 不执行管理端 RBAC 同步。

demo seed 要求 `ALLOW_DB_SEED=true`，且在 `NODE_ENV=production/prod` 或连接信息命中
生产危险关键字时失败；它不会被 migrator 或应用启动隐式调用。demo seed 依赖启动期同步
创建的 `super_admin` 角色，必须在至少一次成功的 `admin-api` 启动之后执行。

禁止 `drizzle-kit push`、`drizzle-kit push --force`、`db:push`、`--ignore-conflicts`、
未登记临时写入和任何旧 migration fallback。任何失败都停止并记录必要的脱敏诊断。
