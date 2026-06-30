import type { AppAnnouncementSelect } from '@db/schema'
import type {
  AnnouncementFanoutStatusEnum,
  AnnouncementPublishStatusEnum,
} from './announcement.constant'

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

/** 公告发布状态字符串视图，兼容历史查询参数。 */
export type AnnouncementPublishStatus = `${AnnouncementPublishStatusEnum}`

/** 公告输出 DTO 归一化输入，供 service 从 schema 字段生成稳定响应结构。 */
export type AnnouncementOutputInput = Partial<AnnouncementOutputFieldSource>

/** 公告通知 fanout 的事件键，区分发布入通知中心与撤回通知中心两类任务。 */
export type AnnouncementFanoutEventKey =
  'announcement.published' | 'announcement.unpublished'

/** 公告通知 fanout 决策所需的公告快照字段，避免 service 使用完整 schema 行。 */
export interface AnnouncementDecisionSnapshot {
  enablePlatform: number[]
  id: number
  isPublished: boolean
  isRealtime: boolean
  publishEndTime?: Date | null
  publishStartTime?: Date | null
  updatedAt?: Date | null
}

/** 公告通知 fanout 单次消费预算，约束批次数和运行时间。 */
export interface AnnouncementFanoutConsumeBudget {
  maxBatchesPerTask: number
  maxRuntimeMs: number
  nowMs: () => number
  startedAtMs: number
}

/** 公告通知 fanout 消费入口的可选预算覆盖参数。 */
export type AnnouncementFanoutConsumeOptions = Partial<
  Pick<
    AnnouncementFanoutConsumeBudget,
    'maxBatchesPerTask' | 'maxRuntimeMs' | 'nowMs'
  >
> & {
  maxTasks?: number
}
