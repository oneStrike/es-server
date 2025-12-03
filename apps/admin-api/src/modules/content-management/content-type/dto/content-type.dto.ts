import { ValidateBoolean, ValidateString } from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 内容类型基础 DTO
 */
export class BaseContentTypeDto extends BaseDto {
  @ValidateString({
    description: '类型编码（唯一，如：COMIC/NOVEL/ILLUSTRATION/ALBUM）',
    example: 'COMIC',
    required: true,
    maxLength: 32,
  })
  code!: string

  @ValidateString({
    description: '显示名称',
    example: '漫画',
    required: true,
    maxLength: 50,
  })
  name!: string

  @ValidateBoolean({
    description: '是否启用',
    example: true,
    required: false,
  })
  isEnabled!: boolean

  @ValidateString({
    description: '分类描述',
    example: '漫画类型',
    required: false,
    maxLength: 200,
  })
  description?: string
}

/**
 * 创建内容类型 DTO
 */
export class CreateContentTypeDto extends OmitType(
  BaseContentTypeDto,
  OMIT_BASE_FIELDS,
) {}

/**
 * 更新内容类型 DTO
 */
export class UpdateContentTypeDto extends IntersectionType(
  CreateContentTypeDto,
  IdDto,
) {}

/**
 * 查询内容类型 DTO
 */
export class QueryContentTypeDto extends PartialType(
  PickType(BaseContentTypeDto, ['code', 'name', 'isEnabled']),
) {}
