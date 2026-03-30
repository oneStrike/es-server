# P1-01 主题点赞与收藏通知独立化

## 目标

让论坛主题点赞和收藏通知从现有复用类型中拆出来，并落成论坛主题专属动态文案。

## 范围

- 主题点赞改用 `TOPIC_LIKE`
- 主题收藏改用 `TOPIC_FAVORITE`
- 正文统一展示主题标题
- 同步升级 `TOPIC_LIKE / TOPIC_FAVORITE` 默认模板，避免启用模板环境仍显示旧静态文案

## 当前代码锚点

- `libs/forum/src/topic/resolver/forum-topic-like.resolver.ts`
- `libs/forum/src/topic/resolver/forum-topic-favorite.resolver.ts`
- `libs/message/src/notification/notification.constant.ts`

## 非目标

- 不补论坛主题“被评论”通知
- 不处理评论回复正文摘要
- 不做模板缓存与模板校验增强

## 主要改动

- 主题点赞通知不再复用 `COMMENT_LIKE`
- 主题收藏通知不再复用 `CONTENT_FAVORITE`
- 统一通过 composer 构造 fallback 标题与正文
- 标题使用“`xxx 点赞了你的主题` / `xxx 收藏了你的主题`”
- 正文统一展示主题标题
- `TOPIC_LIKE / TOPIC_FAVORITE` 默认模板同步改为动态占位符文案

## 完成标准

- 论坛主题点赞、收藏通知类型独立
- 用户在消息中心能一眼看出是哪条主题被点赞或收藏
- 不会再出现“有人点赞了你的内容”这类泛化旧文案
- 即使模板已启用且已 seed，主题点赞 / 收藏仍展示动态文案

## 完成后同步文档

- [设计事实源](../../forum-topic-notification-optimization-plan.md)
- [开发排期版](../development-plan.md)
- [P2-01 模板默认文案与 seed 升级](../p2/01-template-default-copy-and-seed.md)

## 排期引用

- 本任务的优先级、依赖关系、并行策略统一以 [执行计划](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准
