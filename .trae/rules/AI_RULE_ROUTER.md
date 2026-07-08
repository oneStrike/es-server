# AI 规则快速路由

本文件面向第一次进入仓库，或遇到多类规则交叉的 AI agent。

## 边界

- 本文件只做导航，不替代 `AGENTS.md`、`PROJECT_RULES.md` 和 `01-08` 专项规则。
- 如果本文件与专项规则冲突，以 `AGENTS.md`、`PROJECT_RULES.md` 和对应专项规则为准。
- 本文件的目标只有一个：帮助你更快判断“先读什么、最低验证做到什么程度”。

## 决策树

按本次改动的主要落点，先选一类：

- 改导入路径、文件放置、barrel、`libs/platform` / `db` 入口：
  - 先读 [01-import-boundaries.md](./01-import-boundaries.md)
- 改 Controller、路由、Swagger、`@HttpCode()`、响应模型：
  - 先读 [02-controller.md](./02-controller.md)
  - 如果同时改成功 / 失败语义，再读 [06-error-handling.md](./06-error-handling.md)
- 改 DTO、返回结构、nullable 字段、`validation: false`、字段复用：
  - 先读 [03-dto.md](./03-dto.md)
  - 如果同时改 Controller 出参，再读 [02-controller.md](./02-controller.md)
- 改 `*.type.ts`、类型推导、签名类型、Drizzle `infer` 类型：
  - 先读 [04-typescript-types.md](./04-typescript-types.md)
  - 如果结构本质上是 HTTP contract，再回到 [03-dto.md](./03-dto.md)
- 改注释、schema 字段说明、导出类型 / 常量 / 枚举注释：
  - 先读 [05-comments.md](./05-comments.md)
- 改错误码、`BusinessException`、HTTP 状态、数据库错误转换：
  - 先读 [06-error-handling.md](./06-error-handling.md)
  - 如果同时改 Controller 响应，再读 [02-controller.md](./02-controller.md)
- 改 Drizzle 查询、schema、migration、seed、bootstrap：
  - 先读 [07-drizzle.md](./07-drizzle.md)
  - 如果同时改 DTO / 返回 contract，再读 [03-dto.md](./03-dto.md)
  - 如果同时改错误收口，再读 [06-error-handling.md](./06-error-handling.md)
- 改验证方式、临时测试、探针脚本、交付前检查：
  - 先读 [08-testing.md](./08-testing.md)
  - 再回看 [AGENTS.md](../../AGENTS.md) 的验证基线
- 只改文档、规则、说明文字：
  - 先读 [AGENTS.md](../../AGENTS.md) 的验证基线
  - 如果改的是规则文档，再读 [PROJECT_RULES.md](./PROJECT_RULES.md)

如果一次改动命中多类，取并集，不要只读一篇规则就开始改。

## 常用命令清单

如果你已经大致知道改动类型，只是想先找仓库里的现成命令，可以先看这里：

### 文档与规则文档

- Markdown 格式检查：
  - `pnpm exec prettier --check <files...>`
- 规则 / 规范文档改动基线：
  - `pnpm type-check`

### 通用代码基线

- 大多数代码改动的最低基线：
  - `pnpm type-check`

### 导入边界与仓库边界

- `db/core` 边界检查：
  - `pnpm db:core:check`
- Swagger 导入边界检查：
  - `pnpm swagger:imports:check`

### Schema、migration 与注释

- migration 检查：
  - `pnpm db:migration:check`
- schema 注释检查：
  - `pnpm db:comments:check`

### 临时测试

- 定点运行临时 spec：
  - `pnpm exec jest --runInBand --runTestsByPath <temp-spec-path>`

上面的命令只解决“跑什么”；是否该跑、还要不要补别的验证，仍然回到下方速查表和对应专项规则判断。

## 速查表

