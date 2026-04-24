import type { UploadConfigInterface } from '@libs/platform/config';
import type {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { mkdir } from 'node:fs/promises'
import { extname } from 'node:path'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { ConfigService } from '@nestjs/config'

const EXT_LEADING_DOT_REGEX = /^\./
export const SVG_CONTENT_SECURITY_POLICY
  = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"

interface StaticHeadersResponse {
  setHeader: (name: string, value: string) => void
}

/**
 * 解析静态文件响应头。
 * 文档与压缩包统一走下载策略，SVG 继续允许预览，但额外补充最小安全头。
 */
export function resolveStaticFileHeaders(
  filePath: string,
  uploadConfig: Pick<UploadConfigInterface, 'allowExtensions'>,
) {
  try {
    const ext = extname(filePath)
      .toLowerCase()
      .replace(EXT_LEADING_DOT_REGEX, '')

    if (ext === 'svg') {
      return {
        'Content-Security-Policy': SVG_CONTENT_SECURITY_POLICY,
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      }
    }

    const { document, archive, package: packageExtensions } =
      uploadConfig.allowExtensions
    const isDoc = document?.includes(ext)
    const isArchive = archive?.includes(ext)
    const isPackage = packageExtensions?.includes(ext)

    if (isDoc || isArchive || isPackage) {
      return {
        'Content-Disposition': 'attachment',
        'X-Content-Type-Options': 'nosniff',
      }
    }
  } catch {}

  return {}
}

/**
 * 配置文件上传与静态文件服务
 *
 * 初始化上传目录、注册静态文件服务与 multipart 解析器。
 * 对文档和压缩包类型强制设置 Content-Disposition 为 attachment，防止浏览器直接渲染或执行。
 *
 * @param fastifyAdapter - Fastify 适配器实例
 * @param app - NestJS 应用实例，用于获取 ConfigService
 */
export async function setupMultipart(
  fastifyAdapter: FastifyAdapter,
  app: NestFastifyApplication,
) {
  const configService = app.get(ConfigService)
  const uploadConfig = configService.get<UploadConfigInterface>('upload')!

  await Promise.all([
    mkdir(uploadConfig.localDir, { recursive: true }),
    mkdir(uploadConfig.tmpDir, { recursive: true }),
  ])

  await fastifyAdapter.register(fastifyStatic, {
    root: uploadConfig.localDir,
    prefix: uploadConfig.localUrlPrefix,
    index: false,
    dotfiles: 'deny',
    etag: true,
    cacheControl: true,
    maxAge: '1h',
    setHeaders(res: StaticHeadersResponse, filePath: string) {
      const headers = resolveStaticFileHeaders(filePath, uploadConfig)
      for (const [name, value] of Object.entries(headers)) {
        res.setHeader(name, value)
      }
    },
  })

  await fastifyAdapter.register(fastifyMultipart, {
    throwFileSizeLimit: true,
    fileSize: uploadConfig.maxFileSize,
    limits: {
      fieldNameSize: 100,
      fieldSize: 100 * 1024,
      fields: 10,
      files: 1,
      parts: 1000,
      fileSize: uploadConfig.maxFileSize,
    },
  })
}
