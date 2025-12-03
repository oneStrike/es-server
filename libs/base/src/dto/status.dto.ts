import { ApiProperty, IntersectionType } from '@nestjs/swagger'
import { IdDto, IdsDto, PublishDto, StatusDto } from './base.dto'

/**
 * 启用禁用
 */
export class UpdateStatusDto extends IntersectionType(IdDto, StatusDto) {}

/**
 * 批量操作响应
 */
export class BatchOperationResponseDto {
  @ApiProperty({
    description: '操作成功的数据量',
    example: true,
    type: Number,
  })
  count!: number
}
/**
 * 批量启用禁用
 */
export class BatchEnabledDto extends IntersectionType(IdsDto, StatusDto) {}
/**
 * 批量发布
 */
export class BatchPublishDto extends IntersectionType(IdsDto, PublishDto) {}
