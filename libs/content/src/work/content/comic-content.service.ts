import type { FastifyRequest } from 'fastify'
import { BaseService } from '@libs/base/database'
import { UploadService } from '@libs/base/modules'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ContentPermissionService } from '../../permission'
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
    private readonly contentPermissionService: ContentPermissionService,
  ) {
    super()
  }

  /**
   * 获取漫画章节内容（用户端）
   * 优先进行权限校验，验证通过后返回内容
   *
   * @param chapterId 章节ID
   * @param userId 用户ID
   * @returns 图片路径列表
   * @throws BadRequestException 章节不存在或权限不足时抛出异常
   */
  async getChapterContents(chapterId: number, userId: number)

  /**
   * 获取漫画章节内容（管理端）
   * 不进行权限校验，直接返回内容
   *
   * @param chapterId 章节ID
   * @returns 图片路径列表
   * @throws BadRequestException 章节不存在时抛出异常
   */

  async getChapterContents(chapterId: number, userId?: number) {
    // 用户端：权限校验 + 获取内容（一次查询）
    if (userId) {
      const result = await this.contentPermissionService.checkChapterAccess(
        userId,
        chapterId,
        { content: true },
      )
      return this.parseContent(result.chapter.content)
    }

    // 管理端：无权限校验，直接查询
    return this.getChapterContentsInternal(chapterId)
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

    const contents: string[] = await this.getChapterContentsInternal(chapterId)

    contents.push(file.filePath)

    await this.workChapter.update({
      where: { id: chapterId },
      data: { content: JSON.stringify(contents) },
    })

    return file
  }

  async updateChapterContent(body: UpdateComicContentDto) {
    const { chapterId, index, content } = body

    const contents: string[] = await this.getChapterContentsInternal(chapterId)

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

    const contents: string[] = await this.getChapterContentsInternal(chapterId)

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

  /**
   * 内部方法：获取章节内容（不进行权限校验）
   * 用于其他方法内部调用或管理端直接调用
   */
  private async getChapterContentsInternal(
    chapterId: number,
  ): Promise<string[]> {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: {
        content: true,
      },
    })

    return this.parseContent(chapter?.content)
  }

  /**
   * 解析漫画章节内容
   * @param content 原始内容字符串
   * @returns 图片路径列表
   */
  private parseContent(content: string | null | undefined): string[] {
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
