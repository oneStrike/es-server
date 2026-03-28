# 任务拆分目录

本目录只承载“可执行任务单”，不重复承担领域设计文档、专项设计文档或阶段总览的职责。

使用原则：

1. 一个文件只描述一个可以独立排期的任务
2. 排序、依赖、波次只在 `execution-plan.md` 维护一次
3. `development-plan.md` 只补执行信息，不重复定义优先级
4. `final-acceptance-checklist.md` 只保留跨任务验收，不再抄写每个任务的完成标准
5. 没有明确前置收益时，不提前做重型基础设施

## 文档分工

| 文档 | 角色 | 负责 | 不负责 |
| --- | --- | --- | --- |
| `../task-growth-reward-domain-design.md` | 领域总览 | 当前问题、目标原则、阶段拆分背景 | 具体排期与逐任务验收 |
| `../event-registry-special-design.md` | 专项设计 | 事件定义层的设计边界与落地方式 | 具体开发波次 |
| `execution-plan.md` | 唯一排期事实源 | 优先级、依赖、波次、并行原则 | 文件级改动清单 |
| `development-plan.md` | 开发执行补充 | 开工条件、改动模块、关键文件、测试点 | 重新定义任务顺序 |
| `p0/*` ~ `p2c/*` | 单任务说明 | 目标、范围、完成标准、代码锚点、非目标 | 阶段总览、跨任务验收 |
| `final-acceptance-checklist.md` | 跨任务验收 | 迁移、兼容、测试、回归、文档一致性 | 每个任务的细节完成标准 |

## 推荐阅读顺序

1. 先看 [execution-plan.md](./execution-plan.md)
2. 再看 [development-plan.md](./development-plan.md)
3. 若要理解背景，再回看 `../task-growth-reward-domain-design.md`
4. 若要做事件定义层，再看 `../event-registry-special-design.md`
5. 开工时进入具体 task 文件
6. 联调与收尾时使用 [final-acceptance-checklist.md](./final-acceptance-checklist.md)

## P0

- `p0/01-policy-and-rule-code-alignment.md`
- `p0/02-admin-report-review-module.md`
- `p0/03-report-reward-after-judgement.md`
- `p0/04-topic-audit-reward-backfill.md`
- `p0/05-admin-manual-adjustment-operation-key.md`

## P1

- `p1/01-reward-config-contract.md`
- `p1/02-task-assignment-reward-status.md`
- `p1/03-growth-reward-result.md`
- `p1/04-ledger-dto-explainability.md`
- `p1/05-mixed-growth-ledger-page.md`

## P2-A

- `p2a/01-event-definition-map.md`
- `p2a/02-event-envelope.md`
- `p2a/03-doc-and-dto-alignment.md`

## P2-B

- `p2b/01-notification-template.md`
- `p2b/02-notification-preference.md`
- `p2b/03-notification-delivery.md`
- `p2b/04-task-reminder-and-announcement-boundary.md`

## P2-C

- `p2c/01-governance-gate-unification.md`
- `p2c/02-comment-moderation-admin.md`
- `p2c/03-chat-outbox-closure.md`

注意：

- 上传服务文档不属于本目录范围
- `event_type / event_record` 不在当前拆分任务里，后续若真有业务收益再单开专题
- 通知域边界、偏好粒度、delivery 状态语义统一参考 `../notification-domain-contract.md`
