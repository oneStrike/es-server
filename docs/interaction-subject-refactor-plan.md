# 互动目标模型改造方案

## 1. 文档目的

本文档用于确认本次互动模块的一次性改造方案。

本次改造范围仅包含：

- 举报模块
- 点赞模块

本次改造明确不包含：

- 收藏模块

原因如下：

- 收藏模块当前只支持漫画作品、小说作品、论坛主题 3 类目标
- 当前 `targetType + targetId` 模型已经足以表达收藏对象
- 收藏模块不存在举报模块那种“作品与章节粒度不够、评论维度缺失”的核心问题

## 2. 本次改造的硬性约束

以下约束已经确认，实施时必须严格遵守：

- 不新增新表
- 不保留旧字段做兼容
- 不做双写阶段
- 不兼容旧入参
- 允许修改 controller
- 所有类型类字段不允许使用 `String`
- 所有状态、原因、类型类字段统一使用 `Int @db.SmallInt`
- 代码注释必须使用中文，且语义明确
- DTO 必须高复用，避免为每个场景重复定义相似 DTO

## 3. 关键结论

### 3.1 必须保留 `targetType + targetId`

本仓库中大量多态表和多态 DTO 都使用 `targetType + targetId` 作为统一命名约定，例如：

- `user_view`
- `user_like`
- `user_favorite`
- `user_download_record`
- `user_purchase_record`
- 大量 interaction DTO 与 service

因此，本次改造不能把举报、点赞单独改成 `subjectType + subjectId`。

如果只在部分模块改名，会带来以下维护成本：

- 不同多态表命名风格不一致
- service 参数名与 DTO 字段名不一致
- 新同学理解成本上升
- 后续复用通用查询与通用中间件时更难抽象

结论如下：

- 保留 `targetType + targetId`
- 通过新增 `sceneType + sceneId + commentLevel` 补足统计维度

### 3.2 本次改造的核心思想

`targetType + targetId` 继续表示：

- 当前直接被点赞或被举报的对象

新增字段表示：

- `sceneType`
  - 该对象所属的业务场景
- `sceneId`
  - 该对象所属场景的根对象 ID
- `commentLevel`
  - 若目标为评论，则表示根评论或回复评论

换句话说，本次改造不是替换 `targetType`，而是给 `targetType` 增加可直接统计的上下文维度。

## 4. 现状问题

### 4.1 举报模块的问题

当前举报模块的 `targetType` 粒度不统一：

- 作品举报只区分 `WORK`
- 章节举报只区分 `WORK_CHAPTER`
- 评论举报只区分 `COMMENT`
- 论坛回复又单独拆成 `FORUM_REPLY`

这会导致以下问题：

- 无法直接统计漫画作品举报与小说作品举报
- 无法直接统计漫画章节举报与小说章节举报
- 无法直接统计作品评论、章节评论、论坛根评论、论坛回复举报
- 举报目标类型的定义方式与点赞模块不一致

### 4.2 点赞模块的问题

点赞模块比举报模块更合理，因为当前点赞表已经直接区分：

- 漫画作品
- 小说作品
- 漫画章节
- 小说章节
- 论坛主题
- 评论

但评论点赞仍然存在一类典型问题：

- 表里只知道点的是评论
- 表里无法直接看出评论属于作品、章节还是论坛主题
- 表里无法直接区分根评论和回复评论

## 5. 改造目标

本次改造后，应当满足以下目标：

- 可以直接统计漫画作品、小说作品、漫画章节、小说章节、论坛主题的举报与点赞数据
- 可以直接统计评论所属场景，不必每次回查 `user_comment`
- 可以直接统计根评论与回复评论的举报与点赞数据
- 举报和点赞继续使用统一的 `targetType + targetId` 术语
- controller 直接切换到新 DTO，不兼容旧入参

## 6. 统一字段设计

### 6.1 核心字段

本次改造后的核心字段如下：

- `targetType`
  - 当前直接目标类型
- `targetId`
  - 当前直接目标 ID
- `sceneType`
  - 当前目标所属业务场景类型
- `sceneId`
  - 当前目标所属业务场景根对象 ID
- `commentLevel`
  - 当前目标为评论时，区分根评论和回复评论

### 6.2 字段职责说明

#### `targetType`

用于回答：

- 当前操作的直接对象是什么

例如：

- 点赞漫画作品
- 举报小说章节
- 举报评论
- 举报用户

#### `sceneType`

用于回答：

- 当前目标属于哪个业务场景

例如：

