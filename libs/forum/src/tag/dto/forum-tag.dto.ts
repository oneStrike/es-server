import {
  BooleanProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'

/**
 * 论坛标签基础 DTO。
 * 严格对应 forum_tag 表中当前对外复用的实体字段。
 */
export class BaseForumTagDto extends BaseDto {
  @StringProperty({
    description: '标签名称',
    example: '技术讨论',
    required: true,
    maxLength: 20,
  })
  name!: string

  @StringProperty({
    description: '标签图标URL',
    example: 'https://example.com/icon.png',
    required: false,
    maxLength: 255,
  })
  icon?: string

  @StringProperty({
    description: '标签描述',
    example: '用于标记技术相关的讨论',
    required: false,
    maxLength: 200,
  })
  description?: string

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: false,
  })
  isEnabled?: boolean

  @NumberProperty({
    description: '使用次数',
    example: 100,
    required: false,
    min: 0,
  })
  useCount?: number

  @NumberProperty({
    description: '排序权重',
    example: 0,
    required: false,
    min: 0,
  })
  sortOrder?: number
}
