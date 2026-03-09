import {
  AuditStatusEnum,
  InteractionTargetTypeEnum,
} from '@libs/base/constant'
import {
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, PageDto, UserIdDto } from '@libs/base/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { InteractionTargetBodyDto } from '../../dto/target.dto'

export class BaseCommentDto extends BaseDto {
  @EnumProperty({
    description: '目标类型',
    enum: InteractionTargetTypeEnum,
    example: InteractionTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: InteractionTargetTypeEnum

  @NumberProperty({ description: '目标 ID', example: 1, required: true, min: 1 })
  targetId!: number

  @NumberProperty({
    description: '评论用户 ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @StringProperty({
    description: '评论内容',
    example: '写得很棒',
    required: true,
    minLength: 1,
    maxLength: 2000,
  })
  content!: string

  @NumberProperty({
    description: '回复的评论 ID',
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
    description: '是否隐藏',
    example: false,
    required: true,
    default: false,
  })
  isHidden!: boolean

  @EnumProperty({
    description: '审核状态',
    enum: AuditStatusEnum,
    example: AuditStatusEnum.APPROVED,
    required: true,
    default: AuditStatusEnum.APPROVED,
  })
  auditStatus!: AuditStatusEnum

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
    description: '评论 ID',
    example: 1,
    required: true,
    min: 1,
  })
  commentId!: number
}

export class CreateCommentDto extends IntersectionType(
  UserIdDto,
  InteractionTargetBodyDto,
  PickType(BaseCommentDto, ['content', 'replyToId']),
) {}

export class CreateCommentBodyDto extends IntersectionType(
  InteractionTargetBodyDto,
  PickType(BaseCommentDto, ['content']),
) {}

export class ReplyTargetDto {
  @NumberProperty({
    description: '回复的评论 ID',
    example: 1,
    required: true,
    min: 1,
  })
  replyToId!: number
}

export class ReplyCommentDto extends IntersectionType(
  UserIdDto,
  ReplyTargetDto,
  PickType(BaseCommentDto, ['content']),
) {}

export class ReplyCommentBodyDto extends IntersectionType(
  ReplyTargetDto,
  PickType(BaseCommentDto, ['content']),
) {}

export class QueryMyCommentPageDto extends IntersectionType(
  PageDto,
  PartialType(InteractionTargetBodyDto),
  PickType(PartialType(BaseCommentDto), ['auditStatus']),
) {}

export class QueryCommentRepliesDto extends IntersectionType(
  PageDto,
  CommentIdDto,
) {}
