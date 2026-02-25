import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, Min } from 'class-validator'
import { InteractionTargetType } from '../../interaction.constant'

export class RecordDownloadDto {
  @ApiProperty({
    description: '目标类型：1=漫画, 2=小说, 3=漫画章节, 4=小说章节',
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
    description: '作品ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  workId!: number

  @ApiProperty({
    description: '作品类型：1=漫画, 2=小说',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  workType!: number
}
