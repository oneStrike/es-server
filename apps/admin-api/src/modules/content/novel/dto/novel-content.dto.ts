import { NumberProperty } from '@libs/platform/decorators'

export class UploadContentDto {
  @NumberProperty({ description: '章节ID', example: 1, required: true })
  chapterId!: number

  @NumberProperty({ description: '作品ID', example: 1, required: true })
  workId!: number
}
