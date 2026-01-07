export enum ForumReportTypeEnum {
  TOPIC = 'topic',
  REPLY = 'reply',
  USER = 'user',
}

export enum ForumReportStatusEnum {
  PENDING = 'pending',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

export enum ForumReportReasonEnum {
  SPAM = 'spam',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  HARASSMENT = 'harassment',
  COPYRIGHT = 'copyright',
  OTHER = 'other',
}
