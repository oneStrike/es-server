import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator'

export class BaseInteractionDto {
  @ApiProperty({
    description: '目标类型：1=漫画,2=小说,3=漫画章节,4=小说章节,5=论坛主题',
    enum: InteractionTargetTypeEnum,
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  targetType!: InteractionTargetTypeEnum

  @ApiProperty({ description: '目标ID', example: 1 })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  targetId!: number
}

export class BaseInteractionQueryDto {
  @ApiPropertyOptional({ description: '目标类型', enum: InteractionTargetTypeEnum })
  @IsInt()
  @IsOptional()
  targetType?: InteractionTargetTypeEnum

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 20
}

export class UserInteractionStatusDto {
  @ApiProperty({ description: '是否已点赞', example: true })
  isLiked!: boolean

  @ApiProperty({ description: '是否已收藏', example: false })
  isFavorited!: boolean

  @ApiProperty({ description: '是否已下载', example: false })
  isDownloaded!: boolean
}

export class InteractionCountsDto {
  @ApiProperty({ description: '点赞数', example: 100 })
  likeCount!: number

  @ApiProperty({ description: '收藏数', example: 50 })
  favoriteCount!: number

  @ApiProperty({ description: '浏览数', example: 1000 })
  viewCount!: number

  @ApiProperty({ description: '评论数', example: 20 })
  commentCount!: number

  @ApiProperty({ description: '下载数', example: 30 })
  downloadCount!: number
}
