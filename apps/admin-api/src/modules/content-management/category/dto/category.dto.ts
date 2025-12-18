import {
  ValidateBoolean,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import { ContentTypeEnum } from '@libs/base/enum'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 分类基础 DTO
 */
export class BaseCategoryDto extends BaseDto {
  @ValidateString({
    description: '分类名称',
    example: '科幻',
    required: true,
    maxLength: 20,
  })
  name!: string

  @ValidateString({
    description: '分类图标URL',
    example: 'https://example.com/icon.png',
    required: false,
    maxLength: 200,
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
    description: '辅助人气值',
    example: 500,
    required: false,
    min: 0,
  })
  popularityWeight!: number

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

  @ValidateNumber({
    description: '分类关联的内容类型',
    example: ContentTypeEnum.COMIC,
    required: true,
  })
  contentType!: number

  @ValidateString({
    description: '分类的描述 （可选）',
    example: '科幻类分类',
    required: false,
  })
  description?: string
}

/**
 * 创建分类 DTO
 */
export class CreateCategoryDto extends OmitType(BaseCategoryDto, [
  ...OMIT_BASE_FIELDS,
  'popularity',
]) {}

/**
 * 更新分类 DTO
 */
export class UpdateCategoryDto extends IntersectionType(
  CreateCategoryDto,
  IdDto,
) {}

/**
 * 查询分类 DTO
 */
export class QueryCategoryDto extends IntersectionType(
  PageDto,
  PartialType(PickType(CreateCategoryDto, ['name', 'isEnabled'])),
) {
  @ValidateString({
    description: '分类关联的内容类型',
    example: '1',
    required: false,
  })
  contentType?: string
}
