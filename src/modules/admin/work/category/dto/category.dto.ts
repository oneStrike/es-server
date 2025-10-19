import {
  ApiProperty,
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  ValidateArray,
  ValidateBoolean,
  ValidateNumber,
  ValidateString,
} from '@/common/decorators/validate.decorator'
import { IdDto } from '@/common/dto/id.dto'
import { PageDto } from '@/common/dto/page.dto'
import { BaseContentTypeDto } from '../../content-type/dto/content-type.dto'

/**
 * 分类基础 DTO
 */
export class BaseCategoryDto {
  @ValidateNumber({
    description: '分类ID',
    example: 1,
    required: true,
    min: 1,
  })
  id!: number

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

  @ValidateString({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  createdAt!: string

  @ValidateString({
    description: '更新时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  updatedAt!: string
}

/**
 * 分类-内容类型 关系项 DTO
 */
export class CategoryContentTypeItemDto {
  @ValidateNumber({
    description: '分类ID',
    example: 1,
    required: true,
    min: 1,
  })
  categoryId!: number

  @ValidateNumber({
    description: '内容类型ID',
    example: 2,
    required: true,
    min: 1,
  })
  contentTypeId!: number

  @ApiProperty({
    description: '内容类型对象',
    type: () => BaseContentTypeDto,
    required: true,
    example: { id: 2, code: 'COMIC', name: '漫画' },
  })
  contentType!: BaseContentTypeDto
}

/**
 * 分类分页 DTO
 */

export class CategoryPageDto extends BaseCategoryDto {
  @ApiProperty({
    description: '分类包含的内容类型项数组',
    type: () => [CategoryContentTypeItemDto],
    required: true,
    example: [
      {
        categoryId: 1,
        contentTypeId: 2,
        contentType: { id: 2, code: 'COMIC', name: '漫画' },
      },
      {
        categoryId: 1,
        contentTypeId: 3,
        contentType: { id: 3, code: 'NOVEL', name: '小说' },
      },
    ],
  })
  @ValidateArray({
    description: '分类包含的内容类型项数组',
    required: true,
    itemType: 'object',
  })
  categoryContentTypes!: CategoryContentTypeItemDto[]
}

/**
 * 创建分类 DTO
 */
export class CreateCategoryDto extends OmitType(BaseCategoryDto, [
  'id',
  'createdAt',
  'updatedAt',
  'popularity',
  'popularityWeight',
]) {
  // 创建时要求明确指定媒介代码集合
  @ValidateArray({
    description: '作品媒介代码数组（必填）',
    example: ['COMIC', 'NOVEL'],
    required: true,
    itemType: 'string',
  })
  contentType!: string[]
}

/**
 * 更新分类 DTO
 */
export class UpdateCategoryDto extends IntersectionType(
  PartialType(OmitType(BaseCategoryDto, ['id', 'createdAt', 'updatedAt'])),
  IdDto,
) {}

/**
 * 查询分类 DTO
 */
export class QueryCategoryDto extends IntersectionType(
  PageDto,
  PickType(PartialType(CreateCategoryDto), ['name', 'isEnabled', 'contentType']),
) {}
