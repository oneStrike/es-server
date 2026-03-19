import { EnablePlatformEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import {
  AnnouncementPriorityEnum,
  AnnouncementTypeEnum,
} from '../announcement.constant'

/**
 * 公告基础DTO
 */
export class BaseAnnouncementDto extends BaseDto {
  @StringProperty({
    description: '公告标题',
    example: '系统维护公告',
    required: true,
    maxLength: 100,
  })
  title!: string

  @StringProperty({
    description: '公告内容详情',
    example: '系统将于今晚进行维护升级...',
    required: true,
  })
  content!: string

  @StringProperty({
    description: '公告摘要',
    example: '系统维护通知，预计维护时间2小时',
    required: false,
    maxLength: 500,
  })
  summary?: string

  @EnumProperty({
    description: '公告类型',
    example: AnnouncementTypeEnum.PLATFORM,
    required: true,
    enum: AnnouncementTypeEnum,
    default: AnnouncementTypeEnum.PLATFORM,
  })
  announcementType!: AnnouncementTypeEnum

  @EnumProperty({
    description: '优先级',
    example: AnnouncementPriorityEnum.MEDIUM,
    required: true,
    enum: AnnouncementPriorityEnum,
    default: AnnouncementPriorityEnum.MEDIUM,
  })
  priorityLevel!: AnnouncementPriorityEnum

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
    description: '公告弹窗背景图片URL',
    example: 'https://example.com/bg.jpg',
    required: false,
    maxLength: 200,
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
    required: false,
    itemType: 'number',
  })
  enablePlatform?: EnablePlatformEnum[] | null

  @BooleanProperty({
    description: '是否置顶',
    example: false,
    required: true,
    default: false,
  })
  isPinned!: boolean

  @BooleanProperty({
    description: '是否弹窗显示',
    example: false,
    required: true,
    default: false,
  })
  showAsPopup!: boolean

  @NumberProperty({
    description: '浏览次数',
    example: 0,
    required: true,
    min: 0,
    default: 0,
  })
  viewCount!: number
}
