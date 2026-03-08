# 点赞/收藏/浏览模块治理方案（参考评论能力，不与评论耦合）

## 1. 范围边界

本次仅改造 LFV 模块自身（Like/Favorite/View），不和评论模块发生业务耦合。

- 仅“参考评论模块的治理方式”：权限前置、事务一致性、副作用拆分、幂等错误、可测试分层
- 不新增评论目标类型
- 不修改评论模块 API/DTO/Service
- 不改 `user_comment` / `user_comment_like` 表

已确认的实施约束：

- `InteractionEventEmitter` 视为废弃，不引入事件总线
- 副作用按评论模式改为“服务内直调”
- app-api 采用 3 个独立 controller 直接对外开放
- 浏览不启用去重窗口

## 2. 要借鉴的评论能力

从评论模块借鉴以下“方法论”，而不是复用评论域对象：

- `Permission` 层：用户状态、频控/配额、目标合法性
- `Core Service` 层：只负责主事务与计数
- `Interaction` 层：通知、消息 outbox、副作用编排
- `Growth` 层：成长奖励与等级刷新
- 统一业务错误语义：重复操作、未操作、目标不存在

## 3. LFV 目标结构

## 3.1 Like

- 新增：`LikePermissionService`
- 新增：`LikeInteractionService`
- 新增：`LikeGrowthService`
- 保留并瘦身：`LikeService`（只做事务写入、计数）

## 3.2 Favorite

- 新增：`FavoritePermissionService`
- 新增：`FavoriteInteractionService`
- 新增：`FavoriteGrowthService`
- 保留并瘦身：`FavoriteService`（只做事务写入、计数）

## 3.3 View

- 新增：`ViewPermissionService`
- 新增：`ViewInteractionService`（埋点/副作用）
- 可选新增：`ViewGrowthService`（若启用浏览奖励）
- 保留并瘦身：`ViewService`（浏览流水写入、历史查询）

## 4. 业务规则对齐（LFV 内部）

- 点赞/收藏前置校验：
  - 用户可用状态
  - 日限额（复用 `dailyLikeLimit` / `dailyFavoriteLimit`）
  - 目标存在且可交互
- 浏览前置校验：
  - 用户可用状态
  - 目标合法（保留当前“无效目标是否静默”的可配置策略）
- 幂等：
  - 重复点赞/收藏返回明确业务错误，不抛 500
  - 取消点赞/收藏未命中返回明确业务错误，不抛 500

## 5. API 规划（仅 LFV）

新增 app-api 三个独立模块，不依赖评论入口：

- `apps/app-api/src/modules/like/*`
- `apps/app-api/src/modules/favorite/*`
- `apps/app-api/src/modules/view/*`

最小接口集建议：

- Like：`POST /app/like`、`POST /app/like/cancel`、`GET /app/like/my`、`GET /app/like/status`
- Favorite：`POST /app/favorite`、`POST /app/favorite/cancel`、`GET /app/favorite/my`、`GET /app/favorite/status`
- View：`POST /app/view/record`、`GET /app/view/my`、`POST /app/view/delete`、`POST /app/view/clear`

## 6. 事件与副作用策略

采用已确认方案：不走事件总线，LFV 直接调用 `*InteractionService` / `*GrowthService`。

## 7. 关于 `user_comment_like` 是否合并到 `user_like`

已复评，结论见配套评估文档：

- [EVALUATION_like-data-unification-2026-03-08.md](E:/Code/es/es-server/docs/interaction-unify/EVALUATION_like-data-unification-2026-03-08.md)

当前建议：在“开发阶段可改 API”的前提下，建议合并并纳入当前迭代。

## 8. 分阶段实施

1. 分层重构（不改对外 API）
2. 新增 app-api 的 like/favorite/view 控制器
3. 回归测试与文档补齐
4. 执行点赞数据统一（含 `user_comment_like` 合并）

## 9. 验收标准

- 结构：
  - LFV 三模块均具备 Permission/Core/Interaction/Growth 分层
- 业务：
  - 幂等、计数、通知、成长不回归
  - 日限额规则生效
- 工程：
  - app-api 可直接调用 LFV，不借道评论模块
