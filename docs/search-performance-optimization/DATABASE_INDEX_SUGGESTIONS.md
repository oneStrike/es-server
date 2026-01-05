# 搜索性能优化 - 数据库索引建议

## 问题概述

当前搜索功能存在性能问题，主要原因是缺少合适的数据库索引，导致查询效率低下。

## 当前索引分析

### ForumTopic 表已有索引
- ✅ `sectionId` - 单列索引
- ✅ `userId` - 单列索引
- ✅ `isPinned, createdAt` - 复合索引
- ✅ `isFeatured, createdAt` - 复合索引
- ✅ `isLocked` - 单列索引
- ✅ `isHidden` - 单列索引
- ✅ `auditStatus` - 单列索引
- ✅ `viewCount` - 单列索引
- ✅ `replyCount` - 单列索引
- ✅ `likeCount` - 单列索引
- ✅ `favoriteCount` - 单列索引
- ✅ `lastReplyAt` - 单列索引
- ✅ `createdAt` - 单列索引
- ✅ `updatedAt` - 单列索引
- ✅ `deletedAt` - 单列索引
- ✅ `sectionId, isPinned, createdAt` - 复合索引
- ✅ `sectionId, isFeatured, createdAt` - 复合索引

### ForumReply 表已有索引
- ✅ `topicId` - 单列索引
- ✅ `userId` - 单列索引
- ✅ `floor` - 单列索引
- ✅ `replyToId` - 单列索引
- ✅ `isHidden` - 单列索引
- ✅ `auditStatus` - 单列索引
- ✅ `likeCount` - 单列索引
- ✅ `createdAt` - 单列索引
- ✅ `updatedAt` - 单列索引
- ✅ `deletedAt` - 单列索引
- ✅ `topicId, floor` - 复合索引
- ✅ `topicId, createdAt` - 复合索引

## 建议添加的索引

### 1. 全文索引（GIN 索引）- 高优先级

用于优化 `LIKE '%keyword%'` 查询，这是搜索功能的核心瓶颈。

```sql
-- ForumTopic 表全文索引
CREATE INDEX idx_forum_topic_title_gin ON forum_topic USING gin(to_tsvector('simple', title));
CREATE INDEX idx_forum_topic_content_gin ON forum_topic USING gin(to_tsvector('simple', content));

-- ForumReply 表全文索引
CREATE INDEX idx_forum_reply_content_gin ON forum_reply USING gin(to_tsvector('simple', content));
```

**注意**：添加全文索引后，需要修改查询逻辑以使用 `tsvector` 搜索，而不是简单的 `LIKE` 或 `contains`。

### 2. 复合索引 - 中优先级

优化常见查询组合，减少索引扫描范围。

```sql
-- ForumTopic: 搜索时常用的过滤条件组合
CREATE INDEX idx_forum_topic_deleted_section_created ON forum_topic(deleted_at, section_id, created_at DESC);

-- ForumTopic: 热门排序查询
CREATE INDEX idx_forum_topic_deleted_reply_like_view ON forum_topic(deleted_at, reply_count DESC, like_count DESC, view_count DESC);

-- ForumReply: 搜索时常用的过滤条件组合
CREATE INDEX idx_forum_reply_deleted_topic_created ON forum_reply(deleted_at, topic_id, created_at DESC);
```

### 3. 部分索引 - 低优先级

针对特定查询场景优化，减少索引大小。

```sql
-- 只为未删除的记录创建索引
CREATE INDEX idx_forum_topic_active_created ON forum_topic(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_forum_reply_active_created ON forum_reply(created_at DESC) WHERE deleted_at IS NULL;
```

## 实施建议

### 阶段 1：立即实施（高优先级）
1. 添加全文索引（如果数据量不大，可以在业务低峰期执行）
2. 修改搜索查询逻辑，使用全文搜索替代 `contains`

### 阶段 2：短期优化（中优先级）
1. 添加复合索引 `idx_forum_topic_deleted_section_created`
2. 添加复合索引 `idx_forum_reply_deleted_topic_created`

### 阶段 3：长期优化（低优先级）
1. 根据实际查询模式调整索引
2. 考虑使用部分索引进一步优化

## 全文搜索实现示例

如果使用全文索引，搜索逻辑需要修改：

```typescript
// 使用 Prisma 原生查询
const topicResults = await this.prisma.$queryRaw`
  SELECT * FROM forum_topic
  WHERE deleted_at IS NULL
    AND (
      to_tsvector('simple', title) @@ plainto_tsquery('simple', ${dto.keyword})
      OR to_tsvector('simple', content) @@ plainto_tsquery('simple', ${dto.keyword})
    )
  ORDER BY created_at DESC
  LIMIT ${pageSize} OFFSET ${offset}
`
```

## 性能监控建议

1. 使用 `EXPLAIN ANALYZE` 分析查询执行计划
2. 监控索引使用情况，移除未使用的索引
3. 定期执行 `VACUUM ANALYZE` 更新统计信息

## 注意事项

1. **索引维护成本**：索引会增加写入开销，需要权衡
2. **存储空间**：GIN 索引占用较多存储空间
3. **查询修改**：使用全文索引需要修改查询逻辑
4. **测试验证**：在生产环境实施前，先在测试环境验证效果
