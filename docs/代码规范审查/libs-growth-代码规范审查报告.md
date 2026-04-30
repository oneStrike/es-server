# libs/growth 代码规范审查报告

## 审查概览

- 审查模块：`libs/growth`
- 审查文件数：111
- 读取范围：`libs/growth/src/**`、`libs/growth/tsconfig.lib.json`
- 适用规范总条数：86
- 合规条数：65
- 违规条数：21
- 风险分布：CRITICAL 0 / HIGH 0 / MEDIUM 13 / LOW 8
- Rules checked：9/9
- Rule points closed：86/86
- Scope completion：complete

## 规范条款逐条校验汇总

| 规范条款                                                                       | 校验结果 | 证据                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| service / resolver 可预期业务失败应使用 `BusinessException`                    | 违规     | `level-rule.service.ts:469`、`task-event-template.registry.ts:77-285`、`task.service.support.ts:312-408`、`check-in-definition.service.ts:248`、`:562-583`、`:830-838`、`check-in-reward-policy.service.ts:54-475`、`reward-rule.service.ts:129-184`、`growth-event-dispatch.service.ts:36` |
| 纯 TS 类型应放在 `*.type.ts`，不得放在 service/constant/internal 普通文件      | 违规     | `growth-rule.constant.ts:90`、`growth-ledger.service.ts:29`、`growth-ledger.internal.ts:24-90`、`growth-balance-query.service.ts:6`、`point.service.ts:22`                                                                                                                                  |
| 复杂方法签名不得直接写内联对象、`Pick`、`Record`、断言组合                     | 违规     | `growth-ledger.service.ts:628`、`:674`、`:714`、`:808`、`:827`、`:866`、`:914`、`:959`，`experience.service.ts:66`、`:263`、`:354`、`:382`，`point.service.ts:80`、`:147`，`check-in-definition.service.ts:700`                                                                             |
| 跨域目标类型、闭集值域应使用命名枚举或集中映射                                 | 违规     | `level-rule.service.ts:22-25`                                                                                                                                                                                                                                                               |
| DTO enum 描述不得直接暴露英文技术 key 或旧字符串枚举值                         | 违规     | `growth.dto.ts:188-220`                                                                                                                                                                                                                                                                     |
| 方法注释应使用紧邻方法的一到两行中文行注释，不使用 JSDoc；注释不得与实现不一致 | 违规     | `permission.service.ts:37-142`、`level-rule.service.ts:215-220`、`growth-event-dispatch.service.ts:103-105`，以及多个 service 方法 JSDoc                                                                                                                                                    |
| 测试不得通过 `as never`、`as unknown as`、private API 断言绕过正式契约         | 违规     | `task-execution.service.spec.ts:14-391`、`check-in-definition.service.spec.ts:59-615`、`check-in-calendar-read-model.service.spec.ts:89-354` 等                                                                                                                                             |
| 导入边界必须使用 `@db/core`、`@db/schema`、`@libs/platform/*` 白名单入口       | 合规     | 未发现 `@db/*` / `@libs/platform/*` 白名单外导入                                                                                                                                                                                                                                            |
| 本模块未包含 schema/migration 文件，Drizzle schema 联动规则本轮不适用          | 不适用   | `libs/growth` 范围内无 `db/schema` 或 `db/migration` 文件                                                                                                                                                                                                                                   |

## 按文件/模块拆分的详细违规清单

### service / registry 错误语义

[MEDIUM] 多个业务服务直接抛出 HTTP 4xx 协议异常

