# P0-07 成长规则值语义与校验对齐

## 目标

收口积分规则与经验规则的配置语义，确保规则值、规则类型和账本结算入口对“发奖规则”的理解保持一致，避免负数或非法规则类型进入 `applyByRule()`。

## 范围

- 统一 point / experience rule 的规则类型校验
- 统一 point / experience rule 的奖励值语义为“正整数发奖”
- 统一 `dailyLimit / totalLimit` 的非负约束
- 为 `GrowthLedgerService.applyByRule()` 补齐 `<= 0` 的兜底拒绝
- 补齐该链路自动化测试

## 当前代码锚点

- `libs/growth/src/point/point-rule.service.ts`
- `libs/growth/src/point/dto/point-rule.dto.ts`
- `libs/growth/src/experience/experience.service.ts`
- `libs/growth/src/experience/dto/experience-rule.dto.ts`
- `libs/growth/src/growth-ledger/growth-ledger.service.ts`
- `libs/growth/src/growth-ledger/growth-ledger.constant.ts`
- `db/schema/app/user-point-rule.ts`
- `db/schema/app/user-experience-rule.ts`

## 非目标

- 不把 task 奖励从 `rewardConfig` 直发改造成 ruleType 驱动
- 不调整积分消费、经验扣减或其他 `applyDelta()` 语义
- 不扩展新的成长规则编码
- 不重做 point / experience 管理端页面结构

## 主要改动

- point / experience rule 创建与更新时统一校验 `GrowthRuleTypeEnum`
- `points / experience` 字段只允许 `> 0`
- `dailyLimit / totalLimit` 字段只允许 `>= 0`
- `applyByRule()` 在规则值 `<= 0` 时直接拒绝
- 同步修正文档、DTO 和 schema 注释中的规则值语义

## 完成标准

- point / experience rule 不能再创建或更新为负数/零值奖励
- point / experience rule 不能再写入非法 `GrowthRuleTypeEnum`
- `applyByRule()` 即使读到脏数据，也不会进入余额更新链路
- 自动化测试能覆盖规则值、规则类型和账本兜底拒绝场景

## 完成后同步文档

- [README.md](../README.md)
- [development-plan.md](../development-plan.md)
- [growth-rule-semantics-and-validation-checklist.md](../checklists/growth-rule-semantics-and-validation-checklist.md)

## 排期引用

- 本任务的优先级、依赖关系、波次与状态统一以 [execution-plan.md](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准
