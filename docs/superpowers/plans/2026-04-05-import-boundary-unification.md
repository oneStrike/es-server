# 导入边界全仓统一改造实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将仓库内所有 `apps/*`、`libs/*` 对混合 root barrel 的使用统一迁移到 `contracts`、`core`、`module` 等受支持公共子入口，使代码符合 `IMPORT_BOUNDARY_SPEC.md`，并消除由 `DTO -> root barrel -> runtime -> DTO` 引发的运行时循环依赖风险。

**架构：** 以“入口分层 + 自动化迁移 + 单分支原子切换”为核心。先调整 ESLint 规则以允许受支持的第三层公共子入口，再通过 inventory + scaffold + codemod 三类脚本批量生成 `contracts/core/module` 入口并改写全仓 import，最后在同一分支内完成 root barrel 收口与旧入口清理，确保合入结果不保留双轨出口或兼容别名。

**技术栈：** TypeScript、NestJS、ESLint、tsx、ripgrep、tsc、Jest

---

### 任务 1：建立迁移基线与允许路径

**文件：**
- 修改：`/E:/Code/es/es-server/eslint.config.mjs`
- 创建：`/E:/Code/es/es-server/scripts/import-boundary/inventory.ts`
- 创建：`/E:/Code/es/es-server/scripts/import-boundary/shared.ts`
- 创建：`/E:/Code/es/es-server/docs/superpowers/plans/2026-04-05-import-boundary-unification.md`

- [ ] **步骤 1：编写 inventory 脚本，输出混合 root barrel 域与 import 使用点**

```ts
// scripts/import-boundary/shared.ts
export interface MixedDomainRecord {
  domain: string
  indexFile: string
  exports: {
    dto: boolean
    module: boolean
    service: boolean
    interfaces: boolean
    constant: boolean
  }
}

export interface ImportUsageRecord {
  importer: string
  specifier: string
  layer: 'app' | 'lib'
  kind: 'dto' | 'service' | 'resolver' | 'module' | 'controller' | 'other'
}
```

```ts
// scripts/import-boundary/inventory.ts
import { readFileSync } from 'node:fs'
import { globby } from 'globby'

// 读取 libs/**/src/*/index.ts，找出同时导出 dto + runtime 的 mixed domains
// 再扫描 apps/** 与 libs/** 的 import，按文件类型分类输出 JSON 报告
```

- [ ] **步骤 2：运行 inventory，生成首份迁移清单**

运行：`pnpm exec tsx scripts/import-boundary/inventory.ts`
预期：输出 mixed domains 列表、每个域的 import 次数、DTO / runtime / module 使用分布

- [ ] **步骤 3：修改 ESLint，允许受支持子入口并保留 deep import 限制**

```ts
// eslint.config.mjs
// 目标：允许 @libs/<lib>/<domain>/contracts|core|module 与 @libs/<lib>/module
// 同时继续禁止文件级 deep import，如 dto/*.dto.ts、*.service.ts
// 并为 libs/**/* 新增限制：禁止直接依赖同时导出 DTO + runtime 的 root barrel
```

- [ ] **步骤 4：运行 lint 验证 ESLint 配置自身合法**

