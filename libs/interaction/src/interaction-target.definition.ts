import { InteractionTargetTypeEnum, SceneTypeEnum } from '@libs/platform/constant'
import { FavoriteTargetTypeEnum } from './favorite/favorite.constant'
import { ReportTargetTypeEnum } from './report/report.constant'

export type InteractionTargetTableKey =
  | 'work'
  | 'workChapter'
  | 'forumTopic'
  | 'userComment'

/**
 * A single source of truth for target lookup strategy.
 * Each target type maps to one model and one where-builder pair.
 */
export interface InteractionTargetDefinition {
  tableKey: InteractionTargetTableKey
  whereBuilder: (targetId: number) => Record<string, unknown>
  whereInBuilder: (targetIds: number[]) => Record<string, unknown>
}

/**
 * Central target query definitions used by like/favorite/view/comment/report.
 */
export const INTERACTION_TARGET_DEFINITIONS: Record<
  InteractionTargetTypeEnum,
  InteractionTargetDefinition
> = {
  [InteractionTargetTypeEnum.COMIC]: {
    tableKey: 'work',
    whereBuilder: (targetId) => ({ id: targetId, type: 1, deletedAt: null }),
    whereInBuilder: (targetIds) => ({
      id: { in: targetIds },
      type: 1,
      deletedAt: null,
    }),
  },
  [InteractionTargetTypeEnum.NOVEL]: {
    tableKey: 'work',
    whereBuilder: (targetId) => ({ id: targetId, type: 2, deletedAt: null }),
    whereInBuilder: (targetIds) => ({
      id: { in: targetIds },
      type: 2,
      deletedAt: null,
    }),
  },
  [InteractionTargetTypeEnum.COMIC_CHAPTER]: {
    tableKey: 'workChapter',
    whereBuilder: (targetId) => ({
      id: targetId,
      workType: 1,
      deletedAt: null,
    }),
    whereInBuilder: (targetIds) => ({
      id: { in: targetIds },
      workType: 1,
      deletedAt: null,
    }),
  },
  [InteractionTargetTypeEnum.NOVEL_CHAPTER]: {
    tableKey: 'workChapter',
    whereBuilder: (targetId) => ({
      id: targetId,
      workType: 2,
      deletedAt: null,
    }),
    whereInBuilder: (targetIds) => ({
      id: { in: targetIds },
      workType: 2,
      deletedAt: null,
    }),
  },
  [InteractionTargetTypeEnum.FORUM_TOPIC]: {
    tableKey: 'forumTopic',
    whereBuilder: (targetId) => ({ id: targetId, deletedAt: null }),
    whereInBuilder: (targetIds) => ({ id: { in: targetIds }, deletedAt: null }),
  },
  [InteractionTargetTypeEnum.COMMENT]: {
    tableKey: 'userComment',
    whereBuilder: (targetId) => ({ id: targetId, deletedAt: null }),
    whereInBuilder: (targetIds) => ({ id: { in: targetIds }, deletedAt: null }),
  },
}

/**
 * Targets that can be favorited at business level.
 * Keeping this here avoids duplicating support matrix in services.
 */
export const FAVORITE_SUPPORTED_TARGET_TYPES = new Set<FavoriteTargetTypeEnum>([
  FavoriteTargetTypeEnum.WORK_COMIC,
  FavoriteTargetTypeEnum.WORK_NOVEL,
  FavoriteTargetTypeEnum.FORUM_TOPIC,
])

/**
 * Targets that can be viewed at business level.
 * Comment is intentionally excluded because comment table has no viewCount field.
 */
export const VIEW_SUPPORTED_TARGET_TYPES = new Set<InteractionTargetTypeEnum>([
  InteractionTargetTypeEnum.COMIC,
  InteractionTargetTypeEnum.NOVEL,
  InteractionTargetTypeEnum.COMIC_CHAPTER,
  InteractionTargetTypeEnum.NOVEL_CHAPTER,
  InteractionTargetTypeEnum.FORUM_TOPIC,
])

/**
 * Static target->scene map for non-comment direct targets.
 * Comment targets are dynamic and resolved from comment payload.
 */
const INTERACTION_TARGET_SCENE_TYPE_MAP: Partial<
  Record<InteractionTargetTypeEnum, SceneTypeEnum>
> = {
  [InteractionTargetTypeEnum.COMIC]: SceneTypeEnum.COMIC_WORK,
  [InteractionTargetTypeEnum.NOVEL]: SceneTypeEnum.NOVEL_WORK,
  [InteractionTargetTypeEnum.COMIC_CHAPTER]: SceneTypeEnum.COMIC_CHAPTER,
  [InteractionTargetTypeEnum.NOVEL_CHAPTER]: SceneTypeEnum.NOVEL_CHAPTER,
  [InteractionTargetTypeEnum.FORUM_TOPIC]: SceneTypeEnum.FORUM_TOPIC,
}

export function mapInteractionTargetTypeToSceneType(
  targetType: InteractionTargetTypeEnum,
): SceneTypeEnum | null {
  return INTERACTION_TARGET_SCENE_TYPE_MAP[targetType] ?? null
}

/**
 * Report type can be projected to interaction target type for common targets.
 * USER is intentionally excluded because it has dedicated resolver logic.
 */
const REPORT_TARGET_TO_INTERACTION_TARGET_MAP: Partial<
  Record<ReportTargetTypeEnum, InteractionTargetTypeEnum>
> = {
  [ReportTargetTypeEnum.COMIC]: InteractionTargetTypeEnum.COMIC,
  [ReportTargetTypeEnum.NOVEL]: InteractionTargetTypeEnum.NOVEL,
  [ReportTargetTypeEnum.COMIC_CHAPTER]: InteractionTargetTypeEnum.COMIC_CHAPTER,
  [ReportTargetTypeEnum.NOVEL_CHAPTER]: InteractionTargetTypeEnum.NOVEL_CHAPTER,
  [ReportTargetTypeEnum.FORUM_TOPIC]: InteractionTargetTypeEnum.FORUM_TOPIC,
  [ReportTargetTypeEnum.COMMENT]: InteractionTargetTypeEnum.COMMENT,
}

export function mapReportTargetTypeToInteractionTargetType(
  targetType: ReportTargetTypeEnum,
): InteractionTargetTypeEnum | null {
  return REPORT_TARGET_TO_INTERACTION_TARGET_MAP[targetType] ?? null
}
