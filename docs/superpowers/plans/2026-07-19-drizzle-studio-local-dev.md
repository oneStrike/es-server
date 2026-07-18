# Drizzle Studio 本地开发环境接入 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在本地开发环境启用 `drizzle-kit studio`，提供一个轻量可视化数据库浏览器，不涉及任何公网或远程部署配置。

**架构：** 沿用项目已有的 drizzle-kit 配置隔离模式（`drizzle.shared.config.ts` 共享基础 + 独立配置文件注入 `dbCredentials`），新建 `drizzle.studio.config.ts`，并在 `package.json` 新增 `db:studio` 脚本。关键安全点：当前 RC 版本（`drizzle-kit@1.0.0-rc.3`）的 `studio` 子命令默认 `--host=0.0.0.0`（绑定所有网卡），必须在脚本中显式指定 `--host=127.0.0.1` 确保只监听本地回环。同步更新操作附录文档，把新命令及其边界约束登记到受控入口列表。

**技术栈：** drizzle-kit@1.0.0-rc.3、drizzle-orm@1.0.0-rc.4、PostgreSQL、TypeScript、pnpm

---

## 文件结构

| 文件                                   | 职责                                                                 | 操作                            |
| -------------------------------------- | -------------------------------------------------------------------- | ------------------------------- |
| `drizzle.studio.config.ts`             | studio 子命令的独立配置文件，复用共享配置并运行时注入 `DATABASE_URL` | **创建**                        |
| `drizzle.shared.config.ts`             | 已有的共享基础配置（dialect/schema/out/migrations）                  | 不修改                          |
| `drizzle.config.ts`                    | 已有的 generate/check 配置（不含 `dbCredentials`）                   | 不修改                          |
| `drizzle.migrate.config.ts`            | 已有的 migrate 配置（含 `dbCredentials`）                            | 不修改                          |
| `package.json`                         | npm scripts 注册 `db:studio` 入口                                    | **修改**：`scripts` 段新增 1 行 |
| `.trae/rules/07-drizzle-operations.md` | Drizzle 操作附录，受控命令登记                                       | **修改**：新增 1 个章节         |

**设计边界确认：**

- `drizzle.studio.config.ts` 的结构与 `drizzle.migrate.config.ts` 完全对齐：都从 `.env` 读 `DATABASE_URL`，都 spread `drizzleKitConfig`，都 `satisfies Config`。
- `studio` 属于"需要连库"的命令，不能复用 `drizzle.config.ts`（该文件不含 `dbCredentials`）。
- 不向 `drizzle.shared.config.ts` 添加 `dbCredentials`，避免污染 `generate`/`check` 这类不需要连库的命令。
- `tsconfig.build.json`（`pnpm type-check` 使用）的 `include` 仅覆盖 `apps/**/*` 和 `libs/**/*`，根级 `*.ts` 配置文件不在类型检查范围内——这与现有 `drizzle.config.ts`、`drizzle.migrate.config.ts` 的处理方式一致。
- `eslint` 的 lint glob（`{apps,libs,scripts,db}/**/*.ts`）也不覆盖根级配置文件——同样与现有配置文件一致。

---

### 任务 1：创建 `drizzle.studio.config.ts`

**文件：**

- 创建：`drizzle.studio.config.ts`

- [ ] **步骤 1：编写配置文件**

在仓库根目录创建 `drizzle.studio.config.ts`，内容与 `drizzle.migrate.config.ts` 结构完全对齐，仅修改错误消息中的命令名：

```typescript
import type { Config } from 'drizzle-kit'
import { existsSync } from 'node:fs'
import { env, loadEnvFile } from 'node:process'
import { defineConfig } from 'drizzle-kit'
import { drizzleKitConfig } from './drizzle.shared.config'

const localEnvFile = '.env'

if (existsSync(localEnvFile)) {
  loadEnvFile(localEnvFile)
}

const databaseUrl = env.DATABASE_URL?.trim()

if (!databaseUrl) {
  throw new Error('db:studio 需要 DATABASE_URL')
}

export default defineConfig({
  ...drizzleKitConfig,
  dbCredentials: {
    url: databaseUrl,
  },
}) satisfies Config
```

**关键设计点：**

