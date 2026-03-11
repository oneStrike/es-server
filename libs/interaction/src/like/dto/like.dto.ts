import {
  CommentLevelEnum,
  InteractionTargetTypeEnum,
  SceneTypeEnum,
} from '@libs/base/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { PageDto } from '@libs/base/dto'
import { IntersectionType, PickType } from '@nestjs/swagger'
import { LikeTargetBodyDto } from '../../dto/target.dto'

/**
 * 点赞目标 DTO
 * 用于指定点赞操作的目标类型和目标 ID
 */
export class LikeTargetDto extends LikeTargetBodyDto {}

export class CreateLikeBodyDto extends LikeTargetDto {}

export class CancelLikeBodyDto extends LikeTargetDto {}

export class LikeStatusQueryDto extends LikeTargetDto {}

/**
 * 点赞列表查询 DTO
 */
export class LikePageQueryDto extends IntersectionType(
  PageDto,
  PickType(LikeTargetDto, ['targetType']),
) {}

export class LikeStatusResponseDto {
  @BooleanProperty({
    description: '是否已点赞',
    example: true,
    required: true,
    validation: false,
  })
  isLiked!: boolean
}

/**
 * 点赞作品简要信息响应 DTO
 */
export class LikeWorkBriefDto {
  @NumberProperty({
    description: '作品ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '作品名称',
    example: '进击的巨人',
    required: true,
    validation: false,
  })
  name!: string

  @StringProperty({
    description: '作品封面',
    example: 'https://example.com/cover.jpg',
    required: true,
    validation: false,
  })
  cover!: string
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

  @NestedProperty({
    description: '作品信息（仅作品类型返回）',
    type: LikeWorkBriefDto,
    required: false,
    nullable: false,
    validation: false,
  })
  work?: LikeWorkBriefDto
}
