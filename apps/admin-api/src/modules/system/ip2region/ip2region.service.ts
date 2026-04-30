import type { FastifyRequest } from 'fastify'
import { createWriteStream, promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  GeoService,
  resolveGeoManagedStorageDir,
} from '@libs/platform/modules/geo/geo.service'
import { GEO_RUNTIME_SOURCE } from '@libs/platform/modules/geo/geo.type'
import { LoggerService } from '@libs/platform/modules/logger/logger.service'
import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common'

const pump = promisify(pipeline)
const ACTIVE_METADATA_FILE = 'metadata.json'
const EXPECTED_UPLOAD_FILE_NAME = 'ip2region_v4.xdb'
const ISO_TIMESTAMP_STRIP_MILLISECONDS_REGEX = /\.\d{3}Z$/
const ISO_TIMESTAMP_STRIP_SYMBOL_REGEX = /[-:]/g

interface ActiveMetadata {
  activeFileName: string
  originalFileName: string
  activatedAt: string
  fileSize: number
}

/**
 * 管理端 ip2region 服务。
 * 负责接收 xdb 上传、落盘管理、当前进程热切换与状态输出。
 */
@Injectable()
export class Ip2regionService {
  private reloading = false

  constructor(
    private readonly geoService: GeoService,
    private readonly loggerService: LoggerService,
  ) {}

  private get logger() {
    return this.loggerService.getLoggerWithContext('ip2region-admin')
  }

  /**
   * 读取当前 ip2region 运行状态。
   * 在 GeoService 基础状态上补充当前是否正在热切换。
   */
  async getStatus() {
    return {
      ...(await this.geoService.getRuntimeStatus()),
      reloading: this.reloading,
    }
  }

  /**
   * 上传并激活新的 ip2region 库。
   * 仅允许一个热切换流程并发执行，避免当前进程查询器状态被覆盖。
   */
  async uploadAndActivate(req: FastifyRequest, operatorUserId?: number) {
    if (this.reloading) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '当前正在切换 IP 属地库，请稍后重试',
      )
    }

    this.reloading = true
    let tempPath: string | undefined

    try {
      const uploadFile = await req.file()
      if (!uploadFile) {
        throw new BadRequestException('上传文件不能为空')
      }

      const originalFileName = basename(uploadFile.filename || '')
      this.assertUploadFileName(originalFileName)

      const storagePaths = await this.ensureStoragePaths()
      const activatedAt = new Date()
      const stampedFileName = this.buildVersionedFileName(
        activatedAt,
        originalFileName,
      )

      tempPath = join(storagePaths.tmpDir, `.${stampedFileName}.uploading`)
      await pump(uploadFile.file, createWriteStream(tempPath))

      if (uploadFile.file.truncated) {
        throw new PayloadTooLargeException('文件大小超过限制')
      }

      const fileStat = await fs.stat(tempPath)
      if (fileStat.size <= 0) {
        throw new BadRequestException('上传文件不能为空')
      }

      const versionPath = join(storagePaths.versionsDir, stampedFileName)
      const activePath = join(storagePaths.activeDir, stampedFileName)

      await this.geoService.validateFile(tempPath)
      await fs.copyFile(tempPath, versionPath)
      await fs.copyFile(tempPath, activePath)
      const runtimeStatus = await this.geoService.reloadFromFile(activePath, {
        source: GEO_RUNTIME_SOURCE.MANAGED_ACTIVE,
        fileName: stampedFileName,
        fileSize: fileStat.size,
        activatedAt,
      })
      await this.writeActiveMetadata(storagePaths.activeDir, {
        activeFileName: stampedFileName,
        originalFileName,
        activatedAt: activatedAt.toISOString(),
        fileSize: fileStat.size,
      })
      await this.cleanupOldActiveFiles(storagePaths.activeDir, stampedFileName)

      this.logger.log({
        level: 'info',
        message: 'ip2region_reload_succeeded',
        operatorUserId,
        originalFileName,
        activeFileName: stampedFileName,
        fileSize: fileStat.size,
        activeFilePath: activePath,
      })

      return {
        ...runtimeStatus,
        reloading: false,
      }
    } catch (error) {
      this.logger.warn({
        level: 'warn',
        message: 'ip2region_reload_failed',
        operatorUserId,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      throw error
    } finally {
      this.reloading = false

      if (tempPath) {
        await fs.rm(tempPath, { force: true }).catch(() => undefined)
      }
    }
  }

  /**
   * 获取 ip2region 专用存储根目录。
   * 复用 GeoService 的目录解析，避免上传链路与运行时恢复链路出现双份默认值。
   */
  private resolveStorageRoot() {
    return resolveGeoManagedStorageDir()
  }

  /**
   * 初始化 ip2region 存储目录。
   * 根目录按 tmp、versions、active 三段收口。
   */
  private async ensureStoragePaths() {
    const storageRoot = this.resolveStorageRoot()
    const tmpDir = join(storageRoot, 'tmp')
    const versionsDir = join(storageRoot, 'versions')
    const activeDir = join(storageRoot, 'active')

    await Promise.all([
      fs.mkdir(tmpDir, { recursive: true }),
      fs.mkdir(versionsDir, { recursive: true }),
      fs.mkdir(activeDir, { recursive: true }),
    ])

    return {
      storageRoot,
      tmpDir,
      versionsDir,
      activeDir,
    }
  }

  /**
   * 校验上传文件名。
   * 当前仅接受标准 `ip2region_v4.xdb`，显式拒绝自定义命名和 v6 文件。
   */
  private assertUploadFileName(fileName: string) {
    if (!fileName) {
      throw new BadRequestException('上传文件不能为空')
    }

    if (fileName !== EXPECTED_UPLOAD_FILE_NAME) {
      throw new BadRequestException('仅支持上传 ip2region_v4.xdb 文件')
    }
  }

  /**
   * 生成版本文件名。
   * 使用时间戳前缀保留历史版本，并避免 active / versions 文件名冲突。
   */
  private buildVersionedFileName(date: Date, originalFileName: string) {
    const timestamp = date
      .toISOString()
      .replace(ISO_TIMESTAMP_STRIP_SYMBOL_REGEX, '')
      .replace(ISO_TIMESTAMP_STRIP_MILLISECONDS_REGEX, '')
      .replace('T', '-')

    return `${timestamp}-${originalFileName}`
  }

  /**
   * 写入 active 目录元信息。
   * 采用临时文件覆盖，避免直接写 metadata.json 时留下半成品。
   */
  private async writeActiveMetadata(
    activeDir: string,
    metadata: ActiveMetadata,
  ) {
    const metadataPath = join(activeDir, ACTIVE_METADATA_FILE)
    const tempMetadataPath = `${metadataPath}.tmp`

    await fs.writeFile(
      tempMetadataPath,
      JSON.stringify(metadata, null, 2),
      'utf8',
    )
    await fs.rename(tempMetadataPath, metadataPath)
  }

  /**
   * 清理旧的 active 库文件。
   * 当前只保留最近一次生效的 `.xdb` 与 metadata.json`，历史版本统一放在 versions 目录。
   */
  private async cleanupOldActiveFiles(
    activeDir: string,
    currentFileName: string,
  ) {
    const fileNames = await fs.readdir(activeDir)
    await Promise.all(
      fileNames
        .filter(
          (fileName) =>
            fileName !== ACTIVE_METADATA_FILE &&
            fileName !== currentFileName &&
            fileName.toLowerCase().endsWith('.xdb'),
        )
        .map(async (fileName) =>
          fs
            .rm(join(activeDir, fileName), { force: true })
            .catch(() => undefined),
        ),
    )
  }
}
