import {
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { AuditStatus, InteractionTargetType } from '../../interaction.constant'

export class BaseCommentDto extends BaseDto {
  @EnumProperty({
    description: '目标类型',
    enum: InteractionTargetType,
    example: InteractionTargetType.COMIC,
    required: true,
  })
  targetType!: InteractionTargetType

  @NumberProperty({
    description: '目标ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @NumberProperty({
    description: '评论用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @StringProperty({
    description: '评论内容',
    example: '写得真棒！',
    required: true,
    minLength: 1,
  })
  content!: string

  @NumberProperty({
    description: '回复的评论ID',
    example: 1,
    required: false,
    min: 1,
  })
  replyToId?: number

  @NumberProperty({
    description: '楼层号',
    example: 1,
    required: false,
    min: 1,
  })
  floor?: number

  @BooleanProperty({
    description: '隐藏状态',
    example: false,
    required: true,
    default: false,
  })
  isHidden!: boolean

  @EnumProperty({
    description: '审核状态',
    enum: AuditStatus,
    example: AuditStatus.APPROVED,
    required: true,
    default: AuditStatus.APPROVED,
  })
  auditStatus!: AuditStatus

  @StringProperty({
    description: '审核原因',
    example: '违反社区规范',
    required: false,
    maxLength: 500,
  })
  auditReason?: string
}

export class CommentIdDto {
  @NumberProperty({
    description: '评论ID',
    example: 1,
    required: true,
    min: 1,
  })
  commentId!: number
}

export class CreateCommentDto extends PickType(BaseCommentDto, [
  'targetType',
  'targetId',
  'content',
  'replyToId',
]) {}

export class DeleteCommentDto extends CommentIdDto {}

export class QueryCommentPageDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BaseCommentDto), [
    'targetType',
    'targetId',
    'auditStatus',
    'isHidden',
  ]),
) {
  @BooleanProperty({
    description: '仅根评论',
    example: true,
    required: false,
  })
  rootOnly?: boolean
}

export class UpdateCommentAuditDto extends IntersectionType(
  CommentIdDto,
  PickType(BaseCommentDto, ['auditStatus', 'auditReason']),
) {}

export class UpdateCommentHiddenDto extends IntersectionType(
  CommentIdDto,
  PickType(BaseCommentDto, ['isHidden']),
) {}

export class RecalcCommentCountDto extends PickType(BaseCommentDto, [
  'targetType',
  'targetId',
]) {}

export class QueryCommentRepliesDto extends IntersectionType(PageDto, CommentIdDto) {}
