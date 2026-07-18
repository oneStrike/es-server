# Drizzle 配置 env 加载逻辑去重 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `drizzle.migrate.config.ts` 与 `drizzle.studio.config.ts` 中完全重复的 `.env` 加载与 `DATABASE_URL` 读取逻辑提取为共享 helper，消除维护隐患。

**架构：** 新建 `drizzle.env.ts` 作为 env 加载的唯一 owner，导出 `loadDatabaseUrl(commandLabel)` 函数。两个需要连库的 drizzle-kit 配置文件（migrate / studio）各自缩减为"调用 helper + 组装 `defineConfig`"的薄壳。`drizzle.shared.config.ts` 保持纯配置声明不变，`drizzle.config.ts`（generate / check）不受影响。

**技术栈：** drizzle-kit@1.0.0-rc.3、TypeScript、Node.js `node:process` API

---

## 背景与问题

### 当前状态

仓库根目录有四份 drizzle-kit 配置文件：

| 文件                        | 用途                                          | 含 `dbCredentials` |
| --------------------------- | --------------------------------------------- | ------------------ |
| `drizzle.shared.config.ts`  | 共享基础配置（dialect/schema/out/migrations） | 否                 |
| `drizzle.config.ts`         | `db:generate` / `db:migration:check`          | 否                 |
| `drizzle.migrate.config.ts` | `db:migrate`                                  | 是                 |
| `drizzle.studio.config.ts`  | `db:studio`                                   | 是                 |

`drizzle.migrate.config.ts` 和 `drizzle.studio.config.ts` 的第 1-17 行完全重复——只有 `throw new Error(...)` 的文案不同（`'db:migrate 需要 DATABASE_URL'` vs `'db:studio 需要 DATABASE_URL'`）。重复的逻辑包括：

1. `import { existsSync } from 'node:fs'`
2. `import { env, loadEnvFile } from 'node:process'`
3. 检查 `.env` 是否存在并加载
4. 读取 `env.DATABASE_URL?.trim()`
5. 缺失时抛出错误

### 为什么不复用 `db/runtime-guard.ts` 或 `db/seed/db-client.ts`

- `db/runtime-guard.ts` 的 `readDatabaseConnection()` 会解析 URL 为结构体（`DatabaseConnection`），并耦合了生产危险关键字检查逻辑，职责与 drizzle-kit 配置文件不匹配。
- `db/seed/db-client.ts` 的 `getDatabaseUrl()` 不加载 `.env` 文件，且属于 `db/seed` 域。
- 导入边界规范（`01-import-boundaries.md`）规定根级配置文件不应依赖 `db/` 内部文件；drizzle-kit 配置文件位于仓库根目录，使用相对路径互引，不命中 `@db/*` 白名单体系。
- 新建根级 `drizzle.env.ts` 与现有 `drizzle.shared.config.ts`、`drizzle.config.ts` 并列，保持 drizzle-kit 配置文件的内聚性。

### 约束

- 仓库不保留测试文件（AGENTS.md §2），验证以 `pnpm type-check` 为底线。
- 根级 `*.ts` 文件不在 `tsconfig.build.json` 的 `include` 范围内（仅 `apps/**/*` 和 `libs/**/*`），也不在 eslint lint glob（`{apps,libs,scripts,db}/**/*.ts`）内——与现有 `drizzle.config.ts`、`drizzle.migrate.config.ts` 的处理方式一致。
- `07-drizzle-operations.md` 中描述的是配置文件的行为（"读取本地 `.env`（若存在）并要求 `DATABASE_URL`"），重构后行为不变，文档无需修改。

---

## 文件结构

| 文件                        | 职责                                                                           | 操作     |
| --------------------------- | ------------------------------------------------------------------------------ | -------- |
| `drizzle.env.ts`            | drizzle-kit 连库命令的 env 加载 helper：加载 `.env`、读取并校验 `DATABASE_URL` | **创建** |
| `drizzle.migrate.config.ts` | migrate 配置：调用 helper + 组装 `defineConfig`                                | **修改** |
| `drizzle.studio.config.ts`  | studio 配置：调用 helper + 组装 `defineConfig`                                 | **修改** |
| `drizzle.shared.config.ts`  | 共享基础配置（纯声明，无副作用）                                               | 不修改   |
| `drizzle.config.ts`         | generate / check 配置（不需要连库）                                            | 不修改   |

**设计边界确认：**

- `drizzle.env.ts` 是 env 加载的唯一 owner，有明确的单一职责。
- `drizzle.shared.config.ts` 继续只导出纯配置对象 `drizzleKitConfig`，不引入副作用——env 加载与配置声明保持分离。
- 两个配置文件各自只保留"差异部分"：错误消息中的命令标签（`'db:migrate'` vs `'db:studio'`）。
- `drizzle.config.ts`（generate / check）不需要连库，不引入 `drizzle.env.ts`。

