import {
  ValidateArray,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import {
  IdDto,
} from '@libs/base/dto'

/**
 * 添加章节内容DTO
 */
export class AddChapterContentDto extends IdDto {
  @ValidateString({
    description: '要添加的内容（图片URL）',
    example: 'https://example.com/new-page.jpg',
    required: true,
  })
  content!: string

  @ValidateNumber({
    description: '插入位置索引（可选，默认添加到末尾）',
    example: 2,
    required: false,
    min: 0,
  })
  index?: number
}

/**
 * 更新章节内容DTO
 */
export class UpdateChapterContentDto extends IdDto {
  @ValidateNumber({
    description: '插入位置索引（可选，默认添加到末尾）',
    example: 2,
    required: true,
    min: 0,
  })
  index!: number

  @ValidateString({
    description: '要更新的内容（图片URL）',
    example: 'https://example.com/updated-page.jpg',
    required: true,
  })
  content!: string
}

/**
 * 删除章节内容DTO
 */
export class DeleteChapterContentDto extends IdDto {
  @ValidateNumber({
    description: '要删除的内容索引',
    example: 2,
    required: true,
    min: 0,
  })
  index!: number
}

/**
 * 移动章节内容DTO（用于排序）
 */
export class MoveChapterContentDto extends IdDto {
  @ValidateNumber({
    description: '源索引位置',
    example: 2,
    required: true,
    min: 0,
  })
  fromIndex!: number

  @ValidateNumber({
    description: '目标索引位置',
    example: 0,
    required: true,
    min: 0,
  })
  toIndex!: number
}

/**
 * 批量更新章节内容DTO
 */
export class BatchUpdateChapterContentsDto extends IdDto {
  @ValidateArray({
    description: '新的内容数组（JSON格式）',
    example: ['https://example.com/page1.jpg'],
    required: true,
    itemType: 'string',
  })
  contents!: string
}
