import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator'
import { InteractionTargetType } from '../interaction.constant'

/**
 * 交互操作基础 DTO
 * 所有交互操作的基础参数
 */
export class BaseInteractionDto {
  @ApiProperty({
    description: '目标类型：1=漫画, 2=小说, 3=漫画章节, 4=小说章节, 5=论坛主题',
    enum: InteractionTargetType,
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  targetType!: InteractionTargetType

  @ApiProperty({
    description: '目标ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  targetId!: number
}

/**
 * 交互查询基础 DTO
 */
export class BaseInteractionQueryDto {
  @ApiPropertyOptional({
    description: '目标类型',
    enum: InteractionTargetType,
  })
  @IsInt()
  @IsOptional()
  targetType?: InteractionTargetType

  @ApiPropertyOptional({
    description: '页码',
    default: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1

  @ApiPropertyOptional({
    description: '每页数量',
    default: 20,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 20
}

/**
 * 用户交互状态响应 DTO
 */
export class UserInteractionStatusDto {
  @ApiProperty({
    description: '是否已点赞',
    example: true,
  })
  isLiked!: boolean

  @ApiProperty({
    description: '是否已收藏',
    example: false,
  })
  isFavorited!: boolean

  @ApiProperty({
    description: '是否已下载',
    example: false,
  })
  isDownloaded!: boolean
}

/**
 * 交互计数响应 DTO
 */
export class InteractionCountsDto {
  @ApiProperty({
    description: '点赞数',
    example: 100,
  })
  likeCount!: number

  @ApiProperty({
    description: '收藏数',
    example: 50,
  })
  favoriteCount!: number

  @ApiProperty({
    description: '浏览数',
    example: 1000,
  })
  viewCount!: number

  @ApiProperty({
    description: '评论数',
    example: 20,
  })
  commentCount!: number

  @ApiProperty({
    description: '下载数',
    example: 30,
  })
  downloadCount!: number
}
