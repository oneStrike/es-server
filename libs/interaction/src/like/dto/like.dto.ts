import { CommentLevelEnum, SceneTypeEnum } from '@libs/platform/constant'
import {
  DateProperty,
  EnumProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { IdDto, PageDto, UserIdDto } from '@libs/platform/dto'
import {
  IntersectionType,
  PickType,
} from '@nestjs/swagger'
import { LikeTargetTypeEnum } from '../like.constant'

/**
 * 点赞记录基础 DTO（全量字段）
 */
export class BaseLikeDto extends IntersectionType(IdDto, UserIdDto) {
  @NumberProperty({
    description: '点赞目标 ID',
    example: 1,
    required: true,
  })
  targetId!: number

  @EnumProperty({
    description:
      '点赞目标类型（1=漫画，2=小说，3=论坛主题，4=漫画章节，5=小说章节，6=评论）',
    enum: LikeTargetTypeEnum,
    example: LikeTargetTypeEnum.WORK_COMIC,
    required: true,
  })
  targetType!: LikeTargetTypeEnum

  @EnumProperty({
    description: '业务场景类型',
    enum: SceneTypeEnum,
    example: SceneTypeEnum.COMIC_WORK,
    required: true,
  })
  sceneType!: SceneTypeEnum

  @NumberProperty({
    description: '业务场景根对象 ID',
    example: 1,
    required: true,
  })
  sceneId!: number

  @EnumProperty({
    description: '评论层级（仅评论目标有值）',
    enum: CommentLevelEnum,
    example: CommentLevelEnum.ROOT,
    required: false,
  })
  commentLevel?: CommentLevelEnum | null

  @DateProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  createdAt!: Date
}

export class LikeTargetDto extends PickType(BaseLikeDto, [
  'targetId',
  'targetType',
] as const) {}

export class LikeRecordDto extends IntersectionType(
  LikeTargetDto,
  PickType(BaseLikeDto, ['userId'] as const),
) {}

export class LikePageQueryDto extends IntersectionType(
  PageDto,
  PickType(BaseLikeDto, ['targetType'] as const),
) {}
