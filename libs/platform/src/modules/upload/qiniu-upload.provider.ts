import type {
  PreparedUploadFile,
  UploadExecutionResult,
  UploadSystemConfig,
} from './upload.types'
import { BadRequestException, Injectable } from '@nestjs/common'
import * as qiniu from 'qiniu'

const TRAILING_SLASH_REGEX = /\/+$/
const HTTP_PREFIX_REGEX = /^https?:\/\//i

@Injectable()
export class QiniuUploadProvider {
  async upload(
    file: PreparedUploadFile,
    systemConfig: UploadSystemConfig,
  ): Promise<UploadExecutionResult> {
    const config = systemConfig.qiniu
    if (!config.accessKey || !config.secretKey || !config.bucket || !config.domain) {
      throw new BadRequestException('七牛上传配置不完整')
    }

    const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey)
    const putPolicy = new qiniu.rs.PutPolicy({
      scope: config.bucket,
      expires: config.tokenExpires,
    })
    const uploadToken = putPolicy.uploadToken(mac)

    const qiniuConfig = new qiniu.conf.Config()
    if (config.region) {
      qiniuConfig.regionsProvider = qiniu.httpc.Region.fromRegionId(config.region)
    }
    qiniuConfig.useHttpsDomain = config.useHttps

    const formUploader = new qiniu.form_up.FormUploader(qiniuConfig)
    const putExtra = new qiniu.form_up.PutExtra()
    const objectKey = this.buildObjectKey(config.pathPrefix, file.objectKey)

    try {
      const { resp, data } = await formUploader.putFile(
        uploadToken,
        objectKey,
        file.tempPath,
        putExtra,
      )

      if (resp.statusCode !== 200) {
        throw new BadRequestException(
          `七牛上传失败: ${data?.error || resp.statusCode}`,
        )
      }

      return {
        filePath: this.joinDomain(config.domain, objectKey, config.useHttps),
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }
      throw new BadRequestException('七牛上传失败')
    }
  }

  private buildObjectKey(pathPrefix: string, objectKey: string) {
    const normalizedPrefix = pathPrefix
      .split('/')
      .map(part => part.trim())
      .filter(Boolean)
      .join('/')

    return normalizedPrefix ? `${normalizedPrefix}/${objectKey}` : objectKey
  }

  private joinDomain(domain: string, objectKey: string, useHttps: boolean) {
    const normalizedDomain = domain.trim().replace(TRAILING_SLASH_REGEX, '')
    if (HTTP_PREFIX_REGEX.test(normalizedDomain)) {
      return `${normalizedDomain}/${objectKey}`
    }

    return `${useHttps ? 'https' : 'http'}://${normalizedDomain}/${objectKey}`
  }
}
