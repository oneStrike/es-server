# Drizzle 操作附录

本文件只定义真实存在的受控命令和顺序；数据建模与 RQB v2 规则以
[07-drizzle.md](./07-drizzle.md) 为准。

`db/migrate.ts` 是受控 migration 执行入口；`scripts/` 不再作为数据库 operational
CLI/helper owner。

## 常规只读检查

```bash
pnpm db:migration:check
pnpm db:comments:check
```

`db:migration:check` 使用 Drizzle Kit 检查当前 migration 图；它不再检查 local active
history 或数据库 journal。

底层 migrator 必须显式使用 `active` mode；`pnpm db:migrate` 已在
`package.json` 中固定传入该参数，并从 `DATABASE_URL` 读取连接：

```bash
pnpm db:migrate
```

不存在 `db:migrate:prod`、`db:studio`、`db:push`、`pnpm check` 或自动 seed 的替代
入口；不得用 shell、`drizzle-kit push` 或直接连库绕过这一限制。

## Canonical baseline boundary

`db/migration` 仅保留从当前 `db/schema/index.ts` 生成的一条全量 baseline。它只可
初始化 `public` schema 中不存在应用表的 PostgreSQL 数据库；`pnpm db:migrate` 不会也
不得推断、修复或接管旧 migration journal、已有表或历史业务数据。

已经运行旧 migration line 的数据库不具备原地升级路径。必须恢复与该历史匹配的备份，
或经明确授权清空数据库后再执行 baseline；不得添加转换 migration、兼容 view、双读写
或迁移别名来规避该边界。

baseline 在 GIN trigram 索引之前显式执行 `CREATE EXTENSION IF NOT EXISTS pg_trgm`；迁移
角色必须拥有创建该扩展的权限。

## Reference bootstrap

```bash
pnpm db:bootstrap:reference:check
pnpm db:bootstrap:reference
```

reference bootstrap 可重复同步 RBAC reference data；migrator 永不自动调用它。写入前会在
session 中核验 `current_database()` 是否与 `DATABASE_URL` 一致。

## Demo seed

```bash
pnpm db:seed:demo -- --check-env
pnpm db:seed:demo
```

demo seed 要求 `ALLOW_DB_SEED=true`，且在 `NODE_ENV=production/prod` 或连接信息命中生产
危险关键字时失败；它不会被 migrator 或 bootstrap 隐式调用。

任何失败都停止并记录必要的脱敏诊断。不得启用兼容 API、双读、双写、`--ignore-conflicts`
或未登记的临时写入命令。
