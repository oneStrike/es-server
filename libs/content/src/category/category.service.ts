import { DrizzleService } from '@db/core'
import { DragReorderDto, UpdateEnabledStatusDto } from '@libs/platform/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import {
  CreateCategoryDto,
  QueryCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto'

@Injectable()
export class WorkCategoryService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  get workCategory() {
    return this.drizzle.schema.workCategory
  }

  async createCategory(createCategoryDto: CreateCategoryDto) {
    if (!createCategoryDto.sortOrder) {
      const maxOrder = await this.drizzle.ext.maxOrder(this.workCategory)
      createCategoryDto.sortOrder = maxOrder + 1
    }

    const [created] = await this.db
      .insert(this.workCategory)
      .values({
        popularity: 0,
        ...createCategoryDto,
      })
      .returning({ id: this.workCategory.id })
    return created
  }

  async getCategoryPage(queryDto: QueryCategoryDto) {
    const { name, isEnabled, contentType, ...pageParams } = queryDto

    if (!pageParams.orderBy) {
      pageParams.orderBy = JSON.stringify({ sortOrder: 'desc' })
    }

    let where = this.drizzle.buildWhere(this.workCategory, {
      and: {
        name: name ? { like: name } : undefined,
        isEnabled,
      },
    })

    if (contentType?.length && contentType !== '[]') {
      const values = JSON.parse(contentType) as number[]
      if (values.length > 0) {
        const typeArray = sql`ARRAY[${sql.join(values.map((v) => sql`${v}`), sql`, `)}]::smallint[]`
        where = and(where, sql`${this.workCategory.contentType} && ${typeArray}`)
      }
    }

    return this.drizzle.ext.findPagination(this.workCategory, {
      where,
      ...pageParams,
    })
  }

  async getCategoryDetail(id: number) {
    return this.db.query.workCategory.findFirst({
      where: { id },
    })
  }

  async updateCategory(updateCategoryDto: UpdateCategoryDto) {
    const { id, ...updateData } = updateCategoryDto as any

    const [updated] = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workCategory)
          .set(updateData)
          .where(eq(this.workCategory.id, id))
          .returning({ id: this.workCategory.id }),
      { duplicate: 'Category name already exists' },
    )
    this.drizzle.assertAffectedRows(updated ? [updated] : [], '分类不存在')
    return updated
  }

  async updateCategoryStatus(updateStatusDto: UpdateEnabledStatusDto) {
    if (!updateStatusDto.isEnabled && (await this.checkCategoryHasWorks())) {
      throw new BadRequestException('Category has related works and cannot be disabled')
    }
    const [updated] = await this.db
      .update(this.workCategory)
      .set({ isEnabled: updateStatusDto.isEnabled })
      .where(eq(this.workCategory.id, updateStatusDto.id))
      .returning({ id: this.workCategory.id })
    this.drizzle.assertAffectedRows(updated ? [updated] : [], '分类不存在')
    return updated
  }

  async updateCategorySort(updateSortDto: DragReorderDto) {
    return this.drizzle.ext.swapField(this.workCategory, {
      where: [{ id: updateSortDto.dragId }, { id: updateSortDto.targetId }],
    })
  }

  async deleteCategory(id: number) {
    if (await this.checkCategoryHasWorks()) {
      throw new BadRequestException('Category has related works and cannot be deleted')
    }
    const result = await this.db.delete(this.workCategory).where(eq(this.workCategory.id, id))
    this.drizzle.assertAffectedRows(result, '分类不存在')
    return { id }
  }

  async checkCategoryHasWorks() {
    return false
  }
}
