import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, Min } from 'class-validator'
import { InteractionTargetType } from '../../interaction.constant'

export class FavoriteDto {
  @ApiProperty({
    description: '目标类型：1=漫画, 2=小说, 5=论坛主题',
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

export class UnfavoriteDto extends FavoriteDto {}