- 位置：`libs/growth/src/level-rule/level-rule.service.ts:469`，`libs/growth/src/task/task-event-template.registry.ts:77`、`:91`、`:94`、`:275`、`:285`，`libs/growth/src/task/task.service.support.ts:312-408`，`libs/growth/src/check-in/check-in-definition.service.ts:248`、`:562-583`、`:830-838`，`libs/growth/src/check-in/check-in-reward-policy.service.ts:54-475`，`libs/growth/src/reward-rule/reward-rule.service.ts:129-184`，`libs/growth/src/growth-reward/growth-event-dispatch.service.ts:36`
- 对应规范：`06-error-handling.md` / 分层职责与禁止项；service 层可预期业务失败不应以 `BadRequestException` 代替 `BusinessException`
- 违规原因：等级权限类型非法、任务模板不存在、任务步骤配置非法、签到规则非法、奖励规则非法、事件定义缺失等均属于业务规则校验，但在 service/registry/support 层直接抛 HTTP 协议异常。
- 整改建议：用 `BusinessException(BusinessErrorCode.OPERATION_NOT_ALLOWED | STATE_CONFLICT | RESOURCE_NOT_FOUND, ...)` 表达业务失败；保留 DTO/ValidationPipe 层格式错误的 HTTP 400 语义在入口边界。

### growth-ledger/growth-ledger.service.ts

[MEDIUM] service 文件内定义顶层类型别名并堆叠复杂内联参数类型

- 位置：`libs/growth/src/growth-ledger/growth-ledger.service.ts:29`、`:628-633`、`:674-679`、`:714-725`、`:808`、`:827`、`:866-880`、`:914-922`、`:959-963`
- 对应规范：`04-typescript-types.md` / 放置规则与禁止项；service 文件不得放置顶层类型定义，复杂签名应抽命名类型
- 违规原因：`type Tx = Db` 放在 service 文件内，多个私有方法直接写 `params: { ... }`，账本写入、审计、余额变动、用量计数等关键契约没有统一命名。
- 整改建议：把 `Tx`、余额变动、审计日志、幂等查询、用量计数等参数类型迁移到 `growth-ledger.type.ts`；service 方法只引用命名类型。

[LOW] 公开上下文映射仍依赖断言读取 JSON 结构

- 位置：`libs/growth/src/growth-ledger/growth-ledger.service.ts:494`、`:566`
- 对应规范：`04-typescript-types.md` / 类型收窄应通过守卫而非断言绕过
- 违规原因：`context as Record<string, ...>`、`item as typeof item & { context?: ... }` 用断言修补数据库 JSON 类型，调用点无法证明输入已经是白名单值结构。
- 整改建议：为 Drizzle JSON 行定义专用 select 类型，或在 `sanitizePublicContext` 内先用类型守卫把 `unknown` 收窄为可索引记录。

### growth-ledger/growth-ledger.internal.ts

[MEDIUM] 类型文件命名不符合 `*.type.ts` 规范

- 位置：`libs/growth/src/growth-ledger/growth-ledger.internal.ts:24-90`
- 对应规范：`04-typescript-types.md` / 纯 TypeScript 类型、接口、内部结构应放入 `*.type.ts`
- 违规原因：该文件包含 `PublicGrowthLedgerContextKey`、`GrowthLedgerApplyResult`、`ApplyRuleParams`、`ApplyDeltaParams`、`PublicGrowthLedgerRecord` 等稳定领域类型，但文件名是 `.internal.ts`，同时混放公开 context key 常量。
- 整改建议：拆成 `growth-ledger.type.ts` 与 `growth-ledger.constant.ts` 或保留常量文件，所有类型改从 `growth-ledger.type.ts` 导出。

### growth-rule.constant.ts

[LOW] constant 文件中导出类型别名

- 位置：`libs/growth/src/growth-rule.constant.ts:90`
- 对应规范：`04-typescript-types.md` / 类型应落在 `*.type.ts`，constant 文件只放闭集常量和映射
- 违规原因：`GrowthRuleTypeKey` 是纯类型，却放在 `growth-rule.constant.ts`。
- 整改建议：移动到 `growth-rule.type.ts`，并保持枚举、常量值列表留在 constant 文件。

### growth-ledger/growth-balance-query.service.ts

[LOW] service 文件中导出接口

- 位置：`libs/growth/src/growth-ledger/growth-balance-query.service.ts:6`
- 对应规范：`04-typescript-types.md` / service 文件不得定义顶层 `interface`
- 违规原因：`UserGrowthSnapshot` 是可复用读模型类型，但直接导出在 service 文件顶部。
- 整改建议：移动到 `growth-balance-query.type.ts` 或 `growth-ledger.type.ts`，service 只引用该类型。

