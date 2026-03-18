import { ContentTypeEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'

/**
 * 分类基础 DTO
 */
export class BaseCategoryDto extends BaseDto {
  @StringProperty({
    description: '分类名称',
    example: '科幻',
    required: true,
    maxLength: 20,
  })
  name!: string

  @StringProperty({
    description: '分类图标URL',
    example: 'https://example.com/icon.png',
    required: false,
    maxLength: 255,
  })
  icon?: string

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

  @ArrayProperty({
    description: '分类关联的内容类型',
    example: [ContentTypeEnum.COMIC],
    required: false,
    itemType: 'number',
  })
  contentType?: number[]

  @StringProperty({
    description: '分类的描述 （可选）',
    example: '科幻类分类',
    required: false,
    maxLength: 200,
  })
  description?: string
}
