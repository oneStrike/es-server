# P2-B-02 用户通知偏好

## 目标

让用户能控制通知接收范围，避免后续模板和投递全靠默认值硬推。

## 范围

- 新增 `notification_preference`
- App 端补获取和更新接口
- 投递前接入偏好检查

## 当前代码锚点

- `apps/app-api/src/modules/message/message.controller.ts`
- `apps/app-api/src/modules/message/dto/message.dto.ts`
- `libs/message/src/notification/notification.constant.ts`
- `libs/message/src/notification/notification.service.ts`
- `libs/message/src/outbox/outbox.worker.ts`

## 非目标

- 不按事件定义 code 控制偏好
- 不按模板 key 控制偏好
- 不按短信 / 邮件 / push 等渠道维度控制偏好
- 不对既有已生成通知做追溯删除

## 主要改动

- 定义默认策略
- 第一阶段只按 `MessageNotificationTypeEnum` 控制偏好
- 采用“显式配置覆盖默认值”
- 在创建 `user_notification` 前接入偏好判断
- 偏好命中关闭时，后续投递结果要能区分为抑制而非失败

## 完成标准

- 用户可按通知类型配置基本通知偏好
- outbox / 通知主链路在创建通知前会校验偏好
- 关闭的通知类型不会继续创建 `user_notification`
- 运营可以区分“用户关闭偏好”与“真实投递失败”

## 完成后同步文档

- [通知域契约](../../notification-domain-contract.md)
- [开发排期版](../development-plan.md)
- [P2-B-03 通知投递结果表](./03-notification-delivery.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准
