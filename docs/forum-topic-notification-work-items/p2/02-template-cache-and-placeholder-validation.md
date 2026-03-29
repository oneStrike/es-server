# P2-02 模板缓存与占位符校验

## 目标

增强模板服务可维护性，减少主链路重复查库，并尽量把模板错误前移到保存期。

## 范围

- 增加模板本地缓存
- 增加模板保存期占位符校验
- 保留运行时 fallback 兜底

## 当前代码锚点

- `libs/message/src/notification/notification-template.service.ts`
- `libs/message/src/notification/notification-template.service.spec.ts`

## 非目标

- 不改通知模板的存储模型
- 不引入 Redis 或分布式缓存
- 不取消运行时 fallback 逻辑
- 不使用无限制的 `payload.*` 通配来放行所有占位符

## 主要改动

- 按 `notificationType` 缓存模板或“无模板”结果
- 在创建 / 更新 / 删除 / 启停切换后主动失效缓存
- 对模板固定根字段增加白名单校验
- 对 `payload` 下允许字段按 `notificationType` / typed payload 定义做白名单校验
- 保存包含非法路径或未注册 payload 字段的模板时直接报错
- 渲染失败时仍回退到业务 fallback 文案

## 完成标准

- 模板服务不会在每次通知渲染前都无条件查库
- 常见模板配置错误，尤其是拼错 payload 字段的场景，可以在保存时就被发现
- 模板层稳定性提升，但不影响现有通知兜底行为

## 完成后同步文档

- [设计事实源](../../forum-topic-notification-optimization-plan.md)
- [开发排期版](../development-plan.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准
