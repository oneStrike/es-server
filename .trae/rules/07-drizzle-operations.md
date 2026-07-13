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

`db:migrate` 不是无参数命令，必须显式提供 mode，并从 `DATABASE_URL` 读取连接：

```bash
pnpm db:migrate -- --mode active
```

不存在 `db:migrate:prod`、`db:studio`、`db:push`、`pnpm check` 或自动 seed 的替代
入口；不得用 shell、`drizzle-kit push` 或直接连库绕过这一限制。

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
