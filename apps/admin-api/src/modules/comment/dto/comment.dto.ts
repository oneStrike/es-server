import { BaseCommentDto } from '@libs/interaction/comment'
import {
  NestedProperty,
} from '@libs/platform/decorators'
import { BaseAppUserDto } from '@libs/user/core'
import {
  PickType,
} from '@nestjs/swagger'

export class AdminCommentUserDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
  'isEnabled',
  'status',
] as const) {}

export class AdminCommentReplyTargetDto extends PickType(BaseCommentDto, [
  'id',
  'userId',
  'content',
  'replyToId',
  'actualReplyToId',
  'auditStatus',
  'isHidden',
  'deletedAt',
  'createdAt',
] as const) {
  @NestedProperty({
    description: '被回复评论的作者信息',
    required: false,
    nullable: false,
    type: AdminCommentUserDto,
    validation: false,
  })
  user!: AdminCommentUserDto
}

export class AdminCommentPageItemDto extends PickType(BaseCommentDto, [
  'id',
  'targetType',
  'targetId',
  'userId',
  'content',
  'bodyTokens',
  'floor',
  'replyToId',
  'actualReplyToId',
  'isHidden',
  'auditStatus',
  'auditById',
  'auditRole',
  'auditReason',
  'auditAt',
  'likeCount',
  'sensitiveWordHits',
  'createdAt',
  'updatedAt',
] as const) {
  @NestedProperty({
    description: '评论作者信息',
    required: false,
    nullable: false,
    type: AdminCommentUserDto,
    validation: false,
  })
  user!: AdminCommentUserDto
}

export class AdminCommentDetailDto extends PickType(BaseCommentDto, [
  'id',
  'targetType',
  'targetId',
  'userId',
  'content',
  'bodyTokens',
  'floor',
  'replyToId',
  'actualReplyToId',
  'isHidden',
  'auditStatus',
  'auditById',
  'auditRole',
  'auditReason',
  'auditAt',
  'likeCount',
  'sensitiveWordHits',
  'createdAt',
  'updatedAt',
  'deletedAt',
] as const) {
  @NestedProperty({
    description: '评论作者信息',
    required: false,
    nullable: false,
    type: AdminCommentUserDto,
    validation: false,
  })
  user!: AdminCommentUserDto

  @NestedProperty({
    description: '被回复评论简要信息',
    required: false,
    nullable: false,
    type: AdminCommentReplyTargetDto,
    validation: false,
  })
  replyTo!: AdminCommentReplyTargetDto
}
