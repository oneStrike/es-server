import { InteractionTargetTypeEnum } from '@libs/platform/constant'
import { ReportTargetTypeEnum } from './report.constant'

/**
 * 举报模块本地目标类型到系统级交互目标语义的映射。
 */
export const REPORT_TARGET_TYPE_TO_INTERACTION_TARGET_TYPE_MAP: Partial<
  Record<ReportTargetTypeEnum, InteractionTargetTypeEnum>
> = {
  [ReportTargetTypeEnum.COMIC]: InteractionTargetTypeEnum.COMIC,
  [ReportTargetTypeEnum.NOVEL]: InteractionTargetTypeEnum.NOVEL,
  [ReportTargetTypeEnum.COMIC_CHAPTER]:
    InteractionTargetTypeEnum.COMIC_CHAPTER,
  [ReportTargetTypeEnum.NOVEL_CHAPTER]:
    InteractionTargetTypeEnum.NOVEL_CHAPTER,
  [ReportTargetTypeEnum.FORUM_TOPIC]: InteractionTargetTypeEnum.FORUM_TOPIC,
  [ReportTargetTypeEnum.COMMENT]: InteractionTargetTypeEnum.COMMENT,
  [ReportTargetTypeEnum.USER]: InteractionTargetTypeEnum.USER,
}

export function mapReportTargetTypeToInteractionTargetType(
  targetType: ReportTargetTypeEnum,
): InteractionTargetTypeEnum | null {
  return REPORT_TARGET_TYPE_TO_INTERACTION_TARGET_TYPE_MAP[targetType] ?? null
}
