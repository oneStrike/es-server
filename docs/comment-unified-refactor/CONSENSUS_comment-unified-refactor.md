# 共识文档：评论模块统一重构

## 1. 最终目标
- 建立统一评论域，单一来源为 `user_comment`、`user_comment_like`、`user_comment_report`。
- 全量覆盖五类目标：漫画、小说、漫画章节、小说章节、论坛帖子。
- 同时交付 C 端与管理端接口，替代分散的旧评论链路。

## 2. 统一业务规则

### 2.1 目标与关联规则
- 统一使用 `targetType + targetId` 关联评论目标。
- `targetType` 固定为：
  - 1 漫画
  - 2 小说
  - 3 漫画章节
  - 4 小说章节
  - 5 论坛主题
- 目标存在性与类型一致性由 `TargetValidatorRegistry` 分派校验器执行。

### 2.2 回复模型规则
- 一级评论：`replyToId = null`，`actualReplyToId = null`，`floor` 递增。
- 二级回复：`replyToId` 指向直接回复对象，`actualReplyToId` 固定指向一级评论。
- 不开放无限级嵌套，统一楼中楼二层语义。

### 2.3 审核与可见性规则
- 新评论审核状态由 `contentReviewPolicy` 决定（含敏感词策略联动）。
- 对外可见条件统一为：`auditStatus=APPROVED` 且 `isHidden=false` 且 `deletedAt is null`。

### 2.4 计数规则
- 新增 `commentCount`：
  - `work.comment_count`
  - `forum_topic.comment_count`
- `work_chapter.comment_count` 复用现有字段。
- 评论新增/删除/审核状态变化/隐藏状态变化时，统一驱动计数增减或重算。

## 3. 数据迁移共识

### 3.1 迁移来源
- `work_comment` 全量迁移到 `user_comment`。
- `forum_reply` 全量迁移到 `user_comment`。
- `forum_reply_like` 迁移到 `user_comment_like`。
- 与回复关联的举报记录统一映射到 `user_comment_report`。

### 3.2 迁移原则
- 先结构变更，再历史回填，再增量双写，再切读，再切写，最后下线旧表。
- 迁移过程全程保留校验与回滚开关。
- 迁移后以统一评论主表为权威数据源。

## 4. 服务与接口共识

### 4.1 服务层
- 统一评论服务承担所有目标类型评论能力，不再保留 `WorkCommentService` 与 `ForumReplyService` 为主链路。
- 复用现有能力：
  - 敏感词检测
  - 系统配置
  - 用户状态与权限校验
  - 计数器服务（扩展后）
  - 操作审计日志

### 4.2 控制器层
- C 端：统一评论控制器，提供创建、删除、分页、回复分页、点赞、举报。
- 管理端：统一评论管理控制器，提供分页治理、审核、隐藏、删除、举报处理、计数重算。
- 旧路由保留短期兼容别名，最终统一收口。

## 5. 技术约束
- 继续使用 Nest + Prisma + DTO 校验 + Swagger 装饰器模式。
- 继续使用项目内枚举/常量规范，不引入 Prisma enum。
- 保持异常返回风格与审计日志风格一致。

## 6. 验收标准
- 五类评论目标全部可发评、查评、删评、审核治理。
- 统一评论主表可完整承载历史数据且对账通过。
- C 端和管理端接口均切换至统一评论服务。
- `work_comment`、`forum_reply` 不再承担主业务写入。
- 关键指标（评论总量、目标评论数、可见评论数）与旧系统对账误差为 0。
