import type { WorkCategoryWhereInput } from '@libs/base/database'
import { BaseService } from '@libs/base/database'
import { DragReorderDto, UpdateEnabledStatusDto } from '@libs/base/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateCategoryDto,
  QueryCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto'

@Injectable()
export class WorkCategoryService extends BaseService {
  get workCategory() {
    return this.prisma.workCategory
  }

  async createCategory(createCategoryDto: CreateCategoryDto) {
    if (!createCategoryDto.sortOrder) {
      const maxOrder = await this.workCategory.maxOrder()
      createCategoryDto.sortOrder = maxOrder + 1
    }

    return this.workCategory.create({
      data: {
        popularity: 0,
        ...createCategoryDto,
      },
      select: { id: true },
    })
  }

  async getCategoryPage(queryDto: QueryCategoryDto) {
    const { name, isEnabled, contentType, ...pageParams } = queryDto

    const where: WorkCategoryWhereInput = {}

    if (name) {
      where.name = { contains: name }
    }

    if (isEnabled !== undefined) {
      where.isEnabled = isEnabled
    }
    if (!pageParams.orderBy) {
      pageParams.orderBy = JSON.stringify({ sortOrder: 'desc' })
    }

    if (contentType?.length && contentType !== '[]') {
      where.contentType = {
        hasSome: JSON.parse(contentType),
      }
    }

    return this.workCategory.findPagination({
      where: { ...where, ...pageParams },
    })
  }

  async getCategoryDetail(id: number) {
    return this.prisma.workCategory.findUnique({
      where: { id },
    })
  }

  async updateCategory(updateCategoryDto: UpdateCategoryDto) {
    const { id, ...updateData } = updateCategoryDto as any

    try {
      return await this.workCategory.update({
        where: { id },
        data: updateData,
        select: { id: true },
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('Category name already exists')
        },
      })
    }
  }

  async updateCategoryStatus(updateStatusDto: UpdateEnabledStatusDto) {
    if (!updateStatusDto.isEnabled && (await this.checkCategoryHasWorks())) {
      throw new BadRequestException('Category has related works and cannot be disabled')
    }
    return this.workCategory.update({
      where: { id: updateStatusDto.id },
      data: { isEnabled: updateStatusDto.isEnabled },
      select: { id: true },
    })
  }

  async updateCategorySort(updateSortDto: DragReorderDto) {
    return this.workCategory.swapField({
      where: [{ id: updateSortDto.dragId }, { id: updateSortDto.targetId }],
    })
  }

  async deleteCategory(id: number) {
    if (await this.checkCategoryHasWorks()) {
      throw new BadRequestException('Category has related works and cannot be deleted')
    }
    return this.workCategory.delete({ where: { id } })
  }

  async checkCategoryHasWorks() {
    return false
  }
}