1. 与 `drizzle.migrate.config.ts` 逐行对齐，只把错误消息从 `'db:migrate 需要 DATABASE_URL'` 改为 `'db:studio 需要 DATABASE_URL'`。
2. 复用 `drizzleKitConfig`（来自 `drizzle.shared.config.ts`），确保 dialect、schema 路径、migration 表名等合同与 generate/check/migrate 完全一致。
3. 运行时从 `.env` 读取 `DATABASE_URL`，不硬编码凭证。

- [ ] **步骤 2：确认文件结构正确**

运行：`node -e "require('./drizzle.studio.config.ts')"` 会因 TS 语法失败，这是预期行为。改用文件内容对比验证：

运行：比较 `drizzle.studio.config.ts` 与 `drizzle.migrate.config.ts` 的结构

预期：两者结构一致，仅错误消息中的命令名不同（`db:studio` vs `db:migrate`）。

---

### 任务 2：在 `package.json` 注册 `db:studio` 脚本

**文件：**

- 修改：`package.json`（`scripts` 段，第 27 行 `db:migrate` 之后）

- [ ] **步骤 1：新增 `db:studio` 脚本**

在 `package.json` 的 `scripts` 对象中，紧跟 `db:migrate` 行之后新增一行。

将：

```json
    "db:migrate": "drizzle-kit migrate --config=drizzle.migrate.config.ts",
    "db:seed:demo": "tsx --env-file=.env db/seed/command.ts",
```

替换为：

```json
    "db:migrate": "drizzle-kit migrate --config=drizzle.migrate.config.ts",
    "db:studio": "drizzle-kit studio --config=drizzle.studio.config.ts --host=127.0.0.1",
    "db:seed:demo": "tsx --env-file=.env db/seed/command.ts",
```

**关键设计点：**

1. `--host=127.0.0.1` 是**必须**的：`drizzle-kit@1.0.0-rc.3` 的 `studio` 子命令默认 `--host=0.0.0.0`（已通过 `drizzle-kit studio --help` 确认），会绑定所有网卡。显式指定 `127.0.0.1` 确保只监听本地回环，避免开发期间意外暴露到局域网。
2. 不传 `--port`，使用默认的 `4983`。
3. 不传 `--verbose`，保持默认不打印每条 SQL（需要时开发者可手动追加 `--verbose`）。

- [ ] **步骤 2：确认脚本注册成功**

运行：`node -e "const p=require('./package.json'); console.log(p.scripts['db:studio'])"`

预期输出：`drizzle-kit studio --config=drizzle.studio.config.ts --host=127.0.0.1`

- [ ] **步骤 3：确认 studio 子命令在此版本可用**

运行：`node node_modules/drizzle-kit/bin.cjs studio --help`

预期：退出码 0，输出包含 `--config`、`--port`、`--host`、`--verbose` 四个 flag。

- [ ] **步骤 4：运行仓库类型检查基线**

运行：`pnpm type-check`

预期：PASS（exit code 0）。根级配置文件不在 `tsconfig.build.json` 的 `include` 范围内，但运行基线确认无连带破坏。

---

### 任务 3：更新 Drizzle 操作附录文档

**文件：**

- 修改：`.trae/rules/07-drizzle-operations.md`（在文件末尾新增章节）

- [ ] **步骤 1：在文件末尾追加"本地数据浏览"章节**

在 `.trae/rules/07-drizzle-operations.md` 的最后一行（第 75 行 `未登记临时写入和任何旧 migration fallback。任何失败都停止并记录必要的脱敏诊断。`）之后，追加以下内容：

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

```

- [ ] **步骤 2：运行 Markdown 格式检查**

运行：`pnpm exec prettier --check .trae/rules/07-drizzle-operations.md`

预期：PASS。如果 FAIL，运行 `pnpm exec prettier --write .trae/rules/07-drizzle-operations.md` 修正格式后重新检查。

- [ ] **步骤 3：运行类型检查（规则文档改动基线验证）**

运行：`pnpm type-check`

预期：PASS（exit code 0），确认仓库基线未被破坏。

---

### 任务 4：最终验证与提交

- [ ] **步骤 1：确认配置文件完整性**

运行：逐文件检查 `drizzle.studio.config.ts`、`drizzle.migrate.config.ts`、`drizzle.config.ts`、`drizzle.shared.config.ts` 的职责边界

预期：

| 文件 | 含 `dbCredentials` | 用途 |
| --- | --- | --- |
| `drizzle.shared.config.ts` | ❌ | 共享基础配置 |
| `drizzle.config.ts` | ❌ | generate / check |
| `drizzle.migrate.config.ts` | ✅（运行时注入） | migrate |
| `drizzle.studio.config.ts` | ✅（运行时注入） | studio |

- [ ] **步骤 2：确认 `package.json` scripts 段完整**

运行：`node -e "const p=require('./package.json'); Object.entries(p.scripts).filter(([k])=>k.startsWith('db:')).forEach(([k,v])=>console.log(k+': '+v))"`

预期输出包含：

```

