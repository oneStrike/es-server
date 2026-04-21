# Admin Check-in Module Breaking Change

## Scope

- API:
  - `GET admin/check-in/config/detail`
  - `POST admin/check-in/config/update`
  - `POST admin/check-in/config/update-enabled`
  - `GET admin/check-in/streak/page`
  - `GET admin/check-in/streak/detail`
  - `GET admin/check-in/streak/history/page`
  - `GET admin/check-in/streak/history/detail`
  - `POST admin/check-in/streak/publish`
  - `POST admin/check-in/streak/terminate`
  - `GET admin/check-in/reconciliation/page`
  - `POST admin/check-in/reconciliation/repair`
- Domain: admin 侧签到配置、连续签到单条记录生命周期、签到对账
- Change type: 破坏性更新，无兼容层

## Preconditions

- 本次不处理历史连续签到数据迁移。
- 默认以上线前清理连续签到相关数据为前提。
- 不提供旧 round、旧 daily/activity 双模型兼容层。

## Route Changes

下线路由：

- `GET admin/check-in/streak-round/detail`
- `GET admin/check-in/streak-round/history/page`
- `GET admin/check-in/streak-round/history/detail`
- `POST admin/check-in/streak-round/update`
- `GET admin/check-in/daily-streak/detail`
- `GET admin/check-in/daily-streak/history/page`
- `GET admin/check-in/daily-streak/history/detail`
- `POST admin/check-in/daily-streak/publish`
- `POST admin/check-in/daily-streak/terminate`
- `GET admin/check-in/activity-streak/page`
- `GET admin/check-in/activity-streak/detail`
- `POST admin/check-in/activity-streak/create`
- `POST admin/check-in/activity-streak/update`
- `POST admin/check-in/activity-streak/update-status`
- `POST admin/check-in/activity-streak/delete`

保留并统一后的连续签到管理路由：

- `GET admin/check-in/streak/page`
- `GET admin/check-in/streak/detail`
- `GET admin/check-in/streak/history/page`
- `GET admin/check-in/streak/history/detail`
- `POST admin/check-in/streak/publish`
- `POST admin/check-in/streak/terminate`

## Unified Streak Model

后台不再管理“轮次”“日常连续签到”“活动连续签到”三套对象，也不再管理“整套连续签到配置版本”。

现在统一成“单条连续天记录独立生命周期”模型：

- `check_in_streak_rule`
- `check_in_streak_rule_reward_item`
- `check_in_streak_progress`
- `check_in_streak_grant`
- `check_in_streak_grant_reward_item`

业务语义：

- 每个第 N 天是一条独立记录，也就是“一天一条记录”。
- 每条记录独立维护 `version / publishStrategy / effectiveFrom / effectiveTo / status`。
- 可以只发布或终止某一个连续天阈值，不影响其他阈值记录。
- 连续签到奖励按单条记录版本归因，不再归属某个整套配置头。
- 每条记录下的奖励项单独落表，不再塞 JSON。

## DTO Changes

旧 DTO 心智下线：

- `UpdateCheckInStreakRoundDto`
- 所有 `round` 详情 / 历史 DTO
- 所有 `daily-streak` / `activity-streak` DTO

当前统一 DTO：

- `PublishCheckInStreakRuleDto`
- `CheckInStreakRuleDetailResponseDto`
- `CheckInStreakRulePageItemDto`
- `CheckInStreakRuleHistoryPageItemDto`

说明：

- 发布单元不再是 `rewardRules[]` 整组数组，而是单条记录。
- 底层持久化已经是 `rule + reward_item` 两层关系表。

## Reconciliation Changes

连续奖励对账过滤字段统一为：

- `ruleId`
- `grantId`

下线旧双模型归因字段：

- `configId`
- `scopeType`
- `configVersionId`
- `activityId`

## Notes

- admin 不得再依赖 `streak-round/*`、`daily-streak/*`、`activity-streak/*`，也不得再依赖旧配置头心智。
- 不做历史补差、旧事实回滚或旧配置迁移。
- 发布策略当前仅支持：
  - `1=立即生效`
  - `2=次日生效`
  - `3=指定时间生效`
