import { EnablePlatformEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { BaseAppPageDto } from '../../page/dto/page.dto'
import {
  AnnouncementFanoutStatusEnum,
  AnnouncementPriorityEnum,
  AnnouncementPublishStatusEnum,
  AnnouncementTypeEnum,
  PopupBackgroundPositionEnum,
} from '../announcement.constant'

/**
 * 公告基础 DTO
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
    example: '系统维护通知，预计维护时间 2 小时',
    nullable: true,
    maxLength: 500,
  })
  summary!: string | null

  @EnumProperty({
    description:
      '公告类型（0=平台公告；1=活动公告；2=维护公告；3=更新公告；4=政策公告）',
    example: AnnouncementTypeEnum.PLATFORM,
    required: true,
    enum: AnnouncementTypeEnum,
    default: AnnouncementTypeEnum.PLATFORM,
  })
  announcementType!: AnnouncementTypeEnum

  @EnumProperty({
    description: '公告优先级（0=低优先级；1=中优先级；2=高优先级；3=紧急）',
    example: AnnouncementPriorityEnum.MEDIUM,
    required: true,
    enum: AnnouncementPriorityEnum,
    default: AnnouncementPriorityEnum.MEDIUM,
  })
  priorityLevel!: AnnouncementPriorityEnum

  @DateProperty({
    description: '发布开始时间',
    example: '2024-01-01T00:00:00.000Z',
    nullable: true,
  })
  publishStartTime!: Date | null

  @DateProperty({
    description: '发布结束时间',
    example: '2024-12-31T23:59:59.999Z',
    nullable: true,
  })
  publishEndTime!: Date | null

  @NumberProperty({
    description: '关联页面 id',
    example: 12,
    nullable: true,
  })
  pageId!: number | null

  @StringProperty({
    description: '公告弹窗背景图片 URL',
    example: 'https://example.com/bg.jpg',
    nullable: true,
    maxLength: 200,
  })
  popupBackgroundImage!: string | null

  @EnumProperty({
    description: '弹窗背景图片位置（CSS background-position 值，默认居中）',
    example: PopupBackgroundPositionEnum.CENTER,
    enum: PopupBackgroundPositionEnum,
    default: PopupBackgroundPositionEnum.CENTER,
  })
  popupBackgroundPosition!: PopupBackgroundPositionEnum

  @BooleanProperty({
    description: '是否发布',
    example: false,
    required: true,
    default: false,
  })
  isPublished!: boolean

  @BooleanProperty({
    description: '是否同步到消息中心',
    example: false,
    required: true,
    default: false,
  })
  isRealtime!: boolean

  @ArrayProperty({
    description: '启用的平台（1=H5；2=App；3=小程序）',
    example: [EnablePlatformEnum.APP],
    itemEnum: EnablePlatformEnum,
    minLength: 1,
  })
  enablePlatform!: EnablePlatformEnum[]

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

class CreateAnnouncementRequiredFieldsDto extends OmitType(
  BaseAnnouncementDto,
  [
    ...OMIT_BASE_FIELDS,
    'isPublished',
    'viewCount',
    'summary',
    'publishStartTime',
    'publishEndTime',
    'pageId',
    'popupBackgroundImage',
    'popupBackgroundPosition',
    'enablePlatform',
  ] as const,
) {}

class CreateAnnouncementOptionalFieldsDto extends PartialType(
  PickType(BaseAnnouncementDto, [
    'summary',
    'publishStartTime',
    'publishEndTime',
    'pageId',
    'popupBackgroundImage',
    'popupBackgroundPosition',
    'enablePlatform',
  ] as const),
) {}

export class CreateAnnouncementDto extends IntersectionType(
  CreateAnnouncementRequiredFieldsDto,
  CreateAnnouncementOptionalFieldsDto,
) {}

export class UpdateAnnouncementDto extends IntersectionType(
  IdDto,
  PartialType(CreateAnnouncementDto),
) {}

export class QueryAnnouncementDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAnnouncementDto, [
      'title',
      'announcementType',
      'priorityLevel',
      'isRealtime',
      'isPinned',
      'showAsPopup',
      'pageId',
      'publishStartTime',
      'publishEndTime',
    ] as const),
  ),
) {
  @EnumProperty({
    description: '派生发布状态（未发布；待生效；生效中；已过期）',
    example: AnnouncementPublishStatusEnum.ACTIVE,
    required: false,
    enum: AnnouncementPublishStatusEnum,
  })
  publishStatus?: AnnouncementPublishStatusEnum

  @EnumProperty({
    description: '消息中心扇出状态（0=待处理；1=处理中；2=成功；3=失败）',
    example: AnnouncementFanoutStatusEnum.SUCCESS,
    required: false,
    enum: AnnouncementFanoutStatusEnum,
  })
  fanoutStatus?: AnnouncementFanoutStatusEnum

  @BooleanProperty({
    description: '是否仅筛选已发布公告',
    example: false,
    required: false,
  })
  isPublished?: boolean

  @JsonProperty({
    description: '启用平台筛选 JSON 字符串，例如 [1,2]',
    example: '[1,2]',
    required: false,
  })
  enablePlatform?: string
}

export class AnnouncementRuntimeFieldsDto {
  @EnumProperty({
    description: '派生发布状态（未发布；待生效；生效中；已过期）',
    example: AnnouncementPublishStatusEnum.ACTIVE,
    required: true,
    enum: AnnouncementPublishStatusEnum,
    validation: false,
  })
  publishStatus!: AnnouncementPublishStatusEnum

  @EnumProperty({
    description: '消息中心扇出状态（0=待处理；1=处理中；2=成功；3=失败）',
    example: AnnouncementFanoutStatusEnum.SUCCESS,
    required: true,
    nullable: true,
    enum: AnnouncementFanoutStatusEnum,
    validation: false,
  })
  fanoutStatus!: AnnouncementFanoutStatusEnum | null

  @StringProperty({
    description: '最近一次消息中心扇出目标事件',
    example: 'announcement.published',
    required: true,
    nullable: true,
    validation: false,
  })
  fanoutDesiredEventKey!: string | null

  @StringProperty({
    description: '最近一次消息中心扇出错误',
    example: 'network timeout',
    required: true,
    nullable: true,
    validation: false,
  })
  fanoutLastError!: string | null

  @DateProperty({
    description: '最近一次消息中心扇出更新时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
    nullable: true,
    validation: false,
  })
  fanoutUpdatedAt!: Date | null
}

export class AnnouncementOutputBaseDto extends BaseAnnouncementDto {}

export class AnnouncementPageItemDto extends IntersectionType(
  AnnouncementOutputBaseDto,
  AnnouncementRuntimeFieldsDto,
) {}

export class AppAnnouncementListItemDto extends OmitType(
  AnnouncementOutputBaseDto,
  ['content'] as const,
) {}

export class AnnouncementRelatedPageDto extends PickType(BaseAppPageDto, [
  'id',
  'name',
  'code',
  'path',
] as const) {}

export class AnnouncementDetailDto extends AnnouncementPageItemDto {
  @NestedProperty({
    description: '公告关联页面',
    required: true,
    nullable: true,
    type: AnnouncementRelatedPageDto,
    validation: false,
  })
  appPage!: AnnouncementRelatedPageDto | null
}