- 评论虽然直接目标是 `COMMENT`
- 但它可能属于漫画作品场景
- 也可能属于小说章节场景
- 也可能属于论坛主题场景

#### `commentLevel`

用于回答：

- 当前评论是根评论还是回复评论

这个字段只在 `targetType = COMMENT` 时有意义。

## 7. 常量设计

## 7.1 点赞目标类型

点赞继续使用现有 `InteractionTargetTypeEnum`，不改字段名，只补场景字段：

```ts
/**
 * 点赞目标类型
 *
 * 说明：
 * - 该枚举继续用于点赞、浏览、收藏等交互模块
 * - 点赞模块不改字段名，只补充场景维度
 */
export enum InteractionTargetTypeEnum {
  /** 漫画作品 */
  COMIC = 1,
  /** 小说作品 */
  NOVEL = 2,
  /** 漫画章节 */
  COMIC_CHAPTER = 3,
  /** 小说章节 */
  NOVEL_CHAPTER = 4,
  /** 论坛主题 */
  FORUM_TOPIC = 5,
  /** 评论 */
  COMMENT = 6,
}
```

## 7.2 举报目标类型

举报模块需要重构 `ReportTargetTypeEnum`，使其粒度与业务查询需求一致：

```ts
/**
 * 举报目标类型
 *
 * 说明：
 * - 该枚举表示被举报的直接对象
 * - 作品与章节必须区分漫画和小说
 * - 论坛回复不再单独作为目标类型
 * - 论坛回复统一归入 COMMENT，通过 sceneType 与 commentLevel 判断
 */
export enum ReportTargetTypeEnum {
  /** 漫画作品 */
  COMIC = 1,
  /** 小说作品 */
  NOVEL = 2,
  /** 漫画章节 */
  COMIC_CHAPTER = 3,
  /** 小说章节 */
  NOVEL_CHAPTER = 4,
  /** 论坛主题 */
  FORUM_TOPIC = 5,
  /** 评论 */
  COMMENT = 6,
  /** 用户 */
  USER = 7,
}
```

## 7.3 场景类型

```ts
/**
 * 业务场景类型
 *
 * 说明：
 * - 用于表示直接目标所属的业务根场景
 * - 该字段是统计维度，不替代 targetType
 */
export enum SceneTypeEnum {
  /** 漫画作品场景 */
  COMIC_WORK = 1,
  /** 小说作品场景 */
  NOVEL_WORK = 2,
  /** 漫画章节场景 */
  COMIC_CHAPTER = 3,
  /** 小说章节场景 */
  NOVEL_CHAPTER = 4,
  /** 论坛主题场景 */
  FORUM_TOPIC = 5,
  /** 用户主页场景 */
  USER_PROFILE = 6,
}
```

## 7.4 评论层级类型

```ts
/**
 * 评论层级类型
 *
 * 说明：
 * - 仅在 targetType 为 COMMENT 时使用
 * - ROOT 表示根评论
 * - REPLY 表示回复评论
 */
export enum CommentLevelEnum {
  /** 根评论 */
  ROOT = 1,
  /** 回复评论 */
  REPLY = 2,
}
```

## 7.5 举报状态与举报原因

举报状态与举报原因统一改为数字枚举：

```ts
/**
 * 举报状态
 */
export enum ReportStatusEnum {
  /** 待处理 */
  PENDING = 1,
  /** 处理中 */
  PROCESSING = 2,
  /** 已处理 */
  RESOLVED = 3,
  /** 已驳回 */
  REJECTED = 4,
}

/**
 * 举报原因类型
 */
export enum ReportReasonTypeEnum {
  /** 垃圾信息 */
  SPAM = 1,
  /** 不当内容 */
  INAPPROPRIATE_CONTENT = 2,
  /** 骚扰行为 */
  HARASSMENT = 3,
  /** 版权问题 */
  COPYRIGHT = 4,
  /** 其他原因 */
  OTHER = 99,
}
```

## 8. 表结构改造方案

## 8.1 user_like

