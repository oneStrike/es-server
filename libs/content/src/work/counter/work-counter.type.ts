/**
 * 作品表可维护的计数字段名。
 * 仅供 WorkCounterService 约束冗余计数更新入口使用。
 */
export type WorkCountField =
  | 'viewCount'
  | 'favoriteCount'
  | 'likeCount'
  | 'commentCount'
  | 'downloadCount'

/**
 * 章节表可维护的计数字段名。
 * 仅供 WorkCounterService 约束章节冗余计数更新入口使用。
 */
export type WorkChapterCountField =
  | 'viewCount'
  | 'likeCount'
  | 'commentCount'
  | 'purchaseCount'
  | 'downloadCount'

/**
 * 作品计数重建结果。
 * 返回给修复脚本或管理入口确认重建后的完整计数快照。
 */
export interface RebuiltWorkCounts {
  workId: number
  workType: number
  viewCount: number
  likeCount: number
  favoriteCount: number
  commentCount: number
  downloadCount: number
}

/**
 * 章节计数重建结果。
 * 返回给修复脚本或管理入口确认重建后的完整章节计数快照。
 */
export interface RebuiltWorkChapterCounts {
  chapterId: number
  workType: number
  viewCount: number
  likeCount: number
  commentCount: number
  purchaseCount: number
  downloadCount: number
}
