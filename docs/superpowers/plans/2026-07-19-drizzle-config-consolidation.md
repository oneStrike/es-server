# Drizzle 配置文件合并 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 4 个 drizzle-kit 配置文件合并为单一的 `drizzle.config.ts`，用条件 `dbCredentials` 区分连库与不连库命令。

**架构：** 重写 `drizzle.config.ts`，内联基础配置 + best-effort `.env` 加载 + 条件 `dbCredentials`。删除 `drizzle.shared.config.ts`、`drizzle.migrate.config.ts`、`drizzle.env.ts`。同步更新 `package.json`、`Dockerfile`、`README.md`、`07-drizzle-operations.md` 中对被删文件的引用。

**技术栈：** drizzle-kit@1.0.0-rc.3、drizzle-orm@1.0.0-rc.4、TypeScript、Node.js `node:process` API、pnpm

---

## 文件结构

| 文件                                   | 职责                                                                 | 操作                                      |
| -------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| `drizzle.config.ts`                    | 唯一 drizzle-kit 配置：基础配置 + `.env` 加载 + 条件 `dbCredentials` | **重写**                                  |
| `drizzle.shared.config.ts`             | 原共享基础配置（已内联）                                             | **删除**                                  |
| `drizzle.migrate.config.ts`            | 原 migrate 配置（已合并）                                            | **删除**                                  |
| `drizzle.env.ts`                       | 原 env 加载 helper（已内联）                                         | **删除**                                  |
| `package.json`                         | npm scripts 注册表                                                   | **修改**：`db:migrate` 的 `--config` 路径 |
| `Dockerfile`                           | Docker 构建文件                                                      | **修改**：移除被删文件的 COPY 引用        |
| `README.md`                            | 项目说明文档                                                         | **修改**：第 57 行引用更新                |
| `.trae/rules/07-drizzle-operations.md` | Drizzle 操作附录                                                     | **修改**：命令路径 + 配置描述             |

---

### 任务 1：重写 `drizzle.config.ts`

**文件：**

- 修改：`drizzle.config.ts`

- [ ] **步骤 1：用合并后的内容替换文件**

将 `drizzle.config.ts` 的完整内容替换为：

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

**关键设计点：**

1. `existsSync('.env')` + `loadEnvFile` 在模块顶层执行——所有 drizzle-kit 子命令都会触发，但 `.env` 不存在时跳过，不影响 generate/check。
2. `databaseUrl` 为空时条件 spread 产出 `{}`，`dbCredentials` 缺失——generate/check 正常运行，migrate 由 drizzle-kit 报错。
3. 去掉了原 `satisfies Config`——`defineConfig` 返回值已是 `Config`，冗余。
4. 去掉了 `import type { Config }`——不再需要类型导入。

- [ ] **步骤 2：确认文件内容正确**

运行：`Get-Content drizzle.config.ts`

预期输出：与上方代码块一致，共 20 行。

- [ ] **步骤 3：运行类型检查基线**

运行：`pnpm type-check`

预期：PASS（exit code 0）。根级 `*.ts` 不在 `tsconfig.build.json` 的 `include` 范围内，此步骤确认仓库基线未被破坏。

---

### 任务 2：删除旧配置文件

**文件：**

- 删除：`drizzle.shared.config.ts`
- 删除：`drizzle.migrate.config.ts`
- 删除：`drizzle.env.ts`

- [ ] **步骤 1：删除三个文件**

运行：

```powershell
Remove-Item drizzle.shared.config.ts, drizzle.migrate.config.ts, drizzle.env.ts
```

- [ ] **步骤 2：确认文件已删除**

运行：

```powershell
Test-Path drizzle.shared.config.ts, drizzle.migrate.config.ts, drizzle.env.ts
```

预期输出：`False, False, False`

- [ ] **步骤 3：确认 `drizzle.config.ts` 仍然存在**

运行：`Test-Path drizzle.config.ts`

预期输出：`True`

- [ ] **步骤 4：运行类型检查基线**

运行：`pnpm type-check`

预期：PASS（exit code 0）。被删文件不在 `tsconfig.build.json` 的 `include` 范围内，删除它们不影响类型检查。

---

### 任务 3：更新 `package.json`

**文件：**

- 修改：`package.json`（`scripts` 段，`db:migrate` 行）

