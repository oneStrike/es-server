import {
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, IdDto, PageDto } from '@libs/base/dto'
import {
  ForumAuditStatusEnum,
  ForumReplySortFieldEnum,
  ForumReplySortOrderEnum,
} from '../forum-reply.constant'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

/**
 * 论坛回复基础DTO
 */
export class BaseForumReplyDto extends BaseDto {
  @StringProperty({
    description: '回复内容',
    example: '这是一个很好的问题...',
    required: true,
  })
  content!: string

  @NumberProperty({
    description: '关联的主题ID',
    example: 1,
    required: true,
    min: 1,
  })
  topicId!: number

  @NumberProperty({
    description: '论坛用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @NumberProperty({
    description: '回复的回复ID（楼中楼）',
    example: 2,
    required: false,
  })
  replyToId?: number

  @NumberProperty({
    description: '实际回复的回复ID（用于追溯完整回复链）',
    example: 3,
    required: false,
  })
  actualReplyToId?: number

  @NumberProperty({
    description: '楼层号（直接回复主题的楼层号，楼中楼为null）',
    example: 1,
    required: false,
  })
  floor?: number

  @StringProperty({
    description: '回复的回复',
    required: false,
    minLength: 1,
  })
  replyTo?: string

  @BooleanProperty({
    description: '是否隐藏',
    example: false,
    required: true,
    default: false,
  })
  isHidden!: boolean

  @EnumProperty({
    description: '审核状态（0=待审核, 1=已通过, 2=已拒绝）',
    example: ForumAuditStatusEnum.APPROVED,
    required: true,
    enum: ForumAuditStatusEnum,
    default: ForumAuditStatusEnum.APPROVED,
  })
  auditStatus!: ForumAuditStatusEnum

  @StringProperty({
    description: '审核拒绝原因',
    example: '内容包含敏感信息',
    required: false,
    maxLength: 500,
  })
  auditReason?: string
}

/**
 * 创建论坛回复DTO
 */
export class CreateForumReplyDto extends PickType(BaseForumReplyDto, [
  'content',
  'topicId',
  'userId',
  'replyToId',
]) {}

/**
 * 查询论坛回复DTO
 */
export class QueryForumReplyDto extends IntersectionType(
  PageDto,
  IntersectionType(
    PartialType(
      PickType(BaseForumReplyDto, [
        'content',
        'isHidden',
        'auditStatus',
        'floor',
      ]),
    ),
    PartialType(PickType(CreateForumReplyDto, ['topicId', 'replyToId'])),
  ),
) {
  @EnumProperty({
    description:
      '排序字段（floor=楼层号, createdAt=创建时间, likeCount=点赞数）',
    example: ForumReplySortFieldEnum.FLOOR,
    required: false,
    enum: ForumReplySortFieldEnum,
  })
  sortBy?: ForumReplySortFieldEnum

  @EnumProperty({
    description: '排序方式（asc=升序, desc=降序）',
    example: ForumReplySortOrderEnum.ASC,
    required: false,
    enum: ForumReplySortOrderEnum,
  })
  sortOrder?: ForumReplySortOrderEnum
}

/**
 * 更新回复审核状态DTO
 */
export class UpdateForumReplyAuditStatusDto extends IntersectionType(
  IdDto,
  PickType(BaseForumReplyDto, ['auditStatus']),
) {}

/**
 * 更新回复隐藏状态DTO
 */
export class UpdateForumReplyHiddenDto extends IntersectionType(
  IdDto,
  PickType(BaseForumReplyDto, ['isHidden']),
) {}
