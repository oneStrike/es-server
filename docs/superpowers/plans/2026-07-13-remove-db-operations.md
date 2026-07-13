# 删除 db/operations 及关联逻辑实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 subagent-driven-development（推荐）或 executing-plans 逐任务实现此计划。步骤使用复选框（- [ ]）语法跟踪进度。

**目标：** 删除 db/operations 下全部三个文件，移除它们的 package script、迁移执行依赖、journal/history/digest 校验逻辑和失效文档约束；不将任何代码迁移到新目录。

**架构：** db/migrate.ts 收敛为受环境保护和 session lock 保护的 Drizzle migrator：直接使用 db/migration 目录、保留迁移失败处理与 schema comment 同步，删除 local active-history、journal snapshot、SQL hash 和 canonical JSON digest 逻辑。package.json 仅保留直接调用 Drizzle Kit 的 generate/check 命令。

**技术栈：** TypeScript、tsx、Bun、Drizzle Kit、Prettier、ESLint。

---

## 需求与决策

- 删除 db/operations/check-db-core-boundary.ts、db/operations/migration/active-history.ts、db/operations/migration/canonical-json.ts，交付后不创建替代目录或转发入口。
- 删除 pnpm db:core:check 与 pnpm db:active:migration:check；pnpm db:generate 和 pnpm db:migration:check 改为直接调用 Drizzle Kit。
- 删除 db/migrate.ts 对 active migration history、SQL hash、journal shape、journal prefix、run digest 和 migration digest 的检查及输出字段。
- 保留 db:migrate.ts 的 DATABASE_URL 读取、数据库身份核对、session lock、Drizzle migrate 调用、错误传播和 schema comment 同步；这些并不属于 db/operations 的依赖逻辑。
- 这是有意改变迁移安全语义：已执行 migration SQL 被改写、journal 非当前形状、目录包含额外文件或 physical FK 不再由这些已删除的 guard 主动拦截。
- 不改变 db/schema 的“禁止数据库外键”建模规则；本次只删除其 active-history 运行时检查实现，不授权新增 physical FK。
- 不创建测试文件、migration SQL、临时 probe 或新依赖。
- 当前工作区已有与本任务无关的未提交改动；实施期间不得 reset、checkout、格式化或提交这些文件，最终状态需将其与本次删除差异分开审查。

## 文件结构

| 操作 | 文件                                                                   | 结果                                                                    |
| ---- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 删除 | db/operations/check-db-core-boundary.ts                                | 移除 @db/core allowlist、深层导入和 operational import 的静态 gate。    |
| 删除 | db/operations/migration/active-history.ts                              | 移除目录名、非空 SQL、SQL hash 和 physical FK 检查。                    |
| 删除 | db/operations/migration/canonical-json.ts                              | 移除 canonical JSON 与 SHA-256 digest 工具。                            |
| 修改 | db/migrate.ts:1-16、22-321、329-404                                    | 删除上述 helpers 的所有调用、类型、snapshot 查询、断言、digest 与输出。 |
| 修改 | package.json:21-24                                                     | 删除两个 script；让 generate/check 直接调用 Drizzle Kit。               |
| 修改 | .trae/rules/07-drizzle-operations.md:6-34、56-57                       | 删除已不存在 gate 的 owner、命令和行为承诺。                            |
| 修改 | .trae/rules/08-testing.md:31-38                                        | 删除不存在的 db:core:check 验证入口。                                   |
| 修改 | .trae/rules/09-nestjs-architecture.md:35                               | 删除 db/operations 作为 operational composition 和反向导入边界的描述。  |
| 修改 | docs/superpowers/plans/2026-07-04-type-fix-remediation-plan.md:102-103 | 将“当前 owner 已迁至 db/operations”的注记改为已删除的历史说明。         |
| 修改 | docs/superpowers/plans/2026-07-13-remove-db-operations.md              | 用本硬删除计划替换此前错误的迁移方案。                                  |

仓库内没有其他代码导入 MigrationCommand、MigrationRunResult、runMigration 或 readMigrationCommand；在 db/migrate.ts 外搜索这些符号无命中。因此可以在该文件内删除 active 专用别名和 overload，而无需改动调用方。

## 实施步骤

### 任务 1：记录删除前的 gate 行为

**文件：** 不修改文件。

- [ ] **步骤 1：执行将被删除的两个脚本。**

运行：

