import { GrowthRuleTypeEnum } from '@libs/growth'

export enum ReportStatusEnum {
  PENDING = 1,
  PROCESSING = 2,
  RESOLVED = 3,
  REJECTED = 4,
}

export const ReportStatusNames: Record<ReportStatusEnum, string> = {
  [ReportStatusEnum.PENDING]: '待处理',
  [ReportStatusEnum.PROCESSING]: '处理中',
  [ReportStatusEnum.RESOLVED]: '已处理',
  [ReportStatusEnum.REJECTED]: '已驳回',
}

export enum ReportReasonEnum {
  SPAM = 1,
  INAPPROPRIATE_CONTENT = 2,
  HARASSMENT = 3,
  COPYRIGHT = 4,
  OTHER = 99,
}

export const ReportReasonNames: Record<ReportReasonEnum, string> = {
  [ReportReasonEnum.SPAM]: '垃圾信息',
  [ReportReasonEnum.INAPPROPRIATE_CONTENT]: '不当内容',
  [ReportReasonEnum.HARASSMENT]: '骚扰行为',
  [ReportReasonEnum.COPYRIGHT]: '版权问题',
  [ReportReasonEnum.OTHER]: '其他',
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

export const ReportTargetTypeNames: Record<ReportTargetTypeEnum, string> = {
  [ReportTargetTypeEnum.COMIC]: '漫画作品',
  [ReportTargetTypeEnum.NOVEL]: '小说作品',
  [ReportTargetTypeEnum.COMIC_CHAPTER]: '漫画章节',
  [ReportTargetTypeEnum.NOVEL_CHAPTER]: '小说章节',
  [ReportTargetTypeEnum.FORUM_TOPIC]: '论坛主题',
  [ReportTargetTypeEnum.COMMENT]: '评论',
  [ReportTargetTypeEnum.USER]: '用户',
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
