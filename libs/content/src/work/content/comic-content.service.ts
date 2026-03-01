import type { FastifyRequest } from 'fastify'
import { BaseService } from '@libs/base/database'
import { UploadService } from '@libs/base/modules'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import fsExtra from 'fs-extra'
import { join } from 'node:path'
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
   * 数据库中存储的是 /uploads/... 格式，需要转换为实际的 uploadDir 路径
   */
  private resolveContentPath(contentPath: string): string {
    // 如果是以 /uploads/ 开头的路径，替换为实际的 uploadDir
    if (contentPath.startsWith('/uploads/')) {
      return join(this.uploadDir, contentPath.slice('/uploads/'.length))
    }
    // 如果已经是绝对路径且包含 uploadDir，直接返回
    if (contentPath.startsWith(this.uploadDir)) {
      return contentPath
    }
    // 其他情况，假设是相对于 uploadDir 的路径
    return join(this.uploadDir, contentPath)
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
      const contentPath = this.resolveContentPath(chapter.content)
      const content = await fsExtra.readFile(contentPath, 'utf-8')
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

    const contentPath = join(
      this.uploadDir,
      'comic',
      query.workId.toString(),
      'chapter',
      chapterId.toString(),
      'content.json',
    )
    await fsExtra.ensureFile(contentPath)
    await fsExtra.writeFile(contentPath, JSON.stringify(contents))
    // 存储相对于上传目录的路径，保持与现有数据格式一致
    const content = `/uploads/comic/${query.workId}/chapter/${chapterId}/content.json`

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
      const contentPath = this.resolveContentPath(chapter.content)
      await fsExtra.writeFile(contentPath, JSON.stringify(contents))
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
      const contentPath = this.resolveContentPath(chapter.content)
      await fsExtra.writeFile(contentPath, JSON.stringify(contents))
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
      const contentPath = this.resolveContentPath(chapter.content)
      await fsExtra.writeFile(contentPath, JSON.stringify(contents))
    }

    return contents
  }

  async clearChapterContents(chapterId: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: { content: true },
    })

    if (chapter?.content) {
      const contentPath = this.resolveContentPath(chapter.content)
      await fsExtra.writeFile(contentPath, JSON.stringify([]))
    }

    return { chapterId }
  }
}
