import { WorkTypeEnum } from '@libs/platform/constant'
import {
  DateProperty,
  EnumProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { UserIdDto } from '@libs/platform/dto'

/**
 * 基础阅读状态 DTO
 */
export class BaseReadingStateDto extends UserIdDto {
  @NumberProperty({
    description: '作品ID',
    example: 1,
    required: true,
    min: 1,
  })
  workId!: number

  @EnumProperty({
    description: '作品类型（1=漫画，2=小说）',
    enum: WorkTypeEnum,
    example: WorkTypeEnum.COMIC,
    required: true,
  })
  workType!: WorkTypeEnum

  @DateProperty({
    description: '最近阅读时间',
    example: '2026-03-10T08:00:00.000Z',
    required: true,
    validation: false,
  })
  lastReadAt!: Date

  @NumberProperty({
    description: '最近阅读的章节ID',
    example: 1,
    required: false,
    min: 1,
  })
  lastReadChapterId?: number
}
