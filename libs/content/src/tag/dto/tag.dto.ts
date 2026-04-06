import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto';
import { DragReorderDto } from '@libs/platform/dto/drag-reorder.dto';
import { PageDto } from '@libs/platform/dto/page.dto';
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 标签基础 DTO
 */
export class BaseTagDto extends BaseDto {
  @StringProperty({
    description: '标签名称',
    example: '科幻',
    required: true,
    maxLength: 20,
  })
  name!: string

  @StringProperty({
    description: '标签图标 URL',
    example: 'https://example.com/icon.png',
    required: false,
    maxLength: 255,
  })
  icon?: string | null

  @NumberProperty({
    description: '人气值',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
  })
  popularity!: number

  @NumberProperty({
    description: '排序值',
    example: 1,
    required: true,
    min: 0,
    max: 32767,
    default: 0,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @StringProperty({
    description: '标签描述',
    example: '漫画类型',
    required: false,
    maxLength: 200,
  })
  description?: string | null
}

export class CreateTagDto extends OmitType(BaseTagDto, [
  ...OMIT_BASE_FIELDS,
  'popularity',
  'isEnabled',
] as const) {}

export class QueryTagDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseTagDto, ['name', 'isEnabled'] as const)),
) {}

export class UpdateTagDto extends IntersectionType(
  IdDto,
  PartialType(CreateTagDto),
) {}

export class UpdateTagSortDto extends PickType(DragReorderDto, [
  'dragId',
  'targetId',
] as const) {}