```powershell
pnpm db:core:check
pnpm db:active:migration:check
```

预期：均退出码为 0；前者输出 @db/core boundary check passed.，后者输出 status 为 pass 的 JSON。输出作为删除前存在这些 gate 的证据，不作为删除后的验收命令。

- [ ] **步骤 2：执行将被保留的 Drizzle 检查。**

运行：pnpm db:migration:check

预期：退出码为 0。记录当前命令仍可运行；删除后其内部不再先运行 active-history gate。

### 任务 2：删除 source 文件并移除 package scripts

**文件：**

- 删除：db/operations/check-db-core-boundary.ts
- 删除：db/operations/migration/active-history.ts
- 删除：db/operations/migration/canonical-json.ts
- 修改：package.json:21-24

- [ ] **步骤 1：使用 apply_patch 删除三个 source 文件。**

删除文件清单：

```
db/operations/check-db-core-boundary.ts
db/operations/migration/active-history.ts
db/operations/migration/canonical-json.ts
```

预期：空的 db/operations/migration 和 db/operations 目录随之消失；不创建 db/guards、scripts 替代项或 barrel。

- [ ] **步骤 2：移除已无执行体的 package scripts，并简化其消费者。**

将 package.json 的四项替换为以下两项：

```json
"db:generate": "drizzle-kit generate --config=drizzle.config.ts",
"db:migration:check": "drizzle-kit check --config=drizzle.config.ts"
```

删除 db:core:check 和 db:active:migration:check 的整行。不要新增空命令、deprecated alias 或 no-op script。

- [ ] **步骤 3：确认删除的脚本和目录不存在。**

运行：

```powershell
rg -n -S '"db:core:check"|"db:active:migration:check"' package.json
rg --files db/operations
```

预期：两条命令均无输出且退出码为 1。

### 任务 3：从 db/migrate.ts 移除 history/journal/digest 逻辑

**文件：** 修改 db/migrate.ts。

- [ ] **步骤 1：移除 db/operations imports，并建立只供 Drizzle migrator 使用的 migration 路径。**

删除第 12-16 行的 active-history 和 canonical-json imports。在 node built-ins 中加入 resolve，并在两个 migration 常量后新增：

```ts
import { resolve } from 'node:path'

const MIGRATIONS_SCHEMA = 'public'
const MIGRATIONS_TABLE = '__drizzle_migrations__'
const MIGRATIONS_DIRECTORY = resolve(__dirname, 'migration')
```

- [ ] **步骤 2：删除 active-only 类型、输入对象与 journal snapshot helpers。**

从 db/migrate.ts 删除以下完整声明和函数，不留下空类型或未使用 import：

```text
ActiveMigrationCommand
DbMigrationRecord
MigrationTableSnapshot
ActiveMigrationInput
MigrationInput
readMigrationInput
getMigrationTableSnapshot
assertCurrentJournalShape
assertActiveMigrationJournal
assertActiveMigrationJournalPrefix
assertMigrationJournalPreflight
migrationJournalDigest
```

将开头类型收敛为：

```ts
export interface MigrationCommand {
  checkEnvironmentOnly: boolean
  mode: 'active'
}

export interface MigrationRunResult {
  comments: {
    appliedStatementCount: number
    sqlSha256: string
  }
  mode: 'active'
}
```

将 readMigrationCommand 的 mode 声明改为 MigrationCommand['mode']，并把 runMigration 的两个 overload 收敛为一个签名：

```ts
export async function runMigration(
  command: MigrationCommand,
): Promise<MigrationRunResult> {
```

- [ ] **步骤 3：改写环境检查和运行结果，去除 migration/journal digest。**

将 buildEnvironmentReadyOutput 改为只报告仍然真实的环境事实：

```ts
function buildEnvironmentReadyOutput(
  command: MigrationCommand,
  database: ReturnType<typeof readDatabaseConnection>,
): Record<string, unknown> {
  return {
    database: database.safeLabel,
    mode: command.mode,
    status: 'environment-ready',
  }
}
```

将 buildRunResult 改为：

```ts
function buildRunResult(
  comments: Awaited<ReturnType<typeof applySchemaComments>>,
): MigrationRunResult {
  return {
    comments: {
      appliedStatementCount: comments.appliedStatementCount,
      sqlSha256: comments.sqlSha256,
    },
    mode: 'active',
  }
}
```

