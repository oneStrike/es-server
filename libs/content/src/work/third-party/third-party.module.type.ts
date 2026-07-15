import type { Type } from '@nestjs/common'

/** 三方漫画运行时模块的应用组合根依赖。 */
export interface ComicThirdPartyRuntimeModuleRegisterOptions {
  /** 当前应用唯一的通用上传 runtime。 */
  uploadRuntimeModule: Type<object>
  /** 当前应用已配置的内容上传 runtime。 */
  workUploadRuntimeModule: Type<object>
}
