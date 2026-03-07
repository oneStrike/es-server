import {
  AuditRoleEnum,
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
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class InteractionTargetDto {
  @EnumProperty({
    description: '目标类型',
    enum: InteractionTargetTypeEnum,
    example: InteractionTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: InteractionTargetTypeEnum

  @NumberProperty({ description: '目标ID', example: 1, required: true, min: 1 })
  targetId!: number
}

export class CommentAuditDto {
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

export class BaseCommentDto extends BaseDto {
  @EnumProperty({
    description: '目标类型',
    enum: InteractionTargetTypeEnum,
    example: InteractionTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: InteractionTargetTypeEnum

  @NumberProperty({ description: '目标ID', example: 1, required: true, min: 1 })
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
    example: '写得很棒',
    required: true,
    minLength: 1,
    maxLength: 2000,
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
    description: '评论ID',
    example: 1,
    required: true,
    min: 1,
  })
  commentId!: number
}

export class CreateCommentDto extends IntersectionType(
  UserIdDto,
  InteractionTargetDto,
  PickType(BaseCommentDto, ['content', 'replyToId']),
) {}

export class CreateCommentBodyDto extends IntersectionType(
  InteractionTargetDto,
  PickType(BaseCommentDto, ['content']),
) {}

export class ReplyTargetDto {
  @NumberProperty({
    description: '回复的评论ID',
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

export class QueryCommentPageDto extends IntersectionType(
  PageDto,
  PartialType(InteractionTargetDto),
  PickType(PartialType(BaseCommentDto), ['auditStatus', 'isHidden']),
) {
  @BooleanProperty({
    description: '仅根评论',
    example: true,
    required: false,
  })
  rootOnly?: boolean
}

export class QueryMyCommentPageDto extends IntersectionType(
  PageDto,
  PartialType(InteractionTargetDto),
  PickType(PartialType(CommentAuditDto), ['auditStatus']),
) {}

export class UpdateCommentAuditDto extends IntersectionType(
  CommentIdDto,
  CommentAuditDto,
) {
  @NumberProperty({
    description: '审核人ID',
    example: 1,
    required: true,
    validation: false,
  })
  operatorId!: number

  @EnumProperty({
    description: '审核人角色',
    enum: AuditRoleEnum,
    example: AuditRoleEnum.ADMIN,
    required: true,
    default: AuditRoleEnum.ADMIN,
    validation: false,
  })
  auditRole!: AuditRoleEnum
}

export class UpdateCommentAuditBodyDto extends OmitType(UpdateCommentAuditDto, [
  'operatorId',
  'auditRole',
]) {}

export class UpdateCommentHiddenDto extends IntersectionType(
  CommentIdDto,
  PickType(BaseCommentDto, ['isHidden']),
) {}

export class RecalcCommentCountDto extends InteractionTargetDto {}

export class QueryCommentRepliesDto extends IntersectionType(
  PageDto,
  CommentIdDto,
) {}
