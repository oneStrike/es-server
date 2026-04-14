# Admin 前端破坏性更新清单

## 说明

- 本文只列 Admin 前端会直接感知的接口合同变化。
- 本轮不做兼容层：旧字符串值、旧筛选值、旧状态映射全部失效。

## 1. 版本更新管理

- 影响接口：
  - `GET admin/app-update/page`
  - `GET admin/app-update/detail`
  - `POST admin/app-update/create`
  - `POST admin/app-update/update`
- 变更字段：
  - `platform`：由字符串改为数字
    - `1=苹果端`
    - `2=安卓端`
  - `packageSourceType`：由字符串改为数字
    - `1=后台上传`
    - `2=外部下载地址`
- 前端必须调整：
  - 查询条件、表单选项、回填值、枚举映射全部改成数字
  - 旧值 `ios/android/upload/url` 不再被接口接受

## 2. 签到计划与对账

- 影响接口：
  - `GET admin/check-in/plan/page`
  - `GET admin/check-in/plan/detail`
  - `POST admin/check-in/plan/create`
  - `POST admin/check-in/plan/update`
  - `GET admin/check-in/reconciliation/page`
- 变更字段：
  - `cycleType`：由字符串改为数字
    - `1=按周切分`
    - `2=按月切分`
  - `resolvedRewardSourceType`：由字符串改为数字
    - `1=默认基础奖励`
    - `2=具体日期奖励`
    - `3=周期模式奖励`
- 前端必须调整：
  - 计划编辑页的周期类型下拉值
  - 对账页奖励来源的筛选、标签、导出文案
  - 旧值 `weekly/monthly/BASE_REWARD/DATE_RULE/PATTERN_RULE` 全部失效

## 3. 消息监控

- 影响接口：
  - `GET admin/message/monitor/delivery/page`
  - `GET admin/message/monitor/dispatch/page`
  - `GET admin/task/assignment/reconciliation/page`
- 变更字段：
  - `dispatchStatus`
    - `0=待处理`
    - `1=处理中`
    - `2=处理成功`
    - `3=处理失败`
  - `deliveryStatus` / `status`
    - `1=已投递`
    - `2=投递失败`
    - `3=重试中`
    - `4=因偏好关闭而跳过`
- 前端必须调整：
  - 消息监控筛选面板
  - 状态标签、颜色、按钮显隐规则
  - 任务奖励对账页中的通知状态展示和筛选

## 4. 漫画压缩包导入

- 影响接口：
  - `POST admin/content/comic/chapter-content/archive/preview`
  - `GET admin/content/comic/chapter-content/archive/detail`
  - `POST admin/content/comic/chapter-content/archive/confirm`
- 变更字段：
  - `mode`
    - `1=单章节压缩包`
    - `2=多章节压缩包`
  - `status`
    - `0=草稿`
    - `1=待处理`
    - `2=处理中`
    - `3=成功`
    - `4=部分失败`
    - `5=失败`
    - `6=已过期`
    - `7=已取消`
  - `resultItems[].status`
    - `0=待处理`
    - `1=成功`
    - `2=失败`
- 前端必须调整：
  - 导入向导状态机
  - 轮询结束条件和失败重试提示
  - 结果列表状态标签与统计分组

## 5. 审计日志

- 影响接口：
  - `GET admin/system/audit/page`
- 变更字段：
  - `apiType`
    - `1=管理端`
    - `2=应用端`
    - `3=系统端`
    - `4=公共端`
  - `actionType`
    - `1=登录`
    - `2=登出`
    - `3=创建`
    - `4=更新`
    - `5=删除`
    - `6=上传`
    - `7=下载`
    - `8=导出`
    - `9=导入`
- 前端必须调整：
  - 审计日志筛选面板
  - 列表页类型标签与操作类型标签映射
  - 旧字符串值 `admin/app/system/public` 和 `LOGIN/UPDATE/...` 不再出现

## 6. 不变项

以下字段本轮继续保持字符串，不计入 Admin 前端破坏范围：

- `eventKey`
- `categoryKey`
- `projectionKey`
- `domain`
- `packageMimeType`
- `popupBackgroundPosition`
