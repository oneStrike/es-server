# 任务拆分目录

本目录只承载“可执行任务单”，不重复承担领域设计文档的职责。

使用原则：

1. 一个文件只描述一个可以独立排期的任务
2. 默认按 `P0 -> P1 -> P2-A -> P2-B -> P2-C` 顺序推进
3. 没有明确前置收益时，不提前做重型基础设施

推荐阅读顺序：

- 先看 [execution-plan.md](./execution-plan.md)
- 再看 [development-plan.md](./development-plan.md)
- 最后用 [final-acceptance-checklist.md](./final-acceptance-checklist.md) 做整体验收
- 再按阶段进入各子任务

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
