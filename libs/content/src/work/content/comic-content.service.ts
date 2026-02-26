import type { FastifyRequest } from 'fastify'
import { BaseService } from '@libs/base/database'
import { UploadService } from '@libs/base/modules'
import { BadRequestException, Injectable } from '@nestjs/common'
import fsExtra from 'fs-extra'
import {
  AddChapterContentDto,
  DeleteChapterContentDto,
  MoveChapterContentDto,
  UpdateChapterContentDto,
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

  async addChapterContent(req: FastifyRequest, query: AddChapterContentDto) {
    const id = query.id
    const file = await this.uploadService.uploadFile(req, [
      'comic',
      query.workId.toString(),
      'chapter',
      id.toString(),
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

    const contents: string[] = await this.getChapterContents(id)

    contents.push(file.filePath)

    const content = `/uploads/comic/${query.workId}/chapter/${id}/content.json`
    await fsExtra.ensureFile(content)
    await fsExtra.writeFile(content, JSON.stringify(contents))

    await this.workChapter.update({
      where: { id },
      data: { content },
    })

    return file
  }

  async updateChapterContent(body: UpdateChapterContentDto) {
    const { id, index, content } = body

    const contents: string[] = await this.getChapterContents(id)

    if (index < 0 || index >= contents.length) {
      throw new BadRequestException('索引超出范围')
    }

    contents[index] = content

    const chapter = await this.workChapter.findUnique({
      where: { id },
      select: { content: true },
    })

    if (chapter?.content) {
      await fsExtra.writeFile(chapter.content, JSON.stringify(contents))
    }

    return { id }
  }

  async deleteChapterContent(dto: DeleteChapterContentDto) {
    const { id, index } = dto

    const contents: string[] = await this.getChapterContents(id)

    if (index.some((i) => i < 0 || i >= contents.length)) {
      throw new BadRequestException('删除的内容不存在')
    }

    index.sort((a, b) => b - a)
    index.forEach((i) => contents.splice(i, 1))

    const chapter = await this.workChapter.findUnique({
      where: { id },
      select: { content: true },
    })

    if (chapter?.content) {
      await fsExtra.writeFile(chapter.content, JSON.stringify(contents))
    }

    return contents
  }

  async moveChapterContent(body: MoveChapterContentDto) {
    const { id, fromIndex, toIndex } = body

    const contents: string[] = await this.getChapterContents(id)

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
      where: { id },
      select: { content: true },
    })

    if (chapter?.content) {
      await fsExtra.writeFile(chapter.content, JSON.stringify(contents))
    }

    return contents
  }

  async clearChapterContents(id: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id },
      select: { content: true },
    })

    if (chapter?.content) {
      await fsExtra.writeFile(chapter.content, JSON.stringify([]))
    }

    return { id }
  }
}
