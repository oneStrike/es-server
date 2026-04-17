# Admin Reward Module Breaking Change

## Scope

- API:
  - `admin/growth/reward-rules/*`
  - `admin/task/*`
  - `admin/check-in/*`
  - `admin/growth/reward-settlement/*`
- Domain: 奖励规则、任务奖励、签到奖励、奖励补偿
- Change type: 破坏性更新，无兼容层

## Route Changes

### Removed routes

- `admin/growth/points-rules/*`
- `admin/growth/experience-rules/grant`

说明：

- 旧积分规则和经验规则管理入口已下线。
- 管理端经验补发只保留 `admin/app-users/experience/grant`。

### New canonical routes

- `admin/growth/reward-rules/page`
- `admin/growth/reward-rules/detail`
- `admin/growth/reward-rules/create`
- `admin/growth/reward-rules/update`
- `admin/growth/reward-rules/delete`

## Unified Rule Contract

成长奖励规则不再按“积分规则 / 经验规则”拆两套 CRUD，统一为单表合同：

```ts
{
  type: number
  assetType: 1 | 2 | 3 | 4 | 5
  assetKey?: string
  delta: number // 正整数
  dailyLimit?: number
  totalLimit?: number
  isEnabled?: boolean
  remark?: string
}
```

说明：

- `assetType=1` 表示积分
- `assetType=2` 表示经验
- 道具 / 虚拟货币 / 等级等扩展资产也复用同一结构
- `delta` 只允许正整数；消费/扣减不再通过 `growth_reward_rule` 表达

## Task Contract Changes

### Request DTO

任务配置不再接受旧奖励对象：

```ts
rewardConfig: {
  points?: number
  experience?: number
}
```

现在统一为：

```ts
rewardItems: Array<{
  assetType: 1 | 2
  assetKey?: ''
  amount: number
}>
```

### Response DTO

任务 assignment / reconciliation 视图不再返回旧奖励状态字段：

- `rewardStatus`
- `rewardResultType`
- `rewardSettledAt`
- `rewardLedgerIds`
- `lastRewardError`

现在统一读取：

- `rewardSettlementId`
- `rewardSettlement`

## Check-in Contract Changes

### Plan DTO

签到计划不再使用：

- `baseRewardConfig`

现在统一为：

- `baseRewardItems`

### Rule / record / grant DTO

以下旧字段全部下线：

- `rewardConfig`
- `resolvedRewardConfig`

现在统一为：

- `rewardItems`
- `resolvedRewardItems`

### Settlement state

`check_in_record` / `check_in_streak_reward_grant` 不再暴露旧奖励状态字段：

- `rewardStatus`
- `rewardResultType`
- `baseRewardLedgerIds`
- `lastRewardError`
- `rewardSettledAt`
- `grantStatus`
- `grantResultType`
- `ledgerIds`
- `lastGrantError`
- `grantSettledAt`

现在统一读取：

- `rewardSettlementId`
- `rewardSettlement`

## Settlement & Reconciliation

奖励补偿统一走：

- `admin/growth/reward-settlement/page`
- `admin/growth/reward-settlement/retry`
- `admin/growth/reward-settlement/retry-pending/batch`

task / check-in 不再保留各自的旧奖励重试契约。

## Migration Guidance

### Rules

旧：

- `user_point_rule`
- `user_experience_rule`

新：

- `growth_reward_rule`

### Reward JSON

旧：

```json
{ "points": 10, "experience": 5 }
```

新：

```json
[
  { "assetType": 1, "assetKey": "", "amount": 10 },
  { "assetType": 2, "assetKey": "", "amount": 5 }
]
```

### Balance and ledger

旧：

- `app_user.points`
- `app_user.experience`
- `growth_rule_usage_slot`

新：

- `user_asset_balance`
- `growth_rule_usage_counter`

## Notes

- 本次为破坏性更新，不提供旧路由、旧 DTO、旧字段兼容层。
- 历史规则、奖励 JSON、余额和限额数据必须通过 migration 刷写到新结构。
