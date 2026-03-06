# 互动分表统一改造方案（评论/点赞/收藏/浏览/举报）

## 1. 目标澄清

本方案采用“分表统一”，不是“单表合并”。

- 评论、点赞、收藏、浏览、举报各自保留独立数据表
- 统一建模规范（字段、枚举、索引、审计、软删、命名）
- 统一服务层抽象与迁移流程，降低重复代码与维护成本

## 2. 现状问题

当前问题不是“表太多”，而是“标准不一”：

- 表间字段语义不完全对齐（如 status/audit/时间字段）
- 唯一约束与索引策略不一致
- forum/work/comment 举报链路割裂
- 服务层分别实现，重复校验逻辑较多

## 3. 目标架构（分表）

## 3.1 表保留策略

保留并规范以下表：

- 评论主表：`user_comment`
- 点赞表：`user_like`
- 收藏表：`user_favorite`
- 浏览表：`user_view`
- 举报表：`user_report`（新增统一举报表）
- 评论点赞表：`user_comment_like`（保留，避免评论点赞语义混淆）

说明：

- 原 `user_comment_report` 与 `forum_report`、`work_comment_report` 最终汇总到 `user_report`
- 评论仍由 `user_comment` 作为主数据表，不并入其他行为表

## 3.2 统一字段规范

所有行为表统一以下基础字段（按需裁剪）：

- `id`（主键）
- `targetType`、`targetId`（多态目标）
- `userId`（行为发起人）
- `createdAt`
- `updatedAt`（除 append-only 表可选）
- `deletedAt`（仅需要软删的行为表启用）

## 3.3 统一枚举

- `InteractionTargetTypeEnum` 继续使用现有 1~5
- 新增 `ReportTargetTypeEnum`（comment/topic/reply/user）
- `ReportStatusEnum` 全量统一为：`pending/processing/resolved/rejected`
- 审核字段命名统一：`auditStatus/auditById/auditAt/auditReason`

## 4. 分表设计建议

## 4.1 `user_comment`（保留主表）

沿用现有设计（已较完整）：

- 保留楼层/回复链：`floor/replyToId/actualReplyToId`
- 保留审核与敏感词字段
- 保持评论可见性索引

仅建议补齐：

- 评论举报聚合关系从 `user_comment_report[]` 调整为 `user_report[]`（按 `targetType=comment`）

## 4.2 `user_like`

保留独立表，统一约束：

- 唯一：`@@unique([targetType, targetId, userId])`
- 索引：`@@index([targetType, targetId])`、`@@index([userId, createdAt])`
- 字段保持轻量（不引入多余状态）

## 4.3 `user_favorite`

保留独立表，模式与 `user_like` 对齐：

- 唯一：`@@unique([targetType, targetId, userId])`
- 索引：`@@index([targetType, targetId])`、`@@index([userId, createdAt])`

## 4.4 `user_view`

保留独立表，作为行为流水：

- 不做唯一约束
- 保留 `ipAddress/device/userAgent/viewedAt`
- 索引建议：
  - `@@index([userId, viewedAt])`
  - `@@index([targetType, targetId, viewedAt])`
- 增加清理策略：只保留近 N 天明细（例如 90/180 天）

## 4.5 `user_report`（新增统一举报表）

目标：替代三套举报表，统一举报域模型。

建议字段：

- `id`
- `reporterId`
- `handlerId`
- `targetType`（report 目标类型：comment/topic/reply/user）
- `targetId`
- `reason`
- `description`
- `evidenceUrl`
- `status`
- `handlingNote`
- `handledAt`
- `createdAt`
- `updatedAt`

约束建议：

- 基础索引：`reporterId/status/createdAt/targetType+targetId`
- 防重复举报：同一 `reporterId+targetType+targetId` 在 `pending/processing` 下不可重复
  - 使用 migration SQL 建部分唯一索引

## 5. 迁移与改造路径

## 阶段 A：Schema 标准化

- 新建 `user_report` 模型
- 保留 `user_comment` / `user_like` / `user_favorite` / `user_view` / `user_comment_like`
- 在 `AppUser` 增加 `userReports/handledUserReports` 关系

## 阶段 B：数据迁移

迁移来源：

- `user_comment_report` -> `user_report`（`targetType=comment`）
- `forum_report` -> `user_report`（映射 topic/reply/user）
- `work_comment_report` -> `user_report`（`targetType=comment`，目标转 user_comment id 或保留旧 comment id + sourceType）

建议迁移脚本：

- `prisma/scripts/interaction/migrate-report-to-user-report.ts`
- 分批按主键分页迁移
- 迁移后执行对账 SQL

## 阶段 C：双写

先改服务层为双写（读仍旧表）：

- `CommentInteractionService`（report）
- `ForumReportService`
- `WorkCommentService`（createCommentReport/handleCommentReport）

## 阶段 D：切读

逐步切换查询到 `user_report`：

1. 后台举报列表
2. 举报详情
3. 用户举报记录

确认稳定后下线：

- `user_comment_report`
- `forum_report`
- `work_comment_report`

## 6. 代码改造清单

- `prisma/models/app/user-report.prisma`（新增）
- `prisma/models/app/app-user.prisma`（新增关系）
- `libs/interaction/src/comment/comment-interaction.service.ts`
- `libs/forum/src/report/forum-report.service.ts`
- `libs/content/src/work/comment/work-comment.service.ts`
- DTO 层：统一 report DTO 字段命名和 status 校验

## 7. 验收标准

- 举报数据：新旧总量一致、状态分布一致、抽样详情一致
- 点赞/收藏/浏览：行为与计数不回归
- 关键接口 P95 不劣化
- 无重复举报异常放大

## 8. 回滚策略

- 双写期间随时回退读路径
- 新表异常时关闭写开关，旧链路继续可用
- 旧举报表保留至少 1 个发布周期再删除

## 9. 结论

本方案满足你的要求：

- 各行为保留独立表
- 重点统一“举报域”并消除三套举报逻辑分裂
- 评论继续以 `user_comment` 为核心，不做高风险物理合表
- 通过统一规范 + 分阶段迁移实现低风险落地
