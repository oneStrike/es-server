# App 前端破坏性更新清单

## 说明

- 本文只列 App 前端会直接感知的签到模块合同变化。
- 本轮不做兼容层：旧 streak 展示口径立即失效。

## 1. 签到摘要

- 影响接口：
  - `GET app/check-in/summary`
- 变更行为：
  - `cycle.currentStreak` 改为“有效连续签到天数”
  - 规则：`lastSignedDate` 是今天或昨天时，连续签到天数继续有效；早于昨天时直接归零
  - `nextStreakReward` 也会基于新的有效 streak 重新计算
- 前端必须调整：
  - 不要再把 `currentStreak` 当成“最近一次签到时的历史快照”
  - 连续签到展示、进度条、下一档奖励提示都要按新的有效 streak 解释

## 2. 签到排行榜

- 影响接口：
  - `GET app/check-in/leaderboard/page`
- 变更行为：
  - 排行榜改为按有效连续签到天数排序
  - 断签超过 1 个自然日的用户不会继续保留旧 streak 排名
- 前端必须调整：
  - 不要缓存旧榜单 streak 作为后续展示依据
  - 榜单空态、名次变化提示要接受“断签后直接掉榜”的新行为

## 3. 不变项

- `GET app/check-in/calendar`
- `GET app/check-in/my/page`
- 奖励来源、奖励明细、补签次数等字段结构本轮不新增兼容字段
