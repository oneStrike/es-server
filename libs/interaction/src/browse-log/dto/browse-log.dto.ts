import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { EnumProperty, NumberProperty } from '@libs/base/decorators'

const BROWSE_LOG_TARGET_TYPES = {
  COMIC: InteractionTargetTypeEnum.COMIC,
  NOVEL: InteractionTargetTypeEnum.NOVEL,
  COMIC_CHAPTER: InteractionTargetTypeEnum.COMIC_CHAPTER,
  NOVEL_CHAPTER: InteractionTargetTypeEnum.NOVEL_CHAPTER,
  FORUM_TOPIC: InteractionTargetTypeEnum.FORUM_TOPIC,
} as const

export class RecordBrowseLogDto {
  @EnumProperty({
    description: '目标类型（1=漫画，2=小说，3=漫画章节，4=小说章节，5=论坛主题）',
    enum: BROWSE_LOG_TARGET_TYPES,
    example: InteractionTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: InteractionTargetTypeEnum

  @NumberProperty({
    description: '目标 ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number
}

export class QueryBrowseLogDto {
  @EnumProperty({
    description: '目标类型筛选',
    enum: BROWSE_LOG_TARGET_TYPES,
    example: InteractionTargetTypeEnum.COMIC,
    required: false,
  })
  targetType?: InteractionTargetTypeEnum

  @NumberProperty({
    description: '页码',
    default: 1,
    example: 1,
    required: false,
    min: 1,
  })
  pageIndex?: number = 1

  @NumberProperty({
    description: '每页数量',
    default: 20,
    example: 20,
    required: false,
    min: 1,
    max: 500,
  })
  pageSize?: number = 20
}

export class ClearBrowseLogDto {
  @EnumProperty({
    description: '仅清理指定目标类型，不传则清理全部',
    enum: BROWSE_LOG_TARGET_TYPES,
    example: InteractionTargetTypeEnum.COMIC,
    required: false,
  })
  targetType?: InteractionTargetTypeEnum
}
