# P1-05 混合成长账本分页接口

## 目标

提供统一的成长时间线，而不是让用户和运营分别查积分页、经验页。

## 范围

- App 端新增统一账本分页
- 管理端新增统一账本分页
- 保留旧接口作为兼容能力

## 当前代码锚点

- `libs/growth/src/point/point.service.ts`
- `libs/growth/src/experience/experience.service.ts`
- `libs/growth/src/growth-ledger/growth-ledger.types.ts`
- `apps/app-api/src/modules/user/dto/user-point.dto.ts`
- `apps/admin-api/src/modules/app-user/dto/app-user.dto.ts`

## 非目标

- 不替换旧 points / experience 分页接口
- 不让展示层接口反向定义奖励触发语义
- 不在本任务里扩展成运营统计报表

## 主要改动

- 统一返回 `assetType / delta / beforeValue / afterValue / ruleType / bizKey / context / createdAt`
- 不立即替换旧 points / experience 分页
- 聚合排序口径以时间线为主

## 完成标准

- App 与管理端都能一次性查看积分和经验流水
- 旧接口继续可用，不形成强制切换

## 完成后同步文档

- [领域设计总览](../../task-growth-reward-domain-design.md)
- [开发排期版](../development-plan.md)
- [P1-04 账本 DTO 解释力增强](./04-ledger-dto-explainability.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准
