import type { FastifyRequest } from 'fastify'
import { DrizzleService } from '@db/core'
import { ReadingStateService } from '@libs/interaction'
import { ContentTypeEnum } from '@libs/platform/constant'
import { UploadService } from '@libs/platform/modules'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { ContentPermissionService } from '../../permission'
import { UploadContentDto } from './dto/content.dto'

@Injectable()
export class NovelContentService {
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
  async getChapterContentWithPermission(chapterId: number, userId?: number) {
    const result = await this.contentPermissionService.checkChapterAccess(
      chapterId,
      userId,
      { content: true, workId: true, workType: true },
    )
    const chapter = result.chapter as {
      workId: number
      workType: number
      content: string | null
    }
    if (userId) {
      await this.readingStateService.touchByWorkSafely({
        userId,
        workId: chapter.workId,
        workType: chapter.workType as ContentTypeEnum,
        lastReadChapterId: chapterId,
      })
    }
    return chapter.content
  }

  /**
   * 获取章节内容（无权限校验）
   * 管理端使用
   */
  async getChapterContent(chapterId: number) {
    const chapter = await this.db.query.workChapter.findFirst({
      where: { id: chapterId, deletedAt: { isNull: true } },
      columns: {
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
      'novel',
      query.workId.toString(),
      'chapter',
      `${chapterId}.txt`,
    ])

    await this.db
      .update(this.workChapter)
      .set({ content: file.filePath })
      .where(and(eq(this.workChapter.id, chapterId), isNull(this.workChapter.deletedAt)))

    return file
  }

  async deleteChapterContent(chapterId: number) {
    const chapter = await this.db.query.workChapter.findFirst({
      where: { id: chapterId, deletedAt: { isNull: true } },
      columns: { content: true },
    })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    await this.db
      .update(this.workChapter)
      .set({ content: null })
      .where(and(eq(this.workChapter.id, chapterId), isNull(this.workChapter.deletedAt)))

    return { id: chapterId }
  }
}
