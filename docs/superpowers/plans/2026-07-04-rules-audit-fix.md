# `.trae/rules` 规范文档审查修复计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 `.trae/rules` 下全部规范文档与项目实际代码/配置之间的不一致，同时补充社区最佳实践缺失项。

**架构：** 本计划分为 7 个独立任务，按"纯文档修改 → 配置修改 → 需要决策的修改"顺序排列。每个任务可独立交付、独立验证。任务 1-4 是纯文档/配置修改，风险低；任务 5-7涉及行为决策，需审查者确认后执行。

**技术栈：** TypeScript 6 + NestJS 11 + Drizzle ORM 1.0 RC + Fastify 5 + antfu ESLint config

---

## 任务文件总览

| 任务 | 类型     | 涉及文件                             | 风险 |
| ---- | -------- | ------------------------------------ | ---- |
| 1    | 文档修改 | `.trae/rules/06-error-handling.md`   | 低   |
| 2    | 文档修改 | `.trae/rules/02-controller.md`       | 低   |
| 3    | 文档修改 | `.trae/rules/05-comments.md`         | 低   |
| 4    | 文档修改 | `.trae/rules/08-testing.md`          | 低   |
| 5    | 配置修改 | `tsconfig.json`、`eslint.config.mjs` | 中   |
| 6    | 文档修改 | `.trae/rules/03-dto.md`              | 低   |
| 7    | 配置清理 | `package.json`                       | 中   |

---

### 任务 1：同步错误码列表

**文件：**

- 修改：`.trae/rules/06-error-handling.md`（第 35 行）

**问题：** 规范第 35 行的业务错误码列表只列到 `20005`（额度不足），但实际代码 `libs/platform/src/constant/error-code.constant.ts` 第 69 行还有 `INVALID_OPERATION_TARGET: 20006`（操作目标类型不支持）。

- [ ] **步骤 1：修改错误码列表**

将 `.trae/rules/06-error-handling.md` 第 35 行：

```
- 业务层固定 code 以 `BusinessErrorCode` 为准，例如 `20001`（资源不存在）、`20002`（资源已存在）、`20003`（状态冲突）、`20004`（当前操作不允许）、`20005`（额度不足）。
```

改为：

```
- 业务层固定 code 以 `BusinessErrorCode` 为准，例如 `20001`（资源不存在）、`20002`（资源已存在）、`20003`（状态冲突）、`20004`（当前操作不允许）、`20005`（额度不足）、`20006`（操作目标类型不支持）。
```

- [ ] **步骤 2：补充错误码扩展规则**

在 `.trae/rules/06-error-handling.md` 的"错误码与映射"小节末尾（第 39 行之后）新增一条：

```
- 新增错误码必须同步更新 `libs/platform/src/constant/error-code.constant.ts` 常量定义与本规范文档的错误码列表；不允许只改代码不更新规范，也不允许只更新规范不补充代码。
```

- [ ] **步骤 3：验证**

运行：`pnpm exec prettier --check .trae/rules/06-error-handling.md`

预期：通过，无格式错误。

---

### 任务 2：修正 Controller 规范表述并补充 `ApiHtmlDoc`

**文件：**

- 修改：`.trae/rules/02-controller.md`（第 7 行、第 22 行）

**问题 A：** 第 7 行"接口继续采用 RPC over HTTP"表述不准确。实际代码使用 `@Get`/`@Post` 等 HTTP 方法装饰器，路由命名是动作型的（如 `admin/report/page`），这不是真正的 RPC 协议，而是"动作型路由 over HTTP"。

**问题 B：** 第 22 行只提到 `ApiDoc`、`ApiPageDoc`，但实际代码中还存在 `ApiHtmlDoc` 装饰器（`libs/platform/src/decorators/api-doc.decorator.ts` 第 112 行），且已被 `apps/admin-api/src/modules/app-content/agreement/agreement.controller.ts` 第 106 行使用。

- [ ] **步骤 1：修正 RPC over HTTP 表述**

