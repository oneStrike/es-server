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
