import {
  CommentLevelEnum,
  InteractionTargetTypeEnum,
  SceneTypeEnum,
} from '@libs/base/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
} from '@libs/base/decorators'
import { PageDto } from '@libs/base/dto'
import { PartialType } from '@nestjs/swagger'
import { LikeTargetBodyDto } from '../../dto/target.dto'

export class CreateLikeBodyDto extends LikeTargetBodyDto {}

export class CancelLikeBodyDto extends LikeTargetBodyDto {}

export class LikeStatusQueryDto extends LikeTargetBodyDto {}

export class LikeListQueryDto extends PartialType(PageDto) {
  @EnumProperty({
    description: '目标类型筛选',
    enum: InteractionTargetTypeEnum,
    example: InteractionTargetTypeEnum.COMIC,
    required: false,
  })
  targetType?: InteractionTargetTypeEnum
}

export class LikeStatusResponseDto {
  @NumberProperty({
    description: '目标 ID',
    example: 1,
    required: true,
    validation: false,
  })
  targetId!: number

  @BooleanProperty({
    description: '是否已点赞',
    example: true,
    required: true,
    validation: false,
  })
  isLiked!: boolean
}

export class LikeRecordResponseDto {
  @NumberProperty({
    description: '点赞记录 ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @EnumProperty({
    description: '点赞目标类型',
    enum: InteractionTargetTypeEnum,
    example: InteractionTargetTypeEnum.COMIC,
    required: true,
    validation: false,
  })
  targetType!: InteractionTargetTypeEnum

  @NumberProperty({
    description: '点赞目标 ID',
    example: 1,
    required: true,
    validation: false,
  })
  targetId!: number

  @EnumProperty({
    description: '所属业务场景类型',
    enum: SceneTypeEnum,
    example: SceneTypeEnum.COMIC_WORK,
    required: true,
    validation: false,
  })
  sceneType!: SceneTypeEnum

  @NumberProperty({
    description: '所属业务场景根对象 ID',
    example: 1,
    required: true,
    validation: false,
  })
  sceneId!: number

  @EnumProperty({
    description: '评论层级，仅评论点赞时存在',
    enum: CommentLevelEnum,
    example: CommentLevelEnum.ROOT,
    required: false,
    validation: false,
  })
  commentLevel?: CommentLevelEnum

  @DateProperty({
    description: '点赞时间',
    example: '2026-03-09T10:00:00.000Z',
    required: true,
    validation: false,
  })
  createdAt!: Date
}
