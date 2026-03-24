# Work Forum Fixes Consensus

## 目标

本次任务以“修复现有缺陷并收敛接口契约”为目标，不调整数据库 Schema，不做无关模块重构。

## 明确需求

1. 修复作品发布状态与论坛板块启停同步问题。
2. 修复 forum topic 删除时误删其他目标评论的问题。
3. 收紧 app 侧作品与 forum topic 的可见性校验。
4. 收窄 forum topic 更新入参，禁止通过更新接口迁移发帖人和板块。
5. 补齐 forum comment 相关计数、最近评论、section 最近发帖时间闭环。
6. 修复 work / forum / like / favorite 等接口与 DTO 文档不一致问题。
7. 补齐 app 侧 forum topic 的基础接口能力。
8. 补充本地设计、任务、验收与总结文档。

## 技术约束

- Service 层继续使用领域 type 或 Drizzle 推导类型，不直接引用 apps DTO。
- 新增 DTO 优先基于 `BaseWorkDto`、`BaseForumTopicDto`、`BaseForumSectionDto` 等基类通过映射类型组合。
- 所有新增写路径遵循 `withErrorHandling + assertAffectedRows + transaction` 规范。
- 不回滚、不覆盖用户已有未提交改动。

## 验收标准

- admin 更新作品发布状态后，关联 forum section `isEnabled` 同步变化。
- 删除 forum topic 时，仅删除 `targetType=FORUM_TOPIC` 的关联评论。
- app 侧无法访问未发布作品详情/作品论坛信息，也无法对隐藏、未审核、禁用板块下的主题执行交互。
- forum topic 更新接口不再允许修改 `sectionId` 与 `userId`。
- forum topic 评论创建/删除后，`commentCount/lastCommentAt/lastCommentUserId` 以及 section 侧 `commentCount/lastPostAt/lastTopicId` 能闭环更新。
- app/admin 文档声明的 DTO 与实际响应结构一致或兼容。
- app 新增 forum topic page/detail/create/update/delete 接口。

## 边界说明

- 原 work-forum fixes 任务不做数据库迁移；当前 forum `reply -> comment` 语义收口已另行通过 migration 落地。
- 不承诺一次性补齐全量自动化测试，但会做最小可运行验证。
