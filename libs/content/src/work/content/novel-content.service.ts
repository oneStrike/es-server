import type { FastifyRequest } from 'fastify'
import { join } from 'node:path'
import { BaseService } from '@libs/base/database'
import { UploadService } from '@libs/base/modules'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import fsExtra from 'fs-extra'
import { UploadContentDto } from './dto/content.dto'

@Injectable()
export class NovelContentService extends BaseService {
  get workChapter() {
    return this.prisma.workChapter
  }

  private readonly uploadDir: string

  constructor(
    private readonly uploadService: UploadService,
    @Inject(ConfigService) private configService: ConfigService,
  ) {
    super()
    this.uploadDir = this.configService.get<string>('upload.uploadDir')!
  }

  /**
   * 将数据库中存储的路径转换为实际文件系统路径
   * 数据库中存储的是 /uploads/... 或 /files/... 格式，需要转换为实际的 uploadDir 路径
   */
  private resolveContentPath(contentPath: string): string {
    // 如果是以 /uploads/ 或 /files/ 开头的路径，替换为实际的 uploadDir
    if (contentPath.startsWith('/uploads/')) {
      return join(this.uploadDir, contentPath.slice('/uploads/'.length))
    }
    if (contentPath.startsWith('/files/')) {
      return join(this.uploadDir, contentPath.slice('/files/'.length))
    }
    // 如果已经是绝对路径且包含 uploadDir，直接返回
    if (contentPath.startsWith(this.uploadDir)) {
      return contentPath
    }
    // 其他情况，假设是相对于 uploadDir 的路径
    return join(this.uploadDir, contentPath)
  }

  async getChapterContent(chapterId: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: {
        content: true,
      },
    })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    if (!chapter.content) {
      return ''
    }

    try {
      const contentPath = this.resolveContentPath(chapter.content)
      const content = await fsExtra.readFile(contentPath, 'utf-8')
      return content
    } catch {
      return ''
    }
  }

  async uploadChapterContent(req: FastifyRequest, query: UploadContentDto) {
    const chapterId = query.chapterId
    const file = await this.uploadService.uploadFile(req, [
      'novel',
      query.workId.toString(),
      'chapter',
      `${chapterId}.txt`,
    ])

    if (
      !(await this.workChapter.exists({
        id: chapterId,
        workId: query.workId,
      }))
    ) {
      fsExtra.removeSync(file.filePath)
      throw new BadRequestException('章节不存在')
    }

    await this.workChapter.update({
      where: { id: chapterId },
      data: { content: file.filePath },
    })

    return file
  }

  async deleteChapterContent(chapterId: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: { content: true },
    })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    if (chapter.content) {
      try {
        const contentPath = this.resolveContentPath(chapter.content)
        await fsExtra.remove(contentPath)
      } catch {
        // ignore
      }
    }

    await this.workChapter.update({
      where: { id: chapterId },
      data: { content: null },
    })

    return { id: chapterId }
  }
}
