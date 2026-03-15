import { EnumProperty, NumberProperty } from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { BrowseLogTargetTypeEnum } from '../browse-log.constant'

/**
 * 浏览日志目标 DTO
 */
export class BrowseLogTargetDto {
  @NumberProperty({
    description: '目标 ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @EnumProperty({
    description: '浏览目标类型',
    enum: BrowseLogTargetTypeEnum,
    example: BrowseLogTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: BrowseLogTargetTypeEnum
}

export class RecordBrowseLogDto extends BrowseLogTargetDto {}

export class QueryBrowseLogDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BrowseLogTargetDto, ['targetType'])),
) {}

export class ClearBrowseLogDto extends PartialType(
  PickType(BrowseLogTargetDto, ['targetType']),
) {}
