# P2-C-02 评论审核后台

## 目标

补齐评论审核后台，避免评论域长期成为治理链路的缺口。

## 范围

- 新增评论审核管理端模块
- 支持分页、筛选、审核、隐藏
- 明确与奖励、通知、任务的联动边界

## 当前代码锚点

- `libs/interaction/src/comment/comment.service.ts`
- `libs/interaction/src/comment/comment-growth.service.ts`
- `db/schema/app/user-comment.ts`
- `libs/message/src/notification/notification.service.ts`

## 非目标

- 不重做评论发布基础能力
- 不在后台模块里重新定义治理规则本身
- 不做历史评论批量补审或批量补发奖脚本

## 主要改动

- 定义评论处理状态流转
- 明确评论待审核时是否允许推进任务
- 审核结果与通知、奖励生产时机对齐

## 完成标准

- 运营可以在后台处理评论审核
- 评论域不再游离于治理闸门之外

## 完成后同步文档

- [领域设计总览](../../task-growth-reward-domain-design.md)
- [开发排期版](../development-plan.md)
- [P2-C-01 治理闸门统一](./01-governance-gate-unification.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准