将 `.trae/rules/02-controller.md` 第 7 行：

```
- 接口继续采用 RPC over HTTP，不强制改成 REST。
```

改为：

```
- 接口继续采用动作型路由（RPC 风格）over HTTP，不强制改成 RESTful。
```

- [ ] **步骤 2：补充 `ApiHtmlDoc` 说明**

将 `.trae/rules/02-controller.md` 第 22 行：

```
- 统一使用 `ApiDoc`、`ApiPageDoc`。
```

改为：

```
- 统一使用 `ApiDoc`、`ApiPageDoc`、`ApiHtmlDoc`。其中 `ApiHtmlDoc` 仅用于返回 `text/html` 的特殊接口（如协议页、公告页渲染），保持 `ApiDoc` 的 JSON envelope 语义不变。
```

- [ ] **步骤 3：验证**

运行：`pnpm exec prettier --check .trae/rules/02-controller.md`

预期：通过，无格式错误。

---

### 任务 3：解决注释规范与实际代码的 JSDoc 矛盾

**文件：**

- 修改：`.trae/rules/05-comments.md`（第 9 行、第 17 行、第 25 行、第 57 行）

**问题：** 规范禁止方法使用 JSDoc（第 17 行、第 57 行），但实际代码中 `DrizzleService`（`db/core/drizzle.service.ts` 第 57、64、78、93 行等）、`setupApp`（`libs/platform/src/bootstrap/app.setup.ts` 第 14-23 行）等导出函数/方法广泛使用 JSDoc。规范与代码存在直接矛盾。

**修复决策：** 放宽规范，允许导出的公共方法/函数使用 JSDoc，但禁止私有方法使用 JSDoc，同时禁止 JSDoc 复述代码。理由：JSDoc 是 TypeScript 生态中导出符号文档的主流方式，IDE 悬浮提示依赖 JSDoc，完全禁止会丢失这一能力。

- [ ] **步骤 1：修改"默认动作"中的方法注释规则**

将 `.trae/rules/05-comments.md` 第 9 行：

```
- 每个方法定义前都必须有一条简短注释，直接说明"这个方法是做什么的"。
```

改为：

```
- 每个方法定义前都必须有一条简短注释，直接说明"这个方法是做什么的"。导出的公共方法/函数可使用 JSDoc 或行注释；私有方法、类内 helper 方法统一使用行注释。
```

- [ ] **步骤 2：修改"注释形式"中的 JSDoc 规则**

将 `.trae/rules/05-comments.md` 第 17 行：

```
- 方法注释统一使用紧邻方法定义的行注释，不使用 JSDoc。
```

改为：

```
- 导出的公共方法/函数可使用 JSDoc；私有方法、类内 helper 方法统一使用紧邻方法定义的行注释，不使用 JSDoc。
```

- [ ] **步骤 3：修改"必须写注释的场景"中的方法范围**

将 `.trae/rules/05-comments.md` 第 25 行：

```
- 所有方法定义，包括公共方法、私有方法、类内 helper 方法。
```

保持不变（这一条不需要修改，只是确认它与新规则不冲突——所有方法仍需注释，只是公共方法可以选 JSDoc 或行注释）。

- [ ] **步骤 4：修改"禁止项"中的 JSDoc 禁令**

将 `.trae/rules/05-comments.md` 第 57 行：

```
- 禁止为方法使用 JSDoc。
```

改为：

```
- 禁止为私有方法、类内 helper 方法使用 JSDoc；禁止用 `/** 获取用户 */` 这类复述代码的 JSDoc 作为方法注释。
```

- [ ] **步骤 5：修改"正反例"中的 JSDoc 反例**

将 `.trae/rules/05-comments.md` 第 79 行：

```
- 禁止：用 `/** 获取用户 */` 这种 JSDoc 作为方法注释。
```

保持不变（这条仍然有效——复述代码的 JSDoc 仍然是禁止的）。

- [ ] **步骤 6：验证**

运行：`pnpm exec prettier --check .trae/rules/05-comments.md`

预期：通过，无格式错误。

