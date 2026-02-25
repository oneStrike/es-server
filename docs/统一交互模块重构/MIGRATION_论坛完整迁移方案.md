# 论坛模块完整迁移方案

## 1. 迁移概述

### 1.1 迁移目标

将论坛模块中的回复、点赞、举报功能完全合并到 InteractionModule，实现：

| 功能 | 旧表 | 新表 | 目标类型 |
|------|------|------|----------|
| 论坛回复 | `forum_reply` | `user_comment` | `FORUM_TOPIC = 5` |
| 回复点赞 | `forum_reply_like` | `user_like` | `FORUM_REPLY = 6` (新增) |
| 论坛举报 | `forum_report` | `user_report` | 新建统一举报表 |

### 1.2 目标类型扩展

```typescript
enum InteractionTargetType {
  COMIC = 1,           // 漫画
  NOVEL = 2,           // 小说
  COMIC_CHAPTER = 3,   // 漫画章节
  NOVEL_CHAPTER = 4,   // 小说章节
  FORUM_TOPIC = 5,     // 论坛主题
  FORUM_REPLY = 6,     // 论坛回复 (新增)
  USER = 7,            // 用户 (新增，用于举报)
}
```

---

## 2. 文件变更清单

### 2.1 需要新增的文件

#### Prisma 模型
| 文件路径 | 说明 |
|----------|------|
| `prisma/models/app/user-report.prisma` | 统一举报表模型 |

#### InteractionModule
| 文件路径 | 说明 |
|----------|------|
| `libs/interaction/src/report/report.service.ts` | 统一举报服务 |
| `libs/interaction/src/report/report.module.ts` | 举报模块 |
| `libs/interaction/src/report/dto/report.dto.ts` | 举报 DTO |
| `libs/interaction/src/report/index.ts` | 导出文件 |
| `libs/interaction/src/validator/validators/forum-reply.validator.ts` | 论坛回复校验器 |

#### 数据迁移
| 文件路径 | 说明 |
|----------|------|
| `prisma/scripts/migrate-forum-to-interaction.ts` | 论坛数据迁移脚本 |

### 2.2 需要修改的文件

#### InteractionModule
| 文件路径 | 修改内容 |
|----------|----------|
| `libs/interaction/src/interaction.constant.ts` | 添加 `FORUM_REPLY = 6`, `USER = 7` |
| `libs/interaction/src/interaction.module.ts` | 导入 ReportModule |
| `libs/interaction/src/index.ts` | 导出 ReportService |
| `libs/interaction/src/validator/validators/index.ts` | 导出 ForumReplyValidator |
| `libs/interaction/src/validator/validator.module.ts` | 注册 ForumReplyValidator |
| `libs/interaction/src/counter/counter.service.ts` | 支持 FORUM_REPLY 计数 |
| `libs/interaction/src/comment/comment.service.ts` | 支持 FORUM_TOPIC 评论 |

#### ForumModule
| 文件路径 | 修改内容 |
|----------|----------|
| `libs/forum/src/forum.module.ts` | 移除 ReplyLikeModule, ReportModule |
| `libs/forum/src/reply/forum-reply.service.ts` | 使用 CommentService 替代直接操作 |
| `libs/forum/src/index.ts` | 移除 ReplyLike, Report 导出 |

#### Prisma 模型
| 文件路径 | 修改内容 |
|----------|----------|
| `prisma/models/app/app-user.prisma` | 移除 forumReplyLikes, forumReports 关联 |
| `prisma/models/forum/forum-topic.prisma` | 移除 replies 关联 |
| `prisma/models/forum/forum-reply.prisma` | 移除 likes 关联 |

### 2.3 需要删除的文件

#### 服务文件
| 文件路径 | 说明 |
|----------|------|
| `libs/forum/src/reply-like/forum-reply-like.service.ts` | 论坛回复点赞服务 |
| `libs/forum/src/reply-like/forum-reply-like.module.ts` | 论坛回复点赞模块 |
| `libs/forum/src/reply-like/dto/forum-reply-like.dto.ts` | 论坛回复点赞 DTO |
| `libs/forum/src/reply-like/index.ts` | 导出文件 |
| `libs/forum/src/report/forum-report.service.ts` | 论坛举报服务 |
| `libs/forum/src/report/forum-report.module.ts` | 论坛举报模块 |
| `libs/forum/src/report/dto/forum-report.dto.ts` | 论坛举报 DTO |
| `libs/forum/src/report/forum-report.constant.ts` | 论坛举报常量 |
| `libs/forum/src/report/index.ts` | 导出文件 |