---

### 任务 1：创建 `drizzle.env.ts`

**文件：**

- 创建：`drizzle.env.ts`

- [ ] **步骤 1：编写 helper 文件**

在仓库根目录创建 `drizzle.env.ts`：

```typescript
import { existsSync } from 'node:fs'
import { env, loadEnvFile } from 'node:process'

/**
 * 为 drizzle-kit 需要连库的子命令（migrate / studio）加载环境变量并返回 DATABASE_URL
 *
 * - 若项目根目录存在 `.env` 文件则自动加载
 * - 读取 `DATABASE_URL` 并 trim，缺失时抛出包含命令标签的明确错误
 *
 * @param commandLabel - 调用方命令标签，用于错误消息（如 `'db:migrate'`）
 * @returns 经过 trim 的 `DATABASE_URL` 字符串
 */
export function loadDatabaseUrl(commandLabel: string): string {
  const localEnvFile = '.env'

  if (existsSync(localEnvFile)) {
    loadEnvFile(localEnvFile)
  }

  const databaseUrl = env.DATABASE_URL?.trim()

  if (!databaseUrl) {
    throw new Error(`${commandLabel} 需要 DATABASE_URL`)
  }

  return databaseUrl
}
```

**关键设计点：**

1. 函数签名 `loadDatabaseUrl(commandLabel: string): string` —— 接受命令标签用于错误消息，返回 `string` 类型的 URL。调用方各自传入 `'db:migrate'` 或 `'db:studio'`，保持错误消息与当前行为完全一致。
2. 逻辑与现有 `drizzle.migrate.config.ts` / `drizzle.studio.config.ts` 中被重复的代码逐行等价：同样的 `existsSync` → `loadEnvFile` → `env.DATABASE_URL?.trim()` → `throw if falsy` 流程。
3. 不做 URL 解析——drizzle-kit 只需要 `dbCredentials.url: string`，解析与安全检查是 `db/runtime-guard.ts` 在 seed/bootstrap 场景的职责。
4. 使用 `node:process` 的 `loadEnvFile`（Node 21+ API），与现有配置文件一致；仓库 `@types/node` 为 `^26.0.1`，类型可用。

- [ ] **步骤 2：确认文件已创建**

运行：`Test-Path drizzle.env.ts`

预期输出：`True`

- [ ] **步骤 3：运行类型检查基线**

运行：`pnpm type-check`

预期：PASS（exit code 0）。根级 `*.ts` 不在 `tsconfig.build.json` 的 `include` 范围内，此步骤确认仓库基线未被新文件破坏。

---

### 任务 2：重构 `drizzle.migrate.config.ts`

**文件：**

- 修改：`drizzle.migrate.config.ts`

- [ ] **步骤 1：用 helper 替换重复的 env 加载逻辑**

将 `drizzle.migrate.config.ts` 的完整内容替换为：

```typescript
import type { Config } from 'drizzle-kit'
import { defineConfig } from 'drizzle-kit'
import { loadDatabaseUrl } from './drizzle.env'
import { drizzleKitConfig } from './drizzle.shared.config'

const databaseUrl = loadDatabaseUrl('db:migrate')

export default defineConfig({
  ...drizzleKitConfig,
  dbCredentials: {
    url: databaseUrl,
  },
}) satisfies Config
```

**关键设计点：**

1. 删除了 `existsSync`、`env`、`loadEnvFile` 的直接导入——这些现在由 `drizzle.env.ts` 内部管理。
2. `loadDatabaseUrl('db:migrate')` 的错误消息与重构前完全一致：`'db:migrate 需要 DATABASE_URL'`。
3. `defineConfig({ ...drizzleKitConfig, dbCredentials: { url: databaseUrl } }) satisfies Config` 的类型与结构不变。
4. 导入顺序遵循 ESLint 默认约定：第三方在前（`drizzle-kit`），本地在后（`./drizzle.env`、`./drizzle.shared.config`），按字母序排列。

- [ ] **步骤 2：确认重构后文件内容正确**

运行：`Get-Content drizzle.migrate.config.ts`

预期输出：

```
import type { Config } from 'drizzle-kit'
import { defineConfig } from 'drizzle-kit'
import { loadDatabaseUrl } from './drizzle.env'
import { drizzleKitConfig } from './drizzle.shared.config'

const databaseUrl = loadDatabaseUrl('db:migrate')

export default defineConfig({
  ...drizzleKitConfig,
  dbCredentials: {
    url: databaseUrl,
  },
}) satisfies Config
```

- [ ] **步骤 3：运行类型检查基线**

