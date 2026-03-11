# 点赞模块对齐收藏模块调整方案（待确认）

更新时间：2026-03-11

## 1. 目标与范围

目标：以“收藏模块”的设计为基准，调整“点赞模块”的接口、DTO、服务分层与返回结构，形成一致的交互体验与维护方式。

范围：仅覆盖点赞模块，不改收藏模块实现。

## 2. 现状差异（简表）

| 维度 | 收藏模块现状 | 点赞模块现状 | 差异影响 |
| --- | --- | --- | --- |
| 路由结构 | `POST /app/favorite/favorite` | `POST /app/like` | 路由命名风格不一致 |
| 创建接口返回 | Controller 直接返回 service（实际为 `void`） | Controller 返回 `{ id: targetId }` | 返回结构不一致 |
| 状态接口返回 | `{ isFavorited }` | `{ targetId, isLiked }` | 返回字段不一致 |
| DTO/枚举 | `FavoriteTargetDto` + `FavoriteTargetTypeEnum` | `LikeTargetBodyDto` + `InteractionTargetTypeEnum` | 目标 DTO 与枚举风格不同 |
| 目标校验 | Service 内部 `ensureTargetExists` | 额外目标解析层 | 分层结构不同 |
| 权限校验 | 无权限与限流 | 存在用户状态与每日上限校验 | 业务规则不一致 |
| 通知逻辑 | 仅论坛主题收藏通知 | 论坛主题与评论点赞通知 | 行为差异 |
| 成长奖励 | `FAVORITE_GROWTH_RULE_TYPE_MAP` | 使用统一规则映射函数 | 规则映射方式不一致 |
| 数据模型 | `user_favorite` 无场景维度 | `user_like` 含 `sceneType/sceneId/commentLevel` | 统计维度不一致 |
| 列表查询 | `targetType` 为必填 | `targetType` 可选 | 查询体验不一致 |
| 列表返回 | 作品类型补充 `work` 简要信息 | 无额外补充信息 | 返回风格不一致 |

## 3. 对齐目标（以收藏为基准）

- 路由命名风格统一
- DTO 命名与参数风格统一
- 统一返回结构与接口行为
- 服务结构趋于收藏模块的简洁分层
- 列表查询与返回风格一致

## 4. 调整方案（建议）

### 4.1 接口路由与返回

已确认方案：

- 路由替换为 `POST /app/like/like`，旧路由不保留
- 状态接口仅返回 `{ isLiked }`，不再返回 `targetId`
- 创建接口保持现状，不做调整

### 4.2 DTO 与枚举对齐

建议方案：

- 新增 `LikeTargetDto`，字段与 `FavoriteTargetDto` 风格一致
- 统一 DTO 命名：`LikeTargetDto`、`LikePageQueryDto`、`LikeStatusResponseDto`
- 目标类型枚举保持 `InteractionTargetTypeEnum` 不变（覆盖范围更广），但文档与 DTO 命名风格向收藏靠拢

### 4.3 目标校验与计数更新

建议方案：

- 目标校验与计数更新逻辑内聚回 `LikeService`，对外表现保持收藏式调用
- 统一为“收藏式”的目标存在性校验与计数更新流程

### 4.4 权限与限流

已确认方案：

- 移除点赞权限与限流校验，与收藏保持“无权限校验”一致

### 4.5 通知策略

已确认方案：

- 点赞对论坛主题与评论都发送通知

### 4.6 成长奖励

建议方案：

- 移除统一规则映射函数依赖
- 点赞模块新增常量映射，风格参考收藏模块 `favorite.constant.ts`

### 4.7 列表查询与返回

已确认方案：

- `targetType` 为必填，与收藏一致
- 点赞列表补充作品简要信息（仅漫画/小说）
- 其它类型保持基础字段返回

### 4.8 数据模型维度

已确认方案：

- 数据模型维度保持不变，继续保留 `sceneType/sceneId/commentLevel`

## 5. 风险与影响

- 路由变更可能影响客户端兼容性
- 删除 `targetId` 或 `targetType` 返回字段会影响前端依赖
- 移除权限校验可能放大恶意点赞行为
- 取消评论点赞通知会影响用户体验预期

## 6. 已确认决策

1. 路由改为 `POST /app/like/like`，旧路由不保留。
2. 状态接口仅返回 `{ isLiked }`。
3. 创建接口保持现状，不做调整。
4. `targetType` 在点赞列表中为必填。
5. 移除点赞权限与限流校验。
6. 点赞对论坛主题与评论都发送通知。
7. 点赞列表补充作品简要信息（仅漫画/小说）。
8. 数据模型维度保持不变，保留 `sceneType/sceneId/commentLevel`。
