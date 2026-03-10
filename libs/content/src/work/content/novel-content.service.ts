import type { FastifyRequest } from 'fastify'
import { BaseService } from '@libs/base/database'
import { UploadService } from '@libs/base/modules'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ContentPermissionService } from '../../permission'
import { UploadContentDto } from './dto/content.dto'

@Injectable()
export class NovelContentService extends BaseService {
  private readonly logger = new Logger(NovelContentService.name)

  get workChapter() {
    return this.prisma.workChapter
  }

  get userWorkBrowseState() {
    return this.prisma.userWorkBrowseState
  }

  constructor(
    private readonly uploadService: UploadService,
    private readonly contentPermissionService: ContentPermissionService,
  ) {
    super()
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
    if (userId) {
      await this.touchWorkBrowseStateFromChapter({
        userId,
        workId: result.chapter.workId,
        workType: result.chapter.workType,
        chapterId,
      })
    }
    return result.chapter.content
  }

  /**
   * 获取章节内容（无权限校验）
   * 管理端使用
   */
  async getChapterContent(chapterId: number) {
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

  private async touchWorkBrowseStateFromChapter(params: {
    userId: number
    workId: number
    workType: number
    chapterId: number
  }) {
    const now = new Date()
    try {
      await this.userWorkBrowseState.upsert({
        where: {
          userId_workId: {
            userId: params.userId,
            workId: params.workId,
          },
        },
        create: {
          userId: params.userId,
          workId: params.workId,
          workType: params.workType,
          lastViewedAt: now,
          lastViewedChapterId: params.chapterId,
        },
        update: {
          workType: params.workType,
          lastViewedAt: now,
          lastViewedChapterId: params.chapterId,
        },
      })
    } catch (error) {
      this.logger.warn(
        `同步小说章节浏览状态失败 userId=${params.userId} chapterId=${params.chapterId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
