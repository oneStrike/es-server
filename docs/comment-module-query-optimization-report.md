# 评论模块数据库查询优化报告

## 文档信息
- **分析日期**: 2026-03-05
- **分析范围**: `libs/interaction/src/comment/` 模块
- **涉及文件**:
  - `comment.service.ts` (626行)
  - `comment-permission.service.ts` (129行)
  - `comment-count.service.ts` (112行)
  - `comment-interaction.service.ts` (229行)
  - `dto/comment.dto.ts` (126行)

---

## 一、现有查询模式分析

### 1.1 整体架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                     CommentService                              │
├─────────────────────────────────────────────────────────────────┤
│  Dependencies:                                                  │
│  - SensitiveWordDetectService (敏感词检测)                      │
│  - SystemConfigService (系统配置，带缓存)                       │
│  - CommentPermissionService (权限校验)                          │
│  - CommentCountService (评论计数)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  createComment│    │ deleteComment │    │  getComments  │
│  (创建评论)   │    │  (删除评论)   │    │  (查询列表)   │
└───────────────┘    └───────────────┘    └───────────────┘
```

### 1.2 各方法查询次数统计

| 方法 | 文件 | 当前查询次数 | 主要查询操作 |
|------|------|-------------|-------------|
| `createComment` | comment.service.ts | 3-4次 | 权限检查(2次) + 楼层计算/回复检查(1-2次) |
| `deleteComment` | comment.service.ts | 1次 | 更新+选择(事务内) |
| `deleteCommentByAdmin` | comment.service.ts | 1次 | 更新+选择(事务内) |
| `getComments` | comment.service.ts | 1次 | 分页查询(带include) |
| `getReplies` | comment.service.ts | 1次 | 分页查询(带include) |
| `updateCommentAudit` | comment.service.ts | 2次 | 先查询+后更新(事务内) |
| `updateCommentHidden` | comment.service.ts | 2次 | 先查询+后更新(事务内) |
| `likeComment` | comment-interaction.service.ts | 2次 | 检查存在+事务操作 |
| `unlikeComment` | comment-interaction.service.ts | 1次 | 事务内操作 |
| `reportComment` | comment-interaction.service.ts | 2次 | 检查存在+检查重复举报 |
| `ensureUserCanComment` | comment-permission.service.ts | 1次 | 查询用户状态 |
| `ensureTargetCanComment` | comment-permission.service.ts | 1次 | 查询目标(作品/章节/话题) |

---

## 二、详细优化点分析

### 2.1 优化点1: createComment 楼层号计算

#### 当前实现
```typescript
// comment.service.ts 第101-110行
const lastComment = await this.prisma.userComment.findFirst({
  where: {
    targetType,
    targetId,
    replyToId: null,
  },
  orderBy: { floor: 'desc' },
  select: { floor: true },
})
floor = (lastComment?.floor ?? 0) + 1
```

#### 问题分析
- 使用 `findFirst` + `orderBy: { floor: 'desc' }` 需要数据库排序后取第一条
- 当评论数量很大时，排序操作成本较高
- 索引使用: `(targetType, targetId, replyToId, floor DESC)`

#### 优化方案
```typescript
// 使用聚合函数直接获取最大值
const result = await this.prisma.userComment.aggregate({
  where: {
    targetType,
    targetId,
    replyToId: null,
  },
  _max: { floor: true },
})
floor = (result._max.floor ?? 0) + 1
```

#### 预期收益
- **查询性能**: 聚合函数 `_max` 通常比排序后取第一条更高效
- **内存使用**: 无需加载整条记录，只返回一个数值
- **索引优化**: 可以利用 `(targetType, targetId, replyToId, floor)` 索引的快速最大值查询

---

### 2.2 优化点2: CommentInteractionService 前置查询消除

#### 当前实现分析

**likeComment (第36-59行)**
```typescript
async likeComment(commentId: number, userId: number): Promise<void> {
  await this.ensureCommentExists(commentId)  // 第1次查询

  await this.prisma.$transaction(async (tx) => {
    try {
      await tx.userCommentLike.create({...})  // 第2次查询(可能)
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new BadRequestException('已经点赞过该评论')
      }
      throw error
    }
    await tx.userComment.update({...})  // 第3次查询
  })
}
```

**reportComment (第135-167行)**
```typescript
async reportComment(...) {
  await this.ensureCommentExists(commentId)  // 第1次查询

  const existing = await this.prisma.userCommentReport.findFirst({...})  // 第2次查询
  if (existing) {
    throw new BadRequestException('已经举报过该评论')
  }

  await this.prisma.userCommentReport.create({...})  // 第3次查询
}
```

#### 问题分析
- `likeComment` 和 `reportComment` 都在事务外先查询评论是否存在
- 这种"检查-然后-操作"模式存在竞态条件，且增加了一次查询
- `unlikeComment` 已经使用了更好的模式：直接在事务中操作，通过异常处理错误

#### 优化方案

**方案A: 异常处理模式 (推荐用于 likeComment)**
```typescript
async likeComment(commentId: number, userId: number): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    // 1. 尝试创建点赞记录
    try {
      await tx.userCommentLike.create({ data: { commentId, userId } })
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new BadRequestException('已经点赞过该评论')
      }
      if (this.isForeignKeyError(error)) {  // 需要添加此方法
        throw new NotFoundException('评论不存在')
      }
      throw error
    }

    // 2. 更新点赞计数
    await tx.userComment.update({
      where: { id: commentId },
      data: { likeCount: { increment: 1 } },
    })
  })
}
```

**方案B: 批量检查模式 (推荐用于 reportComment)**
```typescript
async reportComment(...) {
  // 并行执行：检查评论存在 + 检查是否已举报
  const [comment, existing] = await Promise.all([
    this.prisma.userComment.findUnique({
      where: { id: commentId, deletedAt: null },
      select: { id: true },
    }),
    this.prisma.userCommentReport.findFirst({
      where: { commentId, reporterId, status: ReportStatus.PENDING },
      select: { id: true },
    }),
  ])

  if (!comment) {
    throw new NotFoundException('评论不存在')
  }
  if (existing) {
    throw new BadRequestException('已经举报过该评论')
  }

  await this.prisma.userCommentReport.create({...})
}
```

#### 预期收益
- **likeComment**: 减少1次查询 (从3次降到2次)
- **reportComment**: 保持2次查询但消除竞态条件，或合并为并行查询
- **事务一致性**: 所有检查都在事务内完成，避免竞态条件

---

### 2.3 优化点3: updateCommentAudit 查询合并

#### 当前实现
```typescript
// comment.service.ts 第476-536行
await this.prisma.$transaction(async (tx) => {
  // 第1次查询：获取当前状态
  const comment = await tx.userComment.findUnique({...})
  if (!comment) throw new NotFoundException('Comment not found')
  
  const beforeVisible = this.commentCountService.isVisible(comment)

  // 第2次查询：执行更新
  let updated = await tx.userComment.update({...})
  
  const afterVisible = this.commentCountService.isVisible(updated)
  // ...
})
```

#### 问题分析
- 需要知道更新前后的可见性状态来计算评论数变化
- 当前实现先查询原状态，再执行更新
- 这是必要的，因为 update 操作只返回更新后的数据

#### 优化方案评估

**方案A: 使用 RETURNING 子句 (Prisma 已支持)**
Prisma 的 `update` 方法已经返回更新后的数据，但无法获取更新前的数据。

**方案B: 使用原始查询 (不推荐)**
可以使用原始 SQL 的 `RETURNING` 配合子查询，但会破坏 ORM 的抽象。

**方案C: 业务逻辑优化 (推荐)**
```typescript
await this.prisma.$transaction(async (tx) => {
  // 直接使用 update，利用 P2025 错误判断记录不存在
  let updated;
  try {
    updated = await tx.userComment.update({
      where: { id: body.commentId, deletedAt: null },
      data: { auditStatus: body.auditStatus, ... },
      select: { 
        targetType: true, 
        targetId: true, 
        auditStatus: true,  // 新状态
        isHidden: true, 
        deletedAt: true 
      },
    })
  } catch (error) {
    if (this.isRecordNotFound(error)) {
      throw new NotFoundException('Comment not found')
    }
    throw error
  }

  // 根据业务规则推断之前的状态
  // 例如：如果新状态是 APPROVED，则之前可能是 PENDING 或 REJECTED
  // 需要根据具体业务逻辑来确定
  const beforeVisible = /* 根据传入参数和更新后状态推断 */
  const afterVisible = this.commentCountService.isVisible(updated)
  
  // ...
})
```

#### 结论
此优化点**风险较高**，因为需要准确知道更新前的状态。建议保持当前实现或需要更详细的业务规则才能安全优化。

---

### 2.4 优化点4: updateCommentHidden 查询合并

与优化点3类似，但有一个重要区别：

```typescript
// 当前实现 (第536-600行)
const comment = await tx.userComment.findUnique({...})  // 查询原状态
const beforeVisible = this.commentCountService.isVisible(comment)
let updated = await tx.userComment.update({...})  // 执行更新
const afterVisible = this.commentCountService.isVisible(updated)
```

#### 优化方案
由于 `isHidden` 是布尔值，且更新操作是设置明确的值，我们可以推断：
- 如果 `body.isHidden === true`，则之前是 `false`
- 如果 `body.isHidden === false`，则之前是 `true`

```typescript
await this.prisma.$transaction(async (tx) => {
  try {
    const updated = await tx.userComment.update({
      where: { id: body.commentId, deletedAt: null },
      data: { isHidden: body.isHidden },
      select: { targetType: true, targetId: true, auditStatus: true, 
                isHidden: true, deletedAt: true },
    })

    // 推断之前的状态
    const beforeVisible = this.commentCountService.isVisible({
      auditStatus: updated.auditStatus,
      isHidden: !body.isHidden,  // 与更新值相反
      deletedAt: updated.deletedAt,
    })
    const afterVisible = this.commentCountService.isVisible(updated)
    
    await this.commentCountService.syncVisibleCountByTransition(...)
  } catch (error) {
    if (this.isRecordNotFound(error)) {
      throw new NotFoundException('Comment not found')
    }
    throw error
  }
})
```

#### 预期收益
- 减少1次查询
- 保持事务一致性

---

### 2.5 优化点5: 权限检查缓存

#### 当前实现
```typescript
// comment-permission.service.ts
async ensureUserCanComment(userId: number) {
  const user = await this.prisma.appUser.findUnique({...})
  // 检查用户状态...
}

