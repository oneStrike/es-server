import type { Type } from '@nestjs/common'

/** 内容上传运行时模块的应用组合根依赖。 */
export interface WorkUploadRuntimeModuleRegisterOptions {
  /** 已在当前应用根唯一注册并导出 UploadService 的运行时模块。 */
  uploadRuntimeModule: Type<object>
}
