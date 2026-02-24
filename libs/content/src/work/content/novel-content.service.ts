import type { FastifyRequest } from 'fastify'
import { BaseService } from '@libs/base/database'
import { UploadService } from '@libs/base/modules'
import { BadRequestException, Injectable } from '@nestjs/common'
import fsExtra from 'fs-extra'
import { UploadChapterFileDto } from './dto/content.dto'

@Injectable()
export class NovelContentService extends BaseService {
  get workChapter() {
    return this.prisma.workChapter
  }

  constructor(private readonly uploadService: UploadService) {
    super()
  }

  async getChapterContent(chapterId: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: {
        contentPath: true,
      },
    })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    if (!chapter.contentPath) {
      return ''
    }

    try {
      const content = await fsExtra.readFile(chapter.contentPath, 'utf-8')
      return content
    } catch {
      return ''
    }
  }

  async uploadChapterContent(req: FastifyRequest, query: UploadChapterFileDto) {
    const id = query.id
    const file = await this.uploadService.uploadFile(req, [
      'novel',
      query.workId.toString(),
      'chapter',
      `${id}.txt`,
    ])

    if (
      !(await this.workChapter.exists({
        id,
        workId: query.workId,
      }))
    ) {
      fsExtra.removeSync(file.filePath)
      throw new BadRequestException('章节不存在')
    }

    await this.workChapter.update({
      where: { id },
      data: { contentPath: file.filePath },
    })

    return file
  }

  async deleteChapterContent(chapterId: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: { contentPath: true },
    })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    if (chapter.contentPath) {
      try {
        await fsExtra.remove(chapter.contentPath)
      } catch {
        // ignore
      }
    }

    await this.workChapter.update({
      where: { id: chapterId },
      data: { contentPath: null },
    })

    return { id: chapterId }
  }
}
