import { ArrayProperty, NumberProperty, StringProperty } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'

/// 添加章节内容DTO
export class AddChapterContentDto extends IdDto {
  @NumberProperty({
    description: '作品ID',
    example: 1,
    required: true,
  })
  workId!: number
}

/// 更新章节内容DTO
export class UpdateChapterContentDto extends IdDto {
  @NumberProperty({
    description: '内容索引',
    example: 0,
    required: true,
    min: 0,
  })
  index!: number

  @StringProperty({
    description: '内容路径',
    example: '/uploads/comic/1/chapter/1/image.jpg',
    required: true,
  })
  content!: string
}

/// 删除章节内容DTO
export class DeleteChapterContentDto extends IdDto {
  @ArrayProperty({
    description: '内容索引列表',
    itemType: 'number',
    example: [0, 1],
    required: true,
  })
  index!: number[]
}

/// 移动章节内容DTO
export class MoveChapterContentDto extends IdDto {
  @NumberProperty({
    description: '源索引',
    example: 0,
    required: true,
    min: 0,
  })
  fromIndex!: number

  @NumberProperty({
    description: '目标索引',
    example: 1,
    required: true,
    min: 0,
  })
  toIndex!: number
}

/// 上传章节文件DTO
export class UploadChapterFileDto extends IdDto {
  @NumberProperty({
    description: '作品ID',
    example: 1,
    required: true,
  })
  workId!: number
}

/// 章节内容项DTO
export class ChapterContentItemDto {
  @NumberProperty({
    description: '内容索引',
    example: 0,
    validation: false,
  })
  index!: number

  @StringProperty({
    description: '内容路径',
    example: '/uploads/comic/1/chapter/1/image.jpg',
    validation: false,
  })
  content!: string
}

/// 章节内容列表DTO
export class ChapterContentListDto {
  @NumberProperty({
    description: '章节ID',
    example: 1,
    validation: false,
  })
  chapterId!: number

  @ArrayProperty({
    description: '内容列表',
    itemClass: ChapterContentItemDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  contents!: ChapterContentItemDto[]
}