### point/point.service.ts

[MEDIUM] 积分服务存在 service 内接口、复杂签名和类型断言

- 位置：`libs/growth/src/point/point.service.ts:22-37`、`:80-83`、`:147-150`、`:168`、`:199`、`:242`、`:263`
- 对应规范：`04-typescript-types.md` / `06-error-handling.md`
- 违规原因：`LedgerRecordShape` 定义在 service 文件内；`addPoints`、`consumePointsInTx` 参数使用 DTO 交叉内联对象；分页映射使用 `item as typeof item & { context?: ... }`。另外部分失败场景直接抛 `InternalServerErrorException`，应确认是否真属于未预期系统异常。
- 整改建议：抽 `PointLedgerRecordShape`、`AddPointsInput`、`ConsumePointsInTxInput` 到 `point.type.ts`；对账本失败原因能稳定识别的改为 `BusinessException`，未知系统异常再交给全局兜底。

### experience/experience.service.ts

[MEDIUM] 经验服务方法签名和上下文构建类型内联过重

- 位置：`libs/growth/src/experience/experience.service.ts:66-72`、`:263-276`、`:345`、`:354-363`、`:382-386`
- 对应规范：`04-typescript-types.md` / 复杂结构应命名复用
- 违规原因：`addExperienceDto` 直接把 DTO 与内联上下文字段交叉，`toExperienceRecord`、`buildAddExperienceBizKey`、`buildAddExperienceContext` 也直接写对象结构和 `Pick`。
- 整改建议：新增 `experience.type.ts`，定义 `AddExperienceInput`、`ExperienceRecordRow`、`AddExperienceBizKeyInput`、`AddExperienceContextInput`。

### level-rule/level-rule.service.ts

[MEDIUM] 等级权限统计使用跨域 targetType 魔法数字

- 位置：`libs/growth/src/level-rule/level-rule.service.ts:22-25`
- 对应规范：`PROJECT_RULES.md` / 对外契约优先；`04-typescript-types.md` / 闭集值域使用命名枚举
- 违规原因：`forumTopicLikeTargetType = 3`、`commentLikeTargetType = 6`、`forumTopicFavoriteTargetType = 3` 直接写在 growth 等级服务中，和 interaction/comment/forum 的目标类型契约耦合但没有集中事实源。
- 整改建议：引用 interaction 域稳定目标类型枚举或建立共享映射常量，并为等级权限统计补回归测试。

[LOW] 同一方法存在重复 JSDoc 注释

- 位置：`libs/growth/src/level-rule/level-rule.service.ts:215-220`
- 对应规范：`05-comments.md` / 同一符号只保留一组有效注释，方法注释不用 JSDoc
- 违规原因：`getUserLevelInfo` 前连续两段 JSDoc 描述同一方法。
- 整改建议：合并为一条紧邻方法的 `// 查询用户等级信息并计算升级进度。`

### permission/permission.service.ts

[LOW] 注释与实现错误类型不一致，且保留未使用 HTTP 异常导入

- 位置：`libs/growth/src/permission/permission.service.ts:4`、`:37-41`、`:59-73`、`:137-142`
- 对应规范：`05-comments.md` / 注释不得与实现不一致；`06-error-handling.md` / 业务失败使用 `BusinessException`
- 违规原因：方法 JSDoc 写 `@throws BadRequestException`，但实现已抛 `BusinessException`；文件仍导入 `BadRequestException`。
- 整改建议：删除未使用导入，将方法注释改成短行注释，并把错误语义说明改为业务异常或直接移除 `@throws`。

### growth-reward/growth-event-dispatch.service.ts

[LOW] 私有方法前重复行注释

- 位置：`libs/growth/src/growth-reward/growth-event-dispatch.service.ts:103-105`
- 对应规范：`05-comments.md` / 同一符号只保留一组有效注释
- 违规原因：`buildEventRewardContext` 前连续两行相同注释。
- 整改建议：保留一行即可。

[MEDIUM] 事件定义缺失在 service 层抛 `BadRequestException`

