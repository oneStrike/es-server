/**
 * 章节拖拽排序入参。
 * - 通过 dragId 与 targetId 在同作品下交换章节顺序
 */
export interface SwapWorkChapterNumbersInput {
  dragId: number
  targetId: number
}

export interface WorkChapterDetailContext {
  userId?: number
  ipAddress?: string
  device?: string
}
