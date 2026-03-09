import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator'

const FAVORITE_TARGET_TYPES = [
  InteractionTargetTypeEnum.COMIC,
  InteractionTargetTypeEnum.NOVEL,
  InteractionTargetTypeEnum.FORUM_TOPIC,
] as const

export class FavoriteDto {
  @ApiProperty({
    description: 'Favorite target type: 1=comic, 2=novel, 5=forum topic',
    enum: FAVORITE_TARGET_TYPES,
    example: InteractionTargetTypeEnum.COMIC,
  })
  @IsInt()
  @IsIn(FAVORITE_TARGET_TYPES)
  @IsNotEmpty()
  targetType!: InteractionTargetTypeEnum

  @ApiProperty({
    description: 'Target ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  targetId!: number
}

export class UnfavoriteDto extends FavoriteDto {}

export class FavoriteStatusQueryDto {
  @ApiProperty({
    description: 'Favorite target type',
    enum: FAVORITE_TARGET_TYPES,
    example: InteractionTargetTypeEnum.COMIC,
  })
  @IsInt()
  @IsIn(FAVORITE_TARGET_TYPES)
  @IsNotEmpty()
  targetType!: InteractionTargetTypeEnum

  @ApiProperty({
    description: 'Target ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  targetId!: number
}

export class FavoriteListQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by favorite target type',
    enum: FAVORITE_TARGET_TYPES,
    example: InteractionTargetTypeEnum.COMIC,
  })
  @IsInt()
  @IsIn(FAVORITE_TARGET_TYPES)
  @IsOptional()
  targetType?: InteractionTargetTypeEnum

  @ApiPropertyOptional({ description: 'Page index', default: 0, example: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  pageIndex?: number = 0

  @ApiPropertyOptional({ description: 'Page size', default: 15, example: 15 })
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 15
}

export class FavoriteStatusResponseDto {
  @ApiProperty({ description: 'Whether target is favorited', example: true })
  isFavorited!: boolean
}
