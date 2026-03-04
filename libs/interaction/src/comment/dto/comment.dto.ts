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
    description: 'Target type',
    enum: InteractionTargetType,
    example: InteractionTargetType.COMIC,
    required: true,
  })
  targetType!: InteractionTargetType

  @NumberProperty({
    description: 'Target ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @NumberProperty({
    description: 'Comment user ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @StringProperty({
    description: 'Comment content',
    example: 'Nice work!',
    required: true,
    minLength: 1,
  })
  content!: string

  @NumberProperty({
    description: 'Replied comment ID',
    example: 1,
    required: false,
    min: 1,
  })
  replyToId?: number

  @NumberProperty({
    description: 'Floor number',
    example: 1,
    required: false,
    min: 1,
  })
  floor?: number

  @BooleanProperty({
    description: 'Hidden status',
    example: false,
    required: true,
    default: false,
  })
  isHidden!: boolean

  @EnumProperty({
    description: 'Audit status',
    enum: AuditStatus,
    example: AuditStatus.APPROVED,
    required: true,
    default: AuditStatus.APPROVED,
  })
  auditStatus!: AuditStatus

  @StringProperty({
    description: 'Audit reason',
    example: 'policy violation',
    required: false,
    maxLength: 500,
  })
  auditReason?: string
}

export class CommentIdDto {
  @NumberProperty({
    description: 'Comment ID',
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
    description: 'Only root comments',
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