在 --check-env 分支中调用 buildEnvironmentReadyOutput(command, database)，并返回：

```ts
{
  comments: { appliedStatementCount: 0, sqlSha256: '' },
  mode: command.mode,
}
```

- [ ] **步骤 4：只保留 Drizzle migrate 的执行主线。**

从 runMigration 开头删除 const migrationInput = readMigrationInput()。删除 beforeJournal、assertMigrationJournalPreflight、afterJournal、assertActiveMigrationJournal 和 runDigest。

将 migrate 调用固定为：

```ts
const db = drizzle({ client })
const migrationResult = await migrate(db, {
  migrationsFolder: MIGRATIONS_DIRECTORY,
  migrationsSchema: MIGRATIONS_SCHEMA,
  migrationsTable: MIGRATIONS_TABLE,
})
```

Drizzle 成功后保留：

```ts
const comments = await applySchemaComments({ executor: client })
result = buildRunResult(comments)
process.stdout.write(
  `${JSON.stringify({
    backendPid: identity.backendPid,
    database: database.safeLabel,
    lockAttempts: lock.attempts,
    mode: command.mode,
    status: 'pass',
  })}\n`,
)
```

不要改动 readDatabaseConnection、readTargetIdentity、acquireMigrationSessionLock、releaseMigrationSessionLock、client release、pool.end 或错误优先级处理。

### 任务 4：删除失效规则与历史 owner 注记

**文件：**

- 修改：.trae/rules/07-drizzle-operations.md
- 修改：.trae/rules/08-testing.md
- 修改：.trae/rules/09-nestjs-architecture.md
- 修改：docs/superpowers/plans/2026-07-04-type-fix-remediation-plan.md

- [ ] **步骤 1：收敛 Drizzle 操作附录到剩余命令。**

在 .trae/rules/07-drizzle-operations.md：