```prisma
/// 用户点赞记录表
/// 统一记录用户对作品、章节、论坛主题、评论的点赞行为
model UserLike {
  /// 主键ID
  id Int @id @default(autoincrement())

  /// 点赞直接目标类型
  /// 取值见 InteractionTargetTypeEnum
  targetType Int @map("target_type") @db.SmallInt

  /// 点赞直接目标ID
  targetId Int @map("target_id")

  /// 所属场景类型
  /// 取值见 SceneTypeEnum
  sceneType Int @map("scene_type") @db.SmallInt

  /// 所属场景根对象ID
  sceneId Int @map("scene_id")

  /// 评论层级类型
  /// 仅 targetType 为 COMMENT 时有值
  commentLevel Int? @map("comment_level") @db.SmallInt

  /// 点赞用户ID
  userId Int @map("user_id")

  /// 点赞时间
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  /// 关联用户
  user AppUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// 同一用户对同一目标只能点赞一次
  @@unique([targetType, targetId, userId])
  /// 直接目标查询索引
  @@index([targetType, targetId])
  /// 场景统计索引
  @@index([sceneType, sceneId])
  /// 用户场景查询索引
  @@index([userId, sceneType, createdAt])
  /// 创建时间索引
  @@index([createdAt])
  @@map("user_like")
}
```

## 8.2 user_report

```prisma
/// 用户举报记录表
/// 统一记录用户对作品、章节、论坛主题、评论、用户的举报行为
model UserReport {
  /// 主键ID
  id Int @id @default(autoincrement())

  /// 举报人ID
  reporterId Int @map("reporter_id")

  /// 处理人ID
  handlerId Int? @map("handler_id")

  /// 举报直接目标类型
  /// 取值见 ReportTargetTypeEnum
  targetType Int @map("target_type") @db.SmallInt

  /// 举报直接目标ID
  targetId Int @map("target_id")

  /// 所属场景类型
  /// 取值见 SceneTypeEnum
  sceneType Int @map("scene_type") @db.SmallInt

  /// 所属场景根对象ID
  sceneId Int @map("scene_id")

  /// 评论层级类型
  /// 仅 targetType 为 COMMENT 时有值
  commentLevel Int? @map("comment_level") @db.SmallInt

  /// 举报原因类型
  /// 取值见 ReportReasonTypeEnum
  reasonType Int @map("reason_type") @db.SmallInt

  /// 举报补充说明
  description String? @db.VarChar(500)

  /// 证据链接
  evidenceUrl String? @map("evidence_url") @db.VarChar(500)

  /// 举报状态
  /// 取值见 ReportStatusEnum
  status Int @default(1) @db.SmallInt

  /// 处理备注
  handlingNote String? @map("handling_note") @db.VarChar(500)

  /// 处理时间
  handledAt DateTime? @map("handled_at") @db.Timestamptz(6)

  /// 创建时间
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  /// 更新时间
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  /// 关联举报人
  reporter AppUser @relation("UserReportReporter", fields: [reporterId], references: [id], onDelete: Cascade)

  /// 关联处理人
  handler AppUser? @relation("UserReportHandler", fields: [handlerId], references: [id])

  /// 同一用户对同一目标只能举报一次
  @@unique([reporterId, targetType, targetId])
  /// 直接目标查询索引
  @@index([targetType, targetId])
  /// 场景状态统计索引
  @@index([sceneType, sceneId, status])
  /// 场景时间统计索引
  @@index([sceneType, status, createdAt])
  /// 原因统计索引
  @@index([reasonType, status, createdAt])
  /// 处理维度索引
  @@index([handlerId, status, handledAt])
  /// 创建时间索引
  @@index([createdAt])
  @@map("user_report")
}
```

## 9. 场景映射规则

## 9.1 点赞映射规则

### 作品点赞

- 漫画作品
  - `targetType = COMIC`
  - `targetId = work.id`
  - `sceneType = COMIC_WORK`
  - `sceneId = work.id`
  - `commentLevel = null`

- 小说作品
  - `targetType = NOVEL`
  - `targetId = work.id`
  - `sceneType = NOVEL_WORK`
  - `sceneId = work.id`
  - `commentLevel = null`

### 章节点赞

- 漫画章节
  - `targetType = COMIC_CHAPTER`
  - `targetId = workChapter.id`
  - `sceneType = COMIC_CHAPTER`
  - `sceneId = workChapter.id`
  - `commentLevel = null`

- 小说章节
  - `targetType = NOVEL_CHAPTER`
  - `targetId = workChapter.id`
  - `sceneType = NOVEL_CHAPTER`
  - `sceneId = workChapter.id`
  - `commentLevel = null`

### 论坛主题点赞

- `targetType = FORUM_TOPIC`
- `targetId = forumTopic.id`
- `sceneType = FORUM_TOPIC`
- `sceneId = forumTopic.id`
- `commentLevel = null`

### 评论点赞

