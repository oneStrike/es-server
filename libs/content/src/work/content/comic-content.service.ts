import type { FastifyRequest } from 'fastify'
import { DrizzleService } from '@db/core'
import { ReadingStateService } from '@libs/interaction/reading-state/reading-state.service'
import { BusinessErrorCode, ContentTypeEnum } from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { UploadService } from '@libs/platform/modules/upload/upload.service'
import { jsonParse } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { ContentPermissionService } from '../../permission/content-permission.service'
import {
  DeleteComicContentDto,
  MoveComicContentDto,
  UpdateComicContentDto,
  UploadContentDto,
} from './dto/content.dto'

@Injectable()
export class ComicContentService {
  // 初始化 ComicContentService 依赖。
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

  // 持久化漫画章节内容，统一处理章节不存在时的业务错误。
  private async saveChapterContent(chapterId: number, content: string | null) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workChapter)
          .set({ content })
          .where(
            and(
              eq(this.workChapter.id, chapterId),
              isNull(this.workChapter.deletedAt),
            ),
          ),
      { notFound: '章节不存在' },
    )
  }

  // 获取章节内容（带权限校验），用户端使用。
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

  // 获取章节内容（无权限校验），管理端使用。
  async getChapterContents(chapterId: number) {
    return this.getChapterContentsInternal(chapterId)
  }

  // 新增 chapter Content。
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '章节不存在',
      )
    }

    const file = await this.uploadService.uploadFile(req, [
      'comic',
      query.workId.toString(),
      'chapter',
      chapterId.toString(),
    ])

    const contents: string[] = await this.getChapterContentsInternal(chapterId)

    contents.push(file.filePath)

    await this.saveChapterContent(chapterId, JSON.stringify(contents))

    return file
  }

  // 更新 chapter Content。
  async updateChapterContent(body: UpdateComicContentDto) {
    const { chapterId, index, content } = body

    const contents: string[] = await this.getChapterContentsInternal(chapterId)

    if (index < 0 || index >= contents.length) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '索引超出范围',
      )
    }

    contents[index] = content

    await this.saveChapterContent(chapterId, JSON.stringify(contents))

    return true
  }

  // 删除 chapter Content。
  async deleteChapterContent(dto: DeleteComicContentDto) {
    const { chapterId, index } = dto

    const contents: string[] = await this.getChapterContentsInternal(chapterId)

    if (index.some((i) => i < 0 || i >= contents.length)) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '删除的内容不存在',
      )
    }

    index.sort((a, b) => b - a)
    index.forEach((i) => contents.splice(i, 1))

    await this.saveChapterContent(
      chapterId,
      contents.length > 0 ? JSON.stringify(contents) : null,
    )

    return true
  }

  // 移动 chapter Content。
  async moveChapterContent(body: MoveComicContentDto) {
    const { chapterId, fromIndex, toIndex } = body

    const contents: string[] = await this.getChapterContentsInternal(chapterId)

    if (
      fromIndex < 0 ||
      fromIndex >= contents.length ||
      toIndex < 0 ||
      toIndex >= contents.length
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '索引超出范围',
      )
    }

    const [movedContent] = contents.splice(fromIndex, 1)
    contents.splice(toIndex, 0, movedContent)

    await this.saveChapterContent(chapterId, JSON.stringify(contents))

    return true
  }

  // 清空 chapter Contents。
  async clearChapterContents(chapterId: number) {
    await this.saveChapterContent(chapterId, null)

    return true
  }

  // 整体替换章节图片内容，导入链路必须在全部图片上传成功后才调用。
  async replaceChapterContents(chapterId: number, contents: string[]) {
    await this.saveChapterContent(
      chapterId,
      contents.length > 0 ? JSON.stringify(contents) : null,
    )

    return true
  }

  // 内部方法：获取章节内容（不进行权限校验），用于其他方法内部调用或管理端直接调用。
  private async getChapterContentsInternal(chapterId: number) {
    const chapter = await this.db.query.workChapter.findFirst({
      where: { id: chapterId, deletedAt: { isNull: true } },
      columns: {
        content: true,
      },
    })
    if (!chapter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '章节不存在',
      )
    }

    return this.parseContent(chapter?.content)
  }

  // 解析漫画章节内容。
  parseContent(content: string | null | undefined): string[] {
    if (!content) {
      return []
    }

    const parsed = jsonParse(content, [])
    return Array.isArray(parsed) ? (parsed as string[]) : []
  }
}
