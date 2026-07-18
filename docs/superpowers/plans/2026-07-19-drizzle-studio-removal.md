# 删除 Drizzle Studio 相关逻辑 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 彻底移除仓库中 `drizzle-kit studio`（`db:studio`）相关的所有配置、脚本、文档与历史计划引用，使仓库恢复到"不提供 studio 本地浏览器"的状态。

**架构：** 删除 `drizzle.studio.config.ts` 配置文件，从 `package.json` 移除 `db:studio` 脚本，从 `.trae/rules/07-drizzle-operations.md` 删除"本地数据浏览"章节，从 `.trae/rules/08-testing.md` 移除 `db:studio` 引用，更新 `drizzle.env.ts` 注释去掉 studio 引用，最后删除 studio 创建计划文档。`drizzle.env.ts` 本体保留——它仍被 `drizzle.migrate.config.ts` 使用，职责分离仍然有效。

**技术栈：** drizzle-kit@1.0.0-rc.3、TypeScript、pnpm、Markdown 规则文档

---

## 背景与影响分析

### 当前状态

仓库中有以下 studio 相关产物（均已提交到 git，commit `95239a909` 与 `e4a8d5ece`）：

| 文件                                                            | studio 相关内容                       | 操作                 |
| --------------------------------------------------------------- | ------------------------------------- | -------------------- |
| `drizzle.studio.config.ts`                                      | 整个文件是 studio 配置                | **删除**             |
| `package.json` 第 26 行                                         | `db:studio` 脚本                      | **修改**：删除该行   |
| `.trae/rules/07-drizzle-operations.md` 第 76-91 行              | "本地数据浏览"章节                    | **修改**：删除该章节 |
| `.trae/rules/08-testing.md` 第 41 行                            | 引用 `db:studio` 作为不存在的命令示例 | **修改**：移除引用   |
| `drizzle.env.ts` 第 5 行                                        | 注释中提到 `migrate / studio`         | **修改**：更新注释   |
| `docs/superpowers/plans/2026-07-19-drizzle-studio-local-dev.md` | studio 创建计划（untracked）          | **删除**             |

### 不受影响的文件

| 文件                                                            | 理由                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `drizzle.env.ts`（本体）                                        | 仍被 `drizzle.migrate.config.ts` 调用，职责分离有效，仅更新注释                |
| `drizzle.migrate.config.ts`                                     | 不引用 studio，不受影响                                                        |
| `drizzle.shared.config.ts`                                      | 不引用 studio，不受影响                                                        |
| `drizzle.config.ts`                                             | 不引用 studio，不受影响                                                        |
| `docs/superpowers/plans/2026-07-19-drizzle-config-env-dedup.md` | env 去重计划的历史记录，核心产出物 `drizzle.env.ts` 仍然存在，保留作为历史记录 |

### 设计决策

1. **保留 `drizzle.env.ts`**：虽然删除 studio 后只剩 `drizzle.migrate.config.ts` 一个调用方，但 `drizzle.env.ts` 提供了清晰的 env 加载与配置声明职责分离，且内联回 `drizzle.migrate.config.ts` 扩大了变更范围，不属于"删除 studio 逻辑"的目标范围。仅更新其注释去掉 studio 引用。
2. **保留 env 去重计划文档**：`2026-07-19-drizzle-config-env-dedup.md` 记录的是 env 去重决策，其产出物 `drizzle.env.ts` 仍然有效。虽然其中提到 studio，但它是历史记录而非当前状态描述，不在本次删除范围。
3. **删除 studio 创建计划文档**：`2026-07-19-drizzle-studio-local-dev.md` 是 untracked 文件，其目标完全被本次撤销，删除它保持仓库整洁。

---

## 文件结构