运行：`pnpm exec eslint eslint.config.mjs`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add eslint.config.mjs scripts/import-boundary docs/superpowers/plans/2026-04-05-import-boundary-unification.md
git commit -m "chore: add import boundary migration baseline"
```

### 任务 2：为 mixed domains 生成标准化公共子入口

**文件：**
- 创建：`/E:/Code/es/es-server/scripts/import-boundary/scaffold-subentries.ts`
- 修改：所有 mixed domain 的 `libs/**/src/*/index.ts`
- 创建：所有 mixed domain 的 `libs/**/src/*/contracts.ts`
- 创建：所有 mixed domain 的 `libs/**/src/*/core.ts`
- 创建：按需创建的 `libs/**/src/*/module.ts`

- [ ] **步骤 1：编写 subentry scaffold 脚本**

```ts
// scripts/import-boundary/scaffold-subentries.ts
// 输入 inventory 结果，为每个 mixed domain 生成：
// - contracts.ts：DTO + 契约常量 + 契约友好类型
// - core.ts：service + resolver interface + runtime constant + helper
// - module.ts：仅 module 导出（若该域已有 module）
// 同一迁移分支内需要同步改写 root index.ts，避免最终结果长期保留混合导出
```

- [ ] **步骤 2：定义自动分类规则**

```ts
// 推荐分类
// dto/** -> contracts
// *constant.ts -> contracts + core（纯常量域）
// interfaces/** -> core
// *.service.ts -> core
// *.module.ts -> module
//
// 若某常量被 DTO 和 runtime 同时依赖，允许 contracts/core 双重导出
```

- [ ] **步骤 3：运行脚本，为全部 mixed domains 生成子入口**

运行：`pnpm exec tsx scripts/import-boundary/scaffold-subentries.ts`
预期：为 inventory 中的全部 mixed domains 创建 `contracts.ts` / `core.ts` / `module.ts`

- [ ] **步骤 4：人工抽查高风险域生成结果**

重点检查：
- `libs/content/src/work`
- `libs/interaction/src/download`
- `libs/interaction/src/reading-state`
- `libs/interaction/src/purchase`
- `libs/interaction/src/comment`
- `libs/interaction/src/like`
- `libs/interaction/src/follow`
- `libs/interaction/src/favorite`
- `libs/interaction/src/browse-log`
- `libs/interaction/src/report`

- [ ] **步骤 5：运行类型检查，确认新增子入口不破坏路径解析**

运行：`pnpm exec tsc -p tsconfig.json --noEmit`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add libs scripts/import-boundary
git commit -m "refactor: scaffold import-boundary subentries"
```

### 任务 3：批量改写 DTO import 到 contracts

**文件：**
- 创建：`/E:/Code/es/es-server/scripts/import-boundary/rewrite-dto-imports.ts`
- 修改：所有 `apps/**/*dto*.ts`
- 修改：所有 `libs/**/*dto*.ts`

- [ ] **步骤 1：编写 DTO import codemod**

```ts
// scripts/import-boundary/rewrite-dto-imports.ts
// 规则：
// - DTO 文件从 mixed root domain 迁移到 @libs/<lib>/<domain>/contracts
// - 若同一文件既拿 DTO 又拿 runtime symbol，则拆成两条 import
// - 保持 import 排序稳定，避免无关格式漂移
```

- [ ] **步骤 2：运行 codemod**

运行：`pnpm exec tsx scripts/import-boundary/rewrite-dto-imports.ts`
预期：所有 DTO 文件不再从 mixed root barrel 引入基类 DTO

- [ ] **步骤 3：人工复核所有使用 mapped types 的 DTO**

重点复核：
- `PickType(...)`
- `OmitType(...)`
- `PartialType(...)`
- `IntersectionType(...)`

重点文件：
- `libs/interaction/src/download/dto/download.dto.ts`
- `libs/interaction/src/reading-state/dto/reading-state.dto.ts`
- `libs/interaction/src/purchase/dto/purchase.dto.ts`
- `apps/app-api/src/modules/work/dto/*.ts`
- `apps/admin-api/src/modules/content/**/*dto*.ts`

- [ ] **步骤 4：运行 admin/app 类型检查**

运行：`pnpm exec tsc -p apps/admin-api/tsconfig.app.json --noEmit`
预期：PASS

运行：`pnpm exec tsc -p apps/app-api/tsconfig.app.json --noEmit`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add apps libs scripts/import-boundary
git commit -m "refactor: move dto imports to contracts subentries"
```

### 任务 4：批量改写 runtime import 到 core 与 module，并同步收口 root barrel

**文件：**
- 创建：`/E:/Code/es/es-server/scripts/import-boundary/rewrite-runtime-imports.ts`
- 修改：所有 `*.service.ts`
- 修改：所有 `*.resolver.ts`
- 修改：所有 `*.module.ts`
- 修改：所有 `*.controller.ts`

- [ ] **步骤 1：编写 runtime import codemod**

```ts
// scripts/import-boundary/rewrite-runtime-imports.ts
// 规则：
// - service / resolver / helper 对跨域 runtime symbol 改为 /core
// - module imports 改为 /module
// - controller 若只消费 DTO 用 /contracts，若消费 service 用 /core
// - apps 层也统一切换到明确子入口，避免 root barrel 语义混杂
// - 若某 root index.ts 仅剩 module 聚合价值，则同步收缩为 module-only 或删除多余导出
```

- [ ] **步骤 2：按域执行改写，先高风险后全量**

先改：
- `content/work <-> interaction/*`
- `forum/* <-> interaction/*`

后改：
- `message/*`
- `growth/*`
- `config/*`
- `app-content/*`

- [ ] **步骤 3：人工清理无法自动判定的文件**

典型场景：
- 同时使用 DTO、Module、Service 的 controller / module 文件
- 现有标准子入口如 `@libs/message/module`、`@libs/user/core`
- 历史非标准别名入口，如 `@libs/interaction/purchase-contract`，需要迁移后删除或改名归一

- [ ] **步骤 4：运行 lint 与类型检查**

运行：`pnpm lint`
预期：PASS