- 位置：`libs/growth/src/growth-reward/growth-event-dispatch.service.ts:36`
- 对应规范：`06-error-handling.md` / service 可预期业务失败使用 `BusinessException`
- 违规原因：事件定义不存在是成长事件路由中的业务状态，不应在 dispatch service 中直接变成 HTTP 400。
- 整改建议：改为 `BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, ...)` 或专用 `STATE_CONFLICT`，并由入口层映射协议状态。

### growth/dto/growth.dto.ts

[LOW] EnumProperty 描述直接暴露英文技术 key

- 位置：`libs/growth/src/growth/dto/growth.dto.ts:188-220`
- 对应规范：`05-comments.md` / 禁止在 `EnumProperty.description` 中直接写英文常量名、旧字符串枚举值或技术 key
- 违规原因：`domain`、`governanceGate`、`implStatus` 的描述写成 `forum=论坛`、`topic_approval=主题审核`、`declared=已声明` 等技术 key 对照表。
- 整改建议：改成中文业务枚举说明；若需要展示 key，请放入独立字段或接口文档中解释，不放在 DTO 字段描述里。

### check-in/check-in-definition.service.ts

[MEDIUM] 签到定义服务存在 HTTP 异常、断言和复杂结果收敛

- 位置：`libs/growth/src/check-in/check-in-definition.service.ts:248`、`:562-583`、`:700`、`:744`、`:789`、`:830-838`
- 对应规范：`06-error-handling.md` / `04-typescript-types.md`
- 违规原因：连续奖励阈值、生效时间、排序参数等在 service 中抛 `BadRequestException`；`extractExecutedRows` 使用 `(result as { rows?: T[] | null })`；`parseRewardItems(... )!` 和日期加一天 `!` 依赖非空断言。
- 整改建议：业务规则失败改为 `BusinessException`；为 Drizzle execute 结果定义命名行类型/守卫；让 `parseRewardItems` 通过重载返回非空数组，消除非空断言。

### check-in/check-in-reward-policy.service.ts

[MEDIUM] 奖励规则解析服务大量使用 HTTP 异常和断言

- 位置：`libs/growth/src/check-in/check-in-reward-policy.service.ts:54-74`、`:89`、`:99-100`、`:111`、`:144`、`:171-214`、`:225-226`、`:275`、`:288-289`、`:302`、`:311`、`:335-354`、`:444-475`
- 对应规范：`06-error-handling.md` / `04-typescript-types.md`
- 违规原因：奖励项非法、重复、周期不匹配等均为可预期业务规则失败，但直接抛 `BadRequestException`；同时多处用 `as` 和 `!` 补齐存储 JSON 到内部规则视图的类型。
- 整改建议：将规则校验失败收敛为 `BusinessException`；把存储 JSON 解析拆成带类型守卫的解析器，让返回类型区分可空/非空。

### reward-rule/reward-rule.service.ts

[MEDIUM] 奖励规则服务直接抛 `BadRequestException`

- 位置：`libs/growth/src/reward-rule/reward-rule.service.ts:129`、`:135`、`:139`、`:144`、`:149`、`:156`、`:171`、`:184`
- 对应规范：`06-error-handling.md` / service 可预期业务失败使用 `BusinessException`
- 违规原因：资产类型、规则类型、delta、限额、assetKey 等配置非法都直接抛 HTTP 400。
- 整改建议：改成 `BusinessException(BusinessErrorCode.STATE_CONFLICT | OPERATION_NOT_ALLOWED, ...)`，入口层保留参数格式错误。

### tests

[LOW] 多个测试文件通过断言绕过真实依赖契约

- 位置：`libs/growth/src/task/task-execution.service.spec.ts:14-391`，`libs/growth/src/check-in/check-in-calendar-read-model.service.spec.ts:89-354`，`libs/growth/src/check-in/check-in-definition.service.spec.ts:59-615`，`libs/growth/src/check-in/check-in-execution.service.spec.ts:72-257`，`libs/growth/src/check-in/check-in-runtime.service.spec.ts:71-256`，`libs/growth/src/check-in/check-in-settlement.service.spec.ts:15-122`，`libs/growth/src/check-in/check-in.service.spec.ts:16-51`
- 对应规范：`08-testing.md` / 测试不应通过 `as never`、private API 断言绕过类型
- 违规原因：大量 mock 用 `{} as never`、`service as unknown as { ... }`、`jest.spyOn(service as never, ...)`，测试不再受真实构造器和方法契约保护。
- 整改建议：为 Drizzle、账本、签到依赖建立 typed mock factory；优先通过公开方法覆盖私有逻辑，必须访问内部逻辑时抽成纯函数并导出命名类型。

