import { BaseService } from '@libs/base/database'
import { DragReorderDto } from '@libs/base/dto'

import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateWorkChapterDto,
  QueryWorkChapterDto,
  UpdateWorkChapterDto,
} from './dto/work-chapter.dto'
import { PAGE_WORK_CHAPTER_SELECT } from './work-chapter.select'

/**
 * 作品章节服务
 * 提供章节管理、阅读权限控制、购买下载等核心功能
 */
@Injectable()
export class WorkChapterService extends BaseService {
  /**
   * 获取章节数据访问对象
   */
  get workChapter() {
    return this.prisma.workChapter
  }

  /**
   * 获取作品数据访问对象
   */
  get work() {
    return this.prisma.work
  }

  /**
   * 获取章节购买记录数据访问对象
   */
  get workChapterPurchase() {
    return this.prisma.workChapterPurchase
  }

  /**
   * 获取应用用户数据访问对象
   */
  get appUser() {
    return this.prisma.appUser
  }

  /**
   * 获取用户等级规则数据访问对象
   */
  get userLevelRule() {
    return this.prisma.userLevelRule
  }

  constructor() {
    super()
  }

  /**
   * 创建新章节
   * @param createDto 创建章节数据传输对象
   * @returns 创建的章节记录
   * @throws BadRequestException 当关联作品不存在、章节号已存在或会员等级不存在时抛出
   */
  async createChapter(createDto: CreateWorkChapterDto) {
    const { workId, sortOrder } = createDto

    // 验证关联作品是否存在
    if (!(await this.work.exists({ id: workId }))) {
      throw new BadRequestException('关联的作品不存在')
    }

    // 验证章节号是否已存在
    if (await this.workChapter.exists({ workId, sortOrder })) {
      throw new BadRequestException('该作品下章节号已存在')
    }

    return this.workChapter.create({ data: createDto })
  }

  /**
   * 获取章节分页列表
   * @param dto 查询条件数据传输对象
   * @returns 分页章节列表
   */
  async getChapterPage(dto: QueryWorkChapterDto) {
    return this.workChapter.findPagination({
      where: {
        ...dto,
        title: dto.title
          ? {
              contains: dto.title,
              mode: 'insensitive',
            }
          : undefined,
      },
      select: PAGE_WORK_CHAPTER_SELECT,
    })
  }

  /**
   * 获取章节详情
   * @param id 章节ID
   * @returns 章节详情，包含作品信息和会员等级信息
   * @throws BadRequestException 当章节不存在时抛出
   */
  async getChapterDetail(id: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id },
      include: {
        work: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        requiredViewLevel: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    return chapter
  }

  /**
   * 更新章节信息
   * @param dto 更新章节数据传输对象
   * @returns 更新后的章节记录
   * @throws BadRequestException 当章节号已存在或会员等级不存在时抛出
   */
  async updateChapter(dto: UpdateWorkChapterDto) {
    const { id, workId, ...updateData } = dto
    const { requiredViewLevelId, sortOrder } = updateData

    // 验证章节号是否与其他章节冲突
    if (
      sortOrder !== undefined &&
      workId !== undefined &&
      (await this.workChapter.exists({
        id: { not: id },
        sortOrder,
        workId,
      }))
    ) {
      throw new BadRequestException('该作品下章节号已存在')
    }

    // 验证阅读会员等级是否存在
    if (
      requiredViewLevelId &&
      !(await this.userLevelRule.exists({ id: requiredViewLevelId }))
    ) {
      throw new BadRequestException('指定的阅读会员等级不存在')
    }

    return this.workChapter.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 删除章节
   * @param id 章节ID
   * @returns 删除的章节记录
   */
  async deleteChapter(id: number) {
    if (!(await this.workChapter.exists({ id }))) {
      throw new BadRequestException('章节不存在')
    }
    return this.workChapter.delete({ where: { id } })
  }

  /**
   * 交换两个章节的排序号
   * @param dto 拖拽排序数据传输对象
   * @returns 交换后的章节ID
   * @throws BadRequestException 当章节不存在或不是同一作品时抛出
   */
  async swapChapterNumbers(dto: DragReorderDto) {
    return this.workChapter.swapField({
      where: [{ id: dto.dragId }, { id: dto.targetId }],
      sourceField: 'workId',
    })
  }
}
