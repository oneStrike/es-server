import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator'

export class FavoriteDto {
  @ApiProperty({
    description: '目标类型�?=漫画, 2=小说, 5=论坛主题',
    enum: InteractionTargetTypeEnum,
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  targetType!: InteractionTargetTypeEnum

  @ApiProperty({
    description: '目标ID',
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
    description: '目标类型',
    enum: InteractionTargetTypeEnum,
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  targetType!: InteractionTargetTypeEnum

  @ApiProperty({
    description: '目标ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  targetId!: number
}

export class FavoriteListQueryDto {
  @ApiPropertyOptional({
    description: '目标类型筛选',
    enum: InteractionTargetTypeEnum,
    example: 1,
  })
  @IsInt()
  @IsOptional()
  targetType?: InteractionTargetTypeEnum

  @ApiPropertyOptional({ description: '页码', default: 0, example: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  pageIndex?: number = 0

  @ApiPropertyOptional({ description: '每页数量', default: 15, example: 15 })
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 15
}

export class FavoriteStatusResponseDto {
  @ApiProperty({ description: '是否已收藏', example: true })
  isFavorited!: boolean
}
