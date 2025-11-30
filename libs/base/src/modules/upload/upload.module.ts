import { Module } from '@nestjs/common'
import { UploadService } from './upload.service'

/**
 * 文件上传模块 - 重新组织的上传服务模块
 * 包含所有文件上传相关的服务：主服务、验证服务、流处理服务、签名验证服务、路径管理服务
 */
@Module({
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
