import { EnablePlatformEnum } from '@libs/base/constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { NoticePriorityEnum, NoticeTypeEnum } from '../notice.constant'

/**
 * 通知基础DTO
 */
export class BaseNoticeDto extends BaseDto {
  @StringProperty({
    description: '通知标题',
    example: '系统维护通知',
    required: true,
  })
  title!: string

  @StringProperty({
    description: '通知内容详情',
    example: '系统将于今晚进行维护升级...',
    required: true,
  })
  content!: string

  @EnumProperty({
    description: '通知类型',
    example: NoticeTypeEnum.SYSTEM,
    required: true,
    enum: NoticeTypeEnum,
    default: NoticeTypeEnum.SYSTEM,
  })
  noticeType!: NoticeTypeEnum

  @EnumProperty({
    description: '优先级',
    example: NoticePriorityEnum.MEDIUM,
    required: true,
    enum: NoticePriorityEnum,
    default: NoticePriorityEnum.MEDIUM,
  })
  priorityLevel!: NoticePriorityEnum

  @DateProperty({
    description: '发布开始时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  publishStartTime?: Date

  @DateProperty({
    description: '发布结束时间',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
  })
  publishEndTime?: Date

  @NumberProperty({
    description: '关联页面id',
    example: 12,
    required: false,
  })
  pageId?: number

  @StringProperty({
    description: '通知弹窗背景图片URL',
    example: 'https://example.com/bg.jpg',
    required: false,
  })
  popupBackgroundImage?: string

  @BooleanProperty({
    description: '是否发布',
    example: false,
    required: true,
    default: false,
  })
  isPublished!: boolean

  @ArrayProperty({
    description: '启用的平台',
    example: [EnablePlatformEnum.APP],
    required: true,
    itemType: 'number',
  })
  enablePlatform!: EnablePlatformEnum[]

  @BooleanProperty({
    description: '是否置顶',
    example: false,
    required: false,
    default: false,
  })
  isPinned?: boolean

  @BooleanProperty({
    description: '是否弹窗显示',
    example: false,
    required: false,
    default: false,
  })
  showAsPopup?: boolean

  @NumberProperty({
    description: '阅读次数',
    example: 0,
    required: false,
    min: 0,
    default: 0,
  })
  readCount?: number
}

/**
 * 创建通知DTO
 */
export class CreateNoticeDto extends OmitType(BaseNoticeDto, [
  ...OMIT_BASE_FIELDS,
  'isPublished',
  'readCount',
]) {}

/**
 * 更新通知DTO
 */
export class UpdateNoticeDto extends IntersectionType(CreateNoticeDto, IdDto) {}

/**
 * 通知查询DTO
 */
export class QueryNoticeDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseNoticeDto, [
      'title',
      'noticeType',
      'priorityLevel',
      'isPublished',
      'isPinned',
      'showAsPopup',
      'pageId',
      'publishStartTime',
      'publishEndTime',
    ]),
  ),
) {
  @JsonProperty({
    description: '所启用的平台',
    example: '[1,2,3]',
    required: false,
  })
  enablePlatform?: string
}

/**
 * 通知状态更新DTO
 */
export class UpdateNoticeStatusDto extends IntersectionType(
  PickType(BaseNoticeDto, ['isPublished']),
  IdDto,
) {}

/**
 * 分页接口返回DTO
 */

export class NoticePageResponseDto extends OmitType(BaseNoticeDto, [
  'content',
]) {}
