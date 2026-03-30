# Task 模块状态流转整改最终验收清单

## 1. 文档目标

本文用于验收本轮 `task` 模块状态流转整改是否真正完成。

本文负责：

- 收口本轮排查问题的整改验收项
- 为每类整改项预留证据记录位
- 明确阻塞上线项与最终签收问题

本文不负责：

- 重新定义排期、优先级与波次
- 替代单任务方案文档
- 记录与本轮问题无关的长期优化项

## 2. 适用范围

本清单只覆盖本轮已确认的 `task` 模块问题：

- `reportProgress()` 会让 `MANUAL` 任务在达标时直接完成并触发奖励
- `reportProgress()` 与 `completeTask()` 在乐观锁冲突时仍会写入 `task_progress_log`
- 重复任务 assignment 只依赖 `publishEndAt`，缺少按周期结束的过期语义
- `progress / complete` 未严格受 `publishStartAt / publishEndAt` 限制
- `task_assignment` 状态枚举与真实写入路径存在漂移，`PENDING` 语义未闭环
- 主链路自动化测试缺失，关键行为没有回归保护

不纳入本轮验收：

- 新增奖励类型
- 新建独立 settlement 表
- 任务自动推进到内容域事件的扩展能力
- 任务域之外的通知模板、治理总线或事件中心重构

## 3. 问题基线

### 3.1 已确认问题

| 编号 | 问题 | 关键影响 |
| --- | --- | --- |
| `TASK-F01` | `MANUAL` 完成模式在 `progress` 达标时被自动完成 | 奖励触发时机错误，手动完成语义失效 |
| `TASK-F02` | `reportProgress()` 乐观锁冲突时仍写日志 | 审计日志与真实状态不一致 |
| `TASK-F03` | `completeTask()` 乐观锁冲突时仍写日志 | 完成日志可能伪造，影响排障与审计 |
| `TASK-F04` | 重复任务 assignment 不按周期过期 | 旧周期记录长期滞留，状态流转不闭环 |
| `TASK-F05` | `progress / complete` 忽略发布时间窗口 | 任务结束后仍可继续推进 |
| `TASK-F06` | task 主链路缺少自动化回归覆盖 | 高风险变更无法稳定验证 |

### 3.2 关键代码锚点

- `libs/growth/src/task/task.service.ts`
- `libs/growth/src/task/task.service.spec.ts`
- `libs/growth/src/task/task.constant.ts`
- `libs/growth/src/task/dto/task.dto.ts`
- `apps/app-api/src/modules/task/dto/task.dto.ts`
- `db/schema/app/task-assignment.ts`

## 4. 功能整改验收

### 4.1 完成模式整改

- [x] `AUTO` 任务在首次达到 `target` 时才会进入 `COMPLETED`
- [x] `MANUAL` 任务在 `progress` 达到 `target` 后不会自动完成
- [x] `MANUAL` 任务只有经过 `/complete` 才会进入 `COMPLETED`
- [x] `MANUAL` 任务不会在 `/progress` 阶段提前发奖
- [x] 已 `COMPLETED` 的 assignment 重复提交 `progress / complete` 不会重复发奖

验收证据：

- [x] `task.service.spec.ts`：`auto-completes AUTO tasks on the first reportProgress that reaches the target`
- [x] `task.service.spec.ts`：`keeps manual tasks in progress when reportProgress reaches the target`
- [x] `task.service.spec.ts`：`completes manual tasks only after explicit completeTask`
- [x] `task.service.spec.ts`：`does not re-complete already completed assignments on repeated reportProgress`

### 4.2 发布时间窗口整改

- [x] `publishStartAt` 未到时不能 `claim`
- [x] `publishStartAt` 未到时不能 `progress`
- [x] `publishStartAt` 未到时不能 `complete`
- [x] `publishEndAt` 已过时不能 `claim`
- [x] `publishEndAt` 已过时在 cron 尚未执行前也不能 `progress`
- [x] `publishEndAt` 已过时在 cron 尚未执行前也不能 `complete`

验收证据：

- [x] `task.service.spec.ts`：`rejects task actions before publishStartAt`
- [x] `task.service.spec.ts`：`rejects task actions after publishEndAt even before cron expires assignments`
- [x] `findAvailableTask()` 已收口到统一发布时间窗口校验，`claim / progress / complete` 共用同一断言

### 4.3 周期过期整改

