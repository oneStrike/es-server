import { ContentTypeEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { PageDto, UserIdDto } from '@libs/platform/dto'

import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

/**
 * 基础阅读状态 DTO
 */
export class BaseReadingStateDto extends UserIdDto {
  @NumberProperty({
    description: '作品 ID',
    example: 1,
    required: true,
    min: 1,
  })
  workId!: number

  @EnumProperty({
    description: '作品类型（1=漫画；2=小说）',
    enum: ContentTypeEnum,
    example: ContentTypeEnum.COMIC,
    required: true,
  })
  workType!: ContentTypeEnum

  @DateProperty({
    description: '最近阅读时间',
    example: '2026-03-10T08:00:00.000Z',
    required: true,
  })
  lastReadAt!: Date

  @NumberProperty({
    description: '最近阅读的章节 ID',
    example: 1,
    required: true,
    nullable: true,
    min: 1,
  })
  lastReadChapterId!: number | null
}

export class QueryReadingHistoryDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BaseReadingStateDto), ['workId', 'workType'] as const),
) {}

export class QueryReadingHistoryCommandDto extends IntersectionType(
  QueryReadingHistoryDto,
  PickType(BaseReadingStateDto, ['userId'] as const),
) {}

export class TouchReadingStateByWorkDto extends IntersectionType(
  PickType(BaseReadingStateDto, ['userId', 'workId', 'workType'] as const),
  PartialType(
    PickType(BaseReadingStateDto, ['lastReadChapterId', 'lastReadAt'] as const),
  ),
) {}

export class DeleteReadingHistoryDto {
  @ArrayProperty({
    description: '需要删除的作品 id 列表',
    itemType: 'number',
    required: true,
  })
  workIds!: number[]
}

export class DeleteReadingHistoryCommandDto extends IntersectionType(
  DeleteReadingHistoryDto,
  PickType(BaseReadingStateDto, ['userId'] as const),
) {}

export class ClearReadingHistoryDto {
  @EnumProperty({
    description: '作品类型（1=漫画；2=小说）',
    enum: ContentTypeEnum,
    example: ContentTypeEnum.COMIC,
    required: false,
  })
  workType?: ContentTypeEnum
}

export class ClearReadingHistoryCommandDto extends IntersectionType(
  ClearReadingHistoryDto,
  PickType(BaseReadingStateDto, ['userId'] as const),
) {}
