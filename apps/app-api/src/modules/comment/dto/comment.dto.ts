import {
  BaseCommentDto,
  CommentTargetTypeEnum,
} from '@libs/interaction/comment'
import {
  ArrayProperty,
  BooleanProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { BaseAppUserDto } from '@libs/user/core'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

export class CommentIdDto {
  @NumberProperty({
    description: '评论 ID',
    example: 1,
    required: true,
    min: 1,
  })
  commentId!: number
}

export class CommentTargetDto {
  @NumberProperty({
    description: '目标 ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @EnumProperty({
    description: '评论目标类型',
    enum: CommentTargetTypeEnum,
    example: CommentTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: CommentTargetTypeEnum
}

export class ReplyTargetDto {
  @NumberProperty({
    description: '回复的评论 ID',
    example: 1,
    required: true,
    min: 1,
  })
  replyToId!: number
}

export class CreateCommentBodyDto extends IntersectionType(
  CommentTargetDto,
  PickType(BaseCommentDto, ['content']),
) {}

export class ReplyCommentBodyDto extends IntersectionType(
  ReplyTargetDto,
  PickType(BaseCommentDto, ['content']),
) {}

export class QueryMyCommentPageDto extends IntersectionType(
  PageDto,
  PartialType(CommentTargetDto),
  PickType(PartialType(BaseCommentDto), ['auditStatus']),
) {}

export class QueryCommentRepliesDto extends IntersectionType(
  PageDto,
  CommentIdDto,
) {}

export class CommentUserDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
] as const) {}

export class CommentReplyItemDto extends BaseCommentDto {
  @BooleanProperty({
    description: '当前用户是否已点赞该回复',
    example: false,
    required: true,
    validation: false,
  })
  liked!: boolean

  @NestedProperty({
    description: '回复用户',
    required: false,
    nullable: false,
    type: CommentUserDto,
    validation: false,
  })
  user!: CommentUserDto
}

export class CommentPreviewReplyDto extends PickType(BaseCommentDto, [
  'id',
  'userId',
  'content',
  'bodyTokens',
  'replyToId',
  'likeCount',
  'createdAt',
] as const) {
  @BooleanProperty({
    description: '当前用户是否已点赞该回复',
    example: false,
    required: true,
    validation: false,
  })
  liked!: boolean

  @NestedProperty({
    description: '回复用户',
    required: false,
    nullable: false,
    type: CommentUserDto,
    validation: false,
  })
  user!: CommentUserDto
}

export class TargetCommentItemDto extends PickType(BaseCommentDto, [
  'id',
  'targetType',
  'targetId',
  'userId',
  'content',
  'bodyTokens',
  'floor',
  'likeCount',
  'createdAt',
] as const) {
  @NestedProperty({
    description: '评论用户',
    required: false,
    nullable: false,
    type: CommentUserDto,
    validation: false,
  })
  user!: CommentUserDto

  @BooleanProperty({
    description: '当前用户是否已点赞该评论',
    example: true,
    required: true,
    validation: false,
  })
  liked!: boolean

  @NumberProperty({
    description: '楼中楼回复总数',
    required: true,
    validation: false,
    example: 12,
  })
  replyCount!: number

  @ArrayProperty({
    description: '楼中楼预览（最多3条）',
    itemClass: CommentPreviewReplyDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  previewReplies!: CommentPreviewReplyDto[]

  @BooleanProperty({
    description: '是否还有更多楼中楼回复',
    required: true,
    validation: false,
    example: true,
  })
  hasMoreReplies!: boolean
}
