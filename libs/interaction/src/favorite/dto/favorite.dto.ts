import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { IdDto, PageDto, UserIdDto } from '@libs/platform/dto'

import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { FavoriteTargetTypeEnum } from '../favorite.constant'

/**
 * 收藏记录基础 DTO（全量字段）
 */
export class BaseFavoriteDto extends IntersectionType(IdDto, UserIdDto) {
  @EnumProperty({
    description: '收藏目标类型（1=漫画，2=小说，3=论坛主题）',
    enum: FavoriteTargetTypeEnum,
    example: FavoriteTargetTypeEnum.WORK_COMIC,
    required: true,
  })
  targetType!: FavoriteTargetTypeEnum

  @NumberProperty({
    description: '收藏目标 ID',
    example: 1,
    required: true,
  })
  targetId!: number

  @DateProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
    validation: false,
  })
  createdAt!: Date
}

export class FavoriteTargetDto extends PickType(BaseFavoriteDto, [
  'targetId',
  'targetType',
] as const) {}

export class FavoriteRecordDto extends IntersectionType(
  FavoriteTargetDto,
  PickType(BaseFavoriteDto, ['userId'] as const),
) {}

export class FavoritePageCommandDto extends IntersectionType(
  PageDto,
  PickType(BaseFavoriteDto, ['userId'] as const),
) {}
/**
 * 收藏状态 DTO。
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

export class QueryUserFavoriteDto extends IntersectionType(
  PartialType(UserIdDto),
  PageDto,
) {}
