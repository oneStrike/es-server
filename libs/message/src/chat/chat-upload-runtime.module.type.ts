import type { Type } from '@nestjs/common'

/** 聊天媒体上传运行时模块的应用组合根依赖。 */
export interface MessageChatUploadRuntimeModuleRegisterOptions {
  /** 当前应用唯一的通用上传 runtime。 */
  uploadRuntimeModule: Type<object>
}