- `targetType = COMMENT`
- `targetId = userComment.id`
- `sceneType = 由 userComment.targetType 反查得到`
- `sceneId = userComment.targetId`
- `commentLevel = 由 replyToId 是否为空决定`

## 9.2 举报映射规则

### 作品举报

- 漫画作品
  - `targetType = COMIC`
  - `targetId = work.id`
  - `sceneType = COMIC_WORK`
  - `sceneId = work.id`
  - `commentLevel = null`

- 小说作品
  - `targetType = NOVEL`
  - `targetId = work.id`
  - `sceneType = NOVEL_WORK`
  - `sceneId = work.id`
  - `commentLevel = null`

### 章节举报

- 漫画章节
  - `targetType = COMIC_CHAPTER`
  - `targetId = workChapter.id`
  - `sceneType = COMIC_CHAPTER`
  - `sceneId = workChapter.id`
  - `commentLevel = null`

- 小说章节
  - `targetType = NOVEL_CHAPTER`
  - `targetId = workChapter.id`
  - `sceneType = NOVEL_CHAPTER`
  - `sceneId = workChapter.id`
  - `commentLevel = null`

### 论坛主题举报

- `targetType = FORUM_TOPIC`
- `targetId = forumTopic.id`
- `sceneType = FORUM_TOPIC`
- `sceneId = forumTopic.id`
- `commentLevel = null`

### 用户举报

- `targetType = USER`
- `targetId = appUser.id`
- `sceneType = USER_PROFILE`
- `sceneId = appUser.id`
- `commentLevel = null`

### 评论举报

- `targetType = COMMENT`
- `targetId = userComment.id`
- `sceneType = 由 userComment.targetType 反查得到`
- `sceneId = userComment.targetId`
- `commentLevel = 由 replyToId 是否为空决定`

说明：

- 论坛回复不再单独使用 `FORUM_REPLY`
- 论坛回复统一使用 `targetType = COMMENT`
- 是否为论坛回复由 `sceneType = FORUM_TOPIC` 且 `commentLevel = REPLY` 判断

## 10. controller 改造方案

## 10.1 举报 controller

现状问题：

- 作品、章节、评论、用户、主题、回复分别有不同接口
- DTO 重复
- service 逻辑分叉严重

改造后建议：

- 统一为 `POST /app/report`
- 入参统一使用 `targetType + targetId + reasonType`

示例请求体：

```json
{
  "targetType": 6,
  "targetId": 123,
  "reasonType": 2,
  "description": "该内容存在明显违规信息",
  "evidenceUrl": "https://example.com/evidence.png"
}
```

## 10.2 点赞 controller

改造后建议：

- `LikeController` 继续作为统一点赞入口
- 删除 `CommentController` 中单独的评论点赞与取消点赞接口
- 所有点赞都统一走 `targetType + targetId`

保留路由：

- `POST /app/like`
- `POST /app/like/cancel`
- `GET /app/like/status`
- `GET /app/like/my`

## 11. service 改造方案

## 11.1 新增统一目标解析器

建议新增统一目标解析服务，例如：

- `interaction-target-resolver.service.ts`

职责如下：

- 校验目标是否存在
- 解析 `sceneType`
- 解析 `sceneId`
- 解析 `commentLevel`
- 对评论类目标校验其归属场景是否合法

建议返回结构：

```ts
/**
 * 互动目标解析结果
 *
 * 说明：
 * - 该结构只在服务内部流转
 * - 统一用于举报与点赞落库
 */
export interface ResolvedTargetMeta {
  /** 直接目标类型 */
  targetType: number
  /** 直接目标ID */
  targetId: number
  /** 所属场景类型 */
  sceneType: SceneTypeEnum
  /** 所属场景根对象ID */
  sceneId: number
  /** 评论层级类型 */
  commentLevel?: CommentLevelEnum
}
```

## 11.2 举报服务改造

目标如下：

- 删除 `createWorkReport`
- 删除 `createForumReport`
- 统一为 `createReport`
- 通过统一目标解析器完成目标校验与场景补全

## 11.3 点赞服务改造

目标如下：

- 评论点赞并入统一点赞服务
- `CounterService` 正式支持 `COMMENT`
- 评论点赞通知走统一点赞链路

需要调整的点：

- `CounterService.getModel`
  - 增加 `COMMENT -> userComment`
- `CounterService.getWhere`
  - 增加 `COMMENT -> { id: targetId, deletedAt: null }`
- `LikeService.like`
  - 调用统一目标解析器
  - 落库写入 `sceneType`、`sceneId`、`commentLevel`
