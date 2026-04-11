import type FormData from 'form-data'
import type {
  PreparedUploadFile,
  UploadExecutionResult,
  UploadSystemConfig,
} from './upload.types'
import { createReadStream } from 'node:fs'
import { Injectable, InternalServerErrorException } from '@nestjs/common'
import axios from 'axios'
import NodeFormData from 'form-data'

@Injectable()
export class SuperbedUploadProvider {
  private readonly uploadUrl = 'https://api.superbed.cn/upload'

  async upload(
    file: PreparedUploadFile,
    systemConfig: UploadSystemConfig,
  ): Promise<UploadExecutionResult> {
    const config = systemConfig.superbed
    if (!config.token) {
      throw new InternalServerErrorException('Superbed 上传配置不完整')
    }

    const form = new NodeFormData()
    form.append('token', config.token)
    form.append('file', createReadStream(file.tempPath), {
      contentType: file.mimeType,
      filename: file.finalName,
    })

    if (config.categories) {
      form.append('categories', config.categories)
    }
    this.appendOptionalBoolean(form, 'watermark', config.watermark)
    this.appendOptionalBoolean(form, 'compress', config.compress)
    this.appendOptionalBoolean(form, 'webp', config.webp)

    try {
      const { data } = await axios.post(this.uploadUrl, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 30000,
      })

      if (data?.err !== 0 || !data?.url) {
        throw new InternalServerErrorException(data?.msg || 'Superbed 上传失败')
      }

      return {
        filePath: data.url,
      }
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error
      }
      throw new InternalServerErrorException('Superbed 上传失败')
    }
  }

  private appendOptionalBoolean(form: FormData, name: string, value?: boolean) {
    if (typeof value === 'boolean') {
      form.append(name, String(value))
    }
  }
}
