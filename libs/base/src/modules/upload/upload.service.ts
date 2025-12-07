import type { UploadConfigInterface } from '@libs/base/config'
import type { FastifyRequest } from 'fastify'
import fs from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { UploadResponseDto } from '@libs/base/dto'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { fileTypeFromStream } from 'file-type'
import { v4 as uuidv4 } from 'uuid'
import {
  generateFilePath,
  sanitizeOriginalName,
} from './utils/upload-path.util'
import { cleanupTempFile } from './utils/upload-stream.util'

const pump = promisify(pipeline)

/**
 * 文件上传服务 - 单文件模式重构版本
 * 主要负责单个文件上传的完整流程
 */
@Injectable()
export class UploadService {
  private readonly uploadConfig: UploadConfigInterface
  private readonly fileUrlPrefix: string

  constructor(@Inject(ConfigService) private configService: ConfigService) {
    this.uploadConfig = this.configService.get<UploadConfigInterface>('upload')!
    this.fileUrlPrefix = this.configService.get('app.fileUrlPrefix')!
  }

  /**
   * 清理临时文件
   * @param filePath 临时文件路径
   */
  cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (error: any) {
      throw new BadRequestException(`上传文件时出错: ${error.message}`)
    }
  }

  /**
   * 生成文件保存路径
   * @param uploadPath 基础上传路径
   * @param fileType 文件类型分类
   * @param scene 场景名称
   * @returns 完整的文件保存路径
   */
  generateFilePath(uploadPath: string, fileType: string, scene: string) {
    // 参数验证
    if (!uploadPath || !fileType) {
      throw new Error('上传失败')
    }

    // 使用现代日期处理方式生成日期字符串
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const savePath = join(uploadPath, dateStr, fileType, scene)
    if (!fs.existsSync(savePath)) {
      try {
        fs.mkdirSync(savePath, { recursive: true, mode: 0o755 })
      } catch {
        throw new Error(`上传失败`)
      }
    }
    // 安全地拼接路径
    return join(uploadPath, dateStr, fileType, scene)
  }

  /**
   * 上传单个文件
   * @param data Fastify multipart数据
   * @returns 上传结果
   */
  async uploadFile(data: FastifyRequest): Promise<UploadResponseDto> {
    const targetFile = await data.file()
    if (!targetFile) {
      throw new BadRequestException('上传文件不能为空')
    }

    const { ext, mime } = (await fileTypeFromStream(targetFile.file)) || {}
    if (!ext || !mime) {
      targetFile.file.destroy()
      throw new BadRequestException('无法识别文件类型')
    }

    if (!this.uploadConfig.allowMimeTypesFlat?.includes(mime)) {
      targetFile.file.destroy()
      throw new BadRequestException('文件类型不被允许')
    }

    // 获取场景值，处理字段类型
    let scene: string | undefined
    const sceneField = targetFile.fields.scene
    if (sceneField) {
      // 如果是单个字段
      if (typeof sceneField === 'object' && 'type' in sceneField) {
        if (sceneField.type === 'field') {
          scene = String(sceneField.value)
        }
      } else if (Array.isArray(sceneField)) {
        // 如果是数组，取第一个值
        const firstField = sceneField[0]
        if (firstField.type === 'field') {
          scene = String(firstField.value)
        }
      }
    }

    if (!scene || !/^[a-z0-9]+$/i.test(scene) || scene.length > 10) {
      throw new BadRequestException('未知的上传场景')
    }

    // 生成保存路径
    const savePath = generateFilePath(
      this.uploadConfig.uploadDir,
      'image',
      scene,
    )
    // 生成文件名（保留原扩展，规范化小写）
    const tempName = `.${uuidv4()}.uploading`
    const tempPath = join(savePath, tempName)
    const writeStream = fs.createWriteStream(tempPath)

    try {
      // 使用管道流式处理文件
      await pump(targetFile.file, writeStream)

      // 生成最终文件名并重命名临时文件
      const finalName = `${uuidv4()}${ext}`
      const finalPath = join(savePath, finalName)
      try {
        fs.renameSync(tempPath, finalPath)
      } catch (renameError: any) {
        // 重命名失败则清理临时文件并抛出错误
        cleanupTempFile(tempPath, null)
        throw renameError
      }

      return {
        filename: finalName,
        originalName: sanitizeOriginalName(targetFile.filename),
        filePath: `${this.fileUrlPrefix}${finalPath}`,
        fileSize: 0,
        mimeType: targetFile.mimetype,
        fileType: 'image',
        scene,
        uploadTime: new Date(),
      }
    } catch (error) {
      // 如果上传失败，尝试删除已创建的文件
      cleanupTempFile(tempPath, null)
      console.error(
        `文件上传失败: ${targetFile.filename} - ${error.message}`,
        error.stack,
      )
      throw error
    }
  }
}