async ensureTargetCanComment(targetType, targetId) {
  // 根据类型查询 work / workChapter / forumTopic
  const work = await this.prisma.work.findUnique({...})
  // 检查目标状态...
}
```

#### 问题分析
- 每次创建评论都需要查询用户和目标状态
- 用户状态在短时间内通常不会变化
- 目标(作品/章节)的评论开关状态也很少变化

#### 优化方案
引入短期缓存（如 5-10 秒）：

```typescript
@Injectable()
export class CommentPermissionService extends BaseService {
  // 使用内存缓存，TTL 5秒
  private userCache = new Map<string, { result: boolean; timestamp: number }>()
  private targetCache = new Map<string, { result: boolean; timestamp: number }>()
  private readonly CACHE_TTL = 5000 // 5秒

  async ensureUserCanComment(userId: number) {
    const cacheKey = `user:${userId}`
    const cached = this.userCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      if (!cached.result) {
        throw new BadRequestException('用户已被禁言或封禁，无法评论')
      }
      return
    }

    // 原查询逻辑...
    // 缓存结果
    this.userCache.set(cacheKey, { result: userCanComment, timestamp: Date.now() })
  }
}
```

#### 注意事项
- 缓存时间不宜过长，避免状态变更延迟
- 需要考虑内存使用，可以设置最大缓存条目数
- 或者使用 Redis 等外部缓存

---

## 三、优化优先级与风险评估

### 3.1 优先级矩阵

| 优化点 | 收益 | 风险 | 复杂度 | 优先级 |
|--------|------|------|--------|--------|
| 2.1 楼层号聚合查询 | 中 | 低 | 低 | P1 |
| 2.2 likeComment 异常处理 | 中 | 中 | 低 | P1 |
| 2.4 updateCommentHidden 查询合并 | 中 | 低 | 低 | P2 |
| 2.2 reportComment 并行查询 | 低 | 低 | 低 | P3 |
| 2.3 updateCommentAudit 查询合并 | 中 | 高 | 中 | P3 |
| 2.5 权限检查缓存 | 高 | 中 | 中 | P2 |

### 3.2 风险说明

**低风险 (P1)**
- 楼层号聚合查询：只是改变查询方式，业务逻辑不变
- likeComment 异常处理：使用 Prisma 标准错误码，可靠

**中风险 (P2)**
- updateCommentHidden 查询合并：需要准确推断之前状态
- 权限检查缓存：需要考虑缓存一致性和内存管理

**高风险 (P3)**
- updateCommentAudit 查询合并：审核状态流转复杂，需要详细业务规则才能安全优化

---

## 四、实施建议

### 4.1 第一阶段 (立即实施)

1. **楼层号聚合查询优化**
   - 文件: `comment.service.ts`
   - 行数: 101-110
   - 改动: 将 `findFirst` + `orderBy` 改为 `aggregate` + `_max`

2. **likeComment 异常处理优化**
   - 文件: `comment-interaction.service.ts`
   - 行数: 36-60
   - 改动: 移除前置 `ensureCommentExists`，在事务中捕获外键错误

### 4.2 第二阶段 (评估后实施)

1. **updateCommentHidden 查询合并**
   - 需要确认业务规则：是否总是从 true↔false 切换

2. **权限检查缓存**
   - 需要设计缓存策略和过期机制

### 4.3 第三阶段 (需要更多信息)

1. **updateCommentAudit 查询合并**
   - 需要了解所有可能的审核状态流转规则

---

## 五、代码变更示例

### 5.1 楼层号计算优化

```typescript
// BEFORE
const lastComment = await this.prisma.userComment.findFirst({
  where: { targetType, targetId, replyToId: null },
  orderBy: { floor: 'desc' },
  select: { floor: true },
})
floor = (lastComment?.floor ?? 0) + 1