#### Prisma 模型
| 文件路径 | 说明 |
|----------|------|
| `prisma/models/forum/forum-reply.prisma` | 论坛回复表 (数据迁移后删除) |
| `prisma/models/forum/forum-reply-like.prisma` | 论坛回复点赞表 |
| `prisma/models/forum/forum-report.prisma` | 论坛举报表 |

---

## 3. 详细实现方案

### 3.1 新增 Prisma 模型

#### `prisma/models/app/user-report.prisma`

```prisma
/// 用户举报表
/// 统一存储所有类型的举报记录
model UserReport {
  id          Int       @id @default(autoincrement())

  /// 举报人ID
  reporterId  Int       @map("reporter_id")
  /// 处理人ID
  handlerId   Int?      @map("handler_id")

  /// 目标类型
  /// 1=漫画, 2=小说, 3=漫画章节, 4=小说章节, 5=论坛主题, 6=论坛回复, 7=用户
  targetType  Int       @map("target_type") @db.SmallInt
  /// 目标ID
  targetId    Int       @map("target_id")

  /// 举报原因
  reason      String    @db.VarChar(50)
  /// 举报详细说明
  description String?   @db.VarChar(500)
  /// 证据截图URL
  evidenceUrl String?   @map("evidence_url") @db.VarChar(500)

  /// 处理状态
  status      String    @default("pending") @db.VarChar(20)
  /// 处理备注
  handlingNote String?  @map("handling_note") @db.VarChar(500)
  /// 处理时间
  handledAt   DateTime? @map("handled_at") @db.Timestamptz(6)

  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  /// 关联举报人
  reporter AppUser  @relation("UserReportReporter", fields: [reporterId], references: [id], onDelete: Cascade)
  /// 关联处理人
  handler  AppUser?  @relation("UserReportHandler", fields: [handlerId], references: [id])

  @@index([reporterId])
  @@index([handlerId])
  @@index([targetType, targetId])
  @@index([status])
  @@index([createdAt])
  @@map("user_report")
}
```

### 3.2 修改 InteractionTargetType

#### `libs/interaction/src/interaction.constant.ts`

```typescript
export enum InteractionTargetType {
  COMIC = 1,
  NOVEL = 2,
  COMIC_CHAPTER = 3,
  NOVEL_CHAPTER = 4,
  FORUM_TOPIC = 5,
  FORUM_REPLY = 6,  // 新增
  USER = 7,         // 新增
}

export enum ReportTargetType {
  COMIC = 1,
  NOVEL = 2,
  COMIC_CHAPTER = 3,
  NOVEL_CHAPTER = 4,
  FORUM_TOPIC = 5,
  FORUM_REPLY = 6,
  USER = 7,
}
```

### 3.3 新增 ForumReplyValidator

#### `libs/interaction/src/validator/validators/forum-reply.validator.ts`

```typescript
import { Injectable } from '@nestjs/common'
import { InteractionTargetType } from '../../interaction.constant'
import { BaseTargetValidator } from './base.validator'

@Injectable()
export class ForumReplyValidator extends BaseTargetValidator {
  readonly targetType = InteractionTargetType.FORUM_REPLY
  protected readonly modelName = 'userComment'

  protected getTargetName(): string {
    return '论坛回复'
  }

  async validate(targetId: number) {
    const comment = await this.prisma.userComment.findUnique({
      where: { id: targetId },
    })

    if (!comment) {
      return { valid: false, message: '回复不存在' }
    }

    if (comment.targetType !== InteractionTargetType.FORUM_TOPIC) {
      return { valid: false, message: '目标不是论坛回复' }
    }

    if (comment.deletedAt !== null) {
      return { valid: false, message: '回复已被删除' }
    }

    return { valid: true, data: comment }
  }
}
```

### 3.4 新增 ReportService

#### `libs/interaction/src/report/report.service.ts`