- [ ] **步骤 1：更新 `db:migrate` 脚本的 config 路径**

将 `package.json` 中：

```json
"db:migrate": "drizzle-kit migrate --config=drizzle.migrate.config.ts",
```

替换为：

```json
"db:migrate": "drizzle-kit migrate --config=drizzle.config.ts",
```

- [ ] **步骤 2：确认脚本已更新**

运行：

```powershell
node -e "const p=require('./package.json'); console.log(p.scripts['db:migrate'])"
```

预期输出：`drizzle-kit migrate --config=drizzle.config.ts`

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
db:migrate: drizzle-kit migrate --config=drizzle.config.ts
db:seed:demo: tsx --env-file=.env db/seed/command.ts
db:bootstrap:reference:manifest:write: tsx scripts/generate-admin-rbac-reference-permissions.ts --write
db:bootstrap:reference:manifest:check: tsx scripts/generate-admin-rbac-reference-permissions.ts
db:bootstrap:reference: pnpm db:bootstrap:reference:manifest:check && tsx --env-file=.env db/bootstrap/reference.ts
db:bootstrap:reference:check: pnpm db:bootstrap:reference:manifest:check && tsx --env-file=.env db/bootstrap/reference.ts --check-env
```

不应出现 `drizzle.migrate.config.ts`。

---

### 任务 4：更新 `Dockerfile`

**文件：**

- 修改：`Dockerfile`（第 28 行和第 106-107 行）

- [ ] **步骤 1：更新 builder 阶段的 COPY 命令**

将 `Dockerfile` 第 28 行：

```dockerfile
COPY pnpm-lock.yaml package.json nest-cli.json tsconfig*.json drizzle.config.ts drizzle.migrate.config.ts drizzle.shared.config.ts webpack.config.js ./
```

替换为：

```dockerfile
COPY pnpm-lock.yaml package.json nest-cli.json tsconfig*.json drizzle.config.ts webpack.config.js ./
```

即移除 `drizzle.migrate.config.ts` 和 `drizzle.shared.config.ts`。

- [ ] **步骤 2：删除 runtime 阶段的两个 COPY 行**

将 `Dockerfile` 第 106-107 行：

```dockerfile
COPY --from=builder --chown=nestjs:nodejs /app/drizzle.migrate.config.ts ./drizzle.migrate.config.ts
COPY --from=builder --chown=nestjs:nodejs /app/drizzle.shared.config.ts ./drizzle.shared.config.ts
```

删除这两行。`drizzle.config.ts`（第 105 行）已经存在，无需新增。

- [ ] **步骤 3：确认 Dockerfile 不再引用被删文件**

运行：

```powershell
Select-String -Path Dockerfile -Pattern 'drizzle\.migrate\.config|drizzle\.shared\.config|drizzle\.env'
```

预期：无匹配（无输出）。

- [ ] **步骤 4：确认 `drizzle.config.ts` 引用仍然存在**

运行：

```powershell
Select-String -Path Dockerfile -Pattern 'drizzle\.config\.ts'
```

预期输出：匹配到第 28 行（builder COPY）和第 105 行（runtime COPY）。

---

### 任务 5：更新 `README.md`

**文件：**

- 修改：`README.md`（第 57 行）

- [ ] **步骤 1：更新 migrate 命令引用**

将 `README.md` 第 57 行中的：

```
db:migrate` 直接运行 `drizzle-kit migrate --config=drizzle.migrate.config.ts`，并要求 `DATABASE_URL`。
```

替换为：

