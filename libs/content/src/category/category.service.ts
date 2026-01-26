import type { WorkCategoryWhereInput } from '@libs/base/database/prisma-client/models'
import { BaseService } from '@libs/base/database'
import { DragReorderDto, UpdateEnabledStatusDto } from '@libs/base/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateCategoryDto,
  QueryCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto'

/**
 * 分类服务类
 * 继承 BaseRepositoryService，提供分类相关的业务逻辑
 */
@Injectable()
export class WorkCategoryService extends BaseService {
  get workCategory() {
    return this.prisma.workCategory
  }

  /**
   * 创建分类
   * @param createCategoryDto 创建分类的数据
   * @returns 创建的分类信息
   */
  async createCategory(createCategoryDto: CreateCategoryDto) {
    // 如果没有指定排序值，设置为最大值+1
    if (!createCategoryDto.order) {
      const maxOrder = await this.workCategory.maxOrder()
      createCategoryDto.order = maxOrder + 1
    }

    return this.workCategory.create({
      data: {
        popularity: 0,
        ...createCategoryDto,
      },
      select: { id: true },
    })
  }

  /**
   * 分页查询分类列表
   * @param queryDto 查询参数
   * @returns 分页结果
   */
  async getCategoryPage(queryDto: QueryCategoryDto) {
    const { name, isEnabled, contentType, ...pageParams } = queryDto

    // 构建查询条件
    const where: WorkCategoryWhereInput = {}

    if (name) {
      where.name = { contains: name }
    }

    if (isEnabled !== undefined) {
      where.isEnabled = isEnabled
    }
    if (!pageParams.orderBy) {
      pageParams.orderBy = JSON.stringify({ order: 'desc' })
    }

    if (contentType?.length && contentType !== '[]') {
      // 按内容类型代码筛选（多对多 some 查询）
      where.contentType = {
        hasSome: JSON.parse(contentType),
      }
    }

    return this.workCategory.findPagination({
      where: { ...where, ...pageParams },
    })
  }

  /**
   * 获取分类详情
   * @param id 分类ID
   * @returns 分类详情
   */
  async getCategoryDetail(id: number) {
    return this.prisma.workCategory.findUnique({
      where: { id },
    })
  }

  /**
   * 更新分类
   * @param updateCategoryDto 更新数据
   * @returns 更新后的分类信息
   */
  async updateCategory(updateCategoryDto: UpdateCategoryDto) {
    const { id, ...updateData } = updateCategoryDto as any

    // 如果更新名称，验证名称是否已被其他分类使用
    if (updateData.name) {
      const duplicateCategory = await this.workCategory.findUnique({
        where: { name: updateData.name },
        select: { id: true },
      })
      if (duplicateCategory && duplicateCategory.id !== id) {
        throw new BadRequestException('分类名称已存在')
      }
    }

    return this.workCategory.update({
      where: { id },
      data: updateData,
      select: { id: true },
    })
  }

  /**
   * 更新分类状态
   * @param updateStatusDto 状态更新数据
   * @returns 更新结果
   */
  async updateCategoryStatus(updateStatusDto: UpdateEnabledStatusDto) {
    if (!updateStatusDto.isEnabled && (await this.checkCategoryHasWorks())) {
      throw new BadRequestException(`分类存在关联作品，无法禁用`)
    }
    return this.workCategory.update({
      where: { id: updateStatusDto.id },
      data: { isEnabled: updateStatusDto.isEnabled },
      select: { id: true },
    })
  }

  /**
   * 拖拽排序
   */
  async updateCategorySort(updateSortDto: DragReorderDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.workCategory.swapField(
        { id: updateSortDto.dragId },
        { id: updateSortDto.targetId },
        'order',
      )
    })
  }

  /**
   * 批量删除分类
   * @param id 分类ID
   * @returns 删除结果
   */
  async deleteCategory(id: number) {
    if (await this.checkCategoryHasWorks()) {
      throw new BadRequestException(`分类存在关联作品，无法删除`)
    }
    return this.workCategory.delete({ where: { id } })
  }

  /**
   * 检查分类是否有关联的作品
   */
  async checkCategoryHasWorks() {
    return false
  }
}
