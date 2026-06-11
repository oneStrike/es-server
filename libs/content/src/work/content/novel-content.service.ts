import type { FastifyRequest } from 'fastify'
import { DrizzleService } from '@db/core'
import { ReadingStateService } from '@libs/interaction/reading-state/reading-state.service'
import {
  BusinessErrorCode,
  ContentTypeEnum,
  WorkTypeEnum,
} from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { UploadService } from '@libs/platform/modules/upload/upload.service'
import { Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { ContentPermissionService } from '../../permission/content-permission.service'
import { UploadContentDto } from './dto/content.dto'

@Injectable()
export class NovelContentService {
  // 初始化 NovelContentService 依赖。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly uploadService: UploadService,
    private readonly contentPermissionService: ContentPermissionService,
    private readonly readingStateService: ReadingStateService,
  ) {}

  // 读取 db。
  private get db() {
    return this.drizzle.db
  }

  // 读取 workChapter。
  get workChapter() {
    return this.drizzle.schema.workChapter
  }

  // 获取章节内容（带权限校验），用户端使用。
  async getChapterContentWithPermission(chapterId: number, userId?: number) {
    const result = await this.contentPermissionService.checkChapterAccess(
      chapterId,
      userId,
      {
        novelContentPath: true,
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
      title: string
      subtitle?: string | null
      novelContentPath: string | null
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
      id: chapter.id,
      title: chapter.title,
      subtitle: chapter.subtitle ?? null,
      content: chapter.novelContentPath ?? null,
    }
  }

  // 获取章节内容（无权限校验），管理端使用。
  async getChapterContent(chapterId: number) {
    const chapter = await this.db.query.workChapter.findFirst({
      where: {
        id: chapterId,
        workType: WorkTypeEnum.NOVEL,
        deletedAt: { isNull: true },
      },
      columns: {
        novelContentPath: true,
      },
    })

    if (!chapter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '章节不存在',
      )
    }

    return chapter.novelContentPath
  }

  // 上传 chapter Content。
  async uploadChapterContent(req: FastifyRequest, query: UploadContentDto) {
    const chapterId = query.chapterId

    const [chapter] = await this.db
      .select({ id: this.workChapter.id })
      .from(this.workChapter)
      .where(
        and(
          eq(this.workChapter.id, chapterId),
          eq(this.workChapter.workId, query.workId),
          eq(this.workChapter.workType, WorkTypeEnum.NOVEL),
          isNull(this.workChapter.deletedAt),
        ),
      )
      .limit(1)
    if (!chapter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '章节不存在',
      )
    }

    const file = await this.uploadService.uploadFile(req, [
      'novel',
      query.workId.toString(),
      'chapter',
      chapterId.toString(),
    ], {
      sceneOverride: 'content',
    })

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workChapter)
          .set({ novelContentPath: file.filePath })
          .where(
            and(
              eq(this.workChapter.id, chapterId),
              eq(this.workChapter.workType, WorkTypeEnum.NOVEL),
              isNull(this.workChapter.deletedAt),
            ),
          ),
      { notFound: '章节不存在' },
    )

    return file
  }

  // 删除 chapter Content。
  async deleteChapterContent(chapterId: number) {
    const chapter = await this.db.query.workChapter.findFirst({
      where: {
        id: chapterId,
        workType: WorkTypeEnum.NOVEL,
        deletedAt: { isNull: true },
      },
      columns: { novelContentPath: true },
    })

    if (!chapter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '章节不存在',
      )
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workChapter)
          .set({ novelContentPath: null })
          .where(
            and(
              eq(this.workChapter.id, chapterId),
              eq(this.workChapter.workType, WorkTypeEnum.NOVEL),
              isNull(this.workChapter.deletedAt),
            ),
          ),
      { notFound: '章节不存在' },
    )

    return true
  }
}
