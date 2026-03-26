import type { FastifyAdapter } from '@nestjs/platform-fastify'
import * as zlib from 'node:zlib'
import fastifyCompress from '@fastify/compress'

/**
 * 可压缩内容类型的正则匹配
 * 仅对文本类和 JSON/XML 等结构化内容启用压缩
 */
const COMPRESSIBLE_CONTENT_TYPES = /^text\/|application\/json|application\/javascript|application\/xml/

/**
 * 配置 Fastify 响应压缩
 *
 * 支持 zstd、brotli、gzip、deflate 算法，按客户端 Accept-Encoding 协商选择。
 * 压缩阈值 1KB，低于此大小的响应不压缩以避免额外开销。
 *
 * @param fastifyAdapter - Fastify 适配器实例
 */
export async function setupCompression(fastifyAdapter: FastifyAdapter) {
  await fastifyAdapter.register(fastifyCompress as any, {
    global: true,
    threshold: 1024,

    encodings: ['zstd', 'br', 'gzip', 'deflate'],

    brotliOptions: {
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
      },
    },

    zlibOptions: {
      level: 6,
    },

    customTypes: COMPRESSIBLE_CONTENT_TYPES,

    removeContentLengthHeader: true,
  })
}
