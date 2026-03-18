import { InteractionTargetTypeEnum, SceneTypeEnum } from '@libs/platform/constant'

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
