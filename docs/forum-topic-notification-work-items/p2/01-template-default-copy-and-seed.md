# P2-01 主题通知模板默认文案与 seed 升级

## 目标

收口论坛主题通知的联调 seed 与模板回退验收口径，并保持与已在 `P1-01`、`P1-02`、`P1-03` 落地的动态模板一致。

## 范围

- 更新消息域模板 seed
- 同步联调示例通知文案，避免继续展示旧固定 copy
- 验证模板缺失、禁用或渲染失败时仍使用业务 fallback

## 当前代码锚点

- `libs/message/src/notification/notification-template.service.ts`
- `db/seed/modules/message/domain.ts`

## 非目标

- 不在本任务里做模板缓存
- 不在本任务里引入多渠道模板编排
- 不要求“有模板才能发通知”
- 不重复承担 `COMMENT_REPLY` 默认模板升级；该动作已并入 `P1-02`
- 不重复承担 `TOPIC_LIKE / TOPIC_FAVORITE` 默认模板升级；该动作已并入 `P1-01`
- 不重复承担 `TOPIC_COMMENT` 默认模板升级；该动作已并入 `P1-03`

## 主要改动

- 更新对应 seed 数据
- 同步联调 seed 中涉及通知文案的示例数据
- 保证模板缺失、禁用或渲染失败时仍使用业务 fallback

## 完成标准

- 联调 seed 示例文案与已落地的 `TOPIC_* / COMMENT_REPLY` 动态模板口径一致
- 模板层继续只负责渲染，不侵入业务主链路判断
- 模板缺失、禁用或渲染失败时仍稳定回退到业务 fallback

## 完成后同步文档

- [设计事实源](../../forum-topic-notification-optimization-plan.md)
- [开发排期版](../development-plan.md)
- 若通知域口径调整，同时同步 [../../notification-domain-contract.md](../../notification-domain-contract.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准
