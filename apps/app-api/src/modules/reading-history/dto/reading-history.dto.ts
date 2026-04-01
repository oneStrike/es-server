import { BaseWorkChapterDto, BaseWorkDto } from '@libs/content/work'
import { BaseReadingStateDto } from '@libs/interaction/reading-state'
import { WorkTypeEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  EnumProperty,
  NestedProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

export class QueryReadingHistoryDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BaseReadingStateDto), ['workId', 'workType']),
) {}

export class DeleteReadingHistoryDto {
  @ArrayProperty({
    description: '需要删除的作品id',
    itemType: 'number',
    required: true,
  })
  workIds: number[]
}

export class ClearReadingHistoryDto {
  @EnumProperty({
    description: '作品类型（1=漫画，2=小说）',
    enum: WorkTypeEnum,
    example: WorkTypeEnum.COMIC,
    required: false,
  })
  workType?: WorkTypeEnum
}

export class ReadingHistoryWorkSnapshotDto extends PickType(BaseWorkDto, [
  'id',
  'type',
  'name',
  'cover',
  'serialStatus',
]) {
  @BooleanProperty({
    description: '作品是否应从历史中移除',
    example: false,
    required: false,
    validation: false,
  })
  shouldDelete?: boolean
}

export class ReadingHistoryChapterSnapshotDto extends PickType(
  BaseWorkChapterDto,
  ['id', 'title', 'subtitle', 'cover', 'sortOrder'],
) {
  @BooleanProperty({
    description: '章节是否应从历史中移除',
    example: false,
    required: false,
    validation: false,
  })
  shouldDelete?: boolean
}

export class ReadingHistoryWorkDto extends BaseReadingStateDto {
  @NestedProperty({
    description: '作品信息',
    type: ReadingHistoryWorkSnapshotDto,
    required: true,
    validation: false,
    nullable: false,
  })
  work!: ReadingHistoryWorkSnapshotDto

  @NestedProperty({
    description: '继续阅读章节',
    type: ReadingHistoryChapterSnapshotDto,
    required: false,
    validation: false,
  })
  continueChapter?: ReadingHistoryChapterSnapshotDto
}
