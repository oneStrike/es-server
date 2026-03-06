import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, Min } from 'class-validator'

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
