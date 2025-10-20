/**
 *  类型定义 [UploadFileRequest]
 *  @来源 管理端文件上传
 *  @更新时间 2025-10-20 09:05:51
 */
export type UploadFileRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 上传场景 */
  scene?: string;
};

export type UploadFileResponse = UploadResponseDto[];

/**
 *  类型定义 [UploadResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-20 09:05:51
 */
export type UploadResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 文件名 */
  filename: string;
  /* 文件路径 */
  filePath: string;
  /* 文件大小 */
  fileSize: number;
  /* 文件类型 */
  fileType: string;
  /* 文件类型mimeType */
  mimeType: string;
  /* 原始文件名 */
  originalName: string;
  /* 文件场景 */
  scene: string;

  /* 上传时间 */
  uploadTime: string;
};