- 删除 `CommentInteractionService.likeComment`
- 删除 `CommentInteractionService.unlikeComment`

## 12. DTO 改造方案

## 12.1 设计原则

- 基础字段只定义一次
- 举报原因字段只定义一次
- 点赞与举报分别复用自己的目标类型 DTO
- 不再按作品、章节、主题、回复重复定义多套 DTO

## 12.2 建议目录

- `libs/interaction/src/dto/target.dto.ts`
- `libs/interaction/src/report/dto/report.dto.ts`
- `libs/interaction/src/like/dto/like.dto.ts`

## 12.3 DTO 草案

```ts
import {
  InteractionTargetTypeEnum,
  ReportReasonTypeEnum,
  ReportTargetTypeEnum,
} from '@libs/base/constant'
import {
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { IntersectionType } from '@nestjs/swagger'

/**
 * 基础目标ID请求体
 *
 * 说明：
 * - 所有多态目标请求都复用该 DTO
 * - 只承载目标ID，不承载目标类型
 */
export class TargetIdBodyDto {
  @NumberProperty({
    description: '目标ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number
}

/**
 * 点赞目标请求体
 *
 * 说明：
 * - 点赞接口统一使用该 DTO
 * - 目标类型沿用 InteractionTargetTypeEnum
 */
export class LikeTargetBodyDto extends TargetIdBodyDto {
  @EnumProperty({
    description: '点赞目标类型',
    enum: InteractionTargetTypeEnum,
    example: InteractionTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: InteractionTargetTypeEnum
}

/**
 * 举报目标请求体
 *
 * 说明：
 * - 举报接口统一使用该 DTO
 * - 目标类型使用重构后的 ReportTargetTypeEnum
 */
export class ReportTargetBodyDto extends TargetIdBodyDto {
  @EnumProperty({
    description: '举报目标类型',
    enum: ReportTargetTypeEnum,
    example: ReportTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: ReportTargetTypeEnum
}

/**
 * 举报原因请求体
 *
 * 说明：
 * - 原因类型必须使用数字枚举
 * - description 仅用于补充说明
 */
export class ReportReasonBodyDto {
  @EnumProperty({
    description: '举报原因类型',
    enum: ReportReasonTypeEnum,
    example: ReportReasonTypeEnum.INAPPROPRIATE_CONTENT,
    required: true,
  })
  reasonType!: ReportReasonTypeEnum

  @StringProperty({
    description: '举报补充说明',
    example: '该内容存在明显违规信息',
    required: false,
    maxLength: 500,
  })
  description?: string

  @StringProperty({
    description: '证据链接',
    example: 'https://example.com/evidence.png',
    required: false,
    maxLength: 500,
  })
  evidenceUrl?: string
}

/**
 * 创建举报请求体
 */
export class CreateReportBodyDto extends IntersectionType(
  ReportTargetBodyDto,
  ReportReasonBodyDto,
) {}

/**
 * 创建点赞请求体
 */
export class CreateLikeBodyDto extends LikeTargetBodyDto {}

/**
 * 取消点赞请求体
 */
export class CancelLikeBodyDto extends LikeTargetBodyDto {}
```

## 13. 一次性迁移方案

本次迁移为一次性切换，不兼容旧入参，不做双写。

## 13.1 迁移顺序

1. 修改常量定义
2. 修改 DTO
3. 修改 service 与 controller
4. 修改 Prisma schema
5. 在 migration 中完成数据回填
6. 删除旧的举报类型定义与旧逻辑
7. 发布新版本

## 13.2 user_like 回填规则

点赞表保留原有 `targetType + targetId`，只新增补充维度：

- `sceneType`
- `sceneId`
- `commentLevel`

回填方式如下：

- 作品、章节、论坛主题
  - `sceneType` 直接由现有 `targetType` 映射
  - `sceneId = targetId`
  - `commentLevel = null`
- 评论
  - join `user_comment`
  - `sceneType = 根据 userComment.targetType 映射`
  - `sceneId = userComment.targetId`
  - `commentLevel = 根据 replyToId 映射`

## 13.3 user_report 回填规则

举报表需要同时完成两类迁移：

- 将旧的 `targetType` 值改造成新的更细粒度定义
- 回填 `sceneType`、`sceneId`、`commentLevel`

### 旧举报目标类型到新举报目标类型

- `WORK`
  - 根据 `work.type` 改为 `COMIC` 或 `NOVEL`
- `WORK_CHAPTER`
  - 根据 `workChapter.workType` 改为 `COMIC_CHAPTER` 或 `NOVEL_CHAPTER`
