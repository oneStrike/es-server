/**
 * 系统公告常量定义
 * 覆盖公告类型与优先级
 */
import { EnablePlatformEnum } from '@libs/platform/constant'

/// 公告类型枚举
export enum AnnouncementTypeEnum {
  /** 平台公告 - 平台重要声明 */
  PLATFORM = 0,
  /** 活动公告 - 运营活动信息 */
  ACTIVITY = 1,
  /** 维护公告 - 系统维护通知 */
  MAINTENANCE = 2,
  /** 更新公告 - 版本更新信息 */
  UPDATE = 3,
  /** 政策公告 - 规则政策变更 */
  POLICY = 4,
}

/// 公告优先级枚举
export enum AnnouncementPriorityEnum {
  /** 低优先级 */
  LOW = 0,
  /** 中等优先级 */
  MEDIUM = 1,
  /** 高优先级 */
  HIGH = 2,
  /** 紧急 */
  URGENT = 3,
}

/// 弹窗背景图片位置枚举
/// 支持 CSS background-position 多方位定位，用于控制弹窗背景图的对齐方式
export enum PopupBackgroundPositionEnum {
  /** 居中（默认） */
  CENTER = 'center',
  /** 顶部居中 */
  TOP_CENTER = 'top center',
  /** 顶部靠左 */
  TOP_LEFT = 'top left',
  /** 顶部靠右 */
  TOP_RIGHT = 'top right',
  /** 底部居中 */
  BOTTOM_CENTER = 'bottom center',
  /** 底部靠左 */
  BOTTOM_LEFT = 'bottom left',
  /** 底部靠右 */
  BOTTOM_RIGHT = 'bottom right',
  /** 左侧居中 */
  LEFT_CENTER = 'left center',
  /** 右侧居中 */
  RIGHT_CENTER = 'right center',
}

/// 公告后台派生发布状态
export enum AnnouncementPublishStatusEnum {
  /** 未发布 */
  UNPUBLISHED = 'unpublished',
  /** 已发布但尚未到开始时间 */
  SCHEDULED = 'scheduled',
  /** 当前生效中 */
  ACTIVE = 'active',
  /** 已到结束时间 */
  EXPIRED = 'expired',
}

/// 公告消息中心扇出任务状态
export enum AnnouncementFanoutStatusEnum {
  /** 待处理 */
  PENDING = 0,
  /** 处理中 */
  PROCESSING = 1,
  /** 已成功 */
  SUCCESS = 2,
  /** 失败待重试 */
  FAILED = 3,
}

export type AnnouncementPublishStatus =
  `${AnnouncementPublishStatusEnum}`

/**
 * 判断公告是否应进入通知中心
 *
 * 是否进入消息中心只由显式实时公告开关控制；
 * 优先级、置顶、弹窗只影响内容域展示，不再隐式触发通知。
 */
export function shouldAnnouncementEnterNotificationCenter(input: {
  enablePlatform?: number[] | null
  isRealtime: boolean
}) {
  return (
    input.isRealtime &&
    Array.isArray(input.enablePlatform) &&
    input.enablePlatform.includes(EnablePlatformEnum.APP)
  )
}

/**
 * 判断公告当前是否处于有效发布窗口
 *
 * 仅当已发布且位于发布时间区间内时，才允许进入通知中心。
 */
export function isAnnouncementPublishedNow(
  input: {
    isPublished: boolean
    publishStartTime?: Date | null
    publishEndTime?: Date | null
  },
  now = new Date(),
) {
  if (!input.isPublished) {
    return false
  }
  if (input.publishStartTime && input.publishStartTime > now) {
    return false
  }
  if (input.publishEndTime && input.publishEndTime <= now) {
    return false
  }
  return true
}

export function resolveAnnouncementPublishStatus(
  input: {
    isPublished: boolean
    publishStartTime?: Date | null
    publishEndTime?: Date | null
  },
  now = new Date(),
): AnnouncementPublishStatusEnum {
  if (!input.isPublished) {
    return AnnouncementPublishStatusEnum.UNPUBLISHED
  }
  if (input.publishStartTime && input.publishStartTime > now) {
    return AnnouncementPublishStatusEnum.SCHEDULED
  }
  if (input.publishEndTime && input.publishEndTime <= now) {
    return AnnouncementPublishStatusEnum.EXPIRED
  }
  return AnnouncementPublishStatusEnum.ACTIVE
}
