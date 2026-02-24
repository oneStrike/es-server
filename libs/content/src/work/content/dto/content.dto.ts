import { ValidateArray, ValidateNumber, ValidateString } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { ApiProperty } from '@nestjs/swagger'

/// 添加章节内容DTO
export class AddChapterContentDto extends IdDto {
  @ValidateNumber({
    description: '作品ID',
    example: 1,
    required: true,
  })
  workId!: number
}

/// 更新章节内容DTO
export class UpdateChapterContentDto extends IdDto {
  @ValidateNumber({
    description: '内容索引',
    example: 0,
    required: true,
    min: 0,
  })
  index!: number

  @ValidateString({
    description: '内容路径',
    example: '/uploads/comic/1/chapter/1/image.jpg',
    required: true,
  })
  content!: string
}

/// 删除章节内容DTO
export class DeleteChapterContentDto extends IdDto {
  @ValidateArray({
    description: '内容索引列表',
    itemType: 'number',
    example: [0, 1],
    required: true,
  })
  index!: number[]
}

/// 移动章节内容DTO
export class MoveChapterContentDto extends IdDto {
  @ValidateNumber({
    description: '源索引',
    example: 0,
    required: true,
    min: 0,
  })
  fromIndex!: number

  @ValidateNumber({
    description: '目标索引',
    example: 1,
    required: true,
    min: 0,
  })
  toIndex!: number
}

/// 上传章节文件DTO
export class UploadChapterFileDto extends IdDto {
  @ValidateNumber({
    description: '作品ID',
    example: 1,
    required: true,
  })
  workId!: number
}

/// 章节内容项DTO
export class ChapterContentItemDto {
  @ApiProperty({
    description: '内容索引',
    example: 0,
  })
  index!: number

  @ApiProperty({
    description: '内容路径',
    example: '/uploads/comic/1/chapter/1/image.jpg',
  })
  content!: string
}

/// 章节内容列表DTO
export class ChapterContentListDto {
  @ApiProperty({
    description: '章节ID',
    example: 1,
  })
  chapterId!: number

  @ApiProperty({
    description: '内容列表',
    type: [ChapterContentItemDto],
  })
  contents!: ChapterContentItemDto[]
}
