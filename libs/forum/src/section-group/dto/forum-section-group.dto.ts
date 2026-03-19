import {
  BooleanProperty,
  DateProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'

/**
 * 论坛板块分组基础 DTO。
 * 严格对应 forum_section_group 表字段。
 */
export class BaseForumSectionGroupDto extends BaseDto {
  @StringProperty({
    description: '分组名称',
    example: '技术讨论',
    required: true,
    maxLength: 50,
  })
  name!: string

  @StringProperty({
    description: '分组描述',
    example: '包含所有技术相关的板块',
    required: false,
    maxLength: 500,
  })
  description?: string

  @NumberProperty({
    description: '排序权重',
    example: 0,
    required: true,
    min: 0,
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

  @NumberProperty({
    description: '分组版主数量限制（0表示不限制）',
    example: 0,
    required: true,
    min: 0,
    default: 0,
  })
  maxModerators!: number

  @DateProperty({
    description: '删除时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  deletedAt?: Date | null
}