| 改动类型                                    | 必须先读                                                                                                   | 常见误判                                                                                       | 最低验证                                                                                   | 相关例外                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 导入路径 / owner 放置 / barrel              | [01-import-boundaries.md](./01-import-boundaries.md)                                                       | 把 `libs/platform`、`db` 当成普通 owner 文件；为了缩短路径新增 `index.ts`                      | `pnpm type-check`                                                                          | [AI_TERMS.md](./AI_TERMS.md)、[AI_EXCEPTIONS.md](./AI_EXCEPTIONS.md) |
| Controller / 路由 / Swagger / `@HttpCode()` | [02-controller.md](./02-controller.md)、[06-error-handling.md](./06-error-handling.md)                     | 冗余写 `@HttpCode(200)`；把输入 DTO 当输出模型；遗漏稳定 `null` 字段                           | `pnpm type-check`                                                                          | `AI_EXCEPTIONS.md` 中的“POST 200 / 201 约定”                         |
| DTO / 返回结构 / nullable / 输出校验归属    | [03-dto.md](./03-dto.md)、[02-controller.md](./02-controller.md)                                           | 用 `?: T \| null`；复制字段而不复用；把输出字段漏成 `validation: true`                         | `pnpm type-check`；若 contract 语义改变，按 [08-testing.md](./08-testing.md) 补充验证      | `AI_TERMS.md` 中的“稳定 contract”                                    |
| 内部类型 / `*.type.ts` / infer 类型         | [04-typescript-types.md](./04-typescript-types.md)、[03-dto.md](./03-dto.md)                               | 在业务文件里直接声明顶层复杂类型；为现有类型再套无意义别名；把 DTO 问题下沉成 type             | `pnpm type-check`                                                                          | `AI_EXCEPTIONS.md` 中的“TypeScript / ESLint 基线差距”                |
| 注释 / 字段说明 / 枚举成员说明              | [05-comments.md](./05-comments.md)                                                                         | 用注释复述代码；只写常量整体注释，不写字段级语义                                               | `pnpm type-check`（代码注释）或 Markdown 对应检查                                          | 无                                                                   |
| 错误语义 / 业务错误码 / 异常映射            | [06-error-handling.md](./06-error-handling.md)、[02-controller.md](./02-controller.md)                     | 用 `NotFoundException` 代替 `BusinessException`；手写数字错误码；吞异常降级成 `false` / `null` | `pnpm type-check`；若行为改变，按 [08-testing.md](./08-testing.md) 补充验证                | `AI_EXCEPTIONS.md` 中的“POST 200 / 201 约定”                         |
| Drizzle / schema / migration / seed         | [07-drizzle.md](./07-drizzle.md)、[03-dto.md](./03-dto.md)、[06-error-handling.md](./06-error-handling.md) | 改 schema 不补 migration；把 seed 当 bootstrap；使用 `drizzle-kit push`                        | 至少 `pnpm type-check`；涉及 schema 变更时，继续执行 07 规则要求的 migration / 注释检查    | `AI_EXCEPTIONS.md` 中的“migration、seed 与 bootstrap 边界”           |
| 验证 / 临时测试 / 探针                      | [08-testing.md](./08-testing.md)、[AGENTS.md](../../AGENTS.md)                                             | 保留测试文件；依赖 `pnpm test`；没跑验证就声称完成                                             | 选择最小有效验证；规则 / 文档改动至少做 Markdown 检查和 `pnpm type-check`                  | `AI_EXCEPTIONS.md` 中的“测试依赖与测试文件策略”                      |
| 纯文档 / 规则文档                           | [AGENTS.md](../../AGENTS.md)、[PROJECT_RULES.md](./PROJECT_RULES.md)                                       | 只改文档就跳过基线检查；拿 ESLint 当 Markdown 检查                                             | 对改动 Markdown 跑 `pnpm exec prettier --check <files...>`；规则文档再跑 `pnpm type-check` | `AI_EXCEPTIONS.md` 中的“Markdown 文档检查路径”                       |

## 组合改动提示

以下组合最常见，也最容易漏读规则：

- Controller + DTO
  - 同时阅读 [02-controller.md](./02-controller.md) 和 [03-dto.md](./03-dto.md)
  - 重点看输出 DTO、`boolean` 返回、稳定 `null` 字段、Swagger 响应模型
- DTO + Type
  - 同时阅读 [03-dto.md](./03-dto.md) 和 [04-typescript-types.md](./04-typescript-types.md)
  - 先判断结构是否属于 HTTP contract，再决定是 DTO 还是 `*.type.ts`
- DTO + 错误语义
  - 同时阅读 [03-dto.md](./03-dto.md) 和 [06-error-handling.md](./06-error-handling.md)
  - 重点看输出 contract 稳定性与错误码语义，不要只改一层
- Schema + DTO + Migration
  - 同时阅读 [07-drizzle.md](./07-drizzle.md) 和 [03-dto.md](./03-dto.md)
  - 若值域或字段语义变化，再补 [06-error-handling.md](./06-error-handling.md)
  - 重点避免 schema、DTO、枚举、migration 四层脱节
- 规则文档 + 仓库级验证
  - 同时阅读 [AGENTS.md](../../AGENTS.md) 和 [08-testing.md](./08-testing.md)
  - 规则 / 规范文档改动除了 Markdown 检查，还要跑一次 `pnpm type-check`

## 固定执行顺序

建议按下面顺序工作：

1. 先判断本次改动的主要类型。
2. 读取对应专项规则；多类改动取并集。
3. 遇到 `owner 文件`、`稳定 contract`、`闭集字段` 这类词时，查 [AI_TERMS.md](./AI_TERMS.md)。
4. 如果看到仓库现状与理想规则不完全一致，先查 [AI_EXCEPTIONS.md](./AI_EXCEPTIONS.md)，不要急着把所有历史差距都当作当前任务范围。
5. 选择最小但足以证明结论的验证命令。
6. 声称“已完成”前，使用最新验证输出作为证据。