运行：`pnpm type-check`

预期：PASS（exit code 0）

---

### 任务 3：重构 `drizzle.studio.config.ts`

**文件：**

- 修改：`drizzle.studio.config.ts`

- [ ] **步骤 1：用 helper 替换重复的 env 加载逻辑**

将 `drizzle.studio.config.ts` 的完整内容替换为：

```typescript
import type { Config } from 'drizzle-kit'
import { defineConfig } from 'drizzle-kit'
import { loadDatabaseUrl } from './drizzle.env'
import { drizzleKitConfig } from './drizzle.shared.config'

const databaseUrl = loadDatabaseUrl('db:studio')

export default defineConfig({
  ...drizzleKitConfig,
  dbCredentials: {
    url: databaseUrl,
  },
}) satisfies Config
```

**关键设计点：**

1. 与任务 2 的 `drizzle.migrate.config.ts` 结构完全一致，唯一差异是 `loadDatabaseUrl('db:studio')`。
2. 错误消息与重构前完全一致：`'db:studio 需要 DATABASE_URL'`。

- [ ] **步骤 2：确认重构后文件内容正确**

运行：`Get-Content drizzle.studio.config.ts`

预期输出：

```
import type { Config } from 'drizzle-kit'
import { defineConfig } from 'drizzle-kit'
import { loadDatabaseUrl } from './drizzle.env'
import { drizzleKitConfig } from './drizzle.shared.config'

const databaseUrl = loadDatabaseUrl('db:studio')

export default defineConfig({
  ...drizzleKitConfig,
  dbCredentials: {
    url: databaseUrl,
  },
}) satisfies Config
```

- [ ] **步骤 3：确认两个配置文件的唯一差异**

运行：`Compare-Object (Get-Content drizzle.migrate.config.ts) (Get-Content drizzle.studio.config.ts)`

预期输出：

```
InputObject  SideIndicator
-----------  -------------
db:migrate   =>
db:studio    <=
```

即两文件唯一差异是 `loadDatabaseUrl` 的参数值（`'db:migrate'` vs `'db:studio'`）。

- [ ] **步骤 4：运行类型检查基线**

运行：`pnpm type-check`

预期：PASS（exit code 0）

---

### 任务 4：端到端验证与提交

- [ ] **步骤 1：确认四份配置文件职责边界完整**

运行：逐文件检查 `drizzle.env.ts`、`drizzle.shared.config.ts`、`drizzle.config.ts`、`drizzle.migrate.config.ts`、`drizzle.studio.config.ts` 的职责

预期：

| 文件                        | 职责             | 含 `dbCredentials` | 含 env 加载       |
| --------------------------- | ---------------- | ------------------ | ----------------- |
| `drizzle.env.ts`            | env 加载 helper  | 否                 | 是（owner）       |
| `drizzle.shared.config.ts`  | 共享基础配置     | 否                 | 否                |
| `drizzle.config.ts`         | generate / check | 否                 | 否                |
| `drizzle.migrate.config.ts` | migrate          | 是                 | 否（委托 helper） |
| `drizzle.studio.config.ts`  | studio           | 是                 | 否（委托 helper） |

- [ ] **步骤 2：确认 `drizzle.config.ts` 未被影响**

运行：`Get-Content drizzle.config.ts`

预期输出（与重构前完全一致）：

```
import { defineConfig } from 'drizzle-kit'
import { drizzleKitConfig } from './drizzle.shared.config'

export default defineConfig(drizzleKitConfig)
```

- [ ] **步骤 3：确认 `package.json` scripts 段无需修改**

运行：`node -e "const p=require('./package.json'); Object.entries(p.scripts).filter(([k])=>k.startsWith('db:')).forEach(([k,v])=>console.log(k+': '+v))"`

预期输出（与重构前完全一致，因为脚本引用的是配置文件路径而非内部实现）：

```
db:generate: drizzle-kit generate --config=drizzle.config.ts
db:migration:check: drizzle-kit check --config=drizzle.config.ts
db:comments:generate: tsx scripts/db-comments.ts
db:comments:check: tsx scripts/db-comments.ts --check
db:boundary:check: tsx scripts/check-db-boundary.ts
db:migrate: drizzle-kit migrate --config=drizzle.migrate.config.ts
db:studio: drizzle-kit studio --config=drizzle.studio.config.ts --host=127.0.0.1
db:seed:demo: tsx --env-file=.env db/seed/command.ts
db:bootstrap:reference:manifest:write: tsx scripts/generate-admin-rbac-reference-permissions.ts --write
db:bootstrap:reference:manifest:check: tsx scripts/generate-admin-rbac-reference-permissions.ts
db:bootstrap:reference: pnpm db:bootstrap:reference:manifest:check && tsx --env-file=.env db/bootstrap/reference.ts
db:bootstrap:reference:check: pnpm db:bootstrap:reference:manifest:check && tsx --env-file=.env db/bootstrap/reference.ts --check-env
rbac:coverage:check: tsx scripts/check-admin-rbac-coverage.ts
```

