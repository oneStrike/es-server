import type { WorkTagWhereInput } from '@libs/base/database'
import { BaseService } from '@libs/base/database'
import { DragReorderDto, IdDto } from '@libs/base/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { CreateTagDto, QueryTagDto, UpdateTagDto } from './dto/tag.dto'

/**
 * 标签服务类
 * 继承 BaseService，提供标签相关的业务逻辑
 */
@Injectable()
export class WorkTagService extends BaseService {
  get workTag() {
    return this.prisma.workTag
  }

  /**
   * 创建标签
   * @param createTagDto 创建标签的数据
   * @returns 创建的标签ID
   */
  async createTag(createTagDto: CreateTagDto) {
    // 验证标签名称是否已存在
    if (await this.workTag.exists({ name: createTagDto.name })) {
      throw new BadRequestException('标签名称已存在')
    }

    // 如果没有指定排序值，设置为最大值+1
    if (!createTagDto.order) {
      createTagDto.order = (await this.workTag.maxOrder()) + 1
    }

    return this.workTag.create({
      data: {
        ...createTagDto,
        popularity: 0,
      },
      select: { id: true },
    })
  }

  /**
   * 分页查询标签列表
   * @param queryDto 查询参数
   * @returns 分页结果
   */
  async getTagPage(queryDto: QueryTagDto) {
    const { name, isEnabled, ...pageParams } = queryDto

    // 构建查询条件
    const where: WorkTagWhereInput = {}

    if (name) {
      where.name = { contains: name }
    }

    if (isEnabled !== undefined) {
      where.isEnabled = isEnabled
    }

    if (!pageParams.orderBy) {
      pageParams.orderBy = JSON.stringify({ order: 'desc' })
    }

    return this.workTag.findPagination({
      where: { ...where, ...pageParams },
    })
  }

  /**
   * 获取标签详情
   * @param id 标签ID
   * @returns 标签详情
   */
  async getTagDetail(id: number) {
    const tag = await this.workTag.findUnique({
      where: { id },
    })
    if (!tag) {
      throw new BadRequestException('标签不存在')
    }
    return tag
  }

  /**
   * 更新标签
   * @param updateTagDto 更新数据
   * @returns 更新后的标签ID
   */
  async updateTag(updateTagDto: UpdateTagDto) {
    const { id, ...updateData } = updateTagDto

    // 验证标签名称是否已经存在
    const existingTag = await this.workTag.findUnique({
      where: { name: updateData.name, NOT: { id } },
    })

    if (existingTag) {
      throw new BadRequestException('标签名称已存在')
    }

    await this.workTag.update({
      where: { id },
      data: updateData,
    })

    return { id }
  }

  /**
   * 拖拽排序
   */
  async updateTagSort(updateSortDto: DragReorderDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.workTag.swapField(
        { id: updateSortDto.dragId },
        { id: updateSortDto.targetId },
        'order',
      )
    })
  }

  /**
   * 批量删除标签
   * @param dto 标签ID
   * @returns 删除结果
   */
  async deleteTagBatch(dto: IdDto) {
    if (!(await this.workTag.exists({ id: dto.id }))) {
      throw new BadRequestException('标签不存在')
    }

    if (await this.checkTagHasWorks(dto.id)) {
      throw new BadRequestException('标签还有作品，无法删除')
    }

    await this.workTag.delete({
      where: { id: dto.id },
    })
    return { id: dto.id }
  }

  /**
   * 检查标签是否有关联的作品
   */
  async checkTagHasWorks(tagId: number) {
    const count = await this.prisma.workTagRelation.count({
      where: {
        tagId,
      },
    })
    return count > 0
  }
}
