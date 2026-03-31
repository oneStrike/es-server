# 最终验收清单

## 0. 使用说明

- `[x]`：当前已可通过代码路径或单测文件回填事实源。
- `[ ]`：仍缺运行结果、截图、压测或上线签收证据，或当前实现尚未完全满足。
- 本清单用于“最终上线签收”，不等同于排期文档中的任务实现状态。

## 1. 功能验收

| 验收项 | 结论 | 证据 |
| --- | --- | --- |
| `task`、基础奖励、任务 bonus 的职责边界已在代码与文档中统一 | `[x]` | `README.md`、`p0/03-*`、`libs/growth/src/growth-reward/growth-reward.service.ts` |
| `task.type` 已收敛为稳定场景语义 | `[x]` | `libs/growth/src/task/task.constant.ts`、`libs/growth/src/task/dto/task.dto.ts` |
| `repeatRule`、目标模型、发布时间窗等非法配置能在入口 fail fast | `[x]` | `libs/growth/src/task/task.service.ts` 中 `ensurePublishWindow()/ensureTaskObjectiveContract()/parseTaskRepeatRule()` |
| assignment 已冻结执行关键字段，不受 live task 配置改写影响 | `[x]` | `buildTaskSnapshot()`、`buildAssignmentTaskView()`、`libs/growth/src/task/task.service.spec.ts` |
| 事件桥接入口已固定为 `EventEnvelope + bizKey`，未再发明第二套事件壳字段 | `[x]` | `libs/growth/src/growth-reward/growth-event-bridge.service.ts`、`libs/growth/src/event-definition/event-envelope.type.ts` |
| 事件驱动任务可消费真实业务事件并推进 assignment | `[x]` | `TaskService.consumeEventProgress()`、`libs/growth/src/task/task.service.spec.ts` |
| 手动任务与事件任务可共存，语义清晰 | `[x]` | `apps/app-api/src/modules/task/task.controller.ts`、`libs/growth/src/task/task.service.ts` |
| 事件任务按 `occurredAt` 落周期，不因延迟消费跨周期 | `[x]` | `advanceAssignmentByEvent()`、`buildCycleKey()`、相关单测文件 |
| `EVENT_COUNT + MANUAL` 是否回补领取前事件的口径已固定且实现一致 | `[x]` | `README.md` 默认决议、`advanceAssignmentByEvent()` 中 `claimedAt` 判定 |

## 2. 回归验收

| 验收项 | 结论 | 证据 |
| --- | --- | --- |
| 任务删除、下线、过期后不会留下悬挂 assignment | `[ ]` | 待补执行 SQL / 运行结果 |
| 周期切换时不会出现旧新 assignment 长时间并存 | `[ ]` | 待补运行日志 / 压测样例 |
| 已完成 assignment 在任务下线或过期后仍可补偿发奖 | `[x]` | `retryTaskAssignmentReward()/retryCompletedAssignmentRewardsBatch()`、相关单测文件 |
| 修改任务奖励配置不会影响历史 assignment 结算 | `[x]` | assignment snapshot + `tryRewardTaskComplete()` 使用快照奖励配置 |
| 基础奖励与任务 bonus 的叠加策略与产品约定一致 | `[x]` | `p0/03-*`、`growth-reward.service.ts`、相关单测文件 |
| 任务通知不会因重试重复生成卡片 | `[x]` | outbox `bizKey` 去重、`TaskNotificationService` 稳定键、相关单测文件 |
| 治理反转未自动回滚的场景可被查询、审计并人工修复 | `[ ]` | 查询样例 / 脚本 / 操作说明 |

## 3. 奖励与账本验收

| 验收项 | 结论 | 证据 |
| --- | --- | --- |
| 业务 producer 的基础奖励统一通过 `tryRewardByRule()` 进入 | `[x]` | `GrowthEventBridgeService.dispatchDefinedEvent()` -> `tryRewardByRule()`，forum / interaction 相关 producer |
| 任务奖励统一通过 `tryRewardTaskComplete()` 进入 | `[x]` | `emitTaskCompleteEvent()` -> `tryRewardTaskComplete()` |
| 账本 `source` 或等价稳定字段可区分基础奖励与任务 bonus | `[x]` | `db/schema/app/growth-ledger-record.ts`、point/experience/growth-ledger DTO |
| 同一业务事件重复触发不会重复入账 | `[x]` | 账本 `bizKey` 唯一约束、task progress 唯一约束、相关单测文件 |
| 待补偿奖励可被扫描、重试、回写状态 | `[x]` | `retryTaskAssignmentReward()/retryCompletedAssignmentRewardsBatch()`、assignment `rewardStatus` 回写 |

