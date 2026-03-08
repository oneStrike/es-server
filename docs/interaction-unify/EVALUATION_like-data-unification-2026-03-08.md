# 点赞数据统一评估（含 `user_comment_like` 合并）

## 1. 评估结论

在当前“开发阶段、允许修改对外 API”的前提下，建议把 `user_comment_like` 合并到 `user_like`，纳入当前迭代实施。

原因：

- 当前点赞链路分裂为 3 条，重复逻辑明显且维护成本高。
- 尚未进入稳定上线期，迁移成本和回滚成本都可控。
- 合并后可统一权限、幂等、计数、通知、成长奖励和查询接口。

## 2. 当前分裂现状

- 通用点赞：`user_like` + `LikeService`
- 评论点赞：`user_comment_like` + `CommentInteractionService.likeComment`
- 论坛回复点赞：`user_comment_like` + `ForumReplyLikeService.likeReply`

直接问题：

- 表结构分裂：`user_like(targetType,targetId,userId)` vs `user_comment_like(commentId,userId)`
- 业务实现分裂：幂等处理、计数更新、奖励规则、接口语义不一致
- 统计口径分裂：`dailyLikeLimit` 目前需跨 `user_like` 和 `user_comment_like` 统计

## 3. 合并可行性

技术上可行，且复杂度中等。

核心映射：

- `user_comment_like.comment_id` -> `user_like.target_id`
- 新增点赞目标类型：`InteractionTargetTypeEnum.COMMENT = 6`
- `user_like.target_type = 6` 表示点赞对象是 `user_comment.id`

说明：

- `user_comment` 已统一承载内容评论与论坛回复，`id` 全局唯一，可直接映射。
- 评论/回复的奖励差异可在服务层按被点赞 `user_comment` 的属性再分流，不依赖两张点赞表。

## 4. 改造影响面

Schema / Prisma：

- 更新 `InteractionTargetTypeEnum`（新增 COMMENT）
- `user_like` 注释与约束说明更新（支持评论目标）
- 删除 `user_comment_like` 模型与 `AppUser.userCommentLikes` 关系
- 生成并执行迁移（含历史数据搬迁）

服务层：

- `CommentInteractionService`：点赞/取消点赞改为走统一点赞服务或统一点赞仓储
- `ForumReplyLikeService`：改为统一点赞链路（保留论坛动作日志与成长规则）
- `UserLevelRuleService`：`dailyLikeLimit` 统计改为单表 `user_like`

API 层（允许变更）：

- 评论点赞接口、论坛回复点赞接口与通用点赞接口做统一参数规范
- 论坛回复取消点赞当前按“点赞记录 id”删除，建议改为按 `targetType/targetId` 删除

## 5. 迁移方案（开发阶段推荐一次性切换）

1. Schema 迁移：
   - 新增/更新枚举与模型定义
2. 数据搬迁 SQL：
   - `INSERT INTO user_like(target_type,target_id,user_id,created_at) SELECT 6, comment_id, user_id, created_at FROM user_comment_like ON CONFLICT DO NOTHING`
3. 代码切换：
   - 评论/回复点赞统一到 `LikeService`（或共享底层方法）
4. 删除旧表引用：
   - 删除 `user_comment_like` 读写路径与 Prisma 关系
5. 清理旧表（开发环境可直接 drop）

## 6. 风险与控制

- 风险 1：奖励规则回归
  - 控制：按 `user_comment` 类型与上下文补齐规则分流测试（评论被赞、回复被赞）
- 风险 2：论坛回复点赞 API 变更影响前端
  - 控制：同步发布接口变更说明；过渡期保留兼容路由 1 个版本
- 风险 3：统计口径变化
  - 控制：迁移前后对账（总数、按用户、按目标抽样）
- 风险 4：并发重复写入
  - 控制：继续依赖 `@@unique([targetType,targetId,userId])` + 业务错误映射

## 7. 预计工作量

- 开发：1.5 ~ 2.5 人日
- 联调与回归：1 人日
- 合计：约 3 人日（开发阶段）

## 8. 建议执行顺序

1. 先完成 LFV 分层改造（已进行中）
2. 紧接执行点赞统一合并（本评估项）
3. 最后做接口文档和前端联调