| 文件                                                            | 职责                          | 操作                             |
| --------------------------------------------------------------- | ----------------------------- | -------------------------------- |
| `drizzle.studio.config.ts`                                      | studio 子命令配置（将被移除） | **删除**                         |
| `package.json`                                                  | npm scripts 注册表            | **修改**：删除 `db:studio` 行    |
| `.trae/rules/07-drizzle-operations.md`                          | Drizzle 操作附录              | **修改**：删除"本地数据浏览"章节 |
| `.trae/rules/08-testing.md`                                     | 测试与验证规范                | **修改**：移除 `db:studio` 引用  |
| `drizzle.env.ts`                                                | env 加载 helper               | **修改**：更新注释               |
| `docs/superpowers/plans/2026-07-19-drizzle-studio-local-dev.md` | studio 创建计划（untracked）  | **删除**                         |

---

### 任务 1：删除 `drizzle.studio.config.ts`

**文件：**

- 删除：`drizzle.studio.config.ts`

- [ ] **步骤 1：删除文件**

运行：

```powershell
Remove-Item drizzle.studio.config.ts
```

- [ ] **步骤 2：确认文件已删除**

运行：`Test-Path drizzle.studio.config.ts`

预期输出：`False`

- [ ] **步骤 3：确认 `drizzle.env.ts` 仍然存在**

运行：`Test-Path drizzle.env.ts`

预期输出：`True`

- [ ] **步骤 4：运行类型检查基线**

运行：`pnpm type-check`

预期：PASS（exit code 0）。`drizzle.studio.config.ts` 是根级配置文件，不在 `tsconfig.build.json` 的 `include` 范围内，删除它不影响类型检查。但运行基线确认无连带破坏。

---

### 任务 2：从 `package.json` 删除 `db:studio` 脚本

**文件：**

- 修改：`package.json`（`scripts` 段，第 26 行）

- [ ] **步骤 1：删除 `db:studio` 行**

将 `package.json` 的 `scripts` 段中：

```json
    "db:migrate": "drizzle-kit migrate --config=drizzle.migrate.config.ts",
    "db:studio": "drizzle-kit studio --config=drizzle.studio.config.ts --host=127.0.0.1",
    "db:seed:demo": "tsx --env-file=.env db/seed/command.ts",
```

替换为：

```json
    "db:migrate": "drizzle-kit migrate --config=drizzle.migrate.config.ts",
    "db:seed:demo": "tsx --env-file=.env db/seed/command.ts",
```

- [ ] **步骤 2：确认脚本已删除**

运行：

```powershell
node -e "const p=require('./package.json'); console.log(p.scripts['db:studio'] ?? 'NOT FOUND')"
```

预期输出：`NOT FOUND`

- [ ] **步骤 3：确认其他 db 脚本未受影响**

运行：

```powershell
node -e "const p=require('./package.json'); Object.entries(p.scripts).filter(([k])=>k.startsWith('db:')).forEach(([k,v])=>console.log(k+': '+v))"
```

预期输出包含：

```
db:generate: drizzle-kit generate --config=drizzle.config.ts
db:migration:check: drizzle-kit check --config=drizzle.config.ts
db:comments:generate: tsx scripts/db-comments.ts
db:comments:check: tsx scripts/db-comments.ts --check
db:migrate: drizzle-kit migrate --config=drizzle.migrate.config.ts
db:seed:demo: tsx --env-file=.env db/seed/command.ts
db:bootstrap:reference:manifest:write: tsx scripts/generate-admin-rbac-reference-permissions.ts --write
db:bootstrap:reference:manifest:check: tsx scripts/generate-admin-rbac-reference-permissions.ts
db:bootstrap:reference: pnpm db:bootstrap:reference:manifest:check && tsx --env-file=.env db/bootstrap/reference.ts
db:bootstrap:reference:check: pnpm db:bootstrap:reference:manifest:check && tsx --env-file=.env db/bootstrap/reference.ts --check-env
```

不应出现 `db:studio` 行。

- [ ] **步骤 4：运行类型检查基线**

