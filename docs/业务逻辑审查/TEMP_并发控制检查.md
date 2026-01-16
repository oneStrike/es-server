# 并发控制检查

## 1. 检查概述

### 1.1 检查目标

评估系统中的并发控制机制，识别潜在的竞态条件、数据一致性问题，并提供改进建议。

### 1.2 检查范围

- 事务使用情况
- 锁机制（乐观锁、悲观锁）
- 竞态条件风险
- 缓存并发控制
- 并发安全的数据访问

### 1.3 检查方法

- 代码审查：分析事务使用和锁机制
- 数据模型分析：检查并发控制字段
- 业务流程分析：识别竞态条件

## 2. 事务使用情况分析

### 2.1 事务使用统计

| 服务 | 方法 | 使用事务 | 事务范围 |
|-----|------|---------|---------|
| PointService | addPoints | ✅ | 积分记录创建 + 用户积分更新 |
| PointService | consumePoints | ✅ | 积分记录创建 + 用户积分更新 |
| ExperienceService | addExperience | ✅ | 经验记录创建 + 用户经验更新 |
| ForumTopicLikeService | likeTopic | ✅ | 点赞记录创建 + 主题点赞数更新 |
| ForumTopicLikeService | unlikeTopic | ✅ | 点赞记录删除 + 主题点赞数更新 |
| ForumReplyLikeService | likeReply | ✅ | 点赞记录创建 + 回复点赞数更新 |
| ForumReplyLikeService | unlikeReply | ✅ | 点赞记录删除 + 回复点赞数更新 |
| ForumTopicFavoriteService | addFavorite | ✅ | 收藏记录创建 + 主题收藏数更新 |
| ForumTopicFavoriteService | removeFavorite | ✅ | 收藏记录删除 + 主题收藏数更新 |
| ForumReplyService | createForumReply | ✅ | 回复创建 + 多个统计字段更新 |
| ForumTopicService | createForumTopic | ❌ | 主题创建 + 积分增加 |

### 2.2 事务使用评估

**评估结果**: ⚠️ 需要改进

**优点**:
- 大部分关键操作使用事务保护
- 事务范围合理，包含相关联的数据更新

**问题**:
1. **主题创建缺少事务保护**: 创建主题和增加积分不在同一个事务中
2. **事务隔离级别未明确指定**: 使用默认的隔离级别，可能导致幻读等问题

## 3. 锁机制分析

### 3.1 乐观锁

#### 3.1.1 数据模型中的乐观锁字段

**ForumTopic模型**:
```prisma
/// 版本号（用于乐观锁）
version Int @default(0)
```

**ForumProfile模型**: 无版本字段

**ForumReply模型**: 无版本字段

#### 3.1.2 乐观锁使用情况

| 模型 | 版本字段 | 实际使用 | 评估 |
|-----|---------|---------|------|
| ForumTopic | version | ❌ 未使用 | 🔴 严重 |
| ForumProfile | 无 | N/A | 🟡 中 |
| ForumReply | 无 | N/A | 🟡 中 |

#### 3.1.3 乐观锁使用示例

**当前实现**:
```typescript
// ForumTopicService.getTopicById
const topic = await this.forumTopic.findUnique({
  where: { id, deletedAt: null },
  include: {
    topicTags: true,
    section: true,
    profile: {
      include: {
        user: true,
      },
    },
  },
})
```

**问题**: 未使用version字段进行并发控制

**改进建议**:
```typescript
// 使用乐观锁更新主题
const topic = await this.forumTopic.findUnique({
  where: { id, deletedAt: null },
})

try {
  const updated = await this.forumTopic.update({
    where: { 
      id, 
      version: topic.version 
    },
    data: {
      ...updateData,
      version: {
        increment: 1,
      },
    },
  })
} catch (error) {
  if (error.code === 'P2025') {
    throw new ConflictException('主题已被其他用户修改，请刷新后重试')
  }
  throw error
}
```

### 3.2 悲观锁

#### 3.2.1 悲观锁使用情况

| 服务 | 方法 | 使用悲观锁 | 评估 |
|-----|------|-----------|------|
| PointService | addPoints | ❌ 未使用 | 🔴 严重 |
| PointService | consumePoints | ❌ 未使用 | 🔴 严重 |
| ExperienceService | addExperience | ❌ 未使用 | 🔴 严重 |
| ForumTopicLikeService | likeTopic | ❌ 未使用 | 🟡 中 |
| ForumReplyLikeService | likeReply | ❌ 未使用 | 🟡 中 |
| ForumTopicFavoriteService | addFavorite | ❌ 未使用 | 🟡 中 |

