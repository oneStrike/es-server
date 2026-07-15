import { BooleanProperty } from '@libs/platform/decorators'
import { PickType } from '@nestjs/swagger'
import { BaseWorkChapterDto } from './work-chapter.dto'

/**
 * 阅读历史章节快照 DTO。
 */
export class ReadingHistoryChapterSnapshotDto extends PickType(
  BaseWorkChapterDto,
  ['id', 'title', 'subtitle', 'cover', 'sortOrder'] as const,
) {
  @BooleanProperty({
    description: '章节是否应从历史中移除',
    example: false,
    required: true,
    validation: false,
  })
  shouldDelete!: boolean
}
