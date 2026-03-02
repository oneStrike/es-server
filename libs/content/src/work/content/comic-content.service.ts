import type { FastifyRequest } from 'fastify'
import { BaseService } from '@libs/base/database'
import { UploadService } from '@libs/base/modules'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  DeleteComicContentDto,
  MoveComicContentDto,
  UpdateComicContentDto,
  UploadContentDto,
} from './dto/content.dto'

@Injectable()
export class ComicContentService extends BaseService {
  get workChapter() {
    return this.prisma.workChapter
  }

  constructor(
    private readonly uploadService: UploadService,
  ) {
    super()
  }

  async getChapterContents(chapterId: number): Promise<string[]> {
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
      return []
    }

    try {
      const parsed = JSON.parse(chapter.content)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  async addChapterContent(req: FastifyRequest, query: UploadContentDto) {
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
      'comic',
      query.workId.toString(),
      'chapter',
      chapterId.toString(),
    ])

    const contents: string[] = await this.getChapterContents(chapterId)

    contents.push(file.filePath)

    await this.workChapter.update({
      where: { id: chapterId },
      data: { content: JSON.stringify(contents) },
    })

    return file
  }

  async updateChapterContent(body: UpdateComicContentDto) {
    const { chapterId, index, content } = body

    const contents: string[] = await this.getChapterContents(chapterId)

    if (index < 0 || index >= contents.length) {
      throw new BadRequestException('索引超出范围')
    }

    contents[index] = content

    await this.workChapter.update({
      where: { id: chapterId },
      data: { content: JSON.stringify(contents) },
    })

    return { chapterId }
  }

  async deleteChapterContent(dto: DeleteComicContentDto) {
    const { chapterId, index } = dto

    const contents: string[] = await this.getChapterContents(chapterId)

    if (index.some((i) => i < 0 || i >= contents.length)) {
      throw new BadRequestException('删除的内容不存在')
    }

    index.sort((a, b) => b - a)
    index.forEach((i) => contents.splice(i, 1))

    await this.workChapter.update({
      where: { id: chapterId },
      data: { content: contents.length > 0 ? JSON.stringify(contents) : null },
    })

    return contents
  }

  async moveChapterContent(body: MoveComicContentDto) {
    const { chapterId, fromIndex, toIndex } = body

    const contents: string[] = await this.getChapterContents(chapterId)

    if (
      fromIndex < 0 ||
      fromIndex >= contents.length ||
      toIndex < 0 ||
      toIndex >= contents.length
    ) {
      throw new BadRequestException('索引超出范围')
    }

    const [movedContent] = contents.splice(fromIndex, 1)
    contents.splice(toIndex, 0, movedContent)

    await this.workChapter.update({
      where: { id: chapterId },
      data: { content: JSON.stringify(contents) },
    })

    return contents
  }

  async clearChapterContents(chapterId: number) {
    await this.workChapter.update({
      where: { id: chapterId },
      data: { content: null },
    })

    return { chapterId }
  }
}
