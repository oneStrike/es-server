import { AuditStatusEnum, InteractionTargetTypeEnum } from '@libs/base/constant'
import {
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, PageDto, UserIdDto } from '@libs/base/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

/**
 * 交互目标 DTO - 包含目标类型和目标ID
 * 用于评论、点赞等交互操作的目标对象标识
 */
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

/**
 * 评论审核信息 DTO - 包含审核状态相关字段
 */
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

/**
 * 评论基础 DTO - 包含评论的所有基础字段
 */
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

/**
 * 评论ID DTO - 用于接收评论ID参数
 */
export class CommentIdDto {
  @NumberProperty({
    description: '评论ID',
    example: 1,
    required: true,
    min: 1,
  })
  commentId!: number
}

/**
 * 创建评论 DTO - 内部服务使用
 */
export class CreateCommentDto extends IntersectionType(
  UserIdDto,
  InteractionTargetDto,
  PickType(BaseCommentDto, ['content', 'replyToId']),
) {}

/**
 * 创建评论请求体 DTO - API接口使用（不含userId）
 */
export class CreateCommentBodyDto extends IntersectionType(
  InteractionTargetDto,
  PickType(BaseCommentDto, ['content']),
) {}

/**
 * 回复目标 DTO - 包含回复目标评论ID
 */
export class ReplyTargetDto {
  @NumberProperty({
    description: '回复的评论ID',
    example: 1,
    required: true,
    min: 1,
  })
  replyToId!: number
}

/**
 * 回复评论 DTO - 内部服务使用
 */
export class ReplyCommentDto extends IntersectionType(
  UserIdDto,
  ReplyTargetDto,
  PickType(BaseCommentDto, ['content']),
) {}

/**
 * 回复评论请求体 DTO - API接口使用（不含userId）
 */
export class ReplyCommentBodyDto extends IntersectionType(
  ReplyTargetDto,
  PickType(BaseCommentDto, ['content']),
) {}

/**
 * 查询评论分页 DTO
 */
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

/**
 * 查询我的评论分页 DTO
 */
export class QueryMyCommentPageDto extends IntersectionType(
  PageDto,
  PartialType(InteractionTargetDto),
  PickType(PartialType(CommentAuditDto), ['auditStatus']),
) {}

/**
 * 更新评论审核状态 DTO
 */
export class UpdateCommentAuditDto extends IntersectionType(
  CommentIdDto,
  CommentAuditDto,
) {}

/**
 * 更新评论隐藏状态 DTO
 */
export class UpdateCommentHiddenDto extends IntersectionType(
  CommentIdDto,
  PickType(BaseCommentDto, ['isHidden']),
) {}

/**
 * 重新计算评论数量 DTO
 */
export class RecalcCommentCountDto extends InteractionTargetDto {}

/**
 * 查询评论回复列表 DTO
 */
export class QueryCommentRepliesDto extends IntersectionType(
  PageDto,
  CommentIdDto,
) {}