- [ ] **步骤 4：全量类型检查**

运行：`pnpm type-check`

预期：PASS（exit code 0）

- [ ] **步骤 5：确认 `07-drizzle-operations.md` 描述仍然准确**

运行：`Select-String -Path .trae/rules/07-drizzle-operations.md -Pattern 'drizzle.migrate.config|DATABASE_URL|\.env'`

预期：文档中描述的是配置文件的行为（"读取本地 `.env`（若存在）并要求 `DATABASE_URL`"），重构后行为不变，文档无需修改。

- [ ] **步骤 6：Commit**

```bash
git add drizzle.env.ts drizzle.migrate.config.ts drizzle.studio.config.ts
git commit -m "refactor(db): 提取 drizzle-kit 配置的 env 加载逻辑为共享 helper

- 新增 drizzle.env.ts，导出 loadDatabaseUrl(commandLabel) 函数
- drizzle.migrate.config.ts 与 drizzle.studio.config.ts 原先逐行重复
  的 .env 加载与 DATABASE_URL 读取逻辑统一委托给 helper
- 行为完全不变：错误消息、类型约束、配置结构均保持一致
- drizzle.shared.config.ts 与 drizzle.config.ts 不受影响"
```

---

## 自检

### 1. 规格覆盖度

| 需求                         | 对应任务           |
| ---------------------------- | ------------------ |
| 创建共享 env 加载 helper     | 任务 1             |
| 重构 migrate 配置使用 helper | 任务 2             |
| 重构 studio 配置使用 helper  | 任务 3             |
| 验证不破坏现有行为           | 任务 4（步骤 1-5） |
| 提交                         | 任务 4 步骤 6      |

无遗漏。

### 2. 占位符扫描

无 "TODO"、"待定"、"类似任务 N" 等占位符。每个步骤均包含完整代码或精确命令与预期输出。

### 3. 类型一致性

- `loadDatabaseUrl(commandLabel: string): string` 的签名在任务 1 中定义，任务 2 和任务 3 中调用时传入 `string` 字面量，返回值赋给 `databaseUrl: string`——类型一致。
- `defineConfig({ ...drizzleKitConfig, dbCredentials: { url: databaseUrl } }) satisfies Config` 的结构与重构前完全一致，`dbCredentials.url` 类型为 `string`。
- `drizzleKitConfig` 已在 `drizzle.shared.config.ts` 中 `satisfies Config`，spread 后再追加 `dbCredentials` 不破坏类型约束。
- `drizzle.env.ts` 的导入（`existsSync` from `node:fs`，`env`/`loadEnvFile` from `node:process`）与重构前两个配置文件中的导入完全一致，`@types/node@^26.0.1` 提供类型支持。

### 4. 行为等价性确认

| 行为                      | 重构前                                                             | 重构后                                                              | 一致 |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- | ---- |
| `.env` 不存在时           | 不加载，继续读 `process.env`                                       | 同（`existsSync` 为 false 时跳过 `loadEnvFile`）                    | 是   |
| `.env` 存在时             | `loadEnvFile('.env')`                                              | 同                                                                  | 是   |
| `DATABASE_URL` 存在时     | `env.DATABASE_URL?.trim()` 返回值                                  | 同                                                                  | 是   |
| `DATABASE_URL` 缺失时     | `throw new Error('db:migrate 需要 DATABASE_URL')`                  | `throw new Error('db:migrate 需要 DATABASE_URL')`（由 helper 拼接） | 是   |
| `DATABASE_URL` 只有空格时 | `?.trim()` 返回空字符串，falsy，throw                              | 同                                                                  | 是   |
| 配置结构                  | `{ ...drizzleKitConfig, dbCredentials: { url } } satisfies Config` | 同                                                                  | 是   |

### 5. 关键风险确认

- **零行为变更**：重构是纯粹的代码组织优化，不改变任何运行时行为、错误消息或配置结构。
- **无文档影响**：`07-drizzle-operations.md` 描述的是配置文件的行为而非内部实现，重构后行为不变。
- **无脚本影响**：`package.json` 中的脚本引用的是配置文件路径，路径未变。
- **导入边界合规**：`drizzle.env.ts` 位于仓库根目录，与现有 `drizzle.shared.config.ts` 并列，使用相对路径互引，不命中 `01-import-boundaries.md` 的 `@db/*` 或 `@libs/*` 白名单体系。
