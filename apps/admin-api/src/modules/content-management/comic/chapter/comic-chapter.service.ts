import { RepositoryService } from '@libs/base/database'
import { DragReorderDto } from '@libs/base/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  AddChapterContentDto,
  CreateComicChapterDto,
  DeleteChapterContentDto,
  MoveChapterContentDto,
  QueryComicChapterDto,
  UpdateChapterContentDto,
  UpdateComicChapterDto,
} from './dto/comic-chapter.dto'

/**
 * 漫画章节服务类
 * 提供漫画章节的增删改查等核心业务逻辑
 */
@Injectable()
export class ComicChapterService extends RepositoryService {
  get workComicChapter() {
    return this.prisma.workComicChapter
  }

  constructor() {
    super()
  }

  /**
   * 创建漫画章节
   * @param createComicChapterDto 创建章节的数据
   * @returns 创建的章节信息
   */
  async createComicChapter(createComicChapterDto: CreateComicChapterDto) {
    const { comicId, sortOrder } = createComicChapterDto

    if (!(await this.workComicChapter.exists({ id: comicId }))) {
      throw new BadRequestException('关联的漫画不存在')
    }

    // 验证同一漫画下章节号是否已存在
    if (
      await this.workComicChapter.exists({
        comicId,
        sortOrder,
      })
    ) {
      throw new BadRequestException('该漫画下章节号已存在')
    }

    return this.workComicChapter.create({ data: createComicChapterDto })
  }

  /**
   * 分页查询漫画章节列表
   * @param dto 查询条件
   * @returns 分页章节列表
   */
  async getComicChapterPage(dto: QueryComicChapterDto) {
    return this.workComicChapter.findPagination({
      where: {
        ...dto,
        title: {
          contains: dto.title,
          mode: 'insensitive',
        },
      },
      omit: {
        contents: true,
        remark: true,
        deletedAt: true,
      },
      orderBy: [{ sortOrder: 'asc' }],
    })
  }

  /**
   * 获取漫画章节详情
   * @param id 章节ID
   * @returns 章节详情信息
   */
  async getComicChapterDetail(id: number) {
    return this.workComicChapter.findUnique({
      where: { id },
      include: {
        relatedComic: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
  }

  /**
   * 更新漫画章节信息
   * @param dto 更新章节的数据
   * @returns 更新后的章节信息
   */
  async updateComicChapter(dto: UpdateComicChapterDto) {
    const { id, ...updateData } = dto

    if (
      await this.workComicChapter.exists({
        id: { not: id },
        sortOrder: updateData.sortOrder,
        comicId: dto.comicId,
      })
    ) {
      throw new BadRequestException('该漫画下章节号已存在')
    }

    return this.workComicChapter.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 删除章节
   * @param id 章节ID
   * @returns 删除结果
   */
  async deleteComicChapter(id: number) {
    return this.workComicChapter.delete({ where: { id } })
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
    const { id, content, index } = body

    const contents: string[] = await this.getChapterContents(id)

    // 添加内容到指定位置或末尾
    if (index !== undefined && index >= 0 && index <= contents.length) {
      contents.splice(index, 0, content)
    } else {
      contents.push(content)
    }

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
  async deleteChapterContent(body: DeleteChapterContentDto) {
    const { id, index } = body

    const contents: string[] = await this.getChapterContents(id)

    // 验证索引是否有效
    if (index < 0 || index >= contents.length) {
      throw new BadRequestException('索引超出范围')
    }

    // 删除指定位置的内容
    contents.splice(index, 1)

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

  /**
   * 交换两个章节的章节号
   * @param swapChapterNumberDto 交换章节号的数据
   * @returns 交换结果
   */
  async swapChapterNumbers(swapChapterNumberDto: DragReorderDto) {
    const { targetId, dragId } = swapChapterNumberDto

    // 验证两个章节ID不能相同
    if (targetId === dragId) {
      throw new BadRequestException('不能交换相同的章节')
    }

    // 获取两个章节的信息
    const [targetChapter, dragChapter] = await Promise.all([
      this.workComicChapter.findUnique({ where: { id: targetId } }),
      this.workComicChapter.findUnique({ where: { id: dragId } }),
    ])

    // 验证章节是否存在
    if (!targetChapter) {
      throw new BadRequestException(`章节ID ${targetId} 不存在`)
    }
    if (!dragChapter) {
      throw new BadRequestException(`章节ID ${dragId} 不存在`)
    }

    // 验证两个章节是否属于同一漫画
    if (targetChapter.comicId !== dragChapter.comicId) {
      throw new BadRequestException('只能交换同一漫画下的章节号')
    }

    // 使用事务确保数据一致性
    return this.prisma.$transaction(async (tx) => {
      // 临时章节号，避免唯一约束冲突
      const tempChapterNumber = -Math.random() * 1000000

      // 第一步：将拖拽章节的章节号设为临时值
      await tx.workComicChapter.update({
        where: { id: dragId },
        data: { sortOrder: tempChapterNumber },
      })

      // 第二步：将目标章节的章节号设为拖拽章节的原章节号
      await tx.workComicChapter.update({
        where: { id: targetId },
        data: { sortOrder: dragChapter.sortOrder },
      })

      // 第三步：将拖拽章节的章节号设为目标章节的原章节号
      await tx.workComicChapter.update({
        where: { id: dragId },
        data: { sortOrder: targetChapter.sortOrder },
      })

      return { targetId, dragId }
    })
  }
}
