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
