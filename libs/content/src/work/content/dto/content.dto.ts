import {
  ArrayProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

/// 章节ID基础DTO
export class ChapterIdDto {
  @NumberProperty({
    description: '章节ID',
    example: 1,
    required: true,
  })
  chapterId!: number
}

// ==================== 通用 DTO ====================

/// 上传/添加章节内容DTO - 通用
/// Comic和Novel都使用此DTO上传/添加内容
export class UploadContentDto extends ChapterIdDto {
  @NumberProperty({
    description: '作品ID',
    example: 1,
    required: true,
  })
  workId!: number
}

// ==================== Comic 特有 DTO ====================

/// 更新漫画章节内容DTO
/// 仅Comic使用：替换列表中指定索引的图片
export class UpdateComicContentDto extends ChapterIdDto {
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

/// 删除漫画章节内容DTO
/// 仅Comic使用：按索引删除列表中的图片
export class DeleteComicContentDto extends ChapterIdDto {
  @ArrayProperty({
    description: '内容索引列表',
    itemType: 'number',
    example: [0, 1],
    required: true,
  })
  index!: number[]
}

/// 移动漫画章节内容DTO
/// 仅Comic使用：调整图片顺序
export class MoveComicContentDto extends ChapterIdDto {
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

// ==================== 响应 DTO ====================

/// 章节内容项DTO - Comic响应
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

/// 章节内容列表DTO - Comic响应
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