```
db:migrate` 直接运行 `drizzle-kit migrate --config=drizzle.config.ts`，并要求 `DATABASE_URL`。
```

- [ ] **步骤 2：确认引用已更新**

运行：

```powershell
Select-String -Path README.md -Pattern 'drizzle\.migrate\.config'
```

预期：无匹配（无输出）。

- [ ] **步骤 3：运行 Markdown 格式检查**

运行：`pnpm exec prettier --check README.md`

预期：PASS。如果 FAIL，运行 `pnpm exec prettier --write README.md` 修正格式后重新检查。

---

### 任务 6：更新 `07-drizzle-operations.md`

**文件：**

- 修改：`.trae/rules/07-drizzle-operations.md`（第 27 行和第 30-33 行）

- [ ] **步骤 1：更新 migrate 命令路径**

将 `.trae/rules/07-drizzle-operations.md` 中的：

```markdown
drizzle-kit migrate --config=drizzle.migrate.config.ts
```

替换为：

```markdown
drizzle-kit migrate --config=drizzle.config.ts
```

- [ ] **步骤 2：更新配置描述段落**

将：

```markdown
迁移 config 与 schema/check config 共享唯一的 schema、migration directory 和
`public.__drizzle_migrations__` 合同；它读取本地 `.env`（若存在）并要求
`DATABASE_URL`。不提供 `mode`、目标别名、旧 journal 解释器、reconcile/rollback
helper 或迁移兼容分支。
```

替换为：

```markdown
所有 drizzle-kit 子命令共用 `drizzle.config.ts`。该配置 best-effort 加载 `.env`，
并在 `DATABASE_URL` 可用时注入 `dbCredentials`；generate/check 不连库也不要求
`DATABASE_URL`，migrate 连库。不提供 `mode`、目标别名、旧 journal 解释器、
reconcile/rollback helper 或迁移兼容分支。
```

- [ ] **步骤 3：确认被删文件引用已清除**

运行：

```powershell
Select-String -Path .trae/rules/07-drizzle-operations.md -Pattern 'drizzle\.migrate\.config|drizzle\.shared\.config|drizzle\.env'
```

预期：无匹配（无输出）。

- [ ] **步骤 4：运行 Markdown 格式检查**

运行：`pnpm exec prettier --check .trae/rules/07-drizzle-operations.md`

预期：PASS。如果 FAIL，运行 `pnpm exec prettier --write .trae/rules/07-drizzle-operations.md` 修正格式后重新检查。

---

### 任务 7：全量验证与提交

- [ ] **步骤 1：全局搜索确认无残留引用**

运行：

```powershell
Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch '\\\.git\\' -and $_.FullName -notmatch '\\docs\\superpowers\\' } | Select-String -Pattern 'drizzle\.shared\.config|drizzle\.migrate\.config|drizzle\.env\b' -List
```

预期：无匹配（无输出）。

排除项说明：

- `.git/` 目录——版本历史不参与当前状态检查
- `docs/superpowers/` 目录——历史计划文档与设计规格保留作为记录

- [ ] **步骤 2：确认配置文件职责边界完整**

逐文件检查：

| 文件                | 职责                            | 含 `dbCredentials`          | 含 env 加载       |
| ------------------- | ------------------------------- | --------------------------- | ----------------- |
| `drizzle.config.ts` | 所有 drizzle-kit 命令的唯一配置 | 条件（DATABASE_URL 存在时） | 是（best-effort） |

`drizzle.shared.config.ts`、`drizzle.migrate.config.ts`、`drizzle.env.ts` 不应存在。

- [ ] **步骤 3：全量类型检查**

运行：`pnpm type-check`

预期：PASS（exit code 0）

- [ ] **步骤 4：Markdown 格式批量检查**

运行：

```powershell
pnpm exec prettier --check README.md .trae/rules/07-drizzle-operations.md
```

预期：PASS

- [ ] **步骤 5：实际命令验证**

运行：`pnpm db:generate`

预期：drizzle-kit 使用新的 `drizzle.config.ts` 正常加载。generate 不需要连库，即使 `DATABASE_URL` 缺失也应正常运行（或输出 "No schema changes"）。

- [ ] **步骤 6：Commit**

```bash
git add drizzle.config.ts drizzle.shared.config.ts drizzle.migrate.config.ts drizzle.env.ts package.json Dockerfile README.md .trae/rules/07-drizzle-operations.md
git commit -m "refactor(db): 合并 drizzle-kit 配置文件为单一 drizzle.config.ts

