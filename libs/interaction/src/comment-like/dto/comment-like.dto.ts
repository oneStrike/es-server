import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, Min } from 'class-validator'

export class LikeCommentDto {
  @ApiProperty({
    description: '评论ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  commentId!: number
}

export class UnlikeCommentDto extends LikeCommentDto {}
