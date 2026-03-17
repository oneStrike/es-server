import type { FastifyRequest } from 'fastify'
import { DrizzleService } from '@db/core'
import { ReadingStateService } from '@libs/interaction'
import { ContentTypeEnum } from '@libs/platform/constant'
import { UploadService } from '@libs/platform/modules'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { ContentPermissionService } from '../../permission'
import {
  DeleteComicContentDto,
  MoveComicContentDto,
  UpdateComicContentDto,
  UploadContentDto,
} from './dto/content.dto'

@Injectable()
export class ComicContentService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly uploadService: UploadService,
    private readonly contentPermissionService: ContentPermissionService,
    private readonly readingStateService: ReadingStateService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  get workChapter() {
    return this.drizzle.schema.workChapter
  }

  /**
   * 获取章节内容（带权限校验）
   * 用户端使用
   */
  async getChapterContentsWithPermission(chapterId: number, userId?: number) {
    const result = await this.contentPermissionService.checkChapterAccess(
      chapterId,
      userId,
      {
        content: true,
        id: true,
        title: true,
        subtitle: true,
        workId: true,
        workType: true,
      },
    )
    const chapter = result.chapter as {
      id: number
      workId: number
      workType: number
      content: string | null
      title: string
      subtitle?: string | null
    }
    if (userId) {
      await this.readingStateService.touchByWorkSafely({
        userId,
        workId: chapter.workId,
        workType: chapter.workType as ContentTypeEnum,
        lastReadChapterId: chapterId,
      })
    }

    return {
      content: this.parseContent(chapter.content),
      id: chapter.id,
      title: chapter.title,
      subtitle: chapter.subtitle,
    }
  }

  /**
   * 获取章节内容（无权限校验）
   * 管理端使用
   */
  async getChapterContents(chapterId: number) {
    return this.getChapterContentsInternal(chapterId)
  }

  async addChapterContent(req: FastifyRequest, query: UploadContentDto) {
    const chapterId = query.chapterId

    if (
      !(await this.drizzle.ext.exists(
        this.workChapter,
        and(
          eq(this.workChapter.id, chapterId),
          eq(this.workChapter.workId, query.workId),
          isNull(this.workChapter.deletedAt),
        ),
      ))
    ) {
      throw new BadRequestException('章节不存在')
    }

    const file = await this.uploadService.uploadFile(req, [
      'comic',
      query.workId.toString(),
      'chapter',
      chapterId.toString(),
    ])

    const contents: string[] = await this.getChapterContentsInternal(chapterId)

    contents.push(file.filePath)

    await this.db
      .update(this.workChapter)
      .set({ content: JSON.stringify(contents) })
      .where(and(eq(this.workChapter.id, chapterId), isNull(this.workChapter.deletedAt)))

    return file
  }

  async updateChapterContent(body: UpdateComicContentDto) {
    const { chapterId, index, content } = body

    const contents: string[] = await this.getChapterContentsInternal(chapterId)

    if (index < 0 || index >= contents.length) {
      throw new BadRequestException('索引超出范围')
    }

    contents[index] = content

    await this.db
      .update(this.workChapter)
      .set({ content: JSON.stringify(contents) })
      .where(and(eq(this.workChapter.id, chapterId), isNull(this.workChapter.deletedAt)))

    return { chapterId }
  }

  async deleteChapterContent(dto: DeleteComicContentDto) {
    const { chapterId, index } = dto

    const contents: string[] = await this.getChapterContentsInternal(chapterId)

    if (index.some((i) => i < 0 || i >= contents.length)) {
      throw new BadRequestException('删除的内容不存在')
    }

    index.sort((a, b) => b - a)
    index.forEach((i) => contents.splice(i, 1))

    await this.db
      .update(this.workChapter)
      .set({ content: contents.length > 0 ? JSON.stringify(contents) : null })
      .where(and(eq(this.workChapter.id, chapterId), isNull(this.workChapter.deletedAt)))

    return contents
  }

  async moveChapterContent(body: MoveComicContentDto) {
    const { chapterId, fromIndex, toIndex } = body

    const contents: string[] = await this.getChapterContentsInternal(chapterId)

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

    await this.db
      .update(this.workChapter)
      .set({ content: JSON.stringify(contents) })
      .where(and(eq(this.workChapter.id, chapterId), isNull(this.workChapter.deletedAt)))

    return contents
  }

  async clearChapterContents(chapterId: number) {
    await this.db
      .update(this.workChapter)
      .set({ content: null })
      .where(and(eq(this.workChapter.id, chapterId), isNull(this.workChapter.deletedAt)))

    return { chapterId }
  }

  /**
   * 内部方法：获取章节内容（不进行权限校验）
   * 用于其他方法内部调用或管理端直接调用
   */
  private async getChapterContentsInternal(chapterId: number) {
    const chapter = await this.db.query.workChapter.findFirst({
      where: { id: chapterId, deletedAt: { isNull: true } },
      columns: {
        content: true,
      },
    })
    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    return this.parseContent(chapter?.content)
  }

  /**
   * 解析漫画章节内容
   * @param content 原始内容字符串
   * @returns 图片路径列表
   */
  parseContent(content: string | null | undefined): string[] {
    if (!content) {
      return []
    }

    try {
      const parsed = JSON.parse(content)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
}
