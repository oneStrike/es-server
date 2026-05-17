/** 内容导入工作流类型。 */
export enum ContentImportWorkflowType {
  /** 第三方漫画整本导入。 */
  THIRD_PARTY_IMPORT = 'content-import.third-party-import',
  /** 第三方漫画最新章节同步。 */
  THIRD_PARTY_SYNC = 'content-import.third-party-sync',
  /** 漫画压缩包导入。 */
  ARCHIVE_IMPORT = 'content-import.archive-import',
}

/** 内容导入内容类型。 */
export enum ContentImportContentTypeEnum {
  /** 漫画。 */
  COMIC = 1,
}

/** 内容导入来源类型。 */
export enum ContentImportSourceTypeEnum {
  /** 第三方漫画整本导入。 */
  THIRD_PARTY_IMPORT = 1,
  /** 第三方漫画最新章节同步。 */
  THIRD_PARTY_SYNC = 2,
  /** 漫画压缩包导入。 */
  ARCHIVE_IMPORT = 3,
}

/** 内容导入发布边界状态。 */
export enum ContentImportPublishBoundaryStatusEnum {
  /** 不改变当前发布边界。 */
  UNCHANGED = 1,
  /** 导入后需要人工复核再发布。 */
  NEEDS_MANUAL_REVIEW = 2,
}

/** 内容导入条目类型。 */
export enum ContentImportItemTypeEnum {
  /** 漫画章节。 */
  COMIC_CHAPTER = 1,
}

/** 内容导入条目状态。 */
export enum ContentImportItemStatusEnum {
  /** 待处理。 */
  PENDING = 1,
  /** 处理中。 */
  RUNNING = 2,
  /** 成功。 */
  SUCCESS = 3,
  /** 失败。 */
  FAILED = 4,
  /** 重试中。 */
  RETRYING = 5,
  /** 已跳过。 */
  SKIPPED = 6,
}

/** 内容导入条目阶段。 */
export enum ContentImportItemStageEnum {
  /** 预览中。 */
  PREVIEWING = 1,
  /** 读取来源。 */
  READING_SOURCE = 2,
  /** 准备元数据。 */
  PREPARING_METADATA = 3,
  /** 读取内容。 */
  READING_CONTENT = 4,
  /** 导入图片。 */
  IMPORTING_IMAGES = 5,
  /** 写入内容。 */
  WRITING_CONTENT = 6,
  /** 清理残留。 */
  CLEANING_RESIDUE = 7,
  /** 已完成。 */
  DONE = 8,
}

/** 内容导入条目 attempt 状态。 */
export enum ContentImportItemAttemptStatusEnum {
  /** 待处理。 */
  PENDING = 1,
  /** 处理中。 */
  RUNNING = 2,
  /** 成功。 */
  SUCCESS = 3,
  /** 失败。 */
  FAILED = 4,
  /** 已跳过。 */
  SKIPPED = 5,
}

/** 内容导入残留类型。 */
export enum ContentImportResidueTypeEnum {
  /** 已上传文件。 */
  UPLOADED_FILE = 1,
  /** 压缩包文件。 */
  ARCHIVE_FILE = 2,
  /** 解压目录。 */
  EXTRACT_DIR = 3,
  /** 已创建作品。 */
  CREATED_WORK = 4,
  /** 已创建章节。 */
  CREATED_CHAPTER = 5,
}

/** 内容导入残留清理状态。 */
export enum ContentImportResidueCleanupStatusEnum {
  /** 待清理。 */
  PENDING = 1,
  /** 已清理。 */
  CLEANED = 2,
  /** 清理失败。 */
  FAILED = 3,
  /** 保留待重试。 */
  RETAINED_FOR_RETRY = 4,
}
