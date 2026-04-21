# ES Server Review Matrix

每次使用 `$es-server-code-review` 时，在读完 `AGENTS.md` 与 `.trae/rules/*` 之后，必须按下面的矩阵推进。矩阵不是可选笔记，而是强制完工条件。

## 使用方式

- 先复制本矩阵，再把每一项状态填成 `未开始`、`进行中`、`已完成`、`阻塞`。
- 每个规则文档至少留 1 条检查证据；不能只在有问题时才提到该规则。
- 同时维护两类 findings：
  - `规范问题`：违反仓库规范、会造成漂移或维护风险的实现。
  - `缺陷 / 风险问题`：真实 bug、契约回归、错误语义、权限、事务、通知、migration 等问题。
- 每个可疑实现 / 每条 finding 都要做一次“规则 × 代码面”交叉映射；不要只按首个命中的症状、首条规则或首个高优问题收口。
- 在矩阵未全部完成前，不要宣布审查结束。

## Finding Cross-Check

- 对每个可疑点，逐份回看适用规则文档；不要因为某条规则已经命中就默认其他规则不再相关。
- 对每个可疑点，同时检查相关代码面：模块本体、上下游调用点、DTO、types、schema、migration、tests。
- 若同一实现同时构成 `规范问题` 与 `缺陷 / 风险问题`，分别记录；不能用一条 finding 吞掉另一条。
- 只有当该点位的适用规则与相关代码面都检查过，才能把这个点位视为闭合。

## Rule Matrix

- `PROJECT_RULES.md`
  - 是否遵守项目级最小约束、验证基线、提交与交付要求。
- `01-import-boundaries.md`
  - 是否存在 barrel、越层导入、DTO 拉起运行时依赖、错误的目录级入口。
- `02-controller.md`
  - 路由命名、Swagger、返回语义、controller 薄层、兼容性方案是否正确。
- `03-dto.md`
  - DTO 是否在 `libs/*` 收口、是否重复定义、组合方式是否正确、文档 / 校验 / contract 是否对齐。
- `04-typescript-types.md`
  - `*.type.ts` 是否只承载内部结构，是否重复 DTO，同构结构是否直接复用。
- `05-comments.md`
  - 方法注释是否存在，是否解释约束 / 原因，是否有重复注释、废话注释、字段注释缺失。
- `06-error-handling.md`
  - 可预期业务失败是否用了 `BusinessException + BusinessErrorCode`，是否错误地下沉为 HTTP 异常。
- `07-drizzle.md`
  - schema / query / transaction / migration / comments / check 约束是否同步，值域是否闭合。
- `08-testing.md`
  - 是否有相关 spec，是否覆盖行为变更、错误语义、事务、计数、通知、幂等与回归风险。

## Scope Matrix

- 模块本体：owner 文件、主要 service / controller / resolver / module。
- 上游调用点：controller、scheduler、consumer、event handler、job、command、facade。
- 下游消费者：mapper、serializer、projection、notification、query consumer、adapter。
- DTO：输入 / 输出 DTO、字段组合、文档与校验。
- types：`*.type.ts`、`*.types.ts`、推导类型、内部结构。
- schema：`db/schema/**/*`、注释、check、闭集值域、推导类型。
- migration：本轮 schema 变化对应的 migration、历史数据处理、`db/comments/generated.sql`。
- tests：相关 `*.spec.ts`、是否覆盖行为、错误语义、事务、通知、幂等、回归风险。

## Bug-Hunt Lanes

- 规范违例：即使暂时不报错，也会造成漂移、错误语义或维护风险的实现。
- 用户可感知 bug：错误通知、错误可见性、错误返回、错误排序、错误分页、错误状态流转。
- 权限与审核：越权、隐藏态 / 审核态处理错误、不可见内容提前外泄。
- 通知与去重：重复通知、自通知、遗漏通知、projection key 不合理、补偿链路缺失。
- 事务与计数：事实写入、计数器、奖励、补偿、删除级联是否一致。
- schema 与 migration：缺少 check、字段值域漂移、schema 与 DTO / service 不一致、历史数据迁移风险。
- 错误语义：错误码错、异常类型错、吞异常、错误 message 驱动业务分支。
- 测试缺口：没有 spec、spec 未覆盖关键风险、只测 happy path。

## Completion Checklist

- `Rules checked: 9/9`
- `Bug-hunt lanes checked: 8/8`
- `Scope completion: complete`
- 所有 findings 已完成适用规则与相关代码面的交叉映射
- `规范问题` 与 `缺陷 / 风险问题` 两个区域都已输出
- 开放问题、剩余风险、测试缺口已说明

## Stop Condition

- 发现 P1 / P2 / P3 都不是结束信号。
- 某个文件或链路已发现严重问题，也不是跳过其他规则项和其他范围文件的理由。
- 只有当：
  - 9 份规范文档全部对照完成；
  - 相关上下游链路已检查；
  - bug-hunt 车道全部过一遍；
  - 规范问题与缺陷 / 风险问题都已输出；
  - 剩余风险和测试缺口已说明；
    才允许结束审查。
