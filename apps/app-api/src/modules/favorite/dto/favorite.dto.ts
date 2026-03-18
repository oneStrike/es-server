import { BaseWorkDto } from '@libs/content'
import { BaseFavoriteDto } from '@libs/interaction'
import { BooleanProperty, NestedProperty } from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class FavoriteTargetDto extends PickType(BaseFavoriteDto, [
  'targetId',
  'targetType',
]) {}

export class FavoritePageQueryDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseFavoriteDto, ['targetType'])),
) {}

export class FavoriteStatusResponseDto {
  @BooleanProperty({
    description: '是否已收藏',
    example: true,
    required: true,
    validation: false,
  })
  isFavorited!: boolean
}

export class FavoriteWorkBriefDto extends PickType(BaseWorkDto, [
  'id',
  'name',
  'cover',
]) {}

export class FavoritePageItemDto extends BaseFavoriteDto {
  @NestedProperty({
    description: '作品信息（仅作品类型返回）',
    type: FavoriteWorkBriefDto,
    required: false,
    nullable: false,
    validation: false,
  })
  work?: FavoriteWorkBriefDto
}
