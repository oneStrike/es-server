import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator'
import { InteractionTargetType } from '../../interaction.constant'

export class RecordViewDto {
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

  @ApiPropertyOptional({
    description: 'IP地址',
    example: '192.168.1.1',
  })
  @IsOptional()
  ipAddress?: string

  @ApiPropertyOptional({
    description: '设备类型',
    example: 'mobile',
  })
  @IsOptional()
  device?: string

  @ApiPropertyOptional({
    description: 'User-Agent',
    example: 'Mozilla/5.0',
  })
  @IsOptional()
  userAgent?: string
}

export class DeleteViewDto {
  @ApiProperty({
    description: '浏览记录ID',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  viewId!: number
}
