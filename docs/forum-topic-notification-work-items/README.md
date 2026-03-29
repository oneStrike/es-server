# 论坛主题通知改造任务拆分目录

本目录只承载“论坛主题通知改造”的可执行任务单，不重复承担完整设计文档的职责。

使用原则：

1. 一个文件只描述一个可以独立排期的任务
2. 排序、依赖、波次只在 `execution-plan.md` 维护一次
3. `development-plan.md` 只补执行信息，不重复定义优先级
4. `final-acceptance-checklist.md` 只保留跨任务验收，不再抄写每个任务的完成标准
5. 设计口径统一参考 [../forum-topic-notification-optimization-plan.md](../forum-topic-notification-optimization-plan.md)

## 文档分工

| 文档 | 角色 | 负责 | 不负责 |
| --- | --- | --- | --- |
| `../forum-topic-notification-optimization-plan.md` | 设计事实源 | 目标、边界、类型拆分、文案方案、技术方案 | 优先级、波次 |
| `../forum-topic-notification-checklist.md` | 汇总清单 | 跨阶段执行清单、回归清单、阻塞上线项 | 单任务目标与范围 |
| `execution-plan.md` | 唯一排期事实源 | 优先级、依赖、波次、并行原则 | 文件级改动清单 |
| `development-plan.md` | 开发执行补充 | 开工条件、改动模块、关键文件、测试点 | 重新定义任务顺序 |
| `p0/*` ~ `p2/*` | 单任务说明 | 目标、范围、完成标准、代码锚点、非目标 | 阶段总览、跨任务验收 |
| `final-acceptance-checklist.md` | 跨任务验收 | 兼容性、回归、文档一致性、上线阻塞项 | 每个任务的细项完成标准 |

## 推荐阅读顺序

1. 先看 [execution-plan.md](./execution-plan.md)
2. 再看 [development-plan.md](./development-plan.md)
3. 若要理解完整背景，再看 [../forum-topic-notification-optimization-plan.md](../forum-topic-notification-optimization-plan.md)
4. 开工时进入具体 task 文件
5. 联调与收尾时使用 [final-acceptance-checklist.md](./final-acceptance-checklist.md)

## P0

- `p0/01-notification-type-and-outbox-contract.md`
- `p0/02-notification-composer-and-snapshot-contract.md`

## P1

- `p1/01-topic-like-and-favorite-notification.md`
- `p1/02-comment-reply-dynamic-copy.md`
- `p1/03-topic-comment-notification.md`

## P2

- `p2/01-template-default-copy-and-seed.md`
- `p2/02-template-cache-and-placeholder-validation.md`

注意：

- 本目录只覆盖论坛主题通知改造，不替代现有通知域总契约
- 通知域边界、偏好粒度、delivery 状态语义继续统一参考 [../notification-domain-contract.md](../notification-domain-contract.md)
- 若后续引入更多主题互动类型，应优先在本目录下继续扩任务，而不是把执行信息散落到多份临时文档中
- 若后续把方案推广到全通知域，优先复用“类型语义 + typed payload + composer + 模板 + fallback + 校验”这套治理机制，不要求把所有通知都改成论坛互动式标题 / 正文
- 当前任务包默认要求四类论坛主题通知一起收口；允许按依赖分 wave 实施，但不建议拆成“本轮只做一半、下一轮再补剩余产品化”的交付方式