#### 3.2.2 悲观锁使用示例

**当前实现**:
```typescript
// PointService.addPoints
const profile = await this.forumProfile.findUnique({
  where: { id: profileId },
})

return this.prisma.$transaction(async (tx) => {
  const beforePoints = profile.points
  const afterPoints = beforePoints + rule.points

  const record = await tx.forumPointRecord.create({
    data: {
      profileId,
      ruleId: rule.id,
      points: rule.points,
      beforePoints,
      afterPoints,
      remark,
    },
  })

  await tx.forumProfile.update({
    where: { id: profileId },
    data: {
      points: afterPoints,
    },
  })

  return record
})
```

**问题**: 在事务外读取profile.points，存在竞态条件

**改进建议**:
```typescript
// 使用悲观锁
return this.prisma.$transaction(async (tx) => {
  const profile = await tx.forumProfile.findUnique({
    where: { id: profileId },
  })

  if (!profile) {
    throw new BadRequestException('用户资料不存在')
  }

  const rule = await tx.forumPointRule.findUnique({
    where: {
      type: ruleType,
      isEnabled: true,
    },
  })

  if (!rule) {
    throw new BadRequestException('积分规则不存在')
  }

  if (rule.dailyLimit > 0) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayCount = await tx.forumPointRecord.count({
      where: {
        profileId,
        ruleId: rule.id,
        createdAt: {
          gte: today,
        },
      },
    })

    if (todayCount >= rule.dailyLimit) {
      throw new BadRequestException('今日积分已达上限')
    }
  }

  const beforePoints = profile.points
  const afterPoints = beforePoints + rule.points

  const record = await tx.forumPointRecord.create({
    data: {
      profileId,
      ruleId: rule.id,
      points: rule.points,
      beforePoints,
      afterPoints,
      remark,
    },
  })

  await tx.forumProfile.update({
    where: { id: profileId },
    data: {
      points: afterPoints,
    },
  })

  return record
})
```

## 4. 竞态条件分析

### 4.1 积分系统竞态条件

#### 4.1.1 问题描述

