import { BaseAppPageDto } from '@libs/app-config/page'
import { EnablePlatformEnum } from '@libs/base/constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NestedProperty,
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
    description: '浏览次数',
    example: 0,
    required: false,
    min: 0,
    default: 0,
  })
  viewCount?: number
}

/**
 * 关联的页面DTO
 */

export class RelatedPageDto extends PickType(BaseAppPageDto, [
  'id',
  'name',
  'code',
  'path',
]) {}

/**
 * 公告详情DTO
 */
export class AnnouncementDetailDto extends BaseAnnouncementDto {
  @NestedProperty({
    description: '公告详情',
    example: {
      id: 1,
      name: '首页',
      code: 'home',
      path: '/home',
    },
    required: true,
    type: RelatedPageDto,
    validation: false,
  })
  appPage!: RelatedPageDto
}

/**
 * 创建公告DTO
 */
export class CreateAnnouncementDto extends OmitType(BaseAnnouncementDto, [
  ...OMIT_BASE_FIELDS,
  'isPublished',
  'viewCount',
]) {}

/**
 * 更新公告DTO
 */
export class UpdateAnnouncementDto extends IntersectionType(
  CreateAnnouncementDto,
  IdDto,
) {}

/**
 * 公告查询DTO
 */
export class QueryAnnouncementDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAnnouncementDto, [
      'title',
      'announcementType',
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
 * 公告状态更新DTO
 */
export class UpdateAnnouncementStatusDto extends PickType(BaseAnnouncementDto, [
  'isPublished',
  'id',
]) {}

/**
 * 分页接口返回DTO
 */

export class AnnouncementPageResponseDto extends OmitType(BaseAnnouncementDto, [
  'content',
  'popupBackgroundImage',
]) {}
