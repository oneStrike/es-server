import { InteractionTargetTypeEnum } from '@libs/platform/constant'
import { CommentTargetTypeEnum } from './comment.constant'

/**
 * 评论模块本地目标类型到系统级交互目标语义的映射。
 */
export const COMMENT_TARGET_TYPE_TO_INTERACTION_TARGET_TYPE_MAP: Record<
  CommentTargetTypeEnum,
  InteractionTargetTypeEnum
> = {
  [CommentTargetTypeEnum.COMIC]: InteractionTargetTypeEnum.COMIC,
  [CommentTargetTypeEnum.NOVEL]: InteractionTargetTypeEnum.NOVEL,
  [CommentTargetTypeEnum.COMIC_CHAPTER]:
    InteractionTargetTypeEnum.COMIC_CHAPTER,
  [CommentTargetTypeEnum.NOVEL_CHAPTER]:
    InteractionTargetTypeEnum.NOVEL_CHAPTER,
  [CommentTargetTypeEnum.FORUM_TOPIC]: InteractionTargetTypeEnum.FORUM_TOPIC,
}

export function mapCommentTargetTypeToInteractionTargetType(
  targetType: CommentTargetTypeEnum,
): InteractionTargetTypeEnum {
  return COMMENT_TARGET_TYPE_TO_INTERACTION_TARGET_TYPE_MAP[targetType]
}