```typescript
import { Injectable } from '@nestjs/common'
import { BaseService } from '@libs/base/database'
import { InteractionTargetType, ReportStatus } from '../interaction.constant'
import { TargetValidatorRegistry } from '../validator/target-validator.registry'

@Injectable()
export class ReportService extends BaseService {
  constructor(
    private readonly validatorRegistry: TargetValidatorRegistry,
  ) {
    super()
  }

  async createReport(
    targetType: InteractionTargetType,
    targetId: number,
    reporterId: number,
    reason: string,
    description?: string,
    evidenceUrl?: string,
  ) {
    // 验证目标存在
    if (targetType !== InteractionTargetType.USER) {
      const validator = this.validatorRegistry.getValidator(targetType)
      const result = await validator.validate(targetId)
      if (!result.valid) {
        throw new Error(result.message || '目标不存在')
      }

      // 检查是否举报自己
      const target = result.data as any
      if (target.userId === reporterId) {
        throw new Error('不能举报自己的内容')
      }
    } else {
      // 举报用户
      const user = await this.prisma.appUser.findUnique({
        where: { id: targetId },
      })
      if (!user) {
        throw new Error('用户不存在')
      }
      if (targetId === reporterId) {
        throw new Error('不能举报自己')
      }
    }

    // 检查是否已举报
    const existing = await this.prisma.userReport.findFirst({
      where: {
        reporterId,
        targetType,
        targetId,
        status: { in: [ReportStatus.PENDING, ReportStatus.PROCESSING] },
      },
    })

    if (existing) {
      throw new Error('已经举报过该内容，请等待处理')
    }

    return this.prisma.userReport.create({
      data: {
        reporterId,
        targetType,
        targetId,
        reason,
        description,
        evidenceUrl,
        status: ReportStatus.PENDING,
      },
    })
  }

  async getReports(
    targetType?: InteractionTargetType,
    status?: ReportStatus,
    pageIndex: number = 1,
    pageSize: number = 20,
  ) {
    return this.prisma.userReport.findPagination({
      where: {
        ...(targetType !== undefined && { targetType }),
        ...(status !== undefined && { status }),
        pageIndex,
        pageSize,
      } as any,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: {
          select: { id: true, nickname: true },
        },
        handler: {
          select: { id: true, nickname: true },
        },
      },
    })
  }

  async handleReport(
    id: number,
    handlerId: number,
    status: ReportStatus.RESOLVED | ReportStatus.REJECTED,
    handlingNote?: string,
  ) {
    return this.prisma.userReport.update({
      where: { id },
      data: {
        handlerId,
        status,
        handlingNote,
        handledAt: new Date(),
      },
    })
  }

  async getReportStatistics() {
    const [total, pending, byStatus, byType] = await Promise.all([
      this.prisma.userReport.count(),
      this.prisma.userReport.count({
        where: { status: ReportStatus.PENDING },
      }),
      this.prisma.userReport.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.userReport.groupBy({
        by: ['targetType'],
        _count: { targetType: true },
      }),
    ])

    return {
      total,
      pending,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status
        return acc
      }, {} as Record<string, number>),
      byType: byType.reduce((acc, item) => {
        acc[item.targetType] = item._count.targetType
        return acc
      }, {} as Record<number, number>),
    }
  }
}
```

### 3.5 修改 ForumReplyService

将 `ForumReplyService` 改为使用 `CommentService`：

```typescript
// 原来的方式
await this.prisma.forumReply.create({ data: replyData })

// 迁移后的方式
await this.commentService.createComment(
  InteractionTargetType.FORUM_TOPIC,
  topicId,
  userId,
  content,
  replyToId,
)
```

---

## 4. 数据迁移脚本

