# Task Module Review Result Checklist

生成时间：2026-04-15

## 审查范围

- `apps/admin-api/src/modules/task/task.controller.ts`
- `apps/admin-api/src/modules/task/task.module.ts`
- `apps/app-api/src/modules/task/task.controller.ts`
- `apps/app-api/src/modules/task/task.module.ts`
- `libs/growth/src/task/task.module.ts`
- `libs/growth/src/task/task.service.ts`
- `libs/growth/src/task/task-definition.service.ts`
- `libs/growth/src/task/task-execution.service.ts`
- `libs/growth/src/task/task-runtime.service.ts`
- `libs/growth/src/task/task-notification.service.ts`
- `libs/growth/src/task/task.service.support.ts`
- `libs/growth/src/task/task.constant.ts`
- `libs/growth/src/task/task.type.ts`
- `libs/growth/src/task/dto/task.dto.ts`
- `libs/growth/src/task/test/task-execution.service.spec.ts`
- `libs/growth/src/task/test/task-progress.dto.spec.ts`
- `libs/growth/src/task/test/task-reminder-dedupe.spec.ts`
- `libs/growth/src/task/test/task-type.constant.spec.ts`
- `db/schema/app/task.ts`
- `db/schema/app/task-assignment.ts`
- `db/schema/app/task-progress-log.ts`
- 任务提醒相关依赖链路：
  - `libs/message/src/eventing/message-domain-event.publisher.ts`
  - `libs/message/src/eventing/notification-event.consumer.ts`
  - `libs/message/src/eventing/notification-projection.service.ts`
  - `db/schema/system/domain-event.ts`
  - `db/schema/message/user-notification.ts`
  - `db/schema/message/notification-delivery.ts`

## 整体结论

- 模块分层整体是清晰的：controller 保持薄层，task 定义态 / 执行态 / runtime 已经拆开，快照冻结、乐观锁、奖励幂等等关键意识都在。
- 主要风险集中在两类：
  - 周期任务的“配置语义变更”阻断条件不完整。
  - 提醒链路与对账链路的“最新态 / 幂等态”判断还停留在应用层判重，缺少原子保证。

## 发现清单

### 1. [必须修复] 活跃 assignment 存在时，仍允许修改 `repeatRule.timezone`

- 位置：
  - `libs/growth/src/task/task.service.support.ts:725-731`
  - `libs/growth/src/task/task.service.support.ts:2419-2528`
- 问题说明：
  - `assertNoActiveAssignmentConfigMutation()` 只比较 `repeatRule.type`，没有把 `timezone` 算入“周期规则变更”。
  - 但 `timezone` 直接参与 `buildCycleKey()`、`getTaskCycleAnchor()`、`getCycleExpiredAt()`、`buildAssignmentExpiredAt()` 的计算。
  - 这意味着存在活跃 `daily/weekly/monthly` assignment 时，后台仍可改时区，导致同一业务周期被重新分桶，或者让现有 assignment 提前/延后过期。
- 风险等级：
  - 执行语义错误
  - 周期唯一键漂移
  - 过期边界漂移
- 建议修复：
  - 把 `repeatRule` 的“语义等价比较”扩成完整比较，至少覆盖 `type + timezone`。
  - 有活跃 assignment 时，只要周期切分口径会变，就统一阻断。
  - 增加“活跃 assignment + 修改 timezone 被拒绝”的单测。

### 2. [必须修复] 任务提醒发布判重不是原子操作，并发下仍会重复发事件

- 位置：
  - `libs/growth/src/task/task.service.support.ts:1697-1744`
  - `db/schema/system/domain-event.ts:15-60`
- 问题说明：
  - `publishTaskReminderIfNeeded()` 当前流程是：
    1. 先查 `domain_event.context.projectionKey`
    2. 没查到再调用 `messageDomainEventPublisher.publish()`
  - 这套逻辑没有事务内唯一约束，也没有写侧幂等键。
  - 两个并发请求命中同一个 reminder projectionKey 时，完全可能都查不到旧记录，然后各自写入一条新的 `domain_event`。
- 为什么这不是纯理论问题：
  - 自动领取提醒是在读链路里触发的，`getAvailableTasks()` / `getMyTasks()` / 事件推进 / cron 都可能在相近时间触发。
  - `domain_event` 表本身也没有基于 projectionKey 的唯一约束。
- 风险等级：
  - 重复 reminder domain event
  - 重复 dispatch
  - 下游通知投影冲突
