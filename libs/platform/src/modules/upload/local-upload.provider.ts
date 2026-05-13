import type { UploadConfigInterface } from '@libs/platform/config'
import type { PreparedUploadFile, UploadExecutionResult } from './upload.type'
import { mkdir, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { UploadProviderEnum } from './upload.type'

@Injectable()
export class LocalUploadProvider {
  private readonly uploadConfig: UploadConfigInterface

  constructor(private readonly configService: ConfigService) {
    this.uploadConfig = this.configService.get<UploadConfigInterface>('upload')!
  }

  async upload(file: PreparedUploadFile): Promise<UploadExecutionResult> {
    const targetPath = join(
      this.uploadConfig.localDir,
      ...file.objectKey.split('/'),
    )
    await mkdir(dirname(targetPath), { recursive: true })
    await rename(file.tempPath, targetPath)

    const filePath = this.joinUrlPath(
      this.uploadConfig.localUrlPrefix,
      file.objectKey,
    )
    return {
      filePath,
      deleteTarget: {
        provider: UploadProviderEnum.LOCAL,
        filePath,
        objectKey: file.objectKey,
      },
    }
  }

  private joinUrlPath(prefix: string, objectKey: string) {
    const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
    return `${normalizedPrefix}/${objectKey}`
  }
}
