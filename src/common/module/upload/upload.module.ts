import { Module } from '@nestjs/common'
import { UploadPathService } from './upload-path.service'
import { UploadSignatureService } from './upload-signature.service'
import { UploadStreamService } from './upload-stream.service'
import { UploadValidatorService } from './upload-validator.service'
import { UploadService } from './upload.service'

/**
 * 文件上传模块 - 重新组织的上传服务模块
 * 包含所有文件上传相关的服务：主服务、验证服务、流处理服务、签名验证服务、路径管理服务
 */
@Module({
  providers: [
    UploadService,
    UploadValidatorService,
    UploadStreamService,
    UploadSignatureService,
    UploadPathService,
  ],
  exports: [
    UploadService,
    UploadValidatorService,
    UploadStreamService,
    UploadSignatureService,
    UploadPathService,
  ],
})
export class UploadModule {}
