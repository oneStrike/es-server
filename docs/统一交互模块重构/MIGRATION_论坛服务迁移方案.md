# 论坛服务迁移方案

## 1. 迁移概述

### 1.1 迁移目标
将论坛模块中的交互服务迁移到统一的 InteractionModule，实现：
- ForumTopicLikeService → InteractionModule.LikeService
- ForumTopicFavoriteService → InteractionModule.FavoriteService  
- ForumViewService → InteractionModule.ViewService

### 1.2 当前状态

| 服务 | 数据表 | 状态 |
|------|--------|------|
| ForumTopicLikeService | forum_topic_like | 使用旧表，包含计数器/日志逻辑 |
| ForumTopicFavoriteService | forum_topic_favorite | 使用旧表，包含计数器/日志逻辑 |
| ForumViewService | forum_view | 使用旧表，包含浏览统计逻辑 |

### 1.3 已完成工作
- ✅ InteractionModule 已创建，支持 FORUM_TOPIC 目标类型
- ✅ ForumInteractionEventHandler 已创建，处理事件触发计数器/日志/成长事件
- ✅ 数据迁移脚本已创建 (`prisma/scripts/migrate-interaction-data.ts`)

---

## 2. 服务分析

### 2.1 ForumTopicLikeService

**核心方法：**
| 方法 | 功能 | 迁移复杂度 |
|------|------|------------|
| `likeTopic()` | 点赞主题 | 中 - 需要触发计数器和日志 |
| `unlikeTopic()` | 取消点赞 | 中 - 需要回滚计数器和日志 |
| `toggleTopicLike()` | 切换点赞状态 | 低 - 组合方法 |
| `getTopicLikes()` | 获取点赞列表 | 低 - 查询方法 |
| `checkUserLiked()` | 检查点赞状态 | 低 - 查询方法 |

**依赖服务：**
- `ForumCounterService.updateTopicLikeRelatedCounts()` - 更新主题/用户/版块点赞计数
- `ForumUserActionLogService.createActionLog()` - 记录用户操作日志
- `UserGrowthEventService.handleEvent()` - 触发成长事件

### 2.2 ForumTopicFavoriteService

**核心方法：**
| 方法 | 功能 | 迁移复杂度 |
|------|------|------------|
| `addFavorite()` | 收藏主题 | 中 - 需要触发计数器和日志 |
| `removeFavorite()` | 取消收藏 | 中 - 需要回滚计数器和日志 |
| `toggleTopicFavorite()` | 切换收藏状态 | 低 - 组合方法 |
| `getUserFavorites()` | 获取收藏列表 | 中 - 包含关联查询 |
| `checkUserFavorited()` | 检查收藏状态 | 低 - 查询方法 |
| `getTopicFavoriteCount()` | 获取收藏数 | 低 - 统计方法 |

**依赖服务：**
- `ForumCounterService.updateTopicFavoriteRelatedCounts()` - 更新收藏计数
- `ForumUserActionLogService.createActionLog()` - 记录操作日志
- `UserGrowthEventService.handleEvent()` - 触发成长事件

### 2.3 ForumViewService

**核心方法：**
| 方法 | 功能 | 迁移复杂度 |
|------|------|------------|
| `createView()` | 创建浏览记录 | 中 - 支持主题/回复两种类型 |
| `getForumViews()` | 查询浏览记录 | 低 - 查询方法 |
| `getViewStatistics()` | 获取浏览统计 | 高 - 复杂聚合查询 |
| `getUserViewHistory()` | 获取用户浏览历史 | 低 - 查询方法 |
| `deleteForumView()` | 删除浏览记录 | 低 - 删除方法 |
| `clearOldViews()` | 清理过期记录 | 低 - 批量删除 |

**特殊逻辑：**
- 支持主题浏览和回复浏览两种类型
- 浏览统计包含去重用户数、按类型聚合等复杂查询

---

## 3. 迁移方案

### 3.1 方案选择

#### 方案 A：完全迁移（推荐）
- 删除旧服务，完全使用 InteractionModule
- 优点：代码简洁，维护成本低
- 缺点：需要一次性修改较多代码

