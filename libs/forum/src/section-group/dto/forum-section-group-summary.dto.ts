import { BooleanProperty, NumberProperty, StringProperty } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'

/**
 * 论坛板块分组公开摘要 DTO。
 * 供板块与分组公开接口复用，避免 DTO 间双向导入。
 */
export class ForumSectionGroupSummaryDto extends IdDto {
  @StringProperty({
    description: '分组名称',
    example: '技术讨论',
    required: true,
    validation: false,
  })
  name!: string

  @StringProperty({
    description: '分组描述',
    example: '包含所有技术相关的板块',
    required: false,
    validation: false,
    maxLength: 500,
  })
  description?: string | null

  @NumberProperty({
    description: '排序权重',
    example: 0,
    required: true,
    validation: false,
    min: 0,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
    validation: false,
  })
  isEnabled!: boolean
}