运行：`pnpm type-check`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add apps libs scripts/import-boundary eslint.config.mjs
git commit -m "refactor: move runtime imports to core and module subentries"
```

### 任务 5：高风险域人工复核与旧入口清理

**文件：**
- 修改：`/E:/Code/es/es-server/libs/content/src/work/**/*`
- 修改：`/E:/Code/es/es-server/libs/interaction/src/**/*`
- 修改：历史 root index 与非标准子入口文件，如 `purchase-contract.ts`

- [ ] **步骤 1：人工复核最容易出现循环依赖的调用链**

重点链路：
- `content/work -> interaction/download -> interaction DTO -> content/work DTO`
- `content/work -> interaction/reading-state -> interaction DTO -> content/work DTO`
- `content/work -> interaction/purchase -> interaction DTO -> content/work DTO`

- [ ] **步骤 2：删除或收敛历史非标准入口，避免合入后双轨并存**

```ts
// 迁移完成后，删除旧别名入口或将其重命名为标准 contracts/core/module 入口
// 不保留长期兼容转发文件
```

- [ ] **步骤 3：重写 root index.ts，仅保留明确聚合职责**

```ts
/**
 * Root barrel is for explicit external aggregation only.
 * Internal imports must use contracts/core/module subentries.
 */
```

- [ ] **步骤 4：运行应用构建**

运行：`pnpm build:admin`
预期：PASS

运行：`pnpm build:app`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add libs
git commit -m "refactor: remove legacy import-boundary entrypoints"
```

### 任务 6：补齐自动防线，防止回归

**文件：**
- 修改：`/E:/Code/es/es-server/eslint.config.mjs`
- 创建：`/E:/Code/es/es-server/scripts/import-boundary/check-boundary.ts`
- 修改：`/E:/Code/es/es-server/package.json`

- [ ] **步骤 1：新增 import-boundary 校验脚本**

```ts
// scripts/import-boundary/check-boundary.ts
// 校验：
// - libs 内部不得直接 import mixed root barrel
// - 不得出现未登记第三层子入口
// - DTO 文件不得 import core
```

- [ ] **步骤 2：将校验脚本接入 package.json**

```json
{
  "scripts": {
    "check:import-boundary": "tsx scripts/import-boundary/check-boundary.ts"
  }
}
```

- [ ] **步骤 3：在 ESLint 中收紧 libs 层规则**

```ts
// 只对 libs/**/* 启用更严格限制：
// - 禁止 mixed root domain import
// - 允许 contracts/core/module
// - 禁止文件级 deep import
```

- [ ] **步骤 4：运行最终验证**

运行：`pnpm exec tsx scripts/import-boundary/check-boundary.ts`
预期：PASS

运行：`pnpm lint`
预期：PASS

运行：`pnpm type-check`
预期：PASS

运行：`pnpm test -- --runInBand`
预期：核心单测通过；若有已知历史失败，需在交付说明中单独列出

- [ ] **步骤 5：Commit**

```bash
git add eslint.config.mjs package.json scripts/import-boundary
git commit -m "chore: enforce import-boundary rules"
```

### 任务 7：交付与迁移收尾

**文件：**
- 修改：`/E:/Code/es/es-server/.trae/rules/IMPORT_BOUNDARY_SPEC.md`
- 修改：`/E:/Code/es/es-server/.trae/rules/RULE_INDEX.md`
- 修改：`/E:/Code/es/es-server/README.md`（如需补充开发约定）

- [ ] **步骤 1：回填最终约束与例外清单**

```md
- 已支持子入口：contracts / core / module
- 已删除的历史非标准入口与 root 混合导出清单
- 临时例外与回收时间
```

- [ ] **步骤 2：输出迁移报告**

内容至少包含：
- mixed domains 总数
- 自动改写 import 数量
- 人工修复文件数量
- 删除或收口的旧入口列表
- 尚未回收的技术债

- [ ] **步骤 3：最终 Commit**

```bash
git add .trae/rules README.md
git commit -m "docs: document import-boundary migration"
```

## 规格覆盖度自检

- 覆盖了规范更新、ESLint 放行、全仓子入口生成、全仓 import 改写、循环依赖高风险复核、自动校验与最终收口。
- 未把“全仓统一”简化成手工改几处示例文件，而是明确要求 inventory、scaffold、codemod、验证四类自动化动作。
- 已显式区分仓库内现有标准子入口（如 `@libs/user/core`、`@libs/message/module`）与历史非标准别名入口（如 `@libs/interaction/purchase-contract`），并要求迁移后删除后者。

## 关键执行建议

- 不要用纯手工方式一处一处改 import；应先写脚本建立迁移能力，再批量执行。
- 不要把全仓统一压成一个 commit；建议一个分支内分 6-8 个 commit，便于回滚和 review。
- 不要先收紧 ESLint 再改代码；必须先放行 approved subentries，再推进 codemod。
- 允许在同一迁移分支内分 commit 推进，但分支最终状态必须完成原子切换：不保留双轨 root 导出，不保留历史兼容别名。
