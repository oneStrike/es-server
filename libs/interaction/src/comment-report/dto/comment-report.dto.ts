import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator'

export class ReportCommentDto {
  @ApiProperty({
    description: '评论ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  commentId!: number

  @ApiProperty({
    description: '举报原因',
    example: 'spam',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string

  @ApiPropertyOptional({
    description: '举报说明',
    example: '该评论包含垃圾信息',
  })
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({
    description: '证据截图URL',
    example: 'https://example.com/evidence.png',
  })
  @IsString()
  @IsOptional()
  evidenceUrl?: string
}
