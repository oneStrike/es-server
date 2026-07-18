# Drizzle 配置文件合并 设计

**日期：** 2026-07-19
**状态：** 已批准
**方案：** A — 合并为 1 个文件

## 背景与问题

仓库根目录有 4 个 drizzle-kit 配置文件（在 studio 移除后）：

| 文件                        | 行数 | 职责                                          | 被谁使用                            |
| --------------------------- | ---- | --------------------------------------------- | ----------------------------------- |
| `drizzle.shared.config.ts`  | 18   | 共享基础配置（dialect/schema/out/migrations） | 被 config 和 migrate 引用           |
| `drizzle.config.ts`         | 5    | generate/check 命令配置（不需要连库）         | `db:generate`、`db:migration:check` |
| `drizzle.migrate.config.ts` | 14   | migrate 命令配置（需要连库）                  | `db:migrate`                        |
| `drizzle.env.ts`            | 27   | env 加载 helper（读 .env、校验 DATABASE_URL） | 仅被 migrate.config 引用            |

`drizzle.env.ts` 原本为 migrate 和 studio 两个调用方服务，但 studio 已移除，现在只有 1 个调用方。4 个文件共 64 行，间接层过多。

## 设计

### 架构

将 4 个文件合并为单一的 `drizzle.config.ts`，用条件逻辑区分是否需要 `dbCredentials`。

| 操作     | 文件                                   | 理由                                                                               |
| -------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| **重写** | `drizzle.config.ts`                    | 合并所有配置：基础配置内联 + best-effort `.env` 加载 + 条件 `dbCredentials`        |
| **删除** | `drizzle.shared.config.ts`             | 基础配置内联进 `drizzle.config.ts`，不再需要独立共享文件                           |
| **删除** | `drizzle.migrate.config.ts`            | migrate 命令改用 `drizzle.config.ts`，由条件 `dbCredentials` 提供连库凭证          |
| **删除** | `drizzle.env.ts`                       | env 加载逻辑内联进 `drizzle.config.ts`，不再需要独立 helper                        |
| **修改** | `package.json`                         | `db:migrate` 的 `--config` 从 `drizzle.migrate.config.ts` 改为 `drizzle.config.ts` |
| **修改** | `.trae/rules/07-drizzle-operations.md` | 更新描述：单一配置文件、generate/check 现在也加载 `.env`                           |
| **修改** | `README.md`                            | 第 57 行引用 `drizzle.migrate.config.ts`，改为 `drizzle.config.ts`                 |
| **修改** | `Dockerfile`                           | 移除对 `drizzle.migrate.config.ts` 和 `drizzle.shared.config.ts` 的 COPY 引用      |

### 行为变化点

1. `db:generate` / `db:migration:check` 现在会加载 `.env`（目前不会）——但仍然不连接数据库，不影响功能
2. `db:migrate` 缺少 `DATABASE_URL` 时，错误消息从自定义的 `'db:migrate 需要 DATABASE_URL'` 变为 drizzle-kit 的默认错误

### 合并后的 `drizzle.config.ts`

```typescript
import { existsSync } from 'node:fs'
import { env, loadEnvFile } from 'node:process'
import { defineConfig } from 'drizzle-kit'

// Best-effort 加载 .env；DATABASE_URL 存在时注入 dbCredentials，
// 使 generate/check（不连库）和 migrate（连库）共用同一份配置。
if (existsSync('.env')) {
  loadEnvFile('.env')
}

const databaseUrl = env.DATABASE_URL?.trim()

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema/index.ts',
  out: './db/migration',
  schemaFilter: 'public',
  tablesFilter: ['*'],
  migrations: {
    table: '__drizzle_migrations__',
    schema: 'public',
  },
  breakpoints: true,
  strict: true,
  verbose: true,
  ...(databaseUrl ? { dbCredentials: { url: databaseUrl } } : {}),
})
```

**设计要点：**

- `existsSync('.env')` + `loadEnvFile` 在模块顶层执行——所有 drizzle-kit 子命令都会触发，但 `.env` 不存在时跳过，不影响 generate/check
- `databaseUrl` 为空时条件 spread 产出 `{}`，`dbCredentials` 缺失——generate/check 正常运行，migrate 由 drizzle-kit 报错
- 去掉了原 `satisfies Config`——`defineConfig` 返回值已是 `Config`，冗余
- 去掉了 `import type { Config }`——不再需要类型导入
- 20 行，从 4 个文件（共 64 行）压缩为 1 个文件

### package.json 脚本变更

仅 1 行变更：

```
"db:migrate": "drizzle-kit migrate --config=drizzle.migrate.config.ts"
```

改为：

```
"db:migrate": "drizzle-kit migrate --config=drizzle.config.ts"
```

`db:generate` 和 `db:migration:check` 已经使用 `drizzle.config.ts`，无需改动。

