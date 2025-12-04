import type { UploadUploadFileResponse } from '#/apis/types/upload';

export type EsUploadScene = 'common';

export interface EsUploadProps {
  /** 上传文件的所属场景 */
  scene: EsUploadScene;
  /** 上传地址 */
  modelValue: string | string[] | UploadUploadFileResponse;
  /** 允许上传的文件类型 */
  accept?: string;
  /** 上传时附带的额外参数 */
  data?: Record<string, any>;
  /** 是否禁用上传组件 */
  disabled?: boolean;
  /** 上传列表的内建样式 */
  listType?: 'picture' | 'picture-card' | 'text';
  /** 限制上传文件的最大数量 */
  maxCount?: number;
  /** 是否支持多选文件 */
  multiple?: boolean;
  /** 上传的文件字段名 */
  name?: string;
  /** 限制文件大小（单位：字节） */
  maxSize?: number;
  /** 是否自动上传（false时需要手动触发上传） */
  autoUpload?: boolean;
  /** 是否显示上传进度 */
  showProgress?: boolean;
  /** 进度条样式 */
  progressProps?: Record<string, any>;
  /** 上传文件的返回数据类型 */
  returnDataType?: 'array' | 'json' | 'url';
}

export interface BatchUploadStatus {
  /** 总文件数 */
  total: number;
  /** 已上传文件数 */
  uploaded: number;
  /** 上传失败文件数 */
  failed: number;
  /** 当前是否正在上传 */
  uploading: boolean;
  /** 上传进度百分比 */
  progress: number;
}
