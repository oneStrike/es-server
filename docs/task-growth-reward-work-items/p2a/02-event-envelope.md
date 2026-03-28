# P2-A-02 轻量 `EventEnvelope` 类型

## 目标

补一层最低限度统一事件外壳，先统一语义壳，不急着落库。

## 范围

- 定义轻量 `EventEnvelope`
- 先覆盖高频链路
- 不引入 `event_record`

## 当前代码锚点

- `libs/forum/src/topic/forum-topic.service.ts`
- `libs/interaction/src/comment/comment.service.ts`
- `libs/interaction/src/report/report.service.ts`
- `libs/growth/src/task/task.service.ts`

## 非目标

- 不新增事件落库表
- 不强制所有模块改为统一派发框架
- 不让 envelope 承担完整业务 payload 存储职责

## 主要改动

- 统一 `code / key / subject / target / operator / occurredAt / governanceStatus / context`
- 先让主题、评论、点赞、举报、任务完成可按需复用

## 完成标准

- 高频链路可以共享最低限度事件语义
- 不强迫各模块改成统一派发流程

## 完成后同步文档

- [事件定义专项设计](../../event-registry-special-design.md)
- [开发排期版](../development-plan.md)
- [P2-A-03 文档与 DTO 统一引用事件定义](./03-doc-and-dto-alignment.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准