- [x] `DAILY` 任务旧周期 assignment 会在下一周期被稳定关闭
- [x] `WEEKLY` 任务旧周期 assignment 会在下一周期被稳定关闭
- [x] `MONTHLY` 任务旧周期 assignment 会在下一周期被稳定关闭
- [x] assignment 的 `expiredAt` 生成逻辑可解释
- [x] `expiredAt` 不再只依赖任务整体 `publishEndAt`
- [x] 旧周期 assignment 关闭后不能继续 `progress / complete`

验收证据：

- [x] `task.service.spec.ts`：`builds cycle-based expiredAt for daily tasks`
- [x] `task.service.spec.ts`：`builds cycle-based expiredAt for weekly tasks`
- [x] `task.service.spec.ts`：`builds cycle-based expiredAt for monthly tasks`
- [x] `createOrGetAssignment()` 已改为 `buildAssignmentExpiredAt()` 裁剪 `publishEndAt` 与周期边界
- [x] `task.service.spec.ts`：`writes expire audit logs when cron closes overdue assignments`

### 4.4 状态枚举与代码路径对齐整改

- [x] `task_assignment` 状态枚举与真实代码路径保持一致
- [x] 若继续保留 `PENDING`，必须存在明确进入路径与退出路径
- [x] 本轮保留 `PENDING`，无需执行“取消 `PENDING`”相关清理项
- [x] `IN_PROGRESS / COMPLETED / EXPIRED` 的进入条件可从代码直接解释
- [x] 状态流转不会依赖隐式副作用或不可观察条件

验收证据：

- [x] assignment 创建默认进入 `PENDING`，首次 `progress` 进入 `IN_PROGRESS`
- [x] `task.service.spec.ts`：`keeps manual tasks in progress...`、`auto-completes AUTO tasks...`
- [x] 已同步 `task.constant.ts`、`task.dto.ts`、`db/schema/app/task-assignment.ts` 注释与示例

## 5. 并发与审计验收

### 5.1 乐观锁冲突整改

- [x] `reportProgress()` 乐观锁未命中时不会写入伪造的 `PROGRESS` 日志
- [x] `reportProgress()` 乐观锁未命中时不会写入伪造的 `COMPLETE` 日志
- [x] `completeTask()` 乐观锁未命中时不会写入伪造的 `COMPLETE` 日志
- [x] 冲突请求返回语义稳定，调用方可收到明确重试信号
- [x] 并发达标场景下最多只有一条真实完成日志

验收证据：

- [x] `task.service.spec.ts`：`does not write progress logs when reportProgress loses the optimistic lock`
- [x] `task.service.spec.ts`：`does not write completion logs when completeTask loses the optimistic lock`
- [x] `task.service.spec.ts`：冲突场景断言 `task_progress_log` 不落库
- [x] 冲突分支统一返回 `ConflictException`，文案分别为“任务进度更新冲突，请重试”“任务完成状态更新冲突，请重试”

### 5.2 审计一致性整改

- [x] `task_progress_log.afterValue` 与真实 assignment 最终值一致
- [x] `CLAIM / PROGRESS / COMPLETE / EXPIRE` 日志不会出现未真实生效的伪记录
- [x] 并发重试不会污染同一 assignment 的行为时间线
- [x] 从 assignment 与日志可一致解释“谁在什么时候把任务推进到了哪一步”

验收证据：

- [x] `reportProgress()` / `completeTask()` 仅在更新命中后写日志
- [x] `expireAssignments()` 现已补写 `EXPIRE` 审计日志
- [x] `task.service.spec.ts`：`writes expire audit logs when cron closes overdue assignments`

## 6. 奖励与通知验收

### 6.1 奖励触发整改

- [x] 奖励只会在真实完成后触发
- [x] `MANUAL` 任务不会在达标未提交时提前发奖
- [x] assignment 的 `rewardStatus / rewardResultType / rewardLedgerIds / lastRewardError` 与真实奖励结果一致
- [x] 幂等命中、真实成功、真实失败三类结果仍可区分
- [x] 不会因为并发冲突或重复请求产生重复落账

验收证据：

- [x] `task.service.spec.ts`：`writes reward settlement state back to assignment after completion reward`
- [x] `task.service.spec.ts`：`keeps manual tasks in progress...` 覆盖未完成不触发奖励
- [x] `task.service.spec.ts`：`does not re-complete already completed assignments on repeated reportProgress`

### 6.2 提醒链路整改

