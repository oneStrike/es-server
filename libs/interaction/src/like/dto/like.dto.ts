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

/**
 * 创建点赞请求体。
 *
 * 说明：
 * - 所有点赞入口统一使用该 DTO
 * - 评论点赞不再单独维护独立接口 DTO
 */
export class CreateLikeBodyDto extends LikeTargetBodyDto {}

/**
 * 取消点赞请求体。
 */
export class CancelLikeBodyDto extends LikeTargetBodyDto {}

/**
 * 点赞状态查询参数。
 */
export class LikeStatusQueryDto extends LikeTargetBodyDto {}

/**
 * 我的点赞列表查询参数。
 */
export class LikeListQueryDto extends PartialType(PageDto) {
  @EnumProperty({
    description: '目标类型筛选',
    enum: InteractionTargetTypeEnum,
    example: InteractionTargetTypeEnum.COMIC,
    required: false,
  })
  targetType?: InteractionTargetTypeEnum
}

/**
 * 点赞状态响应体。
 */
export class LikeStatusResponseDto {
  @NumberProperty({
    description: '目标 ID',
    example: 1,
    required: true,
  })
  targetId!: number

  @BooleanProperty({
    description: '是否已点赞',
    example: true,
    required: true,
  })
  isLiked!: boolean
}

/**
 * 点赞记录响应体。
 *
 * 说明：
 * - 返回直接目标与场景维度，便于后续分页展示和前端筛选
 */
export class LikeRecordResponseDto {
  @NumberProperty({ description: '点赞记录 ID', example: 1, required: true })
  id!: number

  @EnumProperty({
    description: '点赞目标类型',
    enum: InteractionTargetTypeEnum,
    example: InteractionTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: InteractionTargetTypeEnum

  @NumberProperty({ description: '点赞目标 ID', example: 1, required: true })
  targetId!: number

  @EnumProperty({
    description: '所属业务场景类型',
    enum: SceneTypeEnum,
    example: SceneTypeEnum.COMIC_WORK,
    required: true,
  })
  sceneType!: SceneTypeEnum

  @NumberProperty({
    description: '所属业务场景根对象 ID',
    example: 1,
    required: true,
  })
  sceneId!: number

  @EnumProperty({
    description: '评论层级，仅评论点赞时有值',
    enum: CommentLevelEnum,
    example: CommentLevelEnum.ROOT,
    required: false,
  })
  commentLevel?: CommentLevelEnum

  @DateProperty({
    description: '点赞时间',
    example: '2026-03-09T10:00:00.000Z',
    required: true,
  })
  createdAt!: Date
}
