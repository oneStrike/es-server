/**
 * 章节拖拽排序入参。
 * - 通过 dragId 与 targetId 在同作品下交换章节顺序
 */
/** 稳定领域类型 `SwapWorkChapterNumbersInput`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface SwapWorkChapterNumbersInput {
  dragId: number
  targetId: number
}

/** 稳定领域类型 `WorkChapterDetailContext`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface WorkChapterDetailContext {
  userId?: number
  ipAddress?: string
  device?: string
  bypassVisibilityCheck?: boolean
}