- [x] 奖励到账提醒不会因补偿、幂等命中或冲突重试而重复发送
- [x] 任务结束后不再出现错误的可推进提醒
- [x] 周期过期后不会对旧周期 assignment 继续发“即将过期”或同类错误提醒

验收证据：

- [x] 奖励提醒继续使用 assignment 维度稳定 bizKey：`task:reminder:reward:assignment:{id}`
- [x] `task.service.spec.ts`：`writes reward settlement state back to assignment after completion reward`
- [x] `publishEndAt` 与周期 `expiredAt` 已成为提醒链路的统一停止边界

## 7. 测试与质量验收

### 7.1 自动化测试覆盖

- [x] `task.service.spec.ts` 已覆盖 `AUTO / MANUAL` 完成模式差异
- [x] `task.service.spec.ts` 已覆盖 `progress` 乐观锁冲突
- [x] `task.service.spec.ts` 已覆盖 `complete` 乐观锁冲突
- [x] `task.service.spec.ts` 已覆盖发布时间窗口限制
- [x] `task.service.spec.ts` 已覆盖 `DAILY` 周期过期
- [x] `task.service.spec.ts` 已覆盖 `WEEKLY` 周期过期
- [x] `task.service.spec.ts` 已覆盖 `MONTHLY` 周期过期
- [x] 新增测试不依赖脆弱时间戳、随机顺序或外部状态

证据记录：

- [x] 新增 9 条主链路测试，累计 `17` 条用例全部通过
- [x] `pnpm test -- --runInBand libs/growth/src/task/task.service.spec.ts`

### 7.2 命令验收

- [x] `pnpm exec eslint libs/growth/src/task apps/app-api/src/modules/task apps/admin-api/src/modules/task --ext .ts` 通过
- [x] `pnpm exec tsc -p tsconfig.json --noEmit` 通过
- [x] task 相关测试命令通过

证据记录：

- [x] `pnpm exec eslint libs/growth/src/task apps/app-api/src/modules/task apps/admin-api/src/modules/task --ext .ts`
- [x] `pnpm exec eslint libs/growth/src/task/task.service.ts libs/growth/src/task/task.service.spec.ts libs/growth/src/task/task.constant.ts libs/growth/src/task/dto/task.dto.ts db/schema/app/task.ts db/schema/app/task-assignment.ts --ext .ts`
- [x] `pnpm exec tsc -p tsconfig.json --noEmit`
- [x] `pnpm test -- --runInBand libs/growth/src/task/task.service.spec.ts`

## 8. 文档与口径验收

- [x] 本轮清单与实际整改内容一致
- [x] 若状态枚举或行为语义有变化，相关注释与 DTO 已同步
- [x] 文档不会继续传播“`MANUAL` 达标即自动完成”这类错误口径
- [x] 任务周期、过期与完成语义可被新同事直接理解

验收证据：

- [x] 已同步 `execution-plan.md` 状态与本清单结论
- [x] 已同步 `task.constant.ts`、`task.dto.ts`、`db/schema/app/task.ts`、`db/schema/app/task-assignment.ts`

## 9. 阻塞上线项

以下任一项未通过，都建议视为阻塞上线：

- [x] 已消除“`MANUAL` 任务在 `progress` 达标时自动完成”阻塞项
- [x] 已消除“乐观锁冲突后产生伪造 `task_progress_log`”阻塞项
- [x] 已消除“重复任务旧周期 assignment 无法自然关闭”阻塞项
- [x] 已消除“`publishEndAt` 已过仍可继续 `progress / complete`”阻塞项
- [x] 已消除“assignment 状态语义与真实代码路径不一致”阻塞项
- [x] 已消除“主链路缺少最基本自动化测试覆盖”阻塞项

## 10. 最终签收问题

- [x] 我们能否准确解释 assignment 何时进入 `IN_PROGRESS / COMPLETED / EXPIRED`？
- [x] 我们能否证明 `MANUAL` 与 `AUTO` 两种完成模式已按预期分流？
- [x] 我们能否证明并发冲突不会污染进度审计日志？
- [x] 我们能否证明重复任务的旧周期不会无限滞留？
- [x] 我们能否证明任务结束后不会再被继续推进？
- [x] 我们能否通过自动化测试稳定复现并验证上述结论？

## 11. 签收结论

- [x] 本轮整改已通过
- [x] 无阻塞上线项
- [x] 证据已归档
- [x] 无豁免项，本轮无需额外豁免记录
