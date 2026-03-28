# P2-A-01 代码级 `EventDefinitionMap`

## 目标

建设统一事件定义层，但不把它做成统一执行中心。

## 范围

- 定义 `EventDefinition` type
- 定义 `EventDefinitionMap`
- 提供查询与枚举能力

## 主要改动

- 保留 `GrowthRuleTypeEnum` 作为稳定编码层
- 为事件补 `label / domain / governanceGate / consumers / implStatus`
- 提供“已实现 / 可配置”筛选能力

## 完成标准

- 事件定义有唯一事实源
- 任务、成长、通知可以复用同一份元数据

## 执行信息

- 优先级：`S2`
- 硬前置：`P0-01`
- 软前置：`P1-04`
- 直接后置：`P2-A-02`、`P2-A-03`、`P2-B-01`、`P2-C-01`
- 可并行：无