### 4.1 `prisma/scripts/migrate-forum-to-interaction.ts`

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始迁移论坛数据...')

  // 1. 迁移论坛回复 -> user_comment
  const replies = await prisma.forumReply.findMany()
  console.log(`发现 ${replies.length} 条论坛回复`)

  for (const reply of replies) {
    await prisma.userComment.create({
      data: {
        targetType: 5, // FORUM_TOPIC
        targetId: reply.topicId,
        userId: reply.userId,
        content: reply.content,
        floor: reply.floor,
        replyToId: reply.replyToId,
        actualReplyToId: reply.actualReplyToId,
        isHidden: reply.isHidden,
        auditStatus: reply.auditStatus,
        auditReason: reply.auditReason,
        sensitiveWordHits: reply.sensitiveWordHits as any,
        likeCount: reply.likeCount,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        deletedAt: reply.deletedAt,
      },
    })
  }
  console.log('论坛回复迁移完成')

  // 2. 迁移论坛回复点赞 -> user_like
  const replyLikes = await prisma.forumReplyLike.findMany()
  console.log(`发现 ${replyLikes.length} 条回复点赞`)

  // 创建 ID 映射
  const replyMap = await buildReplyIdMap()

  for (const like of replyLikes) {
    const newCommentId = replyMap.get(like.replyId)
    if (!newCommentId) continue

    await prisma.userLike.create({
      data: {
        targetType: 6, // FORUM_REPLY
        targetId: newCommentId,
        userId: like.userId,
        createdAt: like.createdAt,
      },
    })
  }
  console.log('回复点赞迁移完成')

  // 3. 迁移论坛举报 -> user_report
  const reports = await prisma.forumReport.findMany()
  console.log(`发现 ${reports.length} 条举报`)

  for (const report of reports) {
    let targetType: number
    let targetId: number

    switch (report.type) {
      case 'topic':
        targetType = 5 // FORUM_TOPIC
        targetId = report.targetId
        break
      case 'reply':
        targetType = 6 // FORUM_REPLY
        targetId = replyMap.get(report.targetId) || report.targetId
        break
      case 'user':
        targetType = 7 // USER
        targetId = report.targetId
        break
      default:
        continue
    }

    await prisma.userReport.create({
      data: {
        reporterId: report.reporterId,
        handlerId: report.handlerId,
        targetType,
        targetId,
        reason: report.reason,
        description: report.description,
        evidenceUrl: report.evidenceUrl,
        status: report.status,
        handlingNote: report.handlingNote,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      },
    })
  }
  console.log('举报迁移完成')

  console.log('所有数据迁移完成！')
}

async function buildReplyIdMap(): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  const oldReplies = await prisma.forumReply.findMany({
    select: { id: true, topicId: true, userId: true, createdAt: true },
  })

  for (const old of oldReplies) {
    const newComment = await prisma.userComment.findFirst({
      where: {
        targetType: 5,
        targetId: old.topicId,
        userId: old.userId,
        createdAt: old.createdAt,
      },
    })
    if (newComment) {
      map.set(old.id, newComment.id)
    }
  }

  return map
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

---

## 5. 迁移步骤

### Phase 1: 准备工作
1. 创建新的 Prisma 模型 `user-report.prisma`
2. 更新 `InteractionTargetType` 枚举
3. 运行 `pnpm prisma:generate` 生成新模型

### Phase 2: 新增服务
1. 创建 `ForumReplyValidator`
2. 创建 `ReportService` 和 `ReportModule`
3. 更新 `InteractionModule` 导入新模块

### Phase 3: 数据迁移
1. 运行数据迁移脚本
2. 验证数据完整性

### Phase 4: 更新业务代码
1. 修改 `ForumReplyService` 使用 `CommentService`
2. 更新 `ForumInteractionEventHandler` 处理回复事件
3. 更新相关模块导入

### Phase 5: 清理工作
1. 删除旧服务文件
2. 删除旧 Prisma 模型
3. 运行 `pnpm prisma db push` 同步数据库

---

## 6. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 数据迁移失败 | 低 | 高 | 备份数据库，提供回滚脚本 |
| ID 映射错误 | 中 | 中 | 使用多字段匹配确保正确映射 |
| 业务逻辑遗漏 | 中 | 中 | 完整测试所有论坛功能 |
| 计数器不一致 | 低 | 中 | 验证计数器更新逻辑 |

---

## 7. 待确认事项

1. **是否保留 `forum_reply` 表？**
   - [ ] 迁移后立即删除
   - [ ] 保留一段时间后删除

2. **举报功能是否需要支持作品评论？**
   - [ ] 是，扩展到所有目标类型
   - [ ] 否，仅支持论坛相关

3. **是否需要更新前端 API？**
   - [ ] 是，需要同步更新
   - [ ] 否，保持 API 兼容

---

## 8. 时间估算

| 阶段 | 预计时间 |
|------|----------|
| Phase 1: 准备工作 | 0.5 小时 |
| Phase 2: 新增服务 | 1.5 小时 |
| Phase 3: 数据迁移 | 1 小时 |
| Phase 4: 更新业务代码 | 2 小时 |
| Phase 5: 清理工作 | 0.5 小时 |
| **总计** | **5.5 小时** |
