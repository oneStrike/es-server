# P0-02 管理端举报处理模块

## 目标

补齐管理端举报分页、详情、处理入口，让举报真正进入运营流程。

## 范围

- 新增管理端举报模块
- 提供分页、详情、处理接口
- 补处理 DTO 和状态流转约束

## 当前代码锚点

- `libs/interaction/src/report/report.service.ts`
- `libs/interaction/src/report/report.constant.ts`
- `libs/interaction/src/report/dto/report.dto.ts`
- `db/schema/app/user-report.ts`

## 非目标

- 不改用户侧举报提交流程
- 不把奖励结算逻辑和后台处理模块绑成一个任务落地
- 不引入复杂工单系统或多级审批流程

## 主要改动

- `apps/admin-api` 注册举报模块
- `libs/interaction` 增加管理端查询与处理能力
- 只允许 `PENDING / PROCESSING -> RESOLVED / REJECTED`

## 完成标准

- 运营能在后台处理举报
- `handlerId / handledAt / handlingNote / status` 能完整落库
- 已处理举报不能被错误回滚到待处理态

## 完成后同步文档

- [领域设计总览](../../task-growth-reward-domain-design.md)
- [开发排期版](../development-plan.md)
- [P0-03 举报奖励切到裁决后结算](./03-report-reward-after-judgement.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准
