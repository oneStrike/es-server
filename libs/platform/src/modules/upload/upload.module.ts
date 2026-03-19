import type { DynamicModule, Type } from '@nestjs/common'
import { Module } from '@nestjs/common'
import { LocalUploadProvider } from './local-upload.provider'
import { QiniuUploadProvider } from './qiniu-upload.provider'
import { SuperbedUploadProvider } from './superbed-upload.provider'
import { UploadService } from './upload.service'
import { UploadModuleOptions } from './upload.types'

/**
 * 文件上传模块 - 重新组织的上传服务模块
 * 包含所有文件上传相关的服务：主服务、验证服务、流处理服务、签名验证服务、路径管理服务
 */
@Module({})
export class UploadModule {
  static register(options: UploadModuleOptions = {}): DynamicModule {
    const imports: (DynamicModule | Type<any>)[] = options.imports ?? []

    return {
      module: UploadModule,
      imports,
      providers: [
        UploadService,
        LocalUploadProvider,
        QiniuUploadProvider,
        SuperbedUploadProvider,
      ],
      exports: [UploadService],
    }
  }
}