db:generate: drizzle-kit generate --config=drizzle.config.ts
db:migration:check: drizzle-kit check --config=drizzle.config.ts
db:comments:generate: tsx scripts/db-comments.ts
db:comments:check: tsx scripts/db-comments.ts --check
db:boundary:check: tsx scripts/check-db-boundary.ts
db:migrate: drizzle-kit migrate --config=drizzle.migrate.config.ts
db:studio: drizzle-kit studio --config=drizzle.studio.config.ts --host=127.0.0.1
db:seed:demo: tsx --env-file=.env db/seed/command.ts
...

````

- [ ] **步骤 3：确认操作附录已更新**

运行：搜索 `.trae/rules/07-drizzle-operations.md` 中是否包含 `db:studio`

预期：匹配到"本地数据浏览"章节。

- [ ] **步骤 4：全量类型检查**

运行：`pnpm type-check`

预期：PASS（exit code 0）

- [ ] **步骤 5：Commit**

```bash
git add drizzle.studio.config.ts package.json .trae/rules/07-drizzle-operations.md
git commit -m "feat(db): 接入 drizzle-kit studio 本地开发浏览器

- 新增 drizzle.studio.config.ts，复用共享配置并运行时注入 DATABASE_URL
- package.json 新增 db:studio 脚本，显式 --host=127.0.0.1 防止局域网暴露
- 07-drizzle-operations.md 新增'本地数据浏览'章节登记受控入口
- studio 仅用于本地只读浏览，不替代 migration 工作流"
````

---

## 自检

### 1. 规格覆盖度

| 需求                       | 对应任务                                               |
| -------------------------- | ------------------------------------------------------ |
| 创建 studio 配置文件       | 任务 1                                                 |
| 注册 npm 脚本              | 任务 2                                                 |
| 显式绑定 localhost（安全） | 任务 2 步骤 1（`--host=127.0.0.1`）                    |
| 更新操作附录文档           | 任务 3                                                 |
| 验证与提交                 | 任务 4                                                 |
| 不涉及公网配置             | ✅ 无 `--host=0.0.0.0`、无 mkcert、无 Gateway 相关步骤 |

无遗漏。

### 2. 占位符扫描

无 "TODO"、"待定"、"类似任务 N" 等占位符。每个步骤均包含完整代码或精确命令与预期输出。

### 3. 类型一致性

- `drizzle.studio.config.ts` 的 `defineConfig(...)` 返回值类型与 `drizzle.migrate.config.ts` 完全一致，都 `satisfies Config`。
- `dbCredentials: { url: databaseUrl }` 的类型与 `drizzle-kit` 的 PostgreSQL `Config.dbCredentials` 定义一致（`url: string`）。
- `drizzleKitConfig` 已在 `drizzle.shared.config.ts` 中 `satisfies Config`，spread 后再追加 `dbCredentials` 不破坏类型约束。
- `package.json` 的 `scripts` 值均为 `string` 类型，新增行格式与现有行一致。

### 4. 关键风险确认

- **`--host` 默认值风险**：已通过 `drizzle-kit studio --help` 实测确认 RC 版本默认 `0.0.0.0`，脚本中显式指定 `127.0.0.1` 规避。
- **配置文件隔离**：`drizzle.studio.config.ts` 不修改任何现有配置文件，新增文件独立存在，零回归风险。
- **文档一致性**：`07-drizzle-operations.md` 已明确 studio 不替代 migration 工作流、不连生产库，与 `07-drizzle.md` 第 81 行"禁止 `drizzle-kit push`"不冲突（studio ≠ push）。