#### 方案 B：渐进式迁移
- 保留旧服务作为适配层，内部调用 InteractionModule
- 优点：风险低，可回滚
- 缺点：增加中间层，代码冗余

#### 方案 C：双写模式
- 同时写入旧表和新表，读取从新表
- 优点：数据一致性有保障
- 缺点：性能开销大，复杂度高

**推荐方案 A**，理由：
1. 论坛服务未被 API 层直接使用，影响范围可控
2. 已有 ForumInteractionEventHandler 处理事件逻辑
3. 代码简洁，长期维护成本低

### 3.2 迁移步骤

#### Phase 1: 准备工作
1. 确保数据迁移脚本可正常运行
2. 验证 InteractionModule 功能完整性
3. 确认 ForumInteractionEventHandler 事件处理正确

#### Phase 2: 服务迁移
1. **ForumTopicLikeService 迁移**
   - 删除旧服务文件
   - 在需要的地方注入 LikeService
   - 使用 `InteractionTargetType.FORUM_TOPIC` 作为目标类型

2. **ForumTopicFavoriteService 迁移**
   - 删除旧服务文件
   - 在需要的地方注入 FavoriteService
   - 使用 `InteractionTargetType.FORUM_TOPIC` 作为目标类型

3. **ForumViewService 迁移**
   - 保留 getViewStatistics 方法（复杂统计逻辑）
   - 其他方法迁移到 ViewService

#### Phase 3: 模块更新
1. 更新 ForumModule，移除旧模块导入
2. 更新相关依赖注入

#### Phase 4: 数据迁移
1. 执行数据迁移脚本
2. 验证数据完整性

#### Phase 5: 清理工作
1. 删除旧表（可选，建议保留一段时间）
2. 更新文档

---

## 4. 详细迁移计划

### 4.1 ForumTopicLikeService 迁移

**原代码：**
```typescript
// 旧服务
async likeTopic(createForumTopicLikeDto: CreateForumTopicLikeDto) {
  const { topicId, userId } = createForumTopicLikeDto
  // ... 验证逻辑
  await this.prisma.$transaction(async (tx) => {
    await tx.forumTopicLike.create({ data: { topicId, userId } })
    await this.forumCounterService.updateTopicLikeRelatedCounts(tx, topicId, topic.userId, 1)
    await this.actionLogService.createActionLog({ userId, actionType: 'LIKE_TOPIC', ... })
  })
  await this.userGrowthEventService.handleEvent({ business: 'forum', eventKey: 'topic_like', ... })
}
```

**迁移后：**
```typescript
// 使用 InteractionModule
async likeTopic(topicId: number, userId: number) {
  await this.likeService.like(InteractionTargetType.FORUM_TOPIC, topicId, userId)
  // 计数器、日志、成长事件由 ForumInteractionEventHandler 自动处理
}
```

**映射关系：**
| 旧方法 | 新方法 |
|--------|--------|
| `likeTopic()` | `likeService.like(FORUM_TOPIC, topicId, userId)` |
| `unlikeTopic()` | `likeService.unlike(FORUM_TOPIC, topicId, userId)` |
| `toggleTopicLike()` | 需要自行实现（先检查状态再决定操作） |
| `getTopicLikes()` | `likeService.getTargetLikes(FORUM_TOPIC, topicId)` |
| `checkUserLiked()` | `likeService.checkLikeStatus(FORUM_TOPIC, topicId, userId)` |

### 4.2 ForumTopicFavoriteService 迁移

**映射关系：**
| 旧方法 | 新方法 |
|--------|--------|
| `addFavorite()` | `favoriteService.favorite(FORUM_TOPIC, topicId, userId)` |
| `removeFavorite()` | `favoriteService.unfavorite(FORUM_TOPIC, topicId, userId)` |
| `toggleTopicFavorite()` | 需要自行实现 |
| `getUserFavorites()` | `favoriteService.getUserFavorites(userId, FORUM_TOPIC)` |
| `checkUserFavorited()` | `favoriteService.checkFavoriteStatus(FORUM_TOPIC, topicId, userId)` |
| `getTopicFavoriteCount()` | 需要新增方法或使用计数器 |

### 4.3 ForumViewService 迁移

