import { RepositoryService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  AddChapterContentDto,
  DeleteChapterContentDto,
  MoveChapterContentDto,
  UpdateChapterContentDto,
} from './dto/chapter-content.dto'

/**
 * 漫画章节内容服务类
 * 提供漫画章节内容的增删改查等核心业务逻辑
 */
@Injectable()
export class ChapterContentService extends RepositoryService {
  get workComicChapter() {
    return this.prisma.workComicChapter
  }

  constructor() {
    super()
  }

  /**
   * 获取章节内容
   * @param chapterId 章节ID
   * @returns 章节内容数组
   */
  async getChapterContents(chapterId: number) {
    const chapter = await this.workComicChapter.findUnique({
      where: { id: chapterId },
      select: {
        contents: true,
      },
    })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    return chapter.contents ? JSON.parse(chapter.contents) : []
  }

  /**
   * 添加章节内容
   */
  async addChapterContent(body: AddChapterContentDto) {
    const { id, content } = body

    const contents: string[] = await this.getChapterContents(id)

    contents.push(...content)

    // 更新数据库
    await this.workComicChapter.update({
      where: { id },
      data: { contents: JSON.stringify(contents) },
    })

    return { id }
  }

  /**
   * 更新章节内容
   */
  async updateChapterContent(body: UpdateChapterContentDto) {
    const { id, index, content } = body

    const contents: string[] = await this.getChapterContents(id)

    // 验证索引是否有效
    if (index < 0 || index >= contents.length) {
      throw new BadRequestException('索引超出范围')
    }

    // 更新指定位置的内容
    contents[index] = content

    // 更新数据库
    await this.workComicChapter.update({
      where: { id },
      data: { contents: JSON.stringify(contents) },
    })

    return { id }
  }

  /**
   * 删除章节内容
   */
  async deleteChapterContent(dto: DeleteChapterContentDto) {
    const { id, index } = dto

    const contents: string[] = await this.getChapterContents(id)

    // 验证索引是否有效
    if (index.some((i) => i < 0 || i >= contents.length)) {
      throw new BadRequestException('删除的内容不存在')
    }

    // 删除指定位置的内容
    index.sort((a, b) => b - a)
    index.forEach((i) => contents.splice(i, 1))

    // 更新数据库
    await this.workComicChapter.update({
      where: { id },
      data: { contents: JSON.stringify(contents) },
    })

    return contents
  }

  /**
   * 移动章节内容（用于排序）
   */
  async moveChapterContent(body: MoveChapterContentDto) {
    const { id, fromIndex, toIndex } = body

    const contents: string[] = await this.getChapterContents(id)

    // 验证索引是否有效
    if (
      fromIndex < 0 ||
      fromIndex >= contents.length ||
      toIndex < 0 ||
      toIndex >= contents.length
    ) {
      throw new BadRequestException('索引超出范围')
    }

    // 移动内容
    const [movedContent] = contents.splice(fromIndex, 1)
    contents.splice(toIndex, 0, movedContent)

    // 更新数据库
    await this.workComicChapter.update({
      where: { id },
      data: { contents: JSON.stringify(contents) },
    })

    return contents
  }

  /**
   * 清空章节内容
   */
  async clearChapterContents(id: number) {
    await this.workComicChapter.update({
      where: { id },
      data: { contents: '[]' },
    })
    return { id }
  }
}
