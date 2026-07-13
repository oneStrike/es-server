# Drizzle 操作附录

本文件只定义真实存在的受控命令和顺序；数据建模与 RQB v2 规则以
[07-drizzle.md](./07-drizzle.md) 为准。

这些命令的 migration/static gate 实现统一由 `db/operations/**` 持有，登记 target 的安全
解析由 `db/targets/**` 持有；`scripts/` 不再作为数据库 operational CLI/helper owner。

## 常规只读检查

```bash
pnpm db:active:migration:check
pnpm db:migration:check
pnpm db:comments:check
pnpm db:core:check
```

`db:migrate` 不是无参数命令，必须显式提供 mode 与已登记 disposable target；它不会
接受 production/shared URL：

```bash
pnpm db:migrate -- --mode active --target-id <registered-local-target>
```

`db:active:migration:check` 校验正常 active history 的每个目录名、非空
`migration.sql`、SQL hash 和零 physical FK；它遵循 Drizzle 的 append-only runtime
lifecycle。

已存在的 journal 必须已经是当前 Drizzle RC 形状（`id`、`hash`、`created_at`、`name`、
`applied_at`）；运行入口不解释、升级或兼容旧 journal。不存在 `db:migrate:prod`、
`db:studio`、`db:push`、`pnpm check` 或自动 seed 的替代入口；不得用 shell、
`drizzle-kit push` 或直接连库绕过这一限制。

任何写入前，active journal 必须是本地 history 的连续 append-only 前缀（空库允许）；
不符合时在调用 Drizzle migrator 前失败，写后仍执行完整 history 复核。

## Reference bootstrap

```bash
pnpm db:bootstrap:reference:check -- --target-id <registered-local-target>
pnpm db:bootstrap:reference -- --target-id <registered-local-target>
```

reference bootstrap 可重复同步 RBAC reference data；migrator 永不自动调用它。写入前会重新
解析 target registry，并在 session 中核验 `current_database()`。

## Demo seed

```bash
pnpm db:seed:demo:target -- --target-id <registered-local-target> --check-env
pnpm db:seed:demo:target -- --target-id <registered-local-target>
```

demo seed 只允许登记的 local disposable target，且要求 `ALLOW_DB_SEED=true`；它不会被
migrator 或 bootstrap 隐式调用。

任何失败都停止并记录必要的脱敏诊断。不得启用旧 migration log fallback、兼容 API、双读、
双写、`--ignore-conflicts` 或未登记的临时写入命令。
