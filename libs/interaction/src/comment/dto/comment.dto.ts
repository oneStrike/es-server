import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, MinLength } from 'class-validator'
import { InteractionTargetType } from '../../interaction.constant'

export class CreateCommentDto {
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

  @ApiProperty({
    description: '评论内容',
    example: '这个作品真不错！',
  })
  @IsString()
  @MinLength(1)
  @IsNotEmpty()
  content!: string

  @ApiPropertyOptional({
    description: '回复的评论ID（楼中楼）',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  replyToId?: number
}

export class DeleteCommentDto {
  @ApiProperty({
    description: '评论ID',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  commentId!: number
}
