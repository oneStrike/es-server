# App 前端破坏性更新清单

## 说明

- 本文只列 App 前端会直接感知的接口合同变化。
- 本轮不做兼容层：旧字符串值不再被后端接受或返回。

## 1. App 更新检查

- 影响接口：
  - `GET app/system/update/check`
- 变更字段：
  - 请求字段 `platform`：由字符串改为数字
    - `1=苹果端`
    - `2=安卓端`
- 前端必须调整：
  - 更新检查请求参数
  - 平台枚举常量
  - 本地缓存中若保存了旧平台值，需要同步迁移

## 2. 签到摘要 / 日历 / 我的记录

- 影响接口：
  - `GET app/check-in/summary`
  - `GET app/check-in/calendar`
  - `GET app/check-in/my/page`
- 变更字段：
  - `cycleType`：由字符串改为数字
    - `1=按周切分`
    - `2=按月切分`
  - `resolvedRewardSourceType`：由字符串改为数字
    - `1=默认基础奖励`
    - `2=具体日期奖励`
    - `3=周期模式奖励`
- 前端必须调整：
  - 签到页周期文案映射
  - 奖励来源标签、卡片角标、明细文案
  - 旧值 `weekly/monthly/BASE_REWARD/DATE_RULE/PATTERN_RULE` 不再出现

## 3. 不变项

以下 App 端字段本轮继续保持原合同，不属于破坏性改动：

- `eventKey`
- `categoryKey`
- `projectionKey`
- `domain`
- `popupBackgroundPosition`
- `TaskUserVisibleStatusEnum`
- 通知分类键相关常量
