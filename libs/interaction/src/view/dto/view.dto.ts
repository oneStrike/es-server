import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator'

export class RecordViewDto {
  @ApiProperty({
    description: '目标类型�?=漫画, 2=小说, 3=漫画章节, 4=小说章节, 5=论坛主题',
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

export class QueryUserViewDto {
  @ApiPropertyOptional({
    description: '目标类型筛选',
    enum: InteractionTargetTypeEnum,
    example: 1,
  })
  @IsInt()
  @IsOptional()
  targetType?: InteractionTargetTypeEnum

  @ApiPropertyOptional({ description: '页码', default: 1, example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  pageIndex?: number = 1

  @ApiPropertyOptional({ description: '每页数量', default: 20, example: 20 })
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 20
}

export class ClearUserViewDto {
  @ApiPropertyOptional({
    description: '仅清理指定目标类型，默认清理全部',
    enum: InteractionTargetTypeEnum,
    example: 1,
  })
  @IsInt()
  @IsOptional()
  targetType?: InteractionTargetTypeEnum
}