**位置**: [point.service.ts](file:///e:/Code/es/es-server/libs/forum/src/point/point.service.ts#L100-L150)

**问题代码**:
```typescript
async addPoints(addPointsDto: AddForumPointsDto) {
  const { profileId, ruleType, remark } = addPointsDto

  const profile = await this.forumProfile.findUnique({
    where: { id: profileId },
  })

  if (!profile) {
    throw new BadRequestException('用户资料不存在')
  }

  const rule = await this.forumPointRule.findUnique({
    where: {
      type: ruleType,
      isEnabled: true,
    },
  })

  if (!rule) {
    throw new BadRequestException('积分规则不存在')
  }

  if (rule.dailyLimit > 0) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayCount = await this.forumPointRecord.count({
      where: {
        profileId,
        ruleId: rule.id,
        createdAt: {
          gte: today,
        },
      },
    })

    if (todayCount >= rule.dailyLimit) {
      throw new BadRequestException('今日积分已达上限')
    }
  }

  return this.prisma.$transaction(async (tx) => {
    const beforePoints = profile.points
    const afterPoints = beforePoints + rule.points

    const record = await tx.forumPointRecord.create({
      data: {
        profileId,
        ruleId: rule.id,
        points: rule.points,
        beforePoints,
        afterPoints,
        remark,
      },
    })

    await tx.forumProfile.update({
      where: { id: profileId },
      data: {
        points: afterPoints,
      },
    })

    return record
  })
}
```

**竞态条件**:
1. 在事务外读取profile.points
2. 如果两个请求同时调用addPoints，可能读取到相同的beforePoints
3. 导致积分计算错误

**风险等级**: 🔴 高

**影响范围**:
- 用户积分可能不准确
- 积分记录可能不一致

### 4.2 经验系统竞态条件

#### 4.2.1 问题描述

**位置**: [experience.service.ts](file:///e:/Code/es/es-server/libs/forum/src/experience/experience.service.ts#L100-L150)

**问题代码**:
```typescript
async addExperience(addExperienceDto: AddForumExperienceDto) {
  const { profileId, ruleType, remark } = addExperienceDto

  const profile = await this.forumProfile.findUnique({
    where: {
      id: profileId,
      status: {
        not: ForumProfileStatusEnum.PERMANENT_BANNED,
      },
    },
  })

  if (!profile) {
    throw new BadRequestException('用户不存在或已被永久封禁')
  }

  const rule = await this.forumExperienceRule.findUnique({
    where: {
      type: ruleType,
      isEnabled: true,
    },
  })

  if (!rule) {
    throw new BadRequestException('经验规则不存在')
  }

  if (rule.dailyLimit > 0) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayCount = await this.forumExperienceRecord.count({
      where: {
        profileId,
        ruleId: rule.id,
        createdAt: {
          gte: today,
        },
      },
    })

    if (todayCount >= rule.dailyLimit) {
      throw new BadRequestException('今日经验已达上限')
    }
  }

  return this.prisma.$transaction(async (tx) => {
    const beforeExperience = profile.experience
    const afterExperience = beforeExperience + rule.experience

    const record = await tx.forumExperienceRecord.create({
      data: {
        profileId,
        ruleId: rule.id,
        experience: rule.experience,
        beforeExperience,
        afterExperience,
        remark,
      },
    })

    await tx.forumProfile.update({
      where: { id: profileId },
      data: {
        experience: afterExperience,
      },
    })

    return record
  })
}
```

**竞态条件**:
1. 在事务外读取profile.experience
2. 如果两个请求同时调用addExperience，可能读取到相同的beforeExperience
3. 导致经验计算错误

**风险等级**: 🔴 高

**影响范围**:
- 用户经验可能不准确
- 经验记录可能不一致
- 等级升级可能出错

### 4.3 点赞系统竞态条件

#### 4.3.1 问题描述

**位置**: [forum-topic-like.service.ts](file:///e:/Code/es/es-server/libs/forum/src/topic-like/forum-topic-like.service.ts#L50-L100)

**问题代码**:
```typescript
async likeTopic(createForumTopicLikeDto: CreateForumTopicLikeDto) {
  const { topicId, profileId } = createForumTopicLikeDto

  const topic = await this.forumTopic.findUnique({
    where: { id: topicId, deletedAt: null },
  })

  if (!topic) {
    throw new NotFoundException('主题不存在')
  }

  const profile = await this.forumProfile.findUnique({
    where: { id: profileId },
  })

  if (!profile) {
    throw new BadRequestException('用户资料不存在')
  }

  const existingLike = await this.forumTopicLike.findUnique({
    where: {
      topicId_userId: {
        topicId,
        userId: profileId,
      },
    },
  })

  if (existingLike) {
    throw new BadRequestException('已经点赞过该主题')
  }

  return this.prisma.$transaction(async (tx) => {
    const like = await tx.forumTopicLike.create({
      data: {
        topicId,
        userId: profileId,
      },
    })

    await tx.forumTopic.update({
      where: { id: topicId },
      data: {
        likeCount: {
          increment: 1,
        },
      },
    })

    return like
  })
}
```

**竞态条件**:
1. 在事务外检查是否已点赞
2. 如果两个请求同时调用likeTopic，可能都通过检查
3. 导致重复点赞

**风险等级**: 🟡 中

**影响范围**:
- 可能出现重复点赞
- 点赞数可能不准确

**改进建议**:
```typescript
async likeTopic(createForumTopicLikeDto: CreateForumTopicLikeDto) {
  const { topicId, profileId } = createForumTopicLikeDto

  return this.prisma.$transaction(async (tx) => {
    const topic = await tx.forumTopic.findUnique({
      where: { id: topicId, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const profile = await tx.forumProfile.findUnique({
      where: { id: profileId },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
    }

    const existingLike = await tx.forumTopicLike.findUnique({
      where: {
        topicId_userId: {
          topicId,
          userId: profileId,
        },
      },
    })

    if (existingLike) {
      throw new BadRequestException('已经点赞过该主题')
    }

    const like = await tx.forumTopicLike.create({
      data: {
        topicId,
        userId: profileId,
      },
    })

    await tx.forumTopic.update({
      where: { id: topicId },
      data: {
        likeCount: {
          increment: 1,
        },
      },
    })

    return like
  })
}
```

### 4.4 收藏系统竞态条件

#### 4.4.1 问题描述

**位置**: [forum-topic-favorite.service.ts](file:///e:/Code/es/es-server/libs/forum/src/topic-favorite/forum-topic-favorite.service.ts#L20-L80)

**问题代码**:
```typescript
async addFavorite(createForumTopicFavoriteDto: CreateForumTopicFavoriteDto) {
  const { topicId, profileId } = createForumTopicFavoriteDto

  const topic = await this.forumTopic.findUnique({
    where: { id: topicId, deletedAt: null },
  })

  if (!topic) {
    throw new NotFoundException('主题不存在')
  }

  const profile = await this.forumProfile.findUnique({
    where: { id: profileId },
  })

  if (!profile) {
    throw new BadRequestException('用户资料不存在')
  }

  const existingFavorite = await this.forumTopicFavorite.findUnique({
    where: {
      topicId_userId: {
        topicId,
        userId: profileId,
      },
    },
  })

  if (existingFavorite) {
    throw new BadRequestException('已经收藏过该主题')
  }

  return this.prisma.$transaction(async (tx) => {
    const favorite = await tx.forumTopicFavorite.create({
      data: {
        topicId,
        userId: profileId,
      },
    })

    await tx.forumTopic.update({
      where: { id: topicId },
      data: {
        favoriteCount: {
          increment: 1,
        },
      },
    })

    return favorite
  })
}
```

**竞态条件**:
1. 在事务外检查是否已收藏
2. 如果两个请求同时调用addFavorite，可能都通过检查
3. 导致重复收藏

**风险等级**: 🟡 中

**影响范围**:
- 可能出现重复收藏
- 收藏数可能不准确

## 5. 缓存并发控制

### 5.1 缓存并发控制机制

#### 5.1.1 ForumConfigCacheService

**位置**: [forum-config-cache.service.ts](file:///e:/Code/es/es-server/libs/forum/src/config/forum-config-cache.service.ts)

**实现机制**:
```typescript
private pendingRequests = new Map<string, Promise<ForumConfig>>()

async getConfig() {
  const cacheKey = FORUM_CONFIG_CACHE_KEYS.CONFIG
  const requestKey = `lock:${cacheKey}`

  const config = await this.cacheManager.get<ForumConfig | null>(cacheKey)

  if (config) {
    await this.incrementMetric(FORUM_CONFIG_CACHE_METRICS.HIT_COUNT)
    return config
  }

  await this.incrementMetric(FORUM_CONFIG_CACHE_METRICS.MISS_COUNT)

  if (this.pendingRequests.has(requestKey)) {
    await this.incrementMetric(FORUM_CONFIG_CACHE_METRICS.PENETRATION_COUNT)
    return this.pendingRequests.get(requestKey)!
  }

  const promise = this.loadConfigFromDatabase(cacheKey)
  this.pendingRequests.set(requestKey, promise)
  return promise
}
```

**并发控制策略**:
1. **缓存击穿防护**: 使用单飞模式，避免大量并发请求同时查询数据库
2. **缓存雪崩防护**: TTL加上随机值，避免同时失效
3. **缓存穿透防护**: 缓存空值，避免重复查询不存在的数据

**评估**: ✅ 实现良好

### 5.2 缓存并发控制评估

**评估结果**: ✅ 实现良好

**优点**:
1. 使用单飞模式防止缓存击穿
2. TTL随机化防止缓存雪崩
3. 缓存空值防止缓存穿透
4. 使用pendingRequests Map管理并发请求

**改进建议**:
1. 可以考虑使用Redis的SETNX实现分布式锁
2. 可以增加缓存预热机制

## 6. 并发控制问题汇总

### 6.1 问题清单

| 问题类型 | 问题描述 | 位置 | 风险等级 | 优先级 |
|---------|---------|------|---------|-------|
| 事务保护 | 主题创建缺少事务保护 | forum-topic.service.ts | 🟡 中 | 高 |
| 竞态条件 | 积分系统存在竞态条件 | point.service.ts | 🔴 高 | 高 |
| 竞态条件 | 经验系统存在竞态条件 | experience.service.ts | 🔴 高 | 高 |
| 竞态条件 | 点赞系统存在竞态条件 | forum-topic-like.service.ts | 🟡 中 | 中 |
| 竞态条件 | 收藏系统存在竞态条件 | forum-topic-favorite.service.ts | 🟡 中 | 中 |
| 乐观锁 | ForumTopic未使用乐观锁 | forum-topic.prisma | 🟡 中 | 中 |
| 悲观锁 | 积分系统未使用悲观锁 | point.service.ts | 🔴 高 | 高 |
| 悲观锁 | 经验系统未使用悲观锁 | experience.service.ts | 🔴 高 | 高 |
| 悲观锁 | 点赞系统未使用悲观锁 | forum-topic-like.service.ts | 🟡 中 | 中 |
| 悲观锁 | 收藏系统未使用悲观锁 | forum-topic-favorite.service.ts | 🟡 中 | 中 |

### 6.2 风险评估

**高风险问题**:
1. 积分系统竞态条件
2. 经验系统竞态条件

**中风险问题**:
1. 主题创建缺少事务保护
2. 点赞系统竞态条件
3. 收藏系统竞态条件
4. 乐观锁未使用
5. 悲观锁未使用

## 7. 改进建议

### 7.1 高优先级改进

#### 7.1.1 修复积分系统竞态条件

**改进方案**:
1. 将所有数据库操作移到事务内
2. 在事务内读取用户当前积分
3. 使用悲观锁或乐观锁保护积分更新

**实施步骤**:
1. 修改PointService.addPoints方法
2. 修改PointService.consumePoints方法
3. 添加单元测试验证并发安全性

**预期效果**:
- 消除积分系统竞态条件
- 确保积分数据一致性

#### 7.1.2 修复经验系统竞态条件

**改进方案**:
1. 将所有数据库操作移到事务内
2. 在事务内读取用户当前经验
3. 使用悲观锁或乐观锁保护经验更新

**实施步骤**:
1. 修改ExperienceService.addExperience方法
2. 添加单元测试验证并发安全性

**预期效果**:
- 消除经验系统竞态条件
- 确保经验数据一致性

### 7.2 中优先级改进

#### 7.2.1 修复主题创建事务问题

**改进方案**:
1. 将主题创建和积分增加放在同一个事务中
2. 使用事务确保数据一致性

**实施步骤**:
1. 修改ForumTopicService.createForumTopic方法
2. 将积分增加逻辑移到事务内

**预期效果**:
- 确保主题创建和积分增加的原子性
- 避免数据不一致

#### 7.2.2 修复点赞系统竞态条件

**改进方案**:
1. 将所有数据库操作移到事务内
2. 使用唯一索引防止重复点赞

**实施步骤**:
1. 修改ForumTopicLikeService.likeTopic方法
2. 修改ForumReplyLikeService.likeReply方法
3. 添加单元测试验证并发安全性

**预期效果**:
- 消除点赞系统竞态条件
- 防止重复点赞

#### 7.2.3 修复收藏系统竞态条件

**改进方案**:
1. 将所有数据库操作移到事务内
2. 使用唯一索引防止重复收藏

**实施步骤**:
1. 修改ForumTopicFavoriteService.addFavorite方法
2. 添加单元测试验证并发安全性

**预期效果**:
- 消除收藏系统竞态条件
- 防止重复收藏

### 7.3 低优先级改进

#### 7.3.1 使用乐观锁

**改进方案**:
1. 在ForumProfile和ForumReply模型中添加version字段
2. 在更新操作中使用version字段进行并发控制

**实施步骤**:
1. 修改Prisma模型添加version字段
2. 修改相关Service方法使用乐观锁
3. 添加单元测试验证并发安全性

**预期效果**:
- 提高并发控制能力
- 防止数据覆盖

#### 7.3.2 使用悲观锁

**改进方案**:
1. 在关键操作中使用SELECT FOR UPDATE
2. 确保数据一致性

**实施步骤**:
1. 修改相关Service方法使用悲观锁
2. 添加单元测试验证并发安全性

**预期效果**:
- 提高并发控制能力
- 确保数据一致性

## 8. 并发控制检查总结

### 8.1 整体评估

**评估结果**: ⚠️ 需要改进

**总体评价**:
- 大部分关键操作使用事务保护
- 缓存并发控制实现良好
- 存在多个竞态条件问题
- 乐观锁和悲观锁未充分利用

### 8.2 优点总结

1. **事务保护**: 大部分关键操作使用事务保护
2. **缓存并发控制**: ForumConfigCacheService实现了良好的缓存并发控制
3. **单飞模式**: 使用单飞模式防止缓存击穿
4. **TTL随机化**: TTL随机化防止缓存雪崩

### 8.3 问题总结

1. **竞态条件**: 积分和经验系统存在严重的竞态条件
2. **事务保护**: 主题创建缺少事务保护
3. **乐观锁未使用**: ForumTopic有version字段但未使用
4. **悲观锁未使用**: 关键操作未使用悲观锁
5. **点赞和收藏**: 存在竞态条件风险

### 8.4 改进优先级

**高优先级**:
1. 修复积分系统竞态条件
2. 修复经验系统竞态条件

**中优先级**:
1. 修复主题创建事务问题
2. 修复点赞系统竞态条件
3. 修复收藏系统竞态条件

**低优先级**:
1. 使用乐观锁
2. 使用悲观锁