---

### 任务 4：修正测试规范中的不可用命令

**文件：**

- 修改：`.trae/rules/08-testing.md`（第 43 行）

**问题：** 规范第 43 行建议运行 `pnpm test -- --runInBand --runTestsByPath <temp-spec-path>`，但 `package.json` 中没有 `test` 脚本定义，这个命令无法直接使用。

- [ ] **步骤 1：修正临时测试运行命令**

将 `.trae/rules/08-testing.md` 第 43 行：

```
- 临时测试验证：可运行 `pnpm test -- --runInBand --runTestsByPath <temp-spec-path>`，随后删除临时测试文件。
```

改为：

```
- 临时测试验证：可运行 `pnpm exec jest --runInBand --runTestsByPath <temp-spec-path>`，随后删除临时测试文件。
```

- [ ] **步骤 2：验证**

运行：`pnpm exec prettier --check .trae/rules/08-testing.md`

预期：通过，无格式错误。

---

### 任务 5：修复 `tsconfig.json` 与 `eslint.config.mjs` 配置

**文件：**

- 修改：`tsconfig.json`（第 34、35、37、44 行）
- 修改：`eslint.config.mjs`（第 59-63 行）
- 修改：`tsconfig.build.json`（确认继承关系）

**问题：** `04-typescript-types.md` 规范禁止使用 `any`，但 `tsconfig.json` 中 `noImplicitAny: false` 允许隐式 any；`forceConsistentCasingInFileNames: false` 在 Windows 上可能导致大小写不一致问题（Linux CI 构建失败）；ESLint 中 `no-unsafe-*` 规则为 `warn` 而非 `error`，与规范严格程度不匹配。

> **⚠️ 注意：** 此任务涉及编译器配置变更，可能暴露大量既有隐式 any 和未使用变量。建议先运行 `pnpm type-check` 确认基线，修改后再运行对比。如果暴露的问题数量过大，可先只修复 `forceConsistentCasingInFileNames`（风险最低），`noImplicitAny` 和 `strict` 作为后续迭代。

- [ ] **步骤 1：记录基线**

运行：`pnpm type-check 2>&1 | tee /tmp/before-type-check.log`

预期：当前应通过（0 错误）。

- [ ] **步骤 2：修改 `tsconfig.json`**

将 `tsconfig.json` 第 44 行：

```json
"forceConsistentCasingInFileNames": false,
```

改为：

```json
"forceConsistentCasingInFileNames": true,
```

> 注意：先只修改这一项，然后验证。`noImplicitAny` 和 `strict` 的修改作为可选步骤，根据基线检查结果决定是否执行。

- [ ] **步骤 3：验证 `forceConsistentCasingInFileNames` 变更**

运行：`pnpm type-check`

预期：通过（0 错误）。如果出现错误，说明存在文件名大小写不一致的导入，需逐个修正。

- [ ] **步骤 4（可选，视步骤 3 结果决定）：修改 `noImplicitAny`**

如果团队决定推进，将 `tsconfig.json` 第 37 行：

```json
"noImplicitAny": false,
```

改为：

```json
"noImplicitAny": true,
```

运行：`pnpm type-check`

如果暴露大量错误（>50 个），回退此修改，记录到规范文档中作为后续迭代项。

- [ ] **步骤 5：修改 ESLint `no-unsafe-*` 规则**

将 `eslint.config.mjs` 第 59-63 行：

```javascript
'@typescript-eslint/no-unsafe-return': 'warn',
'@typescript-eslint/no-unsafe-assignment': 'warn',
'@typescript-eslint/no-unsafe-call': 'warn',
'@typescript-eslint/no-unsafe-argument': 'warn',
'@typescript-eslint/no-unsafe-member-access': 'warn',
```

改为：

```javascript
'@typescript-eslint/no-unsafe-return': 'error',
'@typescript-eslint/no-unsafe-assignment': 'error',
'@typescript-eslint/no-unsafe-call': 'error',
'@typescript-eslint/no-unsafe-argument': 'error',
'@typescript-eslint/no-unsafe-member-access': 'error',
```

