# P2 本地改进方案总览

## 1. 阶段目标

P2 解决的是“定义层与通知域的长期演进问题”。

只有在 P0 和 P1 已经把当前错误口径、任务奖励可解释性、账本解释力修好之后，P2 才值得启动。

P2 的重点不是“一次性重构所有领域”，而是按阶段补这 3 件事：

1. 让事件定义成为统一事实源
2. 让通知域从“底座能力”演进为“最小闭环”
3. 让治理结果正式进入事件、奖励、通知主链路

## 2. 启动前提

建议满足以下条件后再启动：

- P0 已完成奖励时机纠偏、人工补发幂等、规则编码对齐
- P1 已完成任务奖励状态回写、账本 DTO 增强、混合账本接口
- 核心链路已有基础回归测试

## 3. 范围边界

P2 可能涉及：

- 代码级事件定义层
- 通知模板 / 偏好 / delivery
- 任务提醒
- 公告与通知域边界
- 治理闸门前置
- chat outbox 域闭环

P2 默认不作为近期前置的重型改造：

- `event_type / event_record`
- 积分 / 经验规则彻底合表
- 多渠道通知
- 大范围统一事件总线

## 4. 拆分任务

详细任务已拆到独立目录：

优先级、依赖关系、推荐波次详见：

- [任务执行计划](./task-growth-reward-work-items/execution-plan.md)

### P2-A 事件定义层

- [P2-A-01 代码级 `EventDefinitionMap`](./task-growth-reward-work-items/p2a/01-event-definition-map.md)
- [P2-A-02 轻量 `EventEnvelope` 类型](./task-growth-reward-work-items/p2a/02-event-envelope.md)
- [P2-A-03 文档与 DTO 统一引用事件定义](./task-growth-reward-work-items/p2a/03-doc-and-dto-alignment.md)

### P2-B 通知域最小闭环

- [P2-B-01 通知模板](./task-growth-reward-work-items/p2b/01-notification-template.md)
- [P2-B-02 用户通知偏好](./task-growth-reward-work-items/p2b/02-notification-preference.md)
- [P2-B-03 通知投递结果表](./task-growth-reward-work-items/p2b/03-notification-delivery.md)
- [P2-B-04 任务提醒与公告边界](./task-growth-reward-work-items/p2b/04-task-reminder-and-announcement-boundary.md)

### P2-C 治理与基础设施补完

- [P2-C-01 治理闸门统一](./task-growth-reward-work-items/p2c/01-governance-gate-unification.md)
- [P2-C-02 评论审核后台](./task-growth-reward-work-items/p2c/02-comment-moderation-admin.md)
- [P2-C-03 `CHAT` outbox 域闭环](./task-growth-reward-work-items/p2c/03-chat-outbox-closure.md)

通知域跨任务公共边界详见：

- [通知域契约说明](./notification-domain-contract.md)

## 5. 排期引用

本文件不再重复维护任务顺序。

P2 内部的优先级、依赖关系、并行关系与推荐波次，统一以：

- [任务执行计划](./task-growth-reward-work-items/execution-plan.md)

为唯一事实源。

## 6. 阶段验收

P2 完成后，预期达到：

- 业务事件有统一元数据与统一状态语义
- 治理结果先定性，再决定是否进入奖励 / 通知链路
- 通知至少具备模板、偏好、delivery、读模型的最小闭环
- 公告、站内通知、任务提醒、聊天消息边界清晰