// AFTER
const result = await this.prisma.userComment.aggregate({
  where: { targetType, targetId, replyToId: null },
  _max: { floor: true },
})
floor = (result._max.floor ?? 0) + 1
```

### 5.2 likeComment 优化

```typescript
// BEFORE
async likeComment(commentId: number, userId: number): Promise<void> {
  await this.ensureCommentExists(commentId)  // 额外查询

  await this.prisma.$transaction(async (tx) => {
    // ...
  })
}

// AFTER
async likeComment(commentId: number, userId: number): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    try {
      await tx.userCommentLike.create({ data: { commentId, userId } })
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new BadRequestException('已经点赞过该评论')
      }
      if (this.isForeignKeyError(error)) {
        throw new NotFoundException('评论不存在')
      }
      throw error
    }
    // ...
  })
}
```

---

## 六、测试建议

### 6.1 单元测试

1. **楼层号计算**
   - 测试空评论列表时楼层号为1
   - 测试有评论时楼层号正确递增
   - 测试并发创建评论时的楼层号分配

2. **点赞功能**
   - 测试点赞不存在评论时的错误处理
   - 测试重复点赞的错误提示
   - 测试并发点赞的数据一致性

3. **隐藏状态更新**
   - 测试评论计数正确同步
   - 测试边界条件（已删除评论）

### 6.2 性能测试

1. 使用大量数据测试楼层号计算性能
2. 模拟高并发场景测试竞态条件
3. 对比优化前后的查询次数和响应时间

---

## 七、附录

### 7.1 相关索引检查

建议检查以下索引是否存在：

```sql
-- 楼层号查询索引
CREATE INDEX idx_user_comment_target_floor ON userComment(targetType, targetId, replyToId, floor);

-- 点赞记录唯一索引 (应该已存在)
CREATE UNIQUE INDEX idx_user_comment_like_unique ON userCommentLike(commentId, userId);

-- 举报记录查询索引
CREATE INDEX idx_user_comment_report_pending ON userCommentReport(commentId, reporterId, status);
```

### 7.2 监控指标

建议添加以下监控：

1. 评论创建接口的响应时间
2. 数据库查询次数 (可通过 Prisma 日志)
3. 点赞/举报操作的错误率

---

**报告完成**

请仔细审阅以上报告，确认哪些优化点可以实施。我将根据您的反馈进行代码修改。