- [ ] **步骤 6：验证 ESLint 变更**

运行：`pnpm lint`

如果暴露大量 error（>30 个），可回退为 `warn`，并记录到规范文档中作为后续迭代项。

- [ ] **步骤 7：更新 `04-typescript-types.md` 规范**

在 `.trae/rules/04-typescript-types.md` 的"边界类型"小节末尾（第 56 行之后）新增：

```
- `tsconfig.json` 中 `noImplicitAny` 与 `forceConsistentCasingInFileNames` 必须设为 `true`，与"禁止使用 `any`"的规范意图一致。
- ESLint 中 `@typescript-eslint/no-unsafe-*` 系列规则必须设为 `error`，不允许通过 `warn` 绕过。
```

- [ ] **步骤 8：验证**

运行：`pnpm type-check && pnpm exec prettier --check .trae/rules/04-typescript-types.md`

预期：通过。

- [ ] **步骤 9：Commit**

```bash
git add tsconfig.json eslint.config.mjs .trae/rules/04-typescript-types.md
git commit -m "fix: 修复 tsconfig 与 eslint 配置与规范的不一致"
```

---

### 任务 6：消除 DTO 规范中的内容重复

**文件：**

- 修改：`.trae/rules/03-dto.md`（第 70-71 行）

**问题：** nullable 字段规则在"默认动作"（第 12 行）、"禁止项"（第 70-71 行）中重复表述。重复内容增加维护成本，且两处描述容易失步。

- [ ] **步骤 1：精简"禁止项"中的 nullable 重复**

将 `.trae/rules/03-dto.md` 第 70-71 行：

```
- 禁止在输出 DTO 中对数据库 nullable 字段使用 `?: T | null`（可选字段），必须使用 `: T | null`（必填字段），确保 JSON 序列化时字段始终存在。
- 禁止在 Service 层对输出 DTO 的 nullable 字段赋值 `undefined`（如 `level?.name`、`value ?? undefined`、`value || undefined`），导致字段被 JSON 序列化省略；必须使用 `?? null` 确保值始终为 `null` 或实际值。
```

改为：

```
- 禁止违反 nullable 字段规则（见"默认动作"）：输出 DTO 中 nullable 字段必须使用 `: T | null`，Service 层必须使用 `?? null` 而非 `?? undefined`。
```

- [ ] **步骤 2：验证**

运行：`pnpm exec prettier --check .trae/rules/03-dto.md`

预期：通过。

---

### 任务 7：清理测试依赖或调整测试规范

**文件：**

- 修改：`package.json`（devDependencies 部分）

**问题：** `package.json` 安装了完整的测试依赖（`jest`、`ts-jest`、`supertest`、`@types/jest`、`@types/supertest`），但 `08-testing.md` 规定不保留测试文件，且 `package.json` 中没有 `test` 脚本。测试基础设施存在但不使用，造成 `node_modules` 体积浪费。

> **⚠️ 决策点：** 此任务有两种修复方向，需审查者选择：
>
> **方向 A（推荐）：** 保留测试依赖，在 `package.json` 中补充 `test` 脚本。理由：临时测试仍需要 `jest` 运行，保留依赖可让 `pnpm exec jest` 命令可用，与任务 4 修正后的规范一致。
>
> **方向 B：** 清理测试依赖。理由：如果不保留测试文件，安装测试依赖是纯粹的浪费。临时测试可通过 `tsx` 直接运行探针脚本替代。

- [ ] **步骤 1（方向 A）：补充 `test` 脚本**

在 `package.json` 的 `scripts` 部分第 18 行 `"type-check"` 之后新增：

```json
"test": "jest",
```

- [ ] **步骤 2（方向 A）：验证**

运行：`pnpm exec jest --version`

预期：输出 jest 版本号，确认 `jest` 可用。

- [ ] **步骤 3（方向 A）：更新 `08-testing.md`**

将任务 4 中修正的第 43 行改回：

