import type { Type } from '@nestjs/common'

/** 三方漫画工作流模块的应用组合根依赖。 */
export interface ComicThirdPartyWorkflowModuleRegisterOptions {
  /** 当前应用已配置的内容上传 runtime。 */
  workUploadRuntimeModule: Type<object>
  /** 当前应用已配置的三方漫画 provider runtime。 */
  thirdPartyRuntimeModule: Type<object>
}
