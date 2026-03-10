import { BusinessModuleEnum } from '@libs/base/constant'
import { BooleanProperty, EnumProperty } from '@libs/base/decorators'
import { PageDto } from '@libs/base/dto'
import { PartialType } from '@nestjs/swagger'
import { TargetIdBodyDto } from '../../dto/target.dto'

/**
 * 收藏目标 DTO
 * 用于指定收藏操作的目标类型和目标 ID
 */
export class FavoriteTargetDto extends TargetIdBodyDto {
  @EnumProperty({
    description: '收藏目标类型（1=漫画，2=小说，3=论坛主题）',
    enum: BusinessModuleEnum,
    example: BusinessModuleEnum.COMIC,
    required: true,
  })
  targetType!: BusinessModuleEnum
}

/**
 * 收藏 DTO
 */
export class FavoriteDto extends FavoriteTargetDto {}

/**
 * 取消收藏 DTO
 */
export class UnfavoriteDto extends FavoriteTargetDto {}

/**
 * 收藏状态查询 DTO
 */
export class FavoriteStatusQueryDto extends FavoriteTargetDto {}

/**
 * 收藏列表查询 DTO
 */
export class FavoriteListQueryDto extends PartialType(PageDto) {
  @EnumProperty({
    description: '按收藏目标类型筛选',
    enum: BusinessModuleEnum,
    example: BusinessModuleEnum.COMIC,
    required: false,
  })
  targetType?: BusinessModuleEnum
}

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
