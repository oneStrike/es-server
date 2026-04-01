/**
 * 系统公告常量定义
 * 覆盖公告类型与优先级
 */
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

/**
 * 判断公告是否应进入通知中心
 *
 * 第一阶段按“高优先级/置顶/弹窗”任一命中视为重要公告，
 * 物化为消息域通知；普通公告仍留在内容域自行展示。
 */
export function shouldAnnouncementEnterNotificationCenter(input: {
  priorityLevel: number
  isPinned: boolean
  showAsPopup: boolean
}) {
  return (
    input.priorityLevel >= AnnouncementPriorityEnum.HIGH ||
    input.isPinned ||
    input.showAsPopup
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
  if (input.publishEndTime && input.publishEndTime < now) {
    return false
  }
  return true
}
