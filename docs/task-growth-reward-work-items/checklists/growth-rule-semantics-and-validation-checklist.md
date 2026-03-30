# 成长规则值语义与校验对齐清单

## 1. 文档目标

本文用于验收 point / experience rule 与 `applyByRule()` 的规则语义是否一致。

## 2. 适用范围

- 积分规则
- 经验规则
- 规则发奖账本入口

## 3. 验收项

### 3.1 规则类型

- [x] point rule 创建只能使用合法 `GrowthRuleTypeEnum`
- [x] point rule 更新只能使用合法 `GrowthRuleTypeEnum`
- [x] experience rule 创建只能使用合法 `GrowthRuleTypeEnum`
- [x] experience rule 更新只能使用合法 `GrowthRuleTypeEnum`

### 3.2 规则值语义

- [x] `points` 只允许 `> 0`
- [x] `experience` 只允许 `> 0`
- [x] `dailyLimit` 只允许 `>= 0`
- [x] `totalLimit` 只允许 `>= 0`
- [x] DTO、service、schema 注释语义一致

### 3.3 账本兜底

- [x] `applyByRule()` 遇到 `<= 0` 规则值时稳定拒绝
- [x] `applyByRule()` 不会在该场景继续更新用户余额
- [x] 拒绝结果具备稳定失败原因

### 3.4 回归覆盖

- [x] point / experience 规则入口有自动化测试
- [x] growth-ledger 规则值兜底有自动化测试
- [x] 相关 `eslint / tsc / 单测` 通过

## 4. 证据位

- [x] `point-rule.service.spec.ts`：拒绝非正积分规则值、拒绝负数限额
- [x] `experience.service.spec.ts`：拒绝非法规则类型、拒绝非正经验值与负数限额
- [x] `growth-ledger.service.spec.ts`：拒绝非正规则值且不触发余额更新
- [x] `pnpm exec eslint libs/growth/src/point/point-rule.service.ts libs/growth/src/point/point-rule.service.spec.ts libs/growth/src/point/dto/point-rule.dto.ts libs/growth/src/point/point.type.ts libs/growth/src/experience/experience.service.ts libs/growth/src/experience/experience.service.spec.ts libs/growth/src/experience/dto/experience-rule.dto.ts libs/growth/src/experience/experience.type.ts libs/growth/src/growth-ledger/growth-ledger.service.ts libs/growth/src/growth-ledger/growth-ledger.service.spec.ts libs/growth/src/growth-ledger/growth-ledger.constant.ts libs/growth/src/growth-reward/growth-reward.service.spec.ts db/schema/app/user-point-rule.ts db/schema/app/user-experience-rule.ts --ext .ts`
- [x] `pnpm exec tsc -p tsconfig.json --noEmit`
- [x] `pnpm test -- --runInBand libs/growth/src/point/point-rule.service.spec.ts libs/growth/src/experience/experience.service.spec.ts libs/growth/src/growth-ledger/growth-ledger.service.spec.ts libs/growth/src/growth-reward/growth-reward.service.spec.ts libs/growth/src/task/task.service.spec.ts`

## 5. 阻塞上线项

- [x] 不存在“负规则值进入 `applyByRule()` 后实际扣减余额”的路径
- [x] 不存在经验规则仍可写入非法 `GrowthRuleTypeEnum` 的路径

## 6. 签收结论

- [x] 本轮整改已通过
- [x] 无阻塞上线项
