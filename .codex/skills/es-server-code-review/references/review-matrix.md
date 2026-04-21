# ES Server Review Matrix

每次使用 `$es-server-code-review` 时，在读完 `AGENTS.md` 与 `.trae/rules/*` 之后，必须按下面的矩阵推进。

## Rule Matrix

- `PROJECT_RULES.md`
  - 是否遵守项目级最小约束、验证基线、提交与交付要求。
- `01-import-boundaries.md`
  - 是否存在 barrel、越层导入、DTO 拉起运行时依赖、错误的目录级入口。
- `02-controller.md`
  - 路由命名、Swagger、返回语义、controller 薄层、兼容性方案是否正确。
- `03-dto.md`
  - DTO 是否在 `libs/*` 收口、是否重复定义、组合方式是否正确、文档/校验/contract 是否对齐。
- `04-typescript-types.md`
  - `*.type.ts` 是否只承载内部结构，是否重复 DTO，同构结构是否直接复用。
- `05-comments.md`
  - 方法注释是否存在，是否解释约束/原因，是否有重复注释、废话注释、字段注释缺失。
- `06-error-handling.md`
  - 可预期业务失败是否用了 `BusinessException + BusinessErrorCode`，是否错误地下沉为 HTTP 异常。
- `07-drizzle.md`
  - schema / query / transaction / migration / comments / check 约束是否同步，值域是否闭合。
- `08-testing.md`
  - 是否有相关 spec，是否覆盖行为变更、错误语义、事务、计数、通知、幂等与回归风险。

## Bug-Hunt Lanes

- 规范违例：即使暂时不报错，也会造成漂移、错误语义或维护风险的实现。
- 用户可感知 bug：错误通知、错误可见性、错误返回、错误排序、错误分页、错误状态流转。
- 权限与审核：越权、隐藏态/审核态处理错误、不可见内容提前外泄。
- 通知与去重：重复通知、自通知、遗漏通知、projection key 不合理、补偿链路缺失。
- 事务与计数：事实写入、计数器、奖励、补偿、删除级联是否一致。
- schema 与 migration：缺少 check、字段值域漂移、schema 与 DTO/service 不一致、历史数据迁移风险。
- 错误语义：错误码错、异常类型错、吞异常、错误 message 驱动业务分支。
- 测试缺口：没有 spec、spec 未覆盖关键风险、只测 happy path。

## Stop Condition

- 发现 P1/P2 不是结束信号。
- 只有当：
  - 9 份规范文档全部对照完成；
  - 相关上下游链路已检查；
  - bug-hunt 车道全部过一遍；
  - 剩余风险和测试缺口已说明；
    才允许结束审查。
