import type { FastifyRequest } from 'fastify'
import { BaseService } from '@libs/base/database'
import { UploadService } from '@libs/base/modules'
import { BadRequestException, Injectable } from '@nestjs/common'
import fsExtra from 'fs-extra'
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

  constructor(private readonly uploadService: UploadService) {
    super()
  }

  async getChapterContents(chapterId: number) {
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
      const content = await fsExtra.readFile(chapter.content, 'utf-8')
      const parsed = JSON.parse(content)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  async addChapterContent(req: FastifyRequest, query: UploadContentDto) {
    const chapterId = query.chapterId
    const file = await this.uploadService.uploadFile(req, [
      'comic',
      query.workId.toString(),
      'chapter',
      chapterId.toString(),
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

    const contents: string[] = await this.getChapterContents(chapterId)

    contents.push(file.filePath)

    const content = `/uploads/comic/${query.workId}/chapter/${chapterId}/content.json`
    await fsExtra.ensureFile(content)
    await fsExtra.writeFile(content, JSON.stringify(contents))

    await this.workChapter.update({
      where: { id: chapterId },
      data: { content },
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

    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: { content: true },
    })

    if (chapter?.content) {
      await fsExtra.writeFile(chapter.content, JSON.stringify(contents))
    }

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

    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: { content: true },
    })

    if (chapter?.content) {
      await fsExtra.writeFile(chapter.content, JSON.stringify(contents))
    }

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

    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: { content: true },
    })

    if (chapter?.content) {
      await fsExtra.writeFile(chapter.content, JSON.stringify(contents))
    }

    return contents
  }

  async clearChapterContents(chapterId: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: { content: true },
    })

    if (chapter?.content) {
      await fsExtra.writeFile(chapter.content, JSON.stringify([]))
    }

    return { chapterId }
  }
}
