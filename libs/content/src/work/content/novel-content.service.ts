import type { FastifyRequest } from 'fastify'
import { BaseService } from '@libs/base/database'
import { UploadService } from '@libs/base/modules'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ContentPermissionService } from '../../permission'
import { UploadContentDto } from './dto/content.dto'

@Injectable()
export class NovelContentService extends BaseService {
  get workChapter() {
    return this.prisma.workChapter
  }

  constructor(
    private readonly uploadService: UploadService,
    private readonly contentPermissionService: ContentPermissionService,
  ) {
    super()
  }

  /**
   * 获取小说章节内容（用户端）
   * 优先进行权限校验，验证通过后返回内容
   *
   * @param chapterId 章节ID
   * @param userId 用户ID
   * @returns 章节内容
   * @throws BadRequestException 章节不存在或权限不足时抛出异常
   */
  async getChapterContent(
    chapterId: number,
    userId: number,
  ): Promise<string | null>

  /**
   * 获取小说章节内容（管理端）
   * 不进行权限校验，直接返回内容
   *
   * @param chapterId 章节ID
   * @returns 章节内容
   * @throws BadRequestException 章节不存在时抛出异常
   */

  async getChapterContent(chapterId: number, userId?: number) {
    // 用户端：权限校验 + 获取内容（一次查询）
    if (userId) {
      const result = await this.contentPermissionService.checkChapterAccess(
        userId,
        chapterId,
        { content: true },
      )
      return result.chapter.content
    }

    // 管理端：无权限校验，直接查询
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
