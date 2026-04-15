# Admin 前端破坏性更新清单

## 说明

- 本文只列 Admin 前端会直接感知的签到模块合同变化。
- 本轮不做兼容层：旧请求写法、旧宽松校验、旧配置脏值全部失效。

## 1. 签到计划状态更新

- 影响接口：
  - `POST admin/check-in/plan/update-status`
- 变更字段：
  - `status`：现在为必填字段
    - `0=草稿`
    - `1=已发布`
    - `2=已下线`
    - `3=已停用`
- 前端必须调整：
  - 状态切换请求必须始终显式提交 `status`
  - 不能再依赖“只传 `id` 也成功”的旧行为

## 2. 签到计划创建与编辑

- 影响接口：
  - `POST admin/check-in/plan/create`
  - `POST admin/check-in/plan/update`
- 变更字段：
  - `planCode`：去除首尾空格后不能为空
  - `planName`：去除首尾空格后不能为空
  - `patternRewardRules[].patternType=3`（按月最后一天）：
    - 同一计划内最多只允许 1 条
- 前端必须调整：
  - 计划编码、计划名称提交前要做空白校验
  - 周期模式奖励编辑器必须禁止重复添加“按月最后一天”规则
  - 不要再依赖后端接受空白字符串或重复月末规则

## 3. 签到对账与补偿

- 影响接口：
  - `GET admin/check-in/reconciliation/page`
  - `POST admin/check-in/reconciliation/repair`
- 变更行为：
  - 已经成功结算的基础奖励 / 连续奖励再次触发 repair 时，会直接复用成功态
  - repair 失败不再把已成功状态降级成失败
- 前端必须调整：
  - 对账页和补偿按钮文案要按“成功态幂等重试”理解，不再把重复补偿视为状态回退入口

## 4. 不变项

- `cycleType`、`patternRewardRules[].patternType`、`resolvedRewardSourceType` 仍保持当前数字枚举合同
- 计划详情、计划分页、对账分页的响应结构不新增兼容字段
