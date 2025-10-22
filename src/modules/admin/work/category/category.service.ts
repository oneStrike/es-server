import type { WorkCategoryWhereInput } from '@/prisma/client/models'
import { BadRequestException, Injectable } from '@nestjs/common'
import { BatchEnabledDto } from '@/common/dto/batch.dto'

import { RepositoryService } from '@/common/services/repository.service'
import { jsonParse } from '@/utils'
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
export class WorkCategoryService extends RepositoryService {
  get workCategory() {
    return this.prisma.workCategory
  }

  /**
   * 创建分类
   * @param createCategoryDto 创建分类的数据
   * @returns 创建的分类信息
   */
  async createCategory(createCategoryDto: CreateCategoryDto) {
    // 验证分类名称是否已存在
    const existingCategory = await this.workCategory.findUnique({
      where: { name: createCategoryDto.name },
    })
    if (existingCategory) {
      throw new BadRequestException('分类名称已存在')
    }

    // 校验内容类型代码（必须为已存在的 WorkContentType.code）
    if (
      !createCategoryDto.contentType ||
      createCategoryDto.contentType.length === 0
    ) {
      throw new BadRequestException('请至少选择一个内容类型')
    }
    await this.validateMediumCodes(createCategoryDto.contentType)

    // 如果没有指定排序值，设置为最大值+1
    if (!createCategoryDto.order) {
      const maxOrder = await this.workCategory.maxOrder()
      createCategoryDto.order = maxOrder + 1
    }

    // 事务：创建分类并绑定内容类型
    return this.prisma.$transaction(async (tx) => {
      const { contentType, ...payload } = createCategoryDto as any
      const category = await tx.workCategory.create({
        data: {
          ...payload,
          popularity: 0,
          popularityWeight: 0,
        },
      })
      const mediums = await tx.workContentType.findMany({
        where: { code: { in: contentType } },
        select: { id: true },
      })
      if (mediums.length) {
        await tx.workCategoryContentType.createMany({
          data: mediums.map((m) => ({
            categoryId: category.id,
            contentTypeId: m.id,
          })),
          skipDuplicates: true,
        })
      }
      // 返回包含内容类型的详情
      return tx.workCategory.findUnique({
        where: { id: category.id },
        include: { categoryContentTypes: { include: { contentType: true } } },
      })
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

    const types = jsonParse(contentType, [])
    if (types.length) {
      // 按内容类型代码筛选（多对多 some 查询）
      where.categoryContentTypes = {
        some: { contentType: { code: { in: types } } },
      }
    }

    return this.workCategory.findPagination({
      where: { ...where, ...pageParams },
      include: { categoryContentTypes: { include: { contentType: true } } },
    })
  }

  /**
   * 获取分类详情
   * @param id 分类ID
   * @returns 分类详情
   */
  async getCategoryDetail(id: number) {
    const category = await this.prisma.workCategory.findUnique({
      where: { id },
      include: { categoryContentTypes: { include: { contentType: true } } },
    })
    if (!category) {
      throw new BadRequestException('分类不存在')
    }
    return category
  }

  /**
   * 更新分类
   * @param updateCategoryDto 更新数据
   * @returns 更新后的分类信息
   */
  async updateCategory(updateCategoryDto: UpdateCategoryDto) {
    const { id, ...updateData } = updateCategoryDto as any

    // 验证分类是否存在
    const existingCategory = await this.workCategory.findUnique({
      where: { id },
    })
    if (!existingCategory) {
      throw new BadRequestException('分类不存在')
    }

    // 如果更新名称，验证名称是否已被其他分类使用
    if (updateData.name && updateData.name !== existingCategory.name) {
      const duplicateCategory = await this.workCategory.findUnique({
        where: { name: updateData.name },
      })
      if (duplicateCategory && duplicateCategory.id !== id) {
        throw new BadRequestException('分类名称已存在')
      }
    }

    // 如携带内容类型代码则校验
    if (Array.isArray(updateData.contentType)) {
      await this.validateMediumCodes(updateData.contentType)
    }

    // 事务：更新基本信息并差异同步内容类型关联
    return this.prisma.$transaction(async (tx) => {
      const { contentType, ...rest } = updateData
      await tx.workCategory.update({ where: { id }, data: rest })

      if (Array.isArray(contentType)) {
        const target = await tx.workContentType.findMany({
          where: { code: { in: contentType } },
          select: { id: true },
        })
        const targetIds = new Set(target.map((t) => t.id))
        const current = await tx.workCategoryContentType.findMany({
          where: { categoryId: id },
          select: { contentTypeId: true },
        })
        const currentIds = new Set(current.map((c) => c.contentTypeId))
        const toDelete = [...currentIds].filter((mid) => !targetIds.has(mid))
        const toCreate = [...targetIds].filter((mid) => !currentIds.has(mid))

        if (toDelete.length) {
          await tx.workCategoryContentType.deleteMany({
            where: { categoryId: id, contentTypeId: { in: toDelete } },
          })
        }
        if (toCreate.length) {
          await tx.workCategoryContentType.createMany({
            data: toCreate.map((mid) => ({
              categoryId: id,
              contentTypeId: mid,
            })),
            skipDuplicates: true,
          })
        }
      }
      return id
    })
  }

  /**
   * 批量更新分类状态
   * @param updateStatusDto 状态更新数据
   * @returns 更新结果
   */
  async updateCategoryStatus(updateStatusDto: BatchEnabledDto) {
    const { ids, isEnabled } = updateStatusDto

    // 验证所有分类是否存在
    const categories = await this.workCategory.findMany({
      where: { id: { in: ids } },
    })
    if (categories.length !== ids.length) {
      throw new BadRequestException('部分分类不存在')
    }

    return this.workCategory.updateMany({
      where: { id: { in: ids } },
      data: { isEnabled },
    })
  }

  /**
   * 校验内容类型代码均存在
   */
  private async validateMediumCodes(codes: string[]) {
    const unique = Array.from(new Set(codes))
    const count = await this.prisma.workContentType.count({
      where: { code: { in: unique }, isEnabled: true },
    })
    if (count !== unique.length) {
      throw new BadRequestException('存在无效或已禁用的内容类型代码')
    }
  }

  /**
   * 批量删除分类
   * @param ids 分类ID列表
   * @returns 删除结果
   */
  async deleteCategoryBatch(ids: number[]) {
    // 验证所有分类是否存在
    const categories = await this.workCategory.findMany({
      where: { id: { in: ids } },
    })
    if (categories.length !== ids.length) {
      throw new BadRequestException('部分分类不存在')
    }

    // 检查是否有关联的作品
    for (const id of ids) {
      const hasWorks = await this.checkCategoryHasWorks()
      if (hasWorks) {
        const category = categories.find((c) => c?.id === id)
        throw new BadRequestException(
          `分类 ${category?.name} 还有作品，无法删除`,
        )
      }
    }
    return this.workCategory.deleteMany({ where: { id: { in: ids } } })
  }

  /**
   * 检查分类是否有关联的作品
   */
  async checkCategoryHasWorks() {
    return false
  }
}
