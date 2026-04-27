# 连续签到规则级概览图标支持设计

## 1. 背景

当前签到模块已经支持：

- 基础签到全局概览图标 `rewardOverviewIconUrl`
- 日期奖励 / 周期奖励规则级概览图标 `rewardOverviewIconUrl`
- 基础签到与连续签到奖励项级图标 `rewardItems[].iconUrl`

但连续签到仍缺少“规则级概览图标”这一层语义，前端只能从奖励项图标中猜测展示图标，无法稳定配置连续奖励卡片、弹窗或摘要所需的独立图标。

## 2. 目标

1. 连续签到规则支持配置独立的概览图标 URL。
2. app/admin 读取连续签到规则与奖励发放结果时，统一返回该图标。
3. 连续奖励发放事实冻结一份图标快照，避免后续规则更新回溯污染历史。

## 3. 非目标

- 不调整已有 `rewardItems[].iconUrl` 的语义。
- 不为连续签到额外引入多级图标优先级或 fallback 规则。
- 不改动基础签到奖励、补签图标和日历基础奖励概览的既有逻辑。

## 4. 方案

### 4.1 数据层

- 在 `check_in_streak_rule` 新增 `reward_overview_icon_url varchar(500)`。
- 在 `check_in_streak_grant` 新增 `reward_overview_icon_url varchar(500)`，用于冻结发放时的规则级图标快照。

### 4.2 DTO 与返回合同

- 在连续签到规则 DTO 上新增 `rewardOverviewIconUrl?: string | null`。
- 在连续签到奖励发放 DTO 上新增 `rewardOverviewIconUrl?: string | null`。
- 因 `nextReward`、规则详情 / 历史详情 / 列表、签到记录 `grants[]`、对账 `grants[]` 都复用相关 DTO，所以这些读取面会自动带出该字段。

### 4.3 业务语义

- 发布连续签到规则时，持久化规则级图标。
- 查询规则详情、规则列表、历史详情时，返回规则级图标。
- 触发连续奖励发放时，把规则级图标写入 grant 快照。
- 读取 grant 时，返回 grant 快照上的图标，而不是回查当前规则值。

## 5. 风险与兼容

- 这是连续签到返回结构的增量扩展，旧客户端可忽略新增字段。
- 历史 grant 在 migration 前没有快照图标，读取时应允许返回 `null`。
- 需要同步更新 schema、migration、DTO、类型、service 和测试，避免单层脱节。
