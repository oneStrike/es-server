import { ArrayProperty, NumberProperty, StringProperty } from '@libs/platform/decorators'

class ChapterIdDto {
  @NumberProperty({ description: '章节ID', example: 1, required: true })
  chapterId!: number
}

export class UploadContentDto extends ChapterIdDto {
  @NumberProperty({ description: '作品ID', example: 1, required: true })
  workId!: number
}

export class UpdateComicContentDto extends ChapterIdDto {
  @NumberProperty({ description: '内容索引', example: 0, required: true, min: 0 })
  index!: number

  @StringProperty({ description: '内容路径', example: '/uploads/comic/1/chapter/1/1.jpg', required: true })
  content!: string
}

export class DeleteComicContentDto extends ChapterIdDto {
  @ArrayProperty({ description: '内容索引列表', itemType: 'number', example: [0, 1], required: true })
  index!: number[]
}

export class MoveComicContentDto extends ChapterIdDto {
  @NumberProperty({ description: '源索引', example: 0, required: true, min: 0 })
  fromIndex!: number

  @NumberProperty({ description: '目标索引', example: 1, required: true, min: 0 })
  toIndex!: number
}
