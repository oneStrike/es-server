# App Check-in Module Breaking Change

## Scope

- API:
  - `GET app/check-in/summary`
  - `GET app/check-in/calendar`
  - `GET app/check-in/my/page`
  - `GET app/check-in/leaderboard/page`
  - `POST app/check-in/sign`
  - `POST app/check-in/makeup`
- Domain: app 侧签到摘要、连续签到、签到奖励展示
- Change type: 破坏性更新，无兼容层

## Preconditions

- 本次改造按破坏性更新处理。
- 上线前默认清理连续签到相关数据，不围绕历史连续签到数据做迁移或重建。
- 基础签到记录与补签能力继续保留。

## Removed Routes

下列连续签到相关入口已下线：

- `GET app/check-in/activity/page`
- `GET app/check-in/activity/detail`

app 侧现在只读取一套统一连续签到配置，不再区分“日常”和“活动”两个连续签到入口。

## Unified Runtime Model

连续签到运行时不再绑定 round，也不再绑定独立 activity。

当前运行时只关心三件事：

1. 用户当前连续签到天数是多少
2. 当前生效配置是什么
3. 第几天对应什么奖励

底层事实源改为：

- `check_in_streak_config`
- `check_in_streak_rule`
- `check_in_streak_rule_reward_item`

也就是：

- “第几天有什么奖励”已改成数据库中的一天一条规则记录
- 奖励项是关系型明细，不再从 streak JSON 读取

## Summary Shape

`summary.streak` 统一表达为：

```ts
{
  currentStreak: number
  streakStartedAt?: string
  lastSignedDate?: string
  nextReward?: RewardRule | null
}
```

说明：

- app 不再感知“当前在哪一轮”。
- app 只读取当前生效配置。
- 下一档奖励来自统一 `check_in_streak_rule` 的关系数据。

## Removed Runtime Fields

以下连续签到运行时字段已下线：

- `roundConfigId`
- `roundCode`
- `roundIteration`
- `roundStartedAt`
- `round`

## Grant Payload Changes

连续奖励 `grant` 现在统一归因到：

- `configId`
- `ruleId`

下列旧字段已下线：

- `scopeType`
- `configVersionId`
- `activityId`
- `activityRuleId`

同时：

- grant 奖励快照不再来自 `rewardItems json`
- 奖励项改为 `check_in_streak_grant_reward_item` 明细

## Action Response Changes

`POST app/check-in/sign` / `POST app/check-in/makeup` 响应中：

- 保留 `currentStreak`
- 保留 `triggeredGrantIds`
- 不再返回任何 round / activity 连续签到字段

## Notes

- 客户端不得再依赖 round 运行时字段解释连续签到状态。
- 不再存在独立活动连续签到详情页或列表页。
- 连续签到奖励现在是关系型按天规则模型，不再从 streak 配置 JSON 中读取。