**特殊处理：**
- `createView()` 方法支持主题和回复两种类型，需要扩展 ViewService
- `getViewStatistics()` 方法包含复杂聚合，建议保留在 ForumViewService

**映射关系：**
| 旧方法 | 新方法 |
|--------|--------|
| `createView()` | `viewService.recordView(FORUM_TOPIC, topicId, userId, ...)` |
| `getForumViews()` | `viewService.getUserViews(userId, FORUM_TOPIC)` |
| `getViewStatistics()` | 保留在 ForumViewService（复杂统计） |
| `getUserViewHistory()` | `viewService.getUserViews(userId)` |
| `deleteForumView()` | `viewService.deleteView(id)` |
| `clearOldViews()` | `viewService.clearOldViews(daysOld)` |

---

## 5. 风险评估

### 5.1 风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 数据迁移失败 | 低 | 高 | 备份数据库，提供回滚脚本 |
| 事件处理遗漏 | 中 | 中 | 完整测试 ForumInteractionEventHandler |
| 计数器不一致 | 中 | 中 | 验证计数器更新逻辑 |
| API 兼容性问题 | 低 | 低 | 论坛服务未被 API 直接使用 |

### 5.2 回滚方案
1. 保留旧表结构
2. 保留旧服务代码（注释掉）
3. 数据库备份

---

## 6. 待确认事项

### 6.1 需要用户决策

1. **迁移方案选择**
   - [ ] 方案 A：完全迁移（推荐）
   - [ ] 方案 B：渐进式迁移
   - [ ] 方案 C：双写模式

2. **ForumViewService 处理方式**
   - [ ] 完全迁移到 ViewService
   - [ ] 保留 getViewStatistics 方法在 ForumViewService
   - [ ] 其他方案：______

3. **旧表处理**
   - [ ] 迁移后立即删除
   - [ ] 保留 1 周后删除
   - [ ] 保留 1 个月后删除
   - [ ] 不删除，仅标记废弃

4. **toggle 方法处理**
   - [ ] 在 InteractionModule 基类添加 toggle 方法
   - [ ] 在业务层自行实现 toggle 逻辑
   - [ ] 不需要 toggle 方法

### 6.2 技术问题

1. ViewService 是否需要支持回复浏览类型？
2. 收藏列表查询是否需要关联查询主题详情？
3. 是否需要保留操作日志功能？

---

## 7. 时间估算

| 阶段 | 预计时间 |
|------|----------|
| Phase 1: 准备工作 | 0.5 小时 |
| Phase 2: 服务迁移 | 2 小时 |
| Phase 3: 模块更新 | 0.5 小时 |
| Phase 4: 数据迁移 | 1 小时 |
| Phase 5: 清理工作 | 0.5 小时 |
| **总计** | **4.5 小时** |

---

## 8. 附录

### 8.1 相关文件列表

**需要修改的文件：**
- `libs/forum/src/topic-like/forum-topic-like.service.ts`
- `libs/forum/src/topic-like/forum-topic-like.module.ts`
- `libs/forum/src/topic-favorite/forum-topic-favorite.service.ts`
- `libs/forum/src/topic-favorite/forum-topic-favorite.module.ts`
- `libs/forum/src/view/forum-view.service.ts`
- `libs/forum/src/view/forum-view.module.ts`
- `libs/forum/src/forum.module.ts`
- `libs/forum/src/interaction/forum-interaction.handler.ts`

**可能需要修改的文件：**
- `libs/interaction/src/like/like.service.ts`
- `libs/interaction/src/favorite/favorite.service.ts`
- `libs/interaction/src/view/view.service.ts`
- `libs/interaction/src/base-interaction.service.ts`

### 8.2 数据迁移 SQL 参考

```sql
-- 迁移点赞数据
INSERT INTO user_like (target_type, target_id, user_id, created_at)
SELECT 5, topic_id, user_id, created_at FROM forum_topic_like;

-- 迁移收藏数据
INSERT INTO user_favorite (target_type, target_id, user_id, created_at)
SELECT 5, topic_id, user_id, created_at FROM forum_topic_favorite;

-- 迁移浏览数据
INSERT INTO user_view (target_type, target_id, user_id, viewed_at)
SELECT 5, topic_id, user_id, viewed_at FROM forum_view;
```