1. 删除第 6-7 行“gate 由 db/operations/** 持有”的段落。
2. 将常规只读检查列表精确改为：

```bash
pnpm db:migration:check
pnpm db:comments:check
```

3. 删除关于 db:active:migration:check、当前 journal column shape、active journal append-only prefix 和写后完整 history 复核的第 24-34 行。
4. 保留 db:migrate 的显式 --mode active、DATABASE_URL、禁止 db:push 和不自动 seed 的说明；将末段的“旧 migration log fallback”删除，其余禁止兼容 API、双读、双写、--ignore-conflicts 和未登记临时写入的约束保留。

- [ ] **步骤 2：删除不存在的测试验证入口。**

从 .trae/rules/08-testing.md 的“当前真实入口”代码块删除：

```bash
pnpm db:core:check
```

保留 db:migration:check 与 db:comments:check。

- [ ] **步骤 3：删除已不存在的架构边界 owner。**

在 .trae/rules/09-nestjs-architecture.md:35：

1. 从 operational CLI composition 列表删除 db/operations/**。
2. 删除同段中从“db/operations/** 只承载”开始到“不得新增 barrel”结束的专用约束句。
3. 保留 db/targets/**、db/bootstrap/**、db/seed/**、db/migrate.ts、scripts/** 与通用“业务 runtime package 不得反向导入可执行入口”的规则。

- [ ] **步骤 4：修正历史计划的当前 owner 注记。**

将 docs/superpowers/plans/2026-07-04-type-fix-remediation-plan.md:102-103 的附加说明替换为：

```md
> 历史说明：此计划完成后，检查器曾位于
> db/operations/check-db-core-boundary.ts；该文件和 pnpm db:core:check 已于 2026-07-13 删除。
```

保留该历史计划中当时执行过的命令记录；它们不是当前可用命令。

### 任务 5：执行无写入验证并审查删除面

**文件：** 验证任务 2-4 的变更；不创建测试文件。

- [ ] **步骤 1：验证格式、lint 和仓库 TypeScript 基线。**

运行：

```powershell
pnpm exec prettier --check package.json db/migrate.ts .trae/rules/07-drizzle-operations.md .trae/rules/08-testing.md .trae/rules/09-nestjs-architecture.md docs/superpowers/plans/2026-07-04-type-fix-remediation-plan.md docs/superpowers/plans/2026-07-13-remove-db-operations.md
pnpm exec eslint db/migrate.ts
pnpm type-check
```

预期：全部退出码为 0。tsconfig.build.json 不包含 db/**，所以 ESLint 和下一步无副作用 module import 是 db/migrate.ts 的直接检查。

- [ ] **步骤 2：验证剩余 migration check 与 db/migrate.ts 的可加载性。**

运行：

```powershell
pnpm db:migration:check
pnpm exec tsx -e "import './db/migrate.ts'"
```

预期：全部退出码为 0。第二条只加载模块，不满足 require.main 条件，因此不读取 DATABASE_URL、不创建连接、不写入数据库。

- [ ] **步骤 3：验证所有 runtime、脚本和现行规则引用已经删除。**

运行：

```powershell
rg -n -S "db/operations|db:core:check|db:active:migration:check|inspectActiveDrizzleMigrationHistory|hashCanonicalJson|migrationDigest|migrationFolderDigest|journalBeforeDigest|journalAfterDigest|journalChanged" package.json db apps libs scripts .trae
git diff --check
git status --short
```

预期：第一条无输出且退出码为 1；git diff --check 退出码为 0；状态保留开始时已有的无关改动，并额外包含三个删除文件、db/migrate.ts、package.json、四份文档和本计划；本次不得新增 migration、测试文件或 lockfile。

- [ ] **步骤 4：记录运行验证边界。**

不要以默认验证执行 pnpm db:migrate：它会对 DATABASE_URL 指向的数据库写入 migration 和 comment。若后续必须验证实际 migrate 行为，只能在已明确授权的 disposable database 上，使用 --mode active，并将该写入验证作为独立任务记录。

- [ ] **步骤 5：在用户确认需要提交时创建 Conventional Commit。**

运行：

```powershell
git add -A db/operations db/migrate.ts package.json .trae/rules/07-drizzle-operations.md .trae/rules/08-testing.md .trae/rules/09-nestjs-architecture.md docs/superpowers/plans/2026-07-04-type-fix-remediation-plan.md docs/superpowers/plans/2026-07-13-remove-db-operations.md
git commit -m "refactor(db): remove operation guards"
```

预期：提交包含 guard 删除、migration runner 简化和规则同步；不包含数据库写入产物。

## 风险与缓解

| 风险                                                                                  | 已接受的结果或缓解                                                                                          |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 修改已执行 SQL、journal 名称或 hash 不再在写入前失败                                  | 这是删除 active-history/journal prefix guard 的直接结果；Drizzle migrator 自身的行为成为唯一 runtime 判断。 |
| 当前 journal 不符合 Drizzle RC shape 时不再得到项目自定义报错                         | 自定义 snapshot/shape 检查被完整删除；Drizzle 的原生报错将直接暴露。                                        |
| physical FK 不再由 migration CLI 静态扫描                                             | 保留 schema/migration 规范的禁止项，但删除运行时扫描实现。                                                  |
| db:migrate stdout 不再含 migrationCount、migrationDigest、journal digest 或 runDigest | 这些字段依赖已删除的 history/canonical JSON 逻辑；只保留成功状态和数据库/锁观测字段。                       |
| db:core:check 不再约束 @db/core allowlist 或深层导入                                  | 该整个 checker 被删除；后续需由现有 lint/review 发现此类问题。                                              |
| 误把直接 Drizzle Kit generate 当验证命令而生成文件                                    | 验证只运行 db:migration:check；不默认运行 db:generate。                                                     |

## 验收标准

- db/operations 目录与三个 source 文件均不存在，且仓库未新增任何替代 guard 文件。
- package.json 不含 db:core:check 或 db:active:migration:check；db:generate 与 db:migration:check 均直接调用 Drizzle Kit。
- db/migrate.ts 不再导入 db/operations，且不含 snapshot、journal assert、active history、canonical JSON 或 migration digest 符号。
- db:migrate.ts 仍要求 --mode active，仍核验实际数据库身份、持有 session lock、执行 Drizzle migrate，并同步 schema comments。
- .trae 的当前规则不再把 db/operations 或已删除脚本列为可用入口；历史文档只以历史说明保留已删除路径。
- 所有无写入验证命令通过，且没有创建测试文件、migration SQL、lockfile 或数据库写入。

## 明确不做的事项

- 不将任何 db/operations 文件迁移到 db/guards、scripts、db/migration 或其他目录。
- 不添加 compatibility alias、空 shell script 或 no-op checker 来保留已删除命令。
- 不通过 db:generate、db:migrate 或真实数据库连接验证本次删除；这些命令可能写入外部状态。
