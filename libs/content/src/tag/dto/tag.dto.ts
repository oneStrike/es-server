import {
  ValidateBoolean,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
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
  @ValidateString({
    description: '标签名称',
    example: '科幻',
    required: true,
    maxLength: 20,
  })
  name!: string

  @ValidateString({
    description: '标签图标URL',
    example: 'https://example.com/icon.png',
    required: false,
    maxLength: 255,
  })
  icon?: string

  @ValidateNumber({
    description: '人气值',
    example: 1000,
    required: false,
    min: 0,
  })
  popularity!: number

  @ValidateNumber({
    description: '排序值',
    example: 1,
    required: false,
    min: 0,
    max: 32767,
  })
  order!: number

  @ValidateBoolean({
    description: '是否启用',
    example: true,
    required: false,
  })
  isEnabled!: boolean

  @ValidateString({
    description: '标签描述',
    example: '漫画类型',
    required: false,
    maxLength: 200,
  })
  description?: string
}

/**
 * 创建标签 DTO
 */
export class CreateTagDto extends OmitType(BaseTagDto, [
  ...OMIT_BASE_FIELDS,
  'popularity',
]) {}

/**
 * 更新标签 DTO
 */
export class UpdateTagDto extends IntersectionType(CreateTagDto, IdDto) {}

/**
 * 查询标签 DTO
 */
export class QueryTagDto extends IntersectionType(
  PageDto,
  PickType(PartialType(CreateTagDto), ['name', 'isEnabled']),
) {}
