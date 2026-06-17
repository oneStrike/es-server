import type { AppAnnouncementSelect } from '@db/schema'
import type { AnnouncementFanoutStatusEnum } from './announcement.constant'

interface AnnouncementFanoutRuntimeFields {
  fanoutDesiredEventKey: string | null
  fanoutLastError: string | null
  fanoutStatus: AnnouncementFanoutStatusEnum | null
  fanoutUpdatedAt: Date | null
}

type AnnouncementInternalRuntimeColumn =
  | 'notificationEndBoundaryAt'
  | 'notificationFanoutDesiredEventKey'
  | 'notificationFanoutLastError'
  | 'notificationFanoutStatus'
  | 'notificationFanoutTaskId'
  | 'notificationFanoutUpdatedAt'
  | 'notificationStartBoundaryAt'

/** 公告管理查询返回行，剔除内部 fanout 列后补齐 service 输出所需的 fanout 运行态字段。 */
export interface AnnouncementResponseRow
  extends
    Omit<AppAnnouncementSelect, AnnouncementInternalRuntimeColumn>,
    AnnouncementFanoutRuntimeFields {}

type AnnouncementOutputFieldSource = Pick<
  AppAnnouncementSelect,
  | 'enablePlatform'
  | 'pageId'
  | 'popupBackgroundImage'
  | 'popupBackgroundPosition'
  | 'publishEndTime'
  | 'publishStartTime'
  | 'summary'
>

/** 公告输出 DTO 归一化输入，供 service 从 schema 字段生成稳定响应结构。 */
export type AnnouncementOutputInput = Partial<AnnouncementOutputFieldSource>
