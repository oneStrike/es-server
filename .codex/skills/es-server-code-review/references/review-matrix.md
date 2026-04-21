# ES Server Normative Review Matrix

每次使用 `$es-server-code-review` 时，在读完 `AGENTS.md` 与 `.trae/rules/*` 之后，必须先把本矩阵展开成“规则点级”工作矩阵，再开始审查代码。矩阵不是可选笔记，而是强制完工条件。

## 使用方式

- 工作矩阵的最小单位是“单条规范点”，不是“单份规范文件”。
- 先按下文“规则点展开清单”把每份规范文档中的全部规范性 bullet 逐条展开到工作矩阵。
- 每条规则点都必须填写：
  - `状态`：`未开始`、`进行中`、`已完成`、`不适用`、`阻塞`
  - `来源`：文档名 + 小节名 + 条目序号
  - `规则点`：原文或等义转述
  - `适用范围`：本次审查对应的文件 / 符号 / 链路
  - `证据 / 理由`：`file:line`、检查结论，或不适用 / 阻塞原因
- `不适用` 必须说明为何对本次范围不适用；`阻塞` 必须说明缺失信息与下一步。
- 同一规则文档只有在其全部规则点都闭合后，才允许标记为完成。
- `正反例`、`示例` 只用于解释和取证，不能替代规则点本身。
- 若 `.trae/rules/` 当前内容与本清单不一致，先同步补齐工作矩阵，再继续审查。

## 单条规则点记录模板

```md
- 状态：未开始
- 来源：03-dto.md / 复用与收敛 / 第 3 条
- 规则点：跨模块复用 DTO 时，先导入目标 DTO，再做字段裁剪或合并
- 适用范围：<file / symbol / chain>
- 证据 / 理由：<file:line，或不适用 / 阻塞说明>
```

## 规则点展开清单

### `PROJECT_RULES.md`

- 决策顺序：逐条展开 1-4。
- 兼容性例外：展开“规范与稳定契约冲突时兼容性优先，并记录冲突点与暂行决策”。

### `01-import-boundaries.md`

- `核心原则`：逐条展开全部 bullet。
- `明确禁止`：逐条展开全部 bullet。
- `分层导入规则`：逐条展开全部 bullet。
- `例外白名单`：逐条展开全部 bullet。
- `正反例`：只作为取证样例，不替代规则点。

### `02-controller.md`

- `核心原则`：逐条展开全部 bullet。
- `路由规范`：逐条展开全部 bullet。
- `Swagger 规范`：逐条展开全部 bullet。
- `返回语义`：逐条展开全部 bullet。
- `权限与审计`：逐条展开全部 bullet。
- `兼容与维护`：逐条展开全部 bullet。

### `03-dto.md`

- `默认动作`：逐条展开全部 bullet。
- `分层与职责`：逐条展开全部 bullet。
- `命名约定`：逐条展开全部 bullet。
- `复用与收敛`：逐条展开全部 bullet。
- `禁止项`：逐条展开全部 bullet。
- `枚举字段描述规范`：逐条展开全部 bullet。
- `正反例`：只作为取证样例，不替代规则点。

### `04-typescript-types.md`

- `默认动作`：逐条展开全部 bullet。
- `放置规则`：逐条展开全部 bullet。
- `复用与推导`：逐条展开全部 bullet。
- `` `type` 与 `interface` ``：逐条展开全部 bullet。
- `边界类型`：逐条展开全部 bullet。
- `禁止项`：逐条展开全部 bullet。
- `正反例`：只作为取证样例，不替代规则点。

### `05-comments.md`

- `默认动作`：逐条展开全部 bullet。
- `注释形式`：逐条展开全部 bullet。
- `必须写注释的场景`：逐条展开全部 bullet。
- `如何写`：逐条展开全部 bullet。
- `数据表字段注释要求`：逐条展开全部 bullet。
- `禁止项`：逐条展开全部 bullet。
- `正反例`：只作为取证样例，不替代规则点。

### `06-error-handling.md`

- `仓库约定`：逐条展开全部 bullet。
- `默认动作`：逐条展开全部 bullet。
- `分层职责`：逐条展开全部 bullet。
- `错误码与映射`：逐条展开全部 bullet。
- `日志与诊断`：逐条展开全部 bullet。
- `禁止项`：逐条展开全部 bullet。
- `正反例`：只作为取证样例，不替代规则点。

### `07-drizzle.md`

- `仓库约定`：逐条展开全部 bullet。
- `默认动作`：逐条展开全部 bullet。
- `查询与写路径`：逐条展开全部 bullet。
- `原生 SQL`：逐条展开全部 bullet。
- `Schema 与 migration 联动`：逐条展开全部 bullet。
- `破坏性更新`：逐条展开全部 bullet。
- `禁止项`：逐条展开全部 bullet。
- `正反例`：只作为取证样例，不替代规则点。

### `08-testing.md`

- `仓库约定`：逐条展开全部 bullet。
- `默认动作`：逐条展开全部 bullet。
- `何时必须补测试`：逐条展开全部 bullet。
- `测试层次`：逐条展开全部 bullet。
- `如何写`：逐条展开全部 bullet。
- `默认验证命令`：逐条展开全部 bullet。
- `禁止项`：逐条展开全部 bullet。
- `正反例`：只作为取证样例，不替代规则点。

## 代码范围矩阵

- `模块本体`：owner 文件、主要 service / controller / resolver / module。
- `上游调用点`：controller、scheduler、consumer、event handler、job、command、facade。
- `下游消费者`：mapper、serializer、projection、notification、query consumer、adapter。
- `DTO`：输入 / 输出 DTO、字段组合、文档与校验。
- `types`：`*.type.ts`、`*.types.ts`、推导类型、内部结构。
- `schema`：`db/schema/**/*`、注释、check、闭集值域、推导类型。
- `migration`：本轮 schema 变化对应的 migration、历史数据处理、`db/comments/generated.sql`。
- `tests`：相关 `*.spec.ts`、是否覆盖行为、错误语义、事务、通知、幂等、回归风险。

每个代码面至少补充：

- `状态`
- `涉及的规则文档 / 规则点`
- `已检查的 owner 文件`
- `剩余阻塞或不适用原因`

## 完成检查

- `.trae/rules/` 当前全部文件已纳入矩阵。
- 每份规范文档中的每条规范点都已登记。
- 工作矩阵里不再存在 `未开始`、`进行中` 条目。
- 所有 `已完成` 条目都带有证据。
- 所有 `不适用` 条目都带有明确理由。
- 若仍有 `阻塞` 条目，输出必须明确标注“审查未完成”，并列出阻塞点。
- 代码范围矩阵已闭合，未留下 owner 文件、上下游、DTO、types、schema、migration、tests 的盲区。
- 输出已包含：
  - `Rules checked: <n>/<n>`
  - `Rule points closed: <n>/<n>`
  - `Scope completion: complete | incomplete`
  - `一、规范问题`
  - `二、规则点覆盖完成情况`
  - `三、开放问题 / 假设`
  - `四、剩余风险 / 未闭合项`

## Stop Condition

- 发现 P1 / P2 / P3 都不是结束信号。
- 某个文件或链路已发现明显违例，也不是跳过其他规则点和其他代码面的理由。
- 只有当：
  - 当前 `.trae/rules/` 全部规范文档已展开并完成；
  - 每条规则点都处于 `已完成` 或 `不适用`；
  - 必要代码范围已检查；
  - 剩余风险和未闭合项已交代清楚；
    才允许宣布审查完成。