## 文件级审查结论

| 范围             | 文件                                                                                                                                                                                                             | 结论                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| badge            | `user-badge.service.ts`                                                                                                                                                                                          | 存在方法 JSDoc 风格问题；未发现更高风险违规                                            |
| badge            | `user-badge.module.ts`、`user-badge.constant.ts`、`dto/*.dto.ts`                                                                                                                                                 | 已纳入审查，未发现本轮明确违规                                                         |
| check-in         | `check-in-definition.service.ts`                                                                                                                                                                                 | 存在 HTTP 异常、断言与复杂结果收敛问题                                                 |
| check-in         | `check-in-reward-policy.service.ts`                                                                                                                                                                              | 存在 HTTP 异常与 JSON/数组断言问题                                                     |
| check-in         | `check-in-makeup.service.ts`、`check-in-execution.service.ts`、`check-in-streak.service.ts`、`check-in.service.support.ts`                                                                                       | 存在 service 层 `BadRequestException` 问题                                             |
| check-in         | `check-in-settlement.service.ts`                                                                                                                                                                                 | 存在 `InternalServerErrorException` 使用点，建议确认是否为未预期系统异常；未单列硬违例 |
| check-in         | `check-in-*.spec.ts`、`dto/check-in-definition.dto.spec.ts`                                                                                                                                                      | 存在 `as never` / private API 断言问题                                                 |
| check-in         | `check-in-calendar.type.ts`、`check-in.type.ts`、`dto/*.dto.ts`、`check-in.module.ts`、`check-in.constant.ts`、`check-in.service.ts`、`check-in-calendar-read-model.service.ts`、`check-in-runtime.service.ts`   | 已纳入审查，未发现本轮明确违规                                                         |
| event-definition | `event-definition.service.ts`、`event-definition.map.ts`、`event-definition.constant.ts`、`event-definition.type.ts`、`event-envelope.type.ts`、`event-definition.module.ts`                                     | 已纳入审查，未发现本轮明确违规                                                         |
| experience       | `experience.service.ts`                                                                                                                                                                                          | 存在复杂内联签名和类型断言问题                                                         |
| experience       | `experience.module.ts`、`dto/experience-record.dto.ts`                                                                                                                                                           | 已纳入审查，未发现本轮明确违规                                                         |
| growth           | `dto/growth.dto.ts`                                                                                                                                                                                              | Enum 描述暴露英文技术 key                                                              |
| growth           | `dto/growth-shared.dto.ts`                                                                                                                                                                                       | 已纳入审查，未发现本轮明确违规                                                         |
| growth-ledger    | `growth-ledger.service.ts`                                                                                                                                                                                       | 存在 service 内顶层类型、复杂内联类型和断言问题                                        |
| growth-ledger    | `growth-ledger.internal.ts`                                                                                                                                                                                      | 类型文件命名和职责不符合 `*.type.ts` 规范                                              |
| growth-ledger    | `growth-balance-query.service.ts`                                                                                                                                                                                | service 文件内导出接口                                                                 |
| growth-ledger    | `growth-ledger-remark.ts`、`growth-ledger-remark.type.ts`、`growth-ledger.constant.ts`、`growth-ledger.module.ts`、`dto/growth-ledger-record.dto.ts`                                                             | 已纳入审查，未发现本轮明确违规                                                         |
| growth-reward    | `growth-event-dispatch.service.ts`                                                                                                                                                                               | 存在 HTTP 异常和重复注释问题                                                           |
| growth-reward    | `growth-reward.service.ts`、`growth-reward-settlement-retry.service.ts`                                                                                                                                          | 存在若干断言与 catch 降级点，当前未单列硬违例；建议随类型收敛一起治理                  |
| growth-reward    | `growth-reward-settlement.service.ts`、`*.module.ts`、`*.constant.ts`、`dto/*.dto.ts`、`types/*.type.ts`、`growth-event-bridge.service.ts`、`growth-event-bridge.module.ts`                                      | 已纳入审查，未发现本轮明确违规                                                         |
| level-rule       | `level-rule.service.ts`                                                                                                                                                                                          | 存在 targetType 魔法数字、HTTP 异常与重复 JSDoc                                        |
| level-rule       | `level-rule.module.ts`、`level-rule.constant.ts`、`dto/level-rule.dto.ts`                                                                                                                                        | 已纳入审查，未发现本轮明确违规                                                         |
| permission       | `permission.service.ts`                                                                                                                                                                                          | 注释与实现错误语义不一致，且存在未使用 HTTP 异常导入                                   |
| permission       | `permission.module.ts`                                                                                                                                                                                           | 已纳入审查，未发现本轮明确违规                                                         |
| point            | `point.service.ts`                                                                                                                                                                                               | 存在 service 内接口、复杂签名、断言问题                                                |
| point            | `point.module.ts`、`dto/point-record.dto.ts`                                                                                                                                                                     | 已纳入审查，未发现本轮明确违规                                                         |
| reward-rule      | `reward-rule.service.ts`                                                                                                                                                                                         | 存在 service 层 `BadRequestException` 问题                                             |
| reward-rule      | `reward-rule.module.ts`、`reward-rule.constant.ts`、`reward-item.type.ts`、`dto/*.dto.ts`                                                                                                                        | 已纳入审查，未发现本轮明确违规                                                         |
| task             | `task-event-template.registry.ts`、`task.service.support.ts`                                                                                                                                                     | 存在 service/registry 层 `BadRequestException` 问题                                    |
| task             | `task-execution.service.spec.ts`                                                                                                                                                                                 | 存在大量 `as never` 与 private API 断言                                                |
| task             | `task-definition.service.ts`、`task-execution.service.ts`、`task-notification.service.ts`、`task-runtime.service.ts`、`task.service.ts`、`task.module.ts`、`task.constant.ts`、`dto/*.dto.ts`、`types/*.type.ts` | 已纳入审查，未发现本轮明确违规                                                         |
| root             | `growth-rule.constant.ts`                                                                                                                                                                                        | constant 文件中导出类型别名                                                            |
| root             | `tsconfig.lib.json`                                                                                                                                                                                              | 已纳入审查，未发现本轮明确违规                                                         |

