import { GrowthRuleTypeEnum } from '@libs/growth'

export enum ReportStatusEnum {
  PENDING = 1,
  PROCESSING = 2,
  RESOLVED = 3,
  REJECTED = 4,
}

export enum ReportReasonEnum {
  SPAM = 1,
  INAPPROPRIATE_CONTENT = 2,
  HARASSMENT = 3,
  COPYRIGHT = 4,
  OTHER = 99,
}

export enum ReportTargetTypeEnum {
  COMIC = 1,
  NOVEL = 2,
  COMIC_CHAPTER = 3,
  NOVEL_CHAPTER = 4,
  FORUM_TOPIC = 5,
  COMMENT = 6,
  USER = 7,
}

export const REPORT_GROWTH_RULE_TYPE_MAP: Partial<
  Record<ReportTargetTypeEnum, GrowthRuleTypeEnum>
> = {
  [ReportTargetTypeEnum.COMIC]: GrowthRuleTypeEnum.COMIC_WORK_REPORT,
  [ReportTargetTypeEnum.NOVEL]: GrowthRuleTypeEnum.NOVEL_WORK_REPORT,
  [ReportTargetTypeEnum.COMIC_CHAPTER]: GrowthRuleTypeEnum.COMIC_CHAPTER_REPORT,
  [ReportTargetTypeEnum.NOVEL_CHAPTER]:
    GrowthRuleTypeEnum.NOVEL_CHAPTER_REPORT,
  [ReportTargetTypeEnum.FORUM_TOPIC]: GrowthRuleTypeEnum.TOPIC_REPORT,
  [ReportTargetTypeEnum.COMMENT]: GrowthRuleTypeEnum.COMMENT_REPORT,
}
