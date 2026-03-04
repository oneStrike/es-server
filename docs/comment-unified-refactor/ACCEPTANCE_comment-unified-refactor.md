# 验收记录：评论模块统一重构

## 本轮完成项
- 已完成 T1：评论域 Schema 改造与迁移脚本初版落地。
  - `work` 新增 `comment_count` 字段与索引。
  - `forum_topic` 新增 `comment_count` 字段与索引。
  - `user_comment` 新增目标可见性与时间维度复合索引。
  - 新增 Prisma 迁移：`20260304143000_unify_comment_schema`。
  - 新增全量迁移脚本：`prisma/scripts/comment/full-migrate-to-user-comment.ts`。
- 已完成 T2：统一评论服务能力扩展。
  - `CommentService` 增加审核策略、可见性计数、管理端分页/详情/审核/隐藏/删除/重算。
  - 审核默认状态改为读取 `contentReviewPolicy` 决策。
  - 增加用户状态、目标可评论状态、回复目标一致性校验。
  - `CommentLikeService`、`CommentReportService` 统一异常语义并补充处理校验。
- 已完成 T3/T4：C 端与管理端统一评论控制器落地。
  - App 新增：`app/work/comment` 控制器。
  - Admin 新增：`admin/content/comment` 控制器与模块接入。

## 验证结果
- `pnpm prisma:generate` 执行通过。
- `pnpm type-check` 执行通过。

## 待完成项
- T5：论坛旧回复链路（reply/reply-like/report/notification/search/counter）深度替换仍需继续实施。
- T6-T9：灰度双写、生产迁移对账、切流下线、最终交付文档待下一轮完成。
