# 收藏模块对齐点赞模块差异与改造建议（待确认）

更新时间：2026-03-11

## 1. 范围说明

本文对比以下现状实现，输出差异与对齐方案，待确认后再进入改造：

- 点赞模块（Controller + Service + DTO + Growth/Permission/Interaction）
- 收藏模块（Controller + Service + DTO + Growth）

## 2. 现状差异清单

| 维度 | 点赞模块现状 | 收藏模块现状 | 差异/影响 |
| --- | --- | --- | --- |
| 路由结构 | `POST /app/like`、`POST /app/like/cancel`、`GET /app/like/status`、`GET /app/like/my` | `POST /app/favorite/favorite`、`POST /app/favorite/cancel`、`GET /app/favorite/status`、`GET /app/favorite/my` | 收藏存在重复动词路径，且整体命名不一致 |
| 创建接口返回 | Controller 返回 `{ id: targetId }` | Controller 直接返回 `FavoriteService.favorite()`，实际为 `void` | API 文档与实际返回不一致，前端无法稳定依赖 |
| 状态接口返回 | `{ targetId, isLiked }` | `{ isFavorited }`，文档标注 `Boolean` | 返回结构不一致且文档模型不准确 |
| DTO/枚举复用 | 使用 `InteractionTargetTypeEnum` 与 `InteractionTargetBodyDto` | 使用 `FavoriteTargetTypeEnum` 与 `FavoriteTargetDto` | 同一枚举含义重复，DTO 未复用 |
| 目标解析与校验 | `InteractionTargetResolverService` + `InteractionTargetAccessService` | `FavoriteService` 内部 `ensureTargetExists` | 逻辑重复，未来扩展易分叉 |
| 计数更新 | `InteractionTargetAccessService.applyTargetCountDelta` | `work`/`forumTopic` 分支调用 `applyCountDelta` | 更新路径不统一，计数规则易不一致 |
| 权限与限流 | `LikePermissionService` 校验用户状态与 `dailyLikeLimit` | 无权限校验，无 `dailyFavoriteLimit` | 收藏缺少用户状态与每日上限限制 |
| 通知逻辑 | `LikeInteractionService` 统一封装通知 | 收藏通知写在 `FavoriteService` 内 | 职责分离不一致，难以复用与测试 |
| 成长奖励映射 | 使用 `resolveInteractionGrowthRuleType('like', targetType)` | 使用 `FAVORITE_GROWTH_RULE_TYPE_MAP` | 规则映射重复，维护成本上升 |
| 数据模型 | `user_like` 含 `sceneType/sceneId/commentLevel` | `user_favorite` 仅 `targetType/targetId` | 收藏缺少场景维度，统计维度与点赞不一致 |
| 列表查询 | `LikeListQueryDto` 中 `targetType` 为可选 | `FavoritePageQueryDto` 中 `targetType` 为必填 | 收藏列表强制分类型，使用体验不一致 |
| 列表返回 | 返回通用字段（不拼作品简要信息） | 额外拼装 `work` 简要信息 | 返回结构与对齐目标不一致 |

## 3. 对齐目标（建议）

以点赞模块为基准，收藏模块应实现以下一致性：

- 路由命名与入参与返回结构一致
- 统一使用 `InteractionTargetTypeEnum` 与公共目标 DTO
- 统一目标解析、计数更新、通知、成长奖励的服务分层
- 补齐用户状态与每日收藏限制
- 统一列表分页与筛选体验
- 视需要补齐 `sceneType/sceneId` 以对齐统计维度

## 4. 改造建议（分阶段）

### 阶段一：代码结构对齐（不改表结构）

1. 路由对齐：新增 `POST /app/favorite`，保留或废弃 `POST /app/favorite/favorite` 需确认。
2. DTO 对齐：改用公共 `InteractionTargetBodyDto`，新增 `CreateFavoriteBodyDto`、`CancelFavoriteBodyDto`、`FavoriteStatusQueryDto`、`FavoriteListQueryDto`。
3. 返回结构对齐：状态接口返回 `{ targetId, isFavorited }`，创建接口返回 `{ id: targetId }`。
4. 权限补齐：新增 `FavoritePermissionService`，校验用户状态与 `dailyFavoriteLimit`。
5. 目标解析对齐：复用 `InteractionTargetAccessService` 做存在性校验与计数更新。
6. 通知与成长拆分：新增 `FavoriteInteractionService`，成长奖励改用 `resolveInteractionGrowthRuleType('favorite', targetType)`。
7. 列表筛选对齐：`targetType` 改为可选，分页与排序对齐点赞（按 `createdAt desc`）。

### 阶段二：数据模型对齐（可选，涉及迁移）

1. 为 `user_favorite` 增加 `sceneType`、`sceneId` 字段。
2. 回填规则：`sceneType` 由 `targetType` 映射（漫画/小说/主题），`sceneId = targetId`。
3. DTO 与列表响应可追加 `sceneType/sceneId`，与点赞保持同维度统计能力。

## 5. 影响评估

需要确认以下变更对客户端/数据的影响：

- 路由变更是否允许兼容期
- 状态与创建接口返回结构是否可以统一
- 收藏列表是否允许不传 `targetType`
- 是否需要对齐统计维度并新增字段

## 6. 待确认项

1. 路由策略：保留 `POST /app/favorite/favorite` 作为兼容入口，还是直接切换到 `POST /app/favorite`。
2. 枚举策略：收藏是否切换到 `InteractionTargetTypeEnum`（值不变，仅类型统一）。
3. 权限策略：是否补齐 `dailyFavoriteLimit` 与用户状态校验。
4. 数据模型：是否需要 `sceneType/sceneId` 的迁移与回填。
5. 列表返回：是否保留 `work` 简要信息作为扩展字段，还是与点赞严格对齐仅返回基础字段。