## 4. 通知与站内信验收

| 验收项 | 结论 | 证据 |
| --- | --- | --- |
| `TASK_REMINDER + payload.reminderKind(AVAILABLE / EXPIRING_SOON / REWARD_GRANTED)` 合同已固定 | `[x]` | `TaskNotificationService`、`task.constant.ts`、README 默认决议 |
| 任务通知 `bizKey` 可追踪、可去重 | `[x]` | `TaskNotificationService` 稳定 `bizKey` + `message_outbox.bizKey` 去重 |
| 奖励到账通知与账本记录可互相定位 | `[x]` | `rewardSummary.ledgerRecordIds`、assignment `rewardLedgerIds`、reward reminder 查询视图 |
| 未读数、站内卡片、实时通知行为一致 | `[ ]` | 待补截图 / 运行样例 |
| 管理端可按 `reminderKind / taskId / assignmentId / bizKey` 查询任务通知结果 | `[x]` | `MessageNotificationDeliveryService.getNotificationDeliveryPage()`、Admin message monitor DTO |

## 5. 性能与稳定性验收

| 验收项 | 结论 | 证据 |
| --- | --- | --- |
| `getMyTasks()` 的即时过期收口不会引入明显性能退化 | `[ ]` | 待补基准结果 |
| auto assignment 补建不会造成不可接受的写放大 | `[ ]` | 待补压测结果 / SQL 分析 |
| 补偿任务扫描频率与批量大小已评估 | `[ ]` | 待补任务配置 / 评审记录 |
| 事件驱动推进失败时不会阻塞主业务事务 | `[x]` | producer 侧 `try/catch` + 降级日志，待补集成测试结果 |

## 6. 数据与迁移验收

| 验收项 | 结论 | 证据 |
| --- | --- | --- |
| 历史 `task.type` 映射规则已执行或已准备执行 | `[x]` | `normalizeTaskType()/getTaskTypeFilterValues()` 兼容映射 |
| 历史脏 `repeatRule`、非法时间窗数据已识别 | `[ ]` | 待补脚本输出 |
| assignment 快照新增字段有回填或兼容方案 | `[x]` | snapshot 双读 fallback：`buildAssignmentTaskView()` |
| `task_progress_log` 的事件去重字段与唯一约束有迁移或兼容方案 | `[x]` | `db/schema/app/task-progress-log.ts` |
| 如涉及拆表，模板/发布/campaign 回填策略已验证 | `[ ]` | `P2-02` 当前 blocked，本轮不适用 |

## 7. 观察与排障验收

| 验收项 | 结论 | 证据 |
| --- | --- | --- |
| 可按 `userId / taskId / assignmentId / bizKey` 查询链路状态 | `[x]` | task reconciliation page + notification delivery page |
| 可按 `eventCode / eventBizKey` 回放或定位任务推进链路 | `[x]` | `getTaskAssignmentReconciliationPage()` + progress log 查询 |
| 存在任务奖励与通知的异常导出入口 | `[ ]` | 当前未见稳定导出入口，待补 |
| 关键日志与指标已接入并可复核 | `[ ]` | 待补日志样例 / 面板截图 |

## 8. 阻塞上线项

| 阻塞项 | 影响范围 | 是否阻塞上线 | 处置方案 | 结论 |
| --- | --- | --- | --- | --- |
| 运行截图、压测、导出与最终签收证据未补齐 | 上线验收与回归发布 | `[x] 是` / `[ ] 否` | 发布前继续回填 checklist 证据位 | 持续跟踪 |

## 9. 最终签收问题

| 问题 | 责任人 | 计划处理时间 | 当前状态 |
| --- | --- | --- | --- |
| 性能、导出与运行证据仍待补齐 | 任务 / 消息 / 增长模块负责人 | 发布前补齐 | 进行中 |

## 10. 最终结论

- 是否满足上线条件：`[ ] 是` / `[x] 否`
- 是否存在豁免项：`[x] 无` / `[ ] 有`
- 验收日期：`待补最终签收日期`
- 验收人：`待补最终签收人`
- 备注：`当前已完成代码与主文档收口，最终上线签收仍需补运行、截图、压测与导出证据。`
