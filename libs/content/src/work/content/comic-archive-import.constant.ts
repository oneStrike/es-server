/**
 * 漫画压缩包导入任务状态。
 * 用于预解析草稿、确认导入和后台执行阶段的状态流转。
 */
export enum ComicArchiveTaskStatusEnum {
  /** 预解析草稿，等待用户确认。 */
  DRAFT = 0,
  /** 已确认，等待后台 worker 消费。 */
  PENDING = 1,
  /** 后台 worker 正在导入。 */
  PROCESSING = 2,
  /** 全部确认章节导入成功。 */
  SUCCESS = 3,
  /** 部分确认章节导入失败。 */
  PARTIAL_FAILED = 4,
  /** 所有确认章节导入失败或任务级失败。 */
  FAILED = 5,
  /** 任务超过保留窗口不可再确认。 */
  EXPIRED = 6,
  /** 任务已被主动取消。 */
  CANCELLED = 7,
}

/**
 * 漫画压缩包预解析会话状态。
 * 用于在真正创建草稿任务前协调预解析、确认和丢弃。
 */
export enum ComicArchivePreviewSessionStatusEnum {
  /** 会话开放，允许预解析或确认。 */
  OPEN = 1,
  /** 会话正在丢弃，禁止后续创建草稿或确认后台任务。 */
  DISCARDING = 2,
}

/**
 * 漫画压缩包预解析模式。
 * 根目录直接是图片时按单章节处理，根目录存在章节目录时按多章节处理。
 */
export enum ComicArchivePreviewModeEnum {
  /** 单章节压缩包。 */
  SINGLE_CHAPTER = 1,
  /** 多章节压缩包。 */
  MULTI_CHAPTER = 2,
}

/**
 * 漫画压缩包忽略原因码。
 * 数字码会直接返回给前端用于友好提示和分组展示。
 */
export enum ComicArchiveIgnoreReasonEnum {
  /** 一级目录不是有效章节 ID。 */
  INVALID_CHAPTER_ID_DIR = 1001,
  /** 章节 ID 在当前作品下不存在。 */
  CHAPTER_NOT_FOUND = 1002,
  /** 嵌套目录不参与导入。 */
  NESTED_DIRECTORY_IGNORED = 1003,
  /** 单章节模式缺少目标章节 ID。 */
  MISSING_CHAPTER_ID = 1004,
  /** 文件不是受支持的图片。 */
  INVALID_IMAGE_FILE = 1005,
}

/**
 * 漫画压缩包单章节导入结果状态。
 * 用于前端查看每个确认章节的执行结果。
 */
export enum ComicArchiveImportItemStatusEnum {
  /** 等待导入。 */
  PENDING = 0,
  /** 导入成功。 */
  SUCCESS = 1,
  /** 导入失败。 */
  FAILED = 2,
}
