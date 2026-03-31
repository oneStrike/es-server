# P2-01 成长规则配置入口语义统一

## 1. 目标

在不推翻现有积分规则、经验规则底层模型的前提下，把后台配置口径统一成“同一个行为事件，对应两类基础资产奖励”的可解释视图。

本任务的重点不是改表，而是解决运营与开发的认知成本：

- 为什么一个行为会同时有积分规则和经验规则；
- 它和任务奖励的关系是什么；
- 后台该如何理解“规则、任务、bonus”三者边界。

## 2. 范围

本任务覆盖以下模块：

- Admin 成长配置入口：
  - `apps/admin-api/src/modules/growth/point/point.controller.ts`
  - `apps/admin-api/src/modules/growth/experience/experience.controller.ts`
  - `apps/admin-api/src/modules/growth/point/dto/point.dto.ts`
  - `apps/admin-api/src/modules/growth/experience/dto/experience.dto.ts`
- Growth 规则与服务：
  - `libs/growth/src/growth-rule.constant.ts`
  - `libs/growth/src/point/point-rule.service.ts`
  - `libs/growth/src/experience/experience.service.ts`
  - `libs/growth/src/point/dto/point-rule.dto.ts`
  - `libs/growth/src/experience/dto/experience-rule.dto.ts`
- 关联任务目标映射说明：
  - `libs/growth/src/task/*`

## 3. 当前代码锚点

- 积分规则和经验规则当前是两套入口、两套 DTO、两套服务；
- 对开发来说这并不奇怪，但对运营来说容易误解为“两套互相竞争的成长规则系统”；
- `GrowthRuleTypeEnum` 实际已经是共同的行为事件码，但后台没有一层“按事件聚合”的阅读视图；
- 任务奖励另有 `task.rewardConfig`，如果后台不明确边界，容易产生“到底发哪边”的困惑。

## 4. 非目标

- 本任务不合并积分规则表与经验规则表；
- 不变更账本模型；
- 不改动积分、经验资产定义；
- 不做用户端成长体系重设计；
- 不在本任务中处理任务模板发布拆分。

## 5. 主要改动

### 5.1 统一后台解释模型

后台文案与接口说明统一为：

- `GrowthRuleTypeEnum`：行为事件
- `point rule`：该事件的积分基础奖励
- `experience rule`：该事件的经验基础奖励
- `task reward`：该事件被任务包装后，达成任务的额外 bonus

### 5.2 提供按事件聚合的管理视图

在不重做底层表的前提下，增加“按事件查看”的聚合输出：

- 事件码
- 事件说明
- 积分规则开关、额度、上限
- 经验规则开关、额度、上限
- 是否存在关联任务模板

这样运营不必分别在两套页面中手工拼脑图。

### 5.3 统一规则校验与展示口径

统一以下校验与展示项：

- 规则是否启用
- 每日上限
- 总上限
- 幂等键语义
- 适用对象
- 与任务 bonus 的叠加策略说明

### 5.4 建立规则与任务的映射说明

补充后台或文档说明：

- 哪些事件只发基础奖励；
- 哪些事件有基础奖励 + 任务 bonus；
- 哪些事件当前没有任务包装；
- 哪些事件不建议被任务直接包装。

### 5.5 为后续结构升级留接口

预留一个聚合查询层或 facade，而不是直接要求前端自己拼两类规则与任务关系。

## 6. 完成标准

- 后台配置口径已能清楚解释“事件、基础奖励、任务 bonus”的关系；
- 运营可按事件聚合查看积分规则、经验规则与任务关联；
- 文案、DTO、接口说明不再暗示积分规则和经验规则是两套互斥系统；
- 至少覆盖：
  - 聚合查询输出测试；
  - 规则展示口径一致性测试；
  - 与任务关联信息的回归测试。

## 7. 完成后同步文档

- `docs/task-growth-notification-rearchitecture-work-items/README.md`
- `docs/task-growth-notification-rearchitecture-work-items/development-plan.md`
- 成长规则后台说明文档
- 运营配置手册

## 8. 排期引用

- 优先级与依赖以 `docs/task-growth-notification-rearchitecture-work-items/execution-plan.md` 为准；
- 本任务对应排期项：`P2-01`；
- 直接前置：`P0-03`；
- 软前置：`P1-01`；
- 可与 `P1-03` 并行，但以排期文档为唯一事实源。
