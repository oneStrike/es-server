import type { AppAnnouncement } from '@db/schema'

/**
 * 创建公告入参。
 * - 用于新增公告主体信息
 */
export type CreateAnnouncementInput = Omit<
  Partial<AppAnnouncement>,
  'id' | 'createdAt' | 'updatedAt' | 'isPublished' | 'viewCount'
> &
Pick<
    AppAnnouncement,
    'title' | 'content' | 'announcementType' | 'priorityLevel'
  >

/**
 * 更新公告入参。
 * - 以公告ID定位并按需更新字段
 */
export type UpdateAnnouncementInput = Pick<AppAnnouncement, 'id'> &
  Omit<Partial<AppAnnouncement>, 'id' | 'createdAt' | 'updatedAt' | 'viewCount'>

/**
 * 公告分页查询入参。
 * - 支持标题、状态、时间、平台等筛选
 * - 分页参数与 PageDto 语义保持一致
 */
export interface AnnouncementPageQuery {
  title?: string
  announcementType?: number
  priorityLevel?: number
  isPublished?: boolean
  isPinned?: boolean
  showAsPopup?: boolean
  pageId?: number
  publishStartTime?: Date
  publishEndTime?: Date
  enablePlatform?: string
  pageIndex?: number
  pageSize?: number
}

/**
 * 公告发布状态更新入参。
 * - 仅用于切换发布状态
 */
export type UpdateAnnouncementStatusInput = Pick<
  AppAnnouncement,
  'id' | 'isPublished'
>

/**
 * 公告删除入参。
 * - 用于按公告 id 删除数据
 */
export type DeleteAnnouncementInput = Pick<AppAnnouncement, 'id'>
