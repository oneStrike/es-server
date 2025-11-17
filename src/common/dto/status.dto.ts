import { ApiProperty, IntersectionType } from '@nestjs/swagger'
import { IdDto, IdsDto, PublishDto, StatusDto } from './base.dto'

export class EnabledDto extends IntersectionType(IdDto, StatusDto) {}

export class BatchOperationResponseDto {
  @ApiProperty({
    description: '操作成功的数据量',
    example: true,
    type: Number,
  })
  count!: number
}

export class BatchEnabledDto extends IntersectionType(IdsDto, StatusDto) {}

export class BatchPublishDto extends IntersectionType(IdsDto, PublishDto) {}