运行：`pnpm type-check`

预期：PASS（exit code 0）

---

### 任务 3：从 `07-drizzle-operations.md` 删除"本地数据浏览"章节

**文件：**

- 修改：`.trae/rules/07-drizzle-operations.md`（删除第 76-91 行，即"本地数据浏览"整节）

- [ ] **步骤 1：删除"本地数据浏览"章节**

将 `.trae/rules/07-drizzle-operations.md` 中从第 75 行末尾到第 91 行的内容：

````markdown
## 本地数据浏览

```bash
pnpm db:studio
```
````

`db:studio` 启动 [Drizzle Studio](https://local.drizzle.studio) 本地代理，默认监听
`127.0.0.1:4983`，在浏览器打开 `https://local.drizzle.studio` 即可浏览表结构与数据。

它使用 `drizzle.studio.config.ts`，与 `db:migrate` 共享同一份 `drizzleKitConfig` 与
`DATABASE_URL` 合同。脚本显式指定 `--host=127.0.0.1`，因为当前 `drizzle-kit@1.0.0-rc.3`
的 `studio` 子命令默认 `--host=0.0.0.0`，不显式绑定回环会暴露到局域网。

`db:studio` 是只读浏览与查询工具，不生成 migration、不修改 schema、不执行 seed/bootstrap。
结构变更仍必须走 `db:generate` → `db:migration:check` → `db:migrate`。禁止用 Studio
直连生产库；它只用于本地开发数据库。

````

全部删除，使文件以第 74 行（`未登记临时写入和任何旧 migration fallback。任何失败都停止并记录必要的脱敏诊断。`）作为最后一行（保留其后的换行符）。

具体操作：将

```markdown
未登记临时写入和任何旧 migration fallback。任何失败都停止并记录必要的脱敏诊断。

## 本地数据浏览

```bash
pnpm db:studio
````

`db:studio` 启动 [Drizzle Studio](https://local.drizzle.studio) 本地代理，默认监听
`127.0.0.1:4983`，在浏览器打开 `https://local.drizzle.studio` 即可浏览表结构与数据。

它使用 `drizzle.studio.config.ts`，与 `db:migrate` 共享同一份 `drizzleKitConfig` 与
`DATABASE_URL` 合同。脚本显式指定 `--host=127.0.0.1`，因为当前 `drizzle-kit@1.0.0-rc.3`
的 `studio` 子命令默认 `--host=0.0.0.0`，不显式绑定回环会暴露到局域网。

`db:studio` 是只读浏览与查询工具，不生成 migration、不修改 schema、不执行 seed/bootstrap。
结构变更仍必须走 `db:generate` → `db:migration:check` → `db:migrate`。禁止用 Studio
直连生产库；它只用于本地开发数据库。

````

替换为：

```markdown
未登记临时写入和任何旧 migration fallback。任何失败都停止并记录必要的脱敏诊断。
````

- [ ] **步骤 2：确认 studio 引用已清除**

运行：

```powershell
Select-String -Path .trae/rules/07-drizzle-operations.md -Pattern 'studio'
```

预期：无匹配（无输出）。

- [ ] **步骤 3：确认文件末尾结构正确**

运行：`Get-Content .trae/rules/07-drizzle-operations.md -Tail 5`

预期输出（文件最后几行）：

```
禁止 `drizzle-kit push`、`drizzle-kit push --force`、`db:push`、`--ignore-conflicts`、
未登记临时写入和任何旧 migration fallback。任何失败都停止并记录必要的脱敏诊断。
```

- [ ] **步骤 4：运行 Markdown 格式检查**

运行：`pnpm exec prettier --check .trae/rules/07-drizzle-operations.md`

预期：PASS。如果 FAIL，运行 `pnpm exec prettier --write .trae/rules/07-drizzle-operations.md` 修正格式后重新检查。

- [ ] **步骤 5：运行类型检查（规则文档改动基线验证）**

运行：`pnpm type-check`

预期：PASS（exit code 0），确认仓库基线未被破坏。

---

### 任务 4：更新 `drizzle.env.ts` 注释

**文件：**

- 修改：`drizzle.env.ts`（第 5 行注释）

- [ ] **步骤 1：更新注释，去掉 studio 引用**

将 `drizzle.env.ts` 中的注释：

```typescript
/**
 * 为 drizzle-kit 需要连库的子命令（migrate / studio）加载环境变量并返回 DATABASE_URL
 *
 * - 若项目根目录存在 `.env` 文件则自动加载
 * - 读取 `DATABASE_URL` 并 trim，缺失时抛出包含命令标签的明确错误
 *
 * @param commandLabel - 调用方命令标签，用于错误消息（如 `'db:migrate'`）
 * @returns 经过 trim 的 `DATABASE_URL` 字符串
 */
```

替换为：

```typescript
/**
 * 为 drizzle-kit 需要连库的子命令（migrate）加载环境变量并返回 DATABASE_URL
 *
 * - 若项目根目录存在 `.env` 文件则自动加载
 * - 读取 `DATABASE_URL` 并 trim，缺失时抛出包含命令标签的明确错误
 *
 * @param commandLabel - 调用方命令标签，用于错误消息（如 `'db:migrate'`）
 * @returns 经过 trim 的 `DATABASE_URL` 字符串
 */
```

唯一变化：第 5 行 `migrate / studio` → `migrate`。

- [ ] **步骤 2：确认注释已更新**

运行：

```powershell
Select-String -Path drizzle.env.ts -Pattern 'studio'
```

预期：无匹配（无输出）。

- [ ] **步骤 3：确认函数签名与逻辑未变**

运行：`Get-Content drizzle.env.ts`

预期输出：

```typescript
import { existsSync } from 'node:fs'
import { env, loadEnvFile } from 'node:process'

/**
 * 为 drizzle-kit 需要连库的子命令（migrate）加载环境变量并返回 DATABASE_URL
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

- [ ] **步骤 4：运行类型检查基线**

运行：`pnpm type-check`

预期：PASS（exit code 0）

---

### 任务 5：更新 `08-testing.md` 中的 studio 引用

**文件：**

- 修改：`.trae/rules/08-testing.md`（第 41 行）

- [ ] **步骤 1：移除 `db:studio` 引用**

将 `.trae/rules/08-testing.md` 中第 40-42 行：

```markdown
只运行实际存在的命令。当前不存在 `pnpm check`、`pnpm lint:check`、
`pnpm test:*`、`pnpm boundaries:check` 或可以作为交付依据的 `db:studio`；不得在文档或
CI 中伪造它们。规则/文档变更至少运行对应 Markdown Prettier check 与 `pnpm type-check`。
```

替换为：

```markdown
只运行实际存在的命令。当前不存在 `pnpm check`、`pnpm lint:check`、
`pnpm test:*`、`pnpm boundaries:check`；不得在文档或
CI 中伪造它们。规则/文档变更至少运行对应 Markdown Prettier check 与 `pnpm type-check`。
```

唯一变化：`或可以作为交付依据的 \`db:studio\`` 被移除，`boundaries:check` 后的分号保持不变。

- [ ] **步骤 2：确认 studio 引用已清除**

运行：

```powershell
Select-String -Path .trae/rules/08-testing.md -Pattern 'studio'
```

预期：无匹配（无输出）。

- [ ] **步骤 3：运行 Markdown 格式检查**

运行：`pnpm exec prettier --check .trae/rules/08-testing.md`

预期：PASS。如果 FAIL，运行 `pnpm exec prettier --write .trae/rules/08-testing.md` 修正格式后重新检查。

- [ ] **步骤 4：运行类型检查（规则文档改动基线验证）**

运行：`pnpm type-check`

预期：PASS（exit code 0）

---

### 任务 6：删除 studio 创建计划文档

**文件：**

- 删除：`docs/superpowers/plans/2026-07-19-drizzle-studio-local-dev.md`（untracked 文件）

- [ ] **步骤 1：删除文件**

运行：

```powershell
Remove-Item docs/superpowers/plans/2026-07-19-drizzle-studio-local-dev.md
```

- [ ] **步骤 2：确认文件已删除**

运行：`Test-Path docs/superpowers/plans/2026-07-19-drizzle-studio-local-dev.md`

预期输出：`False`

- [ ] **步骤 3：确认 env 去重计划文档仍然存在**

运行：`Test-Path docs/superpowers/plans/2026-07-19-drizzle-config-env-dedup.md`

预期输出：`True`

---

### 任务 7：全量验证与提交

- [ ] **步骤 1：全仓库搜索确认无 studio 残留**

运行：

```powershell
Get-ChildItem -Recurse -File -Exclude .git | Select-String -Pattern 'db:studio|drizzle\.studio|drizzle-studio' -List | Where-Object { $_.Path -notmatch '\\\.git\\' -and $_.Path -notmatch 'drizzle-studio-removal' -and $_.Path -notmatch 'drizzle-config-env-dedup' }
```

预期：无匹配（无输出）。

排除项说明：

- `.git/` 目录——版本历史不参与当前状态检查
- `drizzle-studio-removal.md`——本计划文档自身
- `drizzle-config-env-dedup.md`——env 去重历史计划，保留作为历史记录

- [ ] **步骤 2：确认 `package.json` scripts 段完整**

运行：

```powershell
node -e "const p=require('./package.json'); Object.entries(p.scripts).filter(([k])=>k.startsWith('db:')).forEach(([k,v])=>console.log(k+': '+v))"
```

预期输出不包含 `db:studio`：

```
db:generate: drizzle-kit generate --config=drizzle.config.ts
db:migration:check: drizzle-kit check --config=drizzle.config.ts
db:comments:generate: tsx scripts/db-comments.ts
db:comments:check: tsx scripts/db-comments.ts --check
db:migrate: drizzle-kit migrate --config=drizzle.migrate.config.ts
db:seed:demo: tsx --env-file=.env db/seed/command.ts
db:bootstrap:reference:manifest:write: tsx scripts/generate-admin-rbac-reference-permissions.ts --write
db:bootstrap:reference:manifest:check: tsx scripts/generate-admin-rbac-reference-permissions.ts
db:bootstrap:reference: pnpm db:bootstrap:reference:manifest:check && tsx --env-file=.env db/bootstrap/reference.ts
db:bootstrap:reference:check: pnpm db:bootstrap:reference:manifest:check && tsx --env-file=.env db/bootstrap/reference.ts --check-env
```

- [ ] **步骤 3：确认配置文件职责边界**

运行：逐文件检查 `drizzle.env.ts`、`drizzle.shared.config.ts`、`drizzle.config.ts`、`drizzle.migrate.config.ts`

预期：

| 文件                        | 职责             | 含 `dbCredentials` |
| --------------------------- | ---------------- | ------------------ |
| `drizzle.env.ts`            | env 加载 helper  | 否                 |
| `drizzle.shared.config.ts`  | 共享基础配置     | 否                 |
| `drizzle.config.ts`         | generate / check | 否                 |
| `drizzle.migrate.config.ts` | migrate          | 是（运行时注入）   |

`drizzle.studio.config.ts` 不应存在。

- [ ] **步骤 4：Markdown 格式批量检查**

运行：

```powershell
pnpm exec prettier --check .trae/rules/07-drizzle-operations.md .trae/rules/08-testing.md
```

预期：PASS

- [ ] **步骤 5：全量类型检查**

运行：`pnpm type-check`

预期：PASS（exit code 0）

- [ ] **步骤 6：Commit**

```bash
git add drizzle.studio.config.ts package.json .trae/rules/07-drizzle-operations.md .trae/rules/08-testing.md drizzle.env.ts
git commit -m "feat(db): 移除 drizzle-kit studio 相关逻辑

- 删除 drizzle.studio.config.ts 配置文件
- package.json 移除 db:studio 脚本
- 07-drizzle-operations.md 移除'本地数据浏览'章节
- 08-testing.md 移除 db:studio 引用
- drizzle.env.ts 注释去掉 studio 引用（本体保留，仍被 migrate 使用）
- studio 仅用于本地只读浏览，移除后不影响 migration 工作流"
```

---

## 自检

### 1. 规格覆盖度

| 需求                                     | 对应任务 |
| ---------------------------------------- | -------- |
| 删除 studio 配置文件                     | 任务 1   |
| 从 package.json 移除 db:studio 脚本      | 任务 2   |
| 从操作附录移除"本地数据浏览"章节         | 任务 3   |
| 更新 drizzle.env.ts 注释去掉 studio 引用 | 任务 4   |
| 从测试规范移除 db:studio 引用            | 任务 5   |
| 删除 studio 创建计划文档                 | 任务 6   |
| 验证与提交                               | 任务 7   |

无遗漏。

### 2. 占位符扫描

无 "TODO"、"待定"、"类似任务 N" 等占位符。每个步骤均包含完整代码或精确命令与预期输出。

### 3. 类型一致性

- `drizzle.env.ts` 的函数签名 `loadDatabaseUrl(commandLabel: string): string` 未变，`drizzle.migrate.config.ts` 的调用 `loadDatabaseUrl('db:migrate')` 不受影响。
- `package.json` 的 `scripts` 值均为 `string` 类型，删除一行不影响其他行的类型。
- `.trae/rules/07-drizzle-operations.md` 与 `.trae/rules/08-testing.md` 是 Markdown 文档，不涉及 TypeScript 类型。

### 4. 行为等价性确认

| 行为                                       | 删除前                                                                  | 删除后           | 一致     |
| ------------------------------------------ | ----------------------------------------------------------------------- | ---------------- | -------- |
| `db:migrate` 执行                          | `drizzle-kit migrate --config=drizzle.migrate.config.ts`                | 同               | 是       |
| `db:generate` 执行                         | `drizzle-kit generate --config=drizzle.config.ts`                       | 同               | 是       |
| `db:migration:check` 执行                  | `drizzle-kit check --config=drizzle.config.ts`                          | 同               | 是       |
| `db:studio` 执行                           | `drizzle-kit studio --config=drizzle.studio.config.ts --host=127.0.0.1` | 命令不存在       | 预期变更 |
| `drizzle.env.ts` 的 `loadDatabaseUrl` 行为 | 加载 `.env`、读取 `DATABASE_URL`、缺失时 throw                          | 同（仅注释变更） | 是       |

### 5. 关键风险确认

- **零运行时回归**：`db:studio` 是只读浏览工具，不参与 migration、seed、bootstrap 或应用运行时，删除它不影响任何业务行为。
- **`drizzle.env.ts` 保留决策**：删除 studio 后 `drizzle.env.ts` 只有一个调用方（`drizzle.migrate.config.ts`），但保留它避免将 env 加载逻辑内联回配置文件，维持职责分离。仅更新注释去掉 studio 引用。
- **历史计划文档处理**：`2026-07-19-drizzle-studio-local-dev.md`（untracked）被删除；`2026-07-19-drizzle-config-env-dedup.md`（untracked）保留作为历史记录，其核心产出物 `drizzle.env.ts` 仍然有效。
- **文档一致性**：`07-drizzle-operations.md` 删除"本地数据浏览"章节后，文件以"禁止项"段落结尾，结构完整。`08-testing.md` 移除 `db:studio` 引用后，语句通顺，语义不变。