```
- 临时测试验证：可运行 `pnpm test -- --runInBand --runTestsByPath <temp-spec-path>`，随后删除临时测试文件。
```

> 如果选择方向 B，跳过以上步骤，改为执行以下步骤：

- [ ] **步骤 1（方向 B）：移除测试依赖**

从 `package.json` 的 `devDependencies` 中移除以下条目：

- `@nestjs/testing`
- `@types/jest`
- `@types/supertest`
- `jest`
- `supertest`
- `ts-jest`

- [ ] **步骤 2（方向 B）：验证**

运行：`pnpm install`

预期：安装成功，无缺失依赖警告。

- [ ] **步骤 3（方向 B）：更新 `08-testing.md`**

将任务 4 中修正的第 43 行改为：

```
- 临时测试验证：可使用 `pnpm exec tsx <temp-probe-path>` 运行探针脚本验证行为；如需断言式验证，可临时安装 jest 或使用 node:assert。验证后删除临时文件。
```

- [ ] **步骤 4：验证**

运行：`pnpm type-check && pnpm exec prettier --check .trae/rules/08-testing.md`

预期：通过。

- [ ] **步骤 5：Commit**

```bash
git add package.json pnpm-lock.yaml .trae/rules/08-testing.md
git commit -m "chore: 清理未使用的测试依赖或补充 test 脚本"
```

---

## 自检清单

### 规格覆盖度

| 审查发现                                  | 对应任务 | 状态 |
| ----------------------------------------- | -------- | ---- |
| 错误码列表不完整（缺 `20006`）            | 任务 1   | ✅   |
| 缺少错误码扩展规则                        | 任务 1   | ✅   |
| "RPC over HTTP" 表述不准确                | 任务 2   | ✅   |
| 缺少 `ApiHtmlDoc` 说明                    | 任务 2   | ✅   |
| 注释规范禁止方法 JSDoc 与实际代码矛盾     | 任务 3   | ✅   |
| 测试规范临时测试命令不可用                | 任务 4   | ✅   |
| `noImplicitAny: false` 与禁止 any 矛盾    | 任务 5   | ✅   |
| `forceConsistentCasingInFileNames: false` | 任务 5   | ✅   |
| ESLint `no-unsafe-*` 为 warn 而非 error   | 任务 5   | ✅   |
| `04-typescript-types.md` 缺少配置约束说明 | 任务 5   | ✅   |
| DTO 规范 nullable 规则重复                | 任务 6   | ✅   |
| 测试依赖与规范矛盾                        | 任务 7   | ✅   |

### 未纳入本次修复的项（需后续迭代）

| 审查发现                                                       | 原因                         | 建议                   |
| -------------------------------------------------------------- | ---------------------------- | ---------------------- |
| `tsconfig.json` 未启用 `strict: true`                          | 可能暴露大量错误，需单独评估 | 后续迭代               |
| `tsconfig.json` 未启用 `noUnusedLocals` / `noUnusedParameters` | 可能暴露大量错误，需单独评估 | 后续迭代               |
| 导入白名单无自动化校验脚本                                     | 需开发新脚本，工作量较大     | 后续迭代               |
| Drizzle RC 版本风险提示                                        | 属于补充说明，非修复         | 可在下次规范更新时补充 |
| `PROJECT_RULES.md` 与 `AGENTS.md` 决策顺序重复                 | 需团队讨论哪份作为单一事实源 | 后续讨论               |

### 类型一致性

- 任务 5 步骤 7 引用的 `noImplicitAny` 和 `forceConsistentCasingInFileNames` 与步骤 2、4 的修改一致。
- 任务 7 方向 A 的 `test` 脚本与任务 4 修正后的命令一致；方向 B 的 `tsx` 命令与 `package.json` 中已有的 `tsx` 依赖一致。
- 所有规范文档修改后的文件路径、符号名与实际代码一致。

---

## 执行说明

本计划仅作审查，不执行任何修改。审查者确认后，可按以下方式执行：

1. **子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查
2. **内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点
