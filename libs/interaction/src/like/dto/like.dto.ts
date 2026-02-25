import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator'
import { InteractionTargetType } from '../../interaction.constant'

/**
 * 点赞操作 DTO
 */
export class LikeDto {
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
 * 取消点赞 DTO
 */
export class UnlikeDto extends LikeDto {}

/**
 * 点赞状态查询 DTO
 */
export class LikeStatusQueryDto {
  @ApiProperty({
    description: '目标类型',
    enum: InteractionTargetType,
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  targetType!: InteractionTargetType

  @ApiProperty({
    description: '目标ID数组',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsInt({ each: true })
  @IsNotEmpty()
  targetIds!: number[]
}

/**
 * 点赞列表查询 DTO
 */
export class LikeListQueryDto {
  @ApiPropertyOptional({
    description: '目标类型筛选',
    enum: InteractionTargetType,
    example: 1,
  })
  @IsInt()
  @IsOptional()
  targetType?: InteractionTargetType

  @ApiPropertyOptional({
    description: '页码',
    default: 1,
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1

  @ApiPropertyOptional({
    description: '每页数量',
    default: 20,
    example: 20,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 20
}

/**
 * 点赞状态响应 DTO
 */
export class LikeStatusResponseDto {
  @ApiProperty({
    description: '目标ID',
    example: 1,
  })
  targetId!: number

  @ApiProperty({
    description: '是否已点赞',
    example: true,
  })
  isLiked!: boolean
}

/**
 * 点赞计数响应 DTO
 */
export class LikeCountResponseDto {
  @ApiProperty({
    description: '目标ID',
    example: 1,
  })
  targetId!: number

  @ApiProperty({
    description: '点赞数',
    example: 100,
  })
  likeCount!: number
}

/**
 * 点赞记录响应 DTO
 */
export class LikeRecordResponseDto {
  @ApiProperty({
    description: '点赞记录ID',
    example: 1,
  })
  id!: number

  @ApiProperty({
    description: '目标类型',
    enum: InteractionTargetType,
    example: 1,
  })
  targetType!: InteractionTargetType

  @ApiProperty({
    description: '目标ID',
    example: 1,
  })
  targetId!: number

  @ApiProperty({
    description: '点赞时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: Date
}
