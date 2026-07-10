# Drizzle 操作附录

本文件是 [Drizzle 使用规范](./07-drizzle.md) 的操作附录，只承载受控命令入口与执行顺序。

- 它不是独立规则文件。
- Drizzle 约束、禁止项和建模原则仍以 [07-drizzle.md](./07-drizzle.md) 为准。

## 结构变更入口

- 生成 migration：`pnpm db:generate`
- 检查 migration：`pnpm db:migration:check`
- 开发环境执行 migration：`pnpm db:migrate`
- 生产环境执行 migration：`pnpm db:migrate:prod`
- 生成 schema 注释 SQL：`pnpm db:comments:generate`
- 检查 schema 注释 SQL：`pnpm db:comments:check`

常规结构变更始终 append-only；不得修改或删除已生成、已提交或已执行的 migration。

## Development epoch baseline 入口

- 规则与授权事实源：[07-drizzle.md](./07-drizzle.md) 与[零债务开发纪元 ADR](../../docs/architecture/zero-debt-development-epoch.md)。
- candidate 检查目标入口：`pnpm db:baseline:candidate:check`。
- baseline reset 必须使用独立的显式 epoch 命令；普通 `db:migrate`、`pnpm check`、应用启动和测试命令不得包含销毁副作用。
- 专用 reset 命令尚未在仓库建立前，禁止手工删除 migration 目录或直接销毁数据库；不得用临时 shell 命令绕过 guard。

## Demo seed 入口

- 环境检查：`pnpm db:seed:demo:check`
- 显式设置 `ALLOW_DB_SEED=true` 后执行：`pnpm db:seed:demo`

## Bootstrap 入口

- 本地 / 准生产环境检查：`pnpm db:bootstrap:reference:check`
- 本地 / 准生产环境执行：`pnpm db:bootstrap:reference`
- 生产环境检查：`pnpm db:bootstrap:reference:prod:check`
- 生产环境执行：`pnpm db:bootstrap:reference:prod`

## 固定顺序

- 改 schema：先生成 migration，再检查 migration，再执行迁移。
- 改 schema 注释：刷新 `db/comments/generated.sql` 后再做注释检查。
- 跑 demo seed：先做环境检查，再显式设置 `ALLOW_DB_SEED=true` 执行。
- 跑 bootstrap：先做环境检查，再执行对应环境入口。

## 当前 epoch 的 Gate A/B/C 顺序

1. Gate A：确认 `NODE_ENV=development|test`；确认 `ALLOW_DESTRUCTIVE_DB_RESET=true` 与 `DESTRUCTIVE_DB_EPOCH=20260710_ZERO_DEBT`；确认 host allowlist、disposable 数据库名并打印唯一目标。
2. 冻结 schema/index/comments；candidate init 只写隔离目录，不改旧 migration。
3. Gate B：对至少两个独立空 PostgreSQL 实例执行 candidate migrate、comments、bootstrap、seed、app start/readback；校验 digest、第二次 migrate no-op 与 bootstrap 幂等。
4. Gate B 全绿后，固化唯一 `0000_init`，删除旧 migration/snapshot/reconcile/rollback/旧日志解释器。
5. Gate C：只对 Gate A 枚举的 dev/test 目标执行 reset，并用唯一 baseline 重建与 smoke。
6. 记录完成提交/标签和证据；恢复常规 append-only。

任何一步失败都停止；只允许回退 Git 与重建 disposable 数据库，不运行 `push`、`--ignore-conflicts` 或旧链 fallback。
