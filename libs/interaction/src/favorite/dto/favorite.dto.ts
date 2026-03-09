import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BooleanProperty, EnumProperty } from '@libs/base/decorators'
import { PageDto } from '@libs/base/dto'
import { PartialType } from '@nestjs/swagger'
import { TargetIdBodyDto } from '../../dto/target.dto'

const FAVORITE_TARGET_TYPES = {
  COMIC: InteractionTargetTypeEnum.COMIC,
  NOVEL: InteractionTargetTypeEnum.NOVEL,
  FORUM_TOPIC: InteractionTargetTypeEnum.FORUM_TOPIC,
} as const

export class FavoriteTargetDto extends TargetIdBodyDto {
  @EnumProperty({
    description: '收藏目标类型（1=漫画，2=小说，5=论坛主题）',
    enum: FAVORITE_TARGET_TYPES,
    example: InteractionTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: InteractionTargetTypeEnum
}

export class FavoriteDto extends FavoriteTargetDto {}

export class UnfavoriteDto extends FavoriteTargetDto {}

export class FavoriteStatusQueryDto extends FavoriteTargetDto {}

export class FavoriteListQueryDto extends PartialType(PageDto) {
  @EnumProperty({
    description: '按收藏目标类型筛选',
    enum: FAVORITE_TARGET_TYPES,
    example: InteractionTargetTypeEnum.COMIC,
    required: false,
  })
  targetType?: InteractionTargetTypeEnum
}

export class FavoriteStatusResponseDto {
  @BooleanProperty({
    description: '是否已收藏',
    example: true,
    required: true,
    validation: false,
  })
  isFavorited!: boolean
}