- 建议修复：
  - 把 reminder 幂等下沉到数据库写侧，而不是靠“先查再发”。
  - 可选方案：
    - 为 reminder 单独建幂等表，按 business key 插入并加唯一约束。
    - 扩展 message domain event 发布器，支持业务幂等键写入。
    - 若继续复用 `domain_event`，至少提供可约束的唯一业务键列，而不是只放进 `context` JSON。

### 3. [建议修改] 通知 append 投影也是“先查再插”，重复 reminder event 会把 consumer 打成失败

- 位置：
  - `libs/message/src/eventing/notification-projection.service.ts:68-127`
  - `db/schema/message/user-notification.ts:51-54`
- 问题说明：
  - `append` 模式先 `findFirst(receiverUserId + projectionKey)`，再直接 `insert`。
  - 表上虽然有 `unique(receiverUserId, projectionKey)`，但代码没有 `onConflictDoNothing()` 或唯一冲突兜底。
  - 一旦第 2 条里的重复 reminder event 进入 consumer，并发执行时这里就会抛唯一键异常，最终把投影流程标记成失败，而不是按幂等成功处理。
- 风险等级：
  - 通知投影失败
  - 任务提醒 delivery 状态失真
  - 运维面出现噪声告警
- 建议修复：
  - `append` 改成原子 upsert/幂等插入。
  - 最小改法是 `insert ... onConflictDoNothing().returning()`，未返回时回查 existing 并按幂等成功返回。

### 4. [建议修改] 对账页“最近一次事件”按日志插入顺序取值，不按事件发生时间取值

- 位置：
  - `libs/growth/src/task/task.service.support.ts:2213-2248`
- 问题说明：
  - `getAssignmentEventProgressMap()` 使用 `orderBy(desc(id))` 取“最近一次命中 assignment 的事件”。
  - 但 task 模块本身明确允许按 `eventOccurredAt` 消费晚到事件、补放事件和重放事件。
  - 这意味着只要旧事件晚到，后台对账页就会把“最新插入的旧事件”误显示成“最近一次事件”。
- 风险等级：
  - 后台排障误导
  - 事件推进观测口径不一致
- 建议修复：
  - 改成按 `eventOccurredAt desc nulls last, id desc` 选取。
  - 若担心 SQL 复杂度，可以用窗口函数或先聚合后回表。
  - 补一条“先处理新事件，再补放旧事件，对账页仍展示新事件”为准”的测试。

## 当前测试覆盖情况

- 已有覆盖：
  - `task-execution.service.spec.ts` 仅覆盖 `reportProgress(delta)` 的正整数校验前置。
  - `task-progress.dto.spec.ts` 仅覆盖 DTO 级别的 `delta` 校验与转换。
  - `task-reminder-dedupe.spec.ts` 仅覆盖“已存在 projectionKey 时不 publish”的单线程桩逻辑。
  - `task-type.constant.spec.ts` 仅覆盖枚举兼容值归一化。
- 明显缺口：
  - 活跃 assignment 下修改 `repeatRule.timezone` 的保护测试。
  - 并发 reminder publish / projection 的幂等测试。
  - 事件晚到场景下 reconciliation “latest event” 的排序测试。
  - auto-assignment、reward retry、runtime cron 三条主链路的集成级测试。

## 验证结果

- `pnpm test -- --runInBand --runTestsByPath libs/growth/src/task/test/task-execution.service.spec.ts libs/growth/src/task/test/task-progress.dto.spec.ts libs/growth/src/task/test/task-reminder-dedupe.spec.ts libs/growth/src/task/test/task-type.constant.spec.ts`
  - 结果：通过（4 个 test suites，9 个 tests）
- `pnpm type-check`
  - 结果：通过

## 建议的整改优先级

- P0：
  - 修复 `repeatRule.timezone` 变更未阻断的问题。
  - 给 reminder publish 增加数据库级幂等保障。
- P1：
  - 让 notification append 投影具备原子幂等。
  - 修正 reconciliation latest event 的排序口径。
- P2：
  - 为 auto-assignment / reminder / reward retry 增补集成测试。
  - 评估 `getAvailableTasks()` / `getUserTaskSummary()` 的全量加载 + 内存分页是否需要前移到 SQL 层优化。

## 备注

- 本次仅做代码审查与本地清单生成，没有修改任务模块源码。
- 工作区若存在其他未提交改动，它们不在本次审查结论的责任范围内。
