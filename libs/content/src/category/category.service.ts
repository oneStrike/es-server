import type { SQL } from 'drizzle-orm'
import { DrizzleService, escapeLikePattern } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, ilike, isNull, sql } from 'drizzle-orm'
import {
  CategoryIdInput,
  CreateCategoryInput,
  QueryCategoryInput,
  UpdateCategoryInput,
  UpdateCategorySortInput,
  UpdateCategoryStatusInput,
} from './category.type'

@Injectable()
export class WorkCategoryService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  get workCategory() {
    return this.drizzle.schema.workCategory
  }

  get workCategoryRelation() {
    return this.drizzle.schema.workCategoryRelation
  }

  get work() {
    return this.drizzle.schema.work
  }

  async createCategory(createCategoryInput: CreateCategoryInput) {
    if (!createCategoryInput.sortOrder) {
      const maxOrder = await this.drizzle.ext.maxOrder(this.workCategory)
      createCategoryInput.sortOrder = maxOrder + 1
    }

    await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.workCategory)
        .values({
          popularity: 0,
          ...createCategoryInput,
        }),
    )
    return true
  }

  async getCategoryPage(queryDto: QueryCategoryInput) {
    const { name, isEnabled, contentType, ...pageParams } = queryDto

    if (!pageParams.orderBy) {
      pageParams.orderBy = JSON.stringify({ sortOrder: 'desc' })
    }

    const conditions: SQL[] = []

    if (name) {
      conditions.push(
        ilike(this.workCategory.name, `%${escapeLikePattern(name)}%`),
      )
    }
    if (isEnabled !== undefined) {
      conditions.push(eq(this.workCategory.isEnabled, isEnabled))
    }

    let where = conditions.length > 0 ? and(...conditions) : undefined

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

  async getCategoryDetail(input: CategoryIdInput) {
    return this.db.query.workCategory.findFirst({
      where: { id: input.id },
    })
  }

  async updateCategory(updateCategoryDto: UpdateCategoryInput) {
    const { id, ...updateData } = updateCategoryDto

    if (updateData.isEnabled === false && (await this.checkCategoryHasWorks(id))) {
      throw new BadRequestException('Category has related works and cannot be disabled')
    }

    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workCategory)
          .set(updateData)
          .where(eq(this.workCategory.id, id)),
      { duplicate: 'Category name already exists' },
    )
    this.drizzle.assertAffectedRows(result, '分类不存在')
    return true
  }

  async updateCategoryStatus(updateStatusDto: UpdateCategoryStatusInput) {
    if (!updateStatusDto.isEnabled && (await this.checkCategoryHasWorks(updateStatusDto.id))) {
      throw new BadRequestException('Category has related works and cannot be disabled')
    }
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workCategory)
        .set({ isEnabled: updateStatusDto.isEnabled })
        .where(eq(this.workCategory.id, updateStatusDto.id)),
    )
    this.drizzle.assertAffectedRows(result, '分类不存在')
    return true
  }

  async updateCategorySort(updateSortDto: UpdateCategorySortInput) {
    await this.drizzle.ext.swapField(this.workCategory, {
      where: [{ id: updateSortDto.dragId }, { id: updateSortDto.targetId }],
    })
    return true
  }

  async deleteCategory(input: CategoryIdInput) {
    if (await this.checkCategoryHasWorks(input.id)) {
      throw new BadRequestException('Category has related works and cannot be deleted')
    }
    const result = await this.drizzle.withErrorHandling(() =>
      this.db.delete(this.workCategory).where(eq(this.workCategory.id, input.id)),
    )
    this.drizzle.assertAffectedRows(result, '分类不存在')
    return true
  }

  async checkCategoryHasWorks(categoryId: number) {
    const rows = await this.db
      .select({ workId: this.workCategoryRelation.workId })
      .from(this.workCategoryRelation)
      .innerJoin(this.work, eq(this.work.id, this.workCategoryRelation.workId))
      .where(
        and(
          eq(this.workCategoryRelation.categoryId, categoryId),
          isNull(this.work.deletedAt),
        ),
      )
      .limit(1)

    return rows.length > 0
  }
}
