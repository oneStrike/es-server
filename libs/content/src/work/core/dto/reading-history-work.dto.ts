import { BaseReadingStateDto } from '@libs/interaction/reading-state/dto/reading-state.dto'
import { BooleanProperty, NestedProperty } from '@libs/platform/decorators'
import { IntersectionType, OmitType, PickType } from '@nestjs/swagger'
import { ReadingHistoryChapterSnapshotDto } from '../../chapter/dto/reading-history-work-chapter.dto'
import { BaseWorkDto } from './work.dto'

/**
 * 阅读历史作品快照 DTO。
 */
export class ReadingHistoryWorkSnapshotDto extends PickType(BaseWorkDto, [
  'id',
  'type',
  'name',
  'cover',
  'serialStatus',
] as const) {
  @BooleanProperty({
    description: '作品是否应从历史中移除',
    example: false,
    required: true,
    validation: false,
  })
  shouldDelete!: boolean
}

class ReadingHistoryContinueChapterFieldDto {
  @NestedProperty({
    description: '继续阅读章节',
    type: ReadingHistoryChapterSnapshotDto,
    required: true,
    nullable: true,
    validation: false,
  })
  continueChapter!: ReadingHistoryChapterSnapshotDto | null
}

/**
 * 阅读历史作品分页项 DTO。
 */
export class ReadingHistoryWorkDto extends IntersectionType(
  OmitType(BaseReadingStateDto, ['userId'] as const),
  ReadingHistoryContinueChapterFieldDto,
) {
  @NestedProperty({
    description: '作品信息',
    type: ReadingHistoryWorkSnapshotDto,
    required: true,
    validation: false,
    nullable: false,
  })
  work!: ReadingHistoryWorkSnapshotDto
}
