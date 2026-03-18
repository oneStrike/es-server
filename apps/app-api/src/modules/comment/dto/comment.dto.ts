import { BaseCommentDto, CommentTargetTypeEnum } from '@libs/interaction'
import { EnumProperty, NumberProperty } from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
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

export class CommentItemDto extends BaseCommentDto {}
