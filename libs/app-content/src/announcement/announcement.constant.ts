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