### 文档更新

`.trae/rules/07-drizzle-operations.md` 需 2 处修改：

**修改 1**（命令路径）：

```markdown
drizzle-kit migrate --config=drizzle.migrate.config.ts
```

改为：

```markdown
drizzle-kit migrate --config=drizzle.config.ts
```

**修改 2**（配置描述）：

```markdown
迁移 config 与 schema/check config 共享唯一的 schema、migration directory 和
`public.__drizzle_migrations__` 合同；它读取本地 `.env`（若存在）并要求
`DATABASE_URL`。不提供 `mode`、目标别名、旧 journal 解释器、reconcile/rollback
helper 或迁移兼容分支。
```

改为：

```markdown
所有 drizzle-kit 子命令共用 `drizzle.config.ts`。该配置 best-effort 加载 `.env`，
并在 `DATABASE_URL` 可用时注入 `dbCredentials`；generate/check 不连库也不要求
`DATABASE_URL`，migrate 连库。不提供 `mode`、目标别名、旧 journal 解释器、
reconcile/rollback helper 或迁移兼容分支。
```

第 20-22 行关于 `db:migration:check` 的描述（"两者都不连接数据库"）保持不变——加载 `.env` 不等于连接数据库，该描述仍然准确。

### README.md 变更

第 57 行：

```
db:migrate` 直接运行 `drizzle-kit migrate --config=drizzle.migrate.config.ts`，并要求 `DATABASE_URL`。
```

改为：

```
db:migrate` 直接运行 `drizzle-kit migrate --config=drizzle.config.ts`，并要求 `DATABASE_URL`。
```

### Dockerfile 变更

**第 28 行**（builder 阶段 COPY）：

```dockerfile
COPY pnpm-lock.yaml package.json nest-cli.json tsconfig*.json drizzle.config.ts drizzle.migrate.config.ts drizzle.shared.config.ts webpack.config.js ./
```

移除 `drizzle.migrate.config.ts` 和 `drizzle.shared.config.ts`：

```dockerfile
COPY pnpm-lock.yaml package.json nest-cli.json tsconfig*.json drizzle.config.ts webpack.config.js ./
```

**第 106-107 行**（runtime 阶段 COPY）：

```dockerfile
COPY --from=builder --chown=nestjs:nodejs /app/drizzle.migrate.config.ts ./drizzle.migrate.config.ts
COPY --from=builder --chown=nestjs:nodejs /app/drizzle.shared.config.ts ./drizzle.shared.config.ts
```

删除这两行。`drizzle.config.ts`（第 105 行）已经存在，无需新增。

### 删除清单

| 文件                        | 原职责                    |
| --------------------------- | ------------------------- |
| `drizzle.shared.config.ts`  | 共享基础配置（已内联）    |
| `drizzle.migrate.config.ts` | migrate 配置（已合并）    |
| `drizzle.env.ts`            | env 加载 helper（已内联） |

### 验证策略

1. **全局搜索残留引用** — 在全仓库 grep `drizzle.shared.config`、`drizzle.migrate.config`、`drizzle.env`，确认除 `package.json`、`07-drizzle-operations.md`、`README.md`、`Dockerfile`（均已更新）和 `docs/superpowers/plans/` 历史文档外无残留
2. **类型检查基线** — `pnpm type-check`（根级配置文件不在 `tsconfig.build.json` 的 include 范围内，确认无连带破坏）
3. **Markdown 格式检查** — `pnpm exec prettier --check .trae/rules/07-drizzle-operations.md`
4. **实际命令验证** — `pnpm db:generate` 确认 generate 在新配置下正常工作（不需要 DATABASE_URL 也能运行）

### 不受影响

- `db:generate`、`db:migration:check` 脚本路径不变，仍为 `--config=drizzle.config.ts`
- `db:seed:demo`、`db:bootstrap:reference` 等不使用 drizzle-kit 配置文件，不受影响
- `08-testing.md` 无需修改（不引用被删文件）
- `docs/superpowers/plans/` 下的历史计划文档（`drizzle-config-env-dedup.md`、`drizzle-studio-local-dev.md`、`drizzle-studio-removal.md`）引用被删文件名，但属于历史记录，不更新

## 约束

- 仓库不保留测试文件（AGENTS.md §2），验证以 `pnpm type-check` 为底线。
- 根级 `*.ts` 文件不在 `tsconfig.build.json` 的 `include` 范围内（仅 `apps/**/*` 和 `libs/**/*`），也不在 eslint lint glob（`{apps,libs,scripts,db}/**/*.ts`）内——与现有 `drizzle.config.ts` 的处理方式一致。
- `07-drizzle-operations.md` 描述的是配置文件的行为，重构后行为变化点已在"行为变化点"章节明确记录，文档同步更新。