- drizzle.config.ts 内联基础配置 + best-effort .env 加载 + 条件 dbCredentials
- 删除 drizzle.shared.config.ts、drizzle.migrate.config.ts、drizzle.env.ts
- package.json db:migrate 改用 drizzle.config.ts
- Dockerfile 移除被删文件的 COPY 引用
- README.md 和 07-drizzle-operations.md 同步更新引用
- generate/check 现在也加载 .env（不影响功能），migrate 缺少 DATABASE_URL 时由 drizzle-kit 报错"
```

---

## 自检

### 1. 规格覆盖度

| 需求                                     | 对应任务                                    |
| ---------------------------------------- | ------------------------------------------- |
| 重写 `drizzle.config.ts`                 | 任务 1                                      |
| 删除 `drizzle.shared.config.ts`          | 任务 2                                      |
| 删除 `drizzle.migrate.config.ts`         | 任务 2                                      |
| 删除 `drizzle.env.ts`                    | 任务 2                                      |
| 更新 `package.json` `db:migrate` 脚本    | 任务 3                                      |
| 更新 `Dockerfile` COPY 引用              | 任务 4                                      |
| 更新 `README.md` 第 57 行                | 任务 5                                      |
| 更新 `07-drizzle-operations.md` 命令路径 | 任务 6 步骤 1                               |
| 更新 `07-drizzle-operations.md` 配置描述 | 任务 6 步骤 2                               |
| 全局搜索残留引用                         | 任务 7 步骤 1                               |
| 类型检查基线                             | 任务 1 步骤 3、任务 2 步骤 4、任务 7 步骤 3 |
| Markdown 格式检查                        | 任务 5 步骤 3、任务 6 步骤 4、任务 7 步骤 4 |
| 实际命令验证                             | 任务 7 步骤 5                               |
| 提交                                     | 任务 7 步骤 6                               |

无遗漏。

### 2. 占位符扫描

无 "TODO"、"待定"、"类似任务 N" 等占位符。每个步骤均包含完整代码或精确命令与预期输出。

### 3. 类型一致性

- `drizzle.config.ts` 的 `defineConfig(...)` 返回值类型为 `Config`，与原 `drizzle.config.ts` 和 `drizzle.migrate.config.ts` 一致。
- 条件 spread `...(databaseUrl ? { dbCredentials: { url: databaseUrl } } : {})` 产出的对象在 `DATABASE_URL` 存在时包含 `dbCredentials: { url: string }`，在缺失时为 `{}`，两者都满足 `Config` 类型（`dbCredentials` 是可选属性）。
- `databaseUrl` 类型为 `string | undefined`（`env.DATABASE_URL?.trim()`），在条件表达式中作为 truthy/falsy 判断使用，类型安全。
- `package.json` 的 `scripts` 值均为 `string` 类型，修改一行不影响其他行的类型。

### 4. 行为等价性确认

| 行为                              | 重构前                                                                             | 重构后                                                                               | 一致                     |
| --------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------ |
| `db:generate` 执行                | `drizzle-kit generate --config=drizzle.config.ts`（不加载 .env）                   | 同命令，但配置现在会 best-effort 加载 .env                                           | 行为微调（不影响功能）   |
| `db:migration:check` 执行         | `drizzle-kit check --config=drizzle.config.ts`（不加载 .env）                      | 同上                                                                                 | 行为微调（不影响功能）   |
| `db:migrate` 执行                 | `drizzle-kit migrate --config=drizzle.migrate.config.ts`（加载 .env + 自定义错误） | `drizzle-kit migrate --config=drizzle.config.ts`（加载 .env + drizzle-kit 默认错误） | 行为微调（错误消息变化） |
| `db:migrate` 有 DATABASE_URL 时   | 正常连库迁移                                                                       | 同                                                                                   | 是                       |
| `db:migrate` 缺少 DATABASE_URL 时 | `throw new Error('db:migrate 需要 DATABASE_URL')`                                  | drizzle-kit 默认错误                                                                 | 错误消息变化             |
| Docker 构建                       | COPY 4 个配置文件                                                                  | COPY 1 个配置文件                                                                    | 预期变更                 |

### 5. 关键风险确认

- **generate/check 加载 .env**：新配置在模块顶层 `loadEnvFile('.env')`，generate/check 现在也会触发。但 `.env` 不存在时跳过，存在时仅加载环境变量，不连接数据库。不影响 generate/check 的功能。
- **migrate 错误消息**：从自定义中文消息变为 drizzle-kit 默认英文错误。这是已记录的行为变化点，用户已批准。
- **Docker 构建**：Dockerfile 不再 COPY 被删文件，但 `drizzle.config.ts` 仍然 COPY。Docker 镜像中运行 migrate 时使用的是新的合并配置。
- **导入边界合规**：`drizzle.config.ts` 位于仓库根目录，使用 `node:fs`、`node:process`、`drizzle-kit` 导入，不命中 `01-import-boundaries.md` 的 `@db/*` 或 `@libs/*` 白名单体系。
