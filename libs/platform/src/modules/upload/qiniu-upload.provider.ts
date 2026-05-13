import type {
  PreparedUploadFile,
  UploadDeleteTarget,
  UploadExecutionResult,
  UploadSystemConfig,
} from './upload.type'
import { Injectable, InternalServerErrorException } from '@nestjs/common'
import * as qiniu from 'qiniu'
import { UploadProviderEnum } from './upload.type'

const TRAILING_SLASH_REGEX = /\/+$/
const HTTP_PREFIX_REGEX = /^https?:\/\//i

@Injectable()
export class QiniuUploadProvider {
  async upload(
    file: PreparedUploadFile,
    systemConfig: UploadSystemConfig,
  ): Promise<UploadExecutionResult> {
    const config = systemConfig.qiniu
    if (
      !config.accessKey ||
      !config.secretKey ||
      !config.bucket ||
      !config.domain
    ) {
      throw new InternalServerErrorException('七牛上传配置不完整')
    }

    const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey)
    const putPolicy = new qiniu.rs.PutPolicy({
      scope: config.bucket,
      expires: config.tokenExpires,
    })
    const uploadToken = putPolicy.uploadToken(mac)

    const qiniuConfig = new qiniu.conf.Config()
    if (config.region) {
      qiniuConfig.regionsProvider = qiniu.httpc.Region.fromRegionId(
        config.region,
      )
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
        throw new InternalServerErrorException(
          `七牛上传失败: ${data?.error || resp.statusCode}`,
        )
      }

      const filePath = this.joinDomain(
        config.domain,
        objectKey,
        config.useHttps,
      )
      return {
        filePath,
        deleteTarget: {
          provider: UploadProviderEnum.QINIU,
          filePath,
          objectKey,
        },
      }
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error
      }
      throw new InternalServerErrorException('七牛上传失败')
    }
  }

  async delete(target: UploadDeleteTarget, systemConfig: UploadSystemConfig) {
    const config = systemConfig.qiniu
    if (
      !config.accessKey ||
      !config.secretKey ||
      !config.bucket ||
      !config.domain
    ) {
      throw new InternalServerErrorException('七牛上传配置不完整')
    }
    if (!target.objectKey) {
      throw new InternalServerErrorException('七牛删除缺少对象 key')
    }

    const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey)
    const qiniuConfig = new qiniu.conf.Config()
    if (config.region) {
      qiniuConfig.regionsProvider = qiniu.httpc.Region.fromRegionId(
        config.region,
      )
    }
    qiniuConfig.useHttpsDomain = config.useHttps

    const bucketManager = new qiniu.rs.BucketManager(mac, qiniuConfig)
    try {
      const { resp, data } = await bucketManager.delete(
        config.bucket,
        target.objectKey,
      )
      if (resp.statusCode === 200 || resp.statusCode === 612) {
        return
      }
      throw new InternalServerErrorException(
        `七牛删除失败: ${data?.error || resp.statusCode}`,
      )
    } catch (error) {
      if (this.resolveDeleteStatusCode(error) === 612) {
        return
      }
      if (error instanceof InternalServerErrorException) {
        throw error
      }
      throw new InternalServerErrorException('七牛删除失败')
    }
  }

  private buildObjectKey(pathPrefix: string, objectKey: string) {
    const normalizedPrefix = pathPrefix
      .split('/')
      .map((part) => part.trim())
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

  private resolveDeleteStatusCode(error: unknown) {
    if (!error || typeof error !== 'object') {
      return undefined
    }

    const qiniuError = error as {
      code?: number
      response?: {
        statusCode?: number
      }
    }
    return qiniuError.code ?? qiniuError.response?.statusCode
  }
}
