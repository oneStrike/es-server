import { BooleanProperty, NumberProperty, StringProperty } from '@libs/platform/decorators'

/**
 * 论坛板块分组公开摘要 DTO。
 * 供板块与分组公开接口复用，避免 DTO 间双向导入。
 */
export class ForumSectionGroupSummaryDto {
  @NumberProperty({
    description: '主键ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

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
    nullable: true,
    validation: false,
    maxLength: 500,
  })
  description!: string | null

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
