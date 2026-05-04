import type { UploadConfigInterface } from '@libs/platform/config'
import type {
  UploadFileCategory,
  UploadSystemConfig,
} from '@libs/platform/modules/upload/upload.type'

/** 聊天媒体允许复用的上传文件分类。 */
export type ChatMediaFileCategory = Extract<
  UploadFileCategory,
  'image' | 'audio' | 'video'
>

/** 聊天媒体文件来源校验策略，封装当前上传配置与系统 provider 配置。 */
export interface ChatMediaOriginPolicy {
  accepts: (filePath: string, fileCategory: ChatMediaFileCategory) => boolean
}

/** 构造聊天媒体来源校验所需的运行时配置。 */
export interface ChatMediaOriginPolicyOptions {
  uploadConfig: UploadConfigInterface
  systemUploadConfig?: UploadSystemConfig
}
