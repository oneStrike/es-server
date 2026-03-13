import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PickType } from '@nestjs/swagger'
import { FavoriteTargetTypeEnum } from '../favorite.constant'

/**
 * 收藏目标 DTO
 * 用于指定收藏操作的目标类型和目标 ID
 */
export class FavoriteTargetDto {
  @NumberProperty({
    description: '收藏的目标id',
    example: 1,
    required: true,
  })
  targetId!: number

  @EnumProperty({
    description: '收藏目标类型（1=漫画，2=小说，3=论坛主题）',
    enum: FavoriteTargetTypeEnum,
    example: FavoriteTargetTypeEnum.WORK_COMIC,
    required: true,
  })
  targetType!: FavoriteTargetTypeEnum
}

/**
 * 收藏列表查询 DTO
 */
export class FavoritePageQueryDto extends IntersectionType(
  PageDto,
  PickType(FavoriteTargetDto, ['targetType']),
) {}

/**
 * 收藏状态响应 DTO
 */
export class FavoriteStatusResponseDto {
  @BooleanProperty({
    description: '是否已收藏',
    example: true,
    required: true,
    validation: false,
  })
  isFavorited!: boolean
}

/**
 * 收藏作品简要信息响应 DTO
 */
export class FavoriteWorkBriefDto {
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

/**
 * 收藏列表项响应 DTO
 */
export class FavoritePageItemDto {
  @NumberProperty({
    description: '收藏记录ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
    validation: false,
  })
  userId!: number

  @NumberProperty({
    description: '收藏目标ID',
    example: 1,
    required: true,
    validation: false,
  })
  targetId!: number

  @EnumProperty({
    description: '收藏目标类型（1=漫画，2=小说，3=论坛主题）',
    enum: FavoriteTargetTypeEnum,
    example: FavoriteTargetTypeEnum.WORK_COMIC,
    required: true,
    validation: false,
  })
  targetType!: FavoriteTargetTypeEnum

  @DateProperty({
    description: '收藏时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
    validation: false,
  })
  createdAt!: Date

  @NestedProperty({
    description: '作品信息（仅作品类型返回）',
    type: FavoriteWorkBriefDto,
    required: false,
    nullable: false,
    validation: false,
  })
  work?: FavoriteWorkBriefDto
}