## 整体合规率总结

- 合规率：65 / 86 = 75.6%
- 必改项清单：
  - 将 growth 模块 service/registry/support 中的业务校验失败改为 `BusinessException`。
  - 把 `growth-ledger.internal.ts`、`growth-ledger.service.ts`、`point.service.ts`、`experience.service.ts`、`growth-balance-query.service.ts` 中的类型迁移到 `*.type.ts`。
  - 收敛 `level-rule.service.ts` 中 interaction/forum targetType 魔法数字。
  - 修正 DTO enum 描述中的英文技术 key。
  - 为测试补 typed mock helper，清理 `as never` 和 private API 断言。
- 优化建议清单：
  - 将普通方法 JSDoc 改成短行注释，删除重复或过期注释。
  - 为 JSON 字段解析补类型守卫，减少 `as` 和 `!`。
  - 对 `InternalServerErrorException` 使用点做一次语义复核，确认哪些是系统异常，哪些应转为业务状态冲突。

## 开放问题 / 假设

- 本模块未包含 schema/migration；账本、签到、任务的表结构与索引将在 `db` 模块报告中继续核对。
- `check-in` 和 `task` 的部分 `BadRequestException` 可能来自历史上把 service 当作协议解析层使用的兼容约定；若确有兼容要求，需要在整改时记录临时例外。

## 剩余风险 / 未闭合项

- 未闭合项：无。
- 剩余风险：growth 是跨域奖励与账本核心模块，后续还需要结合 `db/schema` 的唯一键、check、索引和历史迁移确认幂等与限额约束是否完全闭合。
