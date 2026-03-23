import { BaseWorkDto } from '@libs/content/work'
import { BaseFavoriteDto } from '@libs/interaction/favorite'
import {
  BooleanProperty,
  NestedProperty,
  StringProperty,
} from '@libs/platform/decorators'
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

export class FavoriteTargetDetailDto extends PickType(BaseWorkDto, ['id']) {
  @StringProperty({
    description: '作品名称（作品类型返回）',
    example: '进击的巨人',
    required: false,
    validation: false,
  })
  name?: string

  @StringProperty({
    description: '作品封面（作品类型返回）',
    example: 'https://example.com/cover.jpg',
    required: false,
    validation: false,
  })
  cover?: string

  @StringProperty({
    description: '主题标题（论坛主题类型返回）',
    example: '如何学习 TypeScript？',
    required: false,
    validation: false,
  })
  title?: string
}

export class FavoritePageItemDto extends BaseFavoriteDto {
  @NestedProperty({
    description: '目标简要信息（作品返回 name/cover，论坛主题返回 title）',
    type: FavoriteTargetDetailDto,
    required: false,
    nullable: false,
    validation: false,
  })
  targetDetail?: FavoriteTargetDetailDto
}