- `FORUM_TOPIC`
  - 保持为 `FORUM_TOPIC`
- `USER`
  - 保持为 `USER`
- `COMMENT`
  - 保持为 `COMMENT`
- `FORUM_REPLY`
  - 统一改为 `COMMENT`

### 举报场景字段回填

- 作品举报
  - `sceneType = COMIC_WORK` 或 `NOVEL_WORK`
  - `sceneId = targetId`
  - `commentLevel = null`
- 章节举报
  - `sceneType = COMIC_CHAPTER` 或 `NOVEL_CHAPTER`
  - `sceneId = targetId`
  - `commentLevel = null`
- 论坛主题举报
  - `sceneType = FORUM_TOPIC`
  - `sceneId = targetId`
  - `commentLevel = null`
- 用户举报
  - `sceneType = USER_PROFILE`
  - `sceneId = targetId`
  - `commentLevel = null`
- 评论举报
  - join `user_comment`
  - `sceneType = 根据 userComment.targetType 映射`
  - `sceneId = userComment.targetId`
  - `commentLevel = 根据 replyToId 映射`

## 13.4 举报状态与原因回填规则

旧值转换为新值：

- `pending -> 1`
- `processing -> 2`
- `resolved -> 3`
- `rejected -> 4`

- `spam -> 1`
- `inappropriate_content -> 2`
- `harassment -> 3`
- `copyright -> 4`
- `other -> 99`

## 14. 改造后的查询能力

改造完成后，可以直接做以下查询而不必每次回查评论归属：

- 漫画作品点赞总数
- 小说作品点赞总数
- 漫画章节举报总数
- 小说章节举报总数
- 作品评论举报总数
- 章节评论举报总数
- 论坛根评论举报总数
- 论坛回复举报总数
- 根评论点赞总数
- 回复评论点赞总数

典型查询维度：

- 按 `targetType` 汇总直接目标分布
- 按 `sceneType` 汇总业务场景分布
- 按 `commentLevel` 汇总评论层级分布
- 按 `sceneType + createdAt` 做趋势统计
- 按 `sceneType + status` 做举报处理看板

## 15. 代码实施规范

## 15.1 注释规范

实施时必须满足：

- 所有新增和修改的注释都使用中文
- 注释必须解释业务含义，而不是简单重复代码
- 表字段注释必须说明字段存在原因
- DTO 注释必须说明 DTO 的使用场景

## 15.2 类型规范

实施时必须满足：

- 所有类型、状态、原因字段统一使用数字枚举
- Prisma 中统一使用 `Int @db.SmallInt`
- DTO 中统一使用数字枚举类型
- 不允许新增字符串枚举承担类型职责

## 15.3 DTO 规范

实施时必须满足：

- 目标 ID 基础字段只定义一次
- 举报原因字段只定义一次
- 点赞 DTO 与举报 DTO 通过组合复用
- 不允许再保留 `ReportWorkBodyDto`、`ReportChapterBodyDto`、`ReportForumReplyBodyDto` 这类重复 DTO

## 16. 需要同步删除的旧内容

- 举报模块旧的场景拆分 controller 路由
- 举报模块旧的场景拆分 DTO
- 举报模块旧的 `createWorkReport`
- 举报模块旧的 `createForumReport`
- `CommentController` 中单独的评论点赞入口
- `CommentInteractionService` 中仅服务旧评论点赞模式的方法
- 任何只为兼容旧举报类型分支而存在的转换逻辑

## 17. 验收清单

确认实施前，建议以以下清单作为验收标准：

- 举报与点赞继续统一使用 `targetType + targetId`
- 举报表已完成漫画/小说/章节粒度细化
- 举报与点赞两张表都已补充 `sceneType`、`sceneId`、`commentLevel`
- 举报状态与举报原因都已改为数字枚举
- controller 已不兼容旧入参
- 评论点赞已并入统一点赞服务
- 评论举报已并入统一举报服务
- 可以直接按 `sceneType` 统计漫画、小说、章节、论坛数据
- 可以直接按 `commentLevel` 统计根评论与回复评论数据
- DTO 已完成高复用收敛

## 18. 下一步建议

如果本文档确认通过，下一步建议按以下顺序实施：

1. 先改常量与 DTO
2. 再实现统一目标解析器
3. 再改点赞服务
4. 再改举报服务
5. 最后生成 migration 并完成回填

本文档确认后，后续实施建议严格以本文档为准，不再引入 `subjectType + subjectId` 方案。
