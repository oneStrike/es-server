import type { FastifyRequest } from 'fastify'
import { BaseService } from '@libs/base/database'
import { UploadService } from '@libs/base/modules'
import { BadRequestException, Injectable } from '@nestjs/common'
import { UploadContentDto } from './dto/content.dto'

@Injectable()
export class NovelContentService extends BaseService {
  get workChapter() {
    return this.prisma.workChapter
  }

  constructor(
    private readonly uploadService: UploadService,
  ) {
    super()
  }

  async getChapterContent(chapterId: number): Promise<string | null> {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: {
        content: true,
      },
    })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    return chapter.content
  }

  async uploadChapterContent(req: FastifyRequest, query: UploadContentDto) {
    const chapterId = query.chapterId

    if (
      !(await this.workChapter.exists({
        id: chapterId,
        workId: query.workId,
      }))
    ) {
      throw new BadRequestException('章节不存在')
    }

    const file = await this.uploadService.uploadFile(req, [
      'novel',
      query.workId.toString(),
      'chapter',
      `${chapterId}.txt`,
    ])

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

    await this.workChapter.update({
      where: { id: chapterId },
      data: { content: null },
    })

    return { id: chapterId }
  }
}
