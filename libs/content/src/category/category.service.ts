import type { DbTransaction } from '@db/core'
import type { WorkCategorySelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import {
  acquireIntegrityLocks,
  buildILikeCondition,
  DrizzleService,
  exclusiveIntegrityLock,
  toPageResult,
} from '@db/core'

import { BusinessErrorCode } from '@libs/platform/constant'
import { IdDto } from '@libs/platform/dto'
import { BusinessException } from '@libs/platform/exceptions'
import { jsonParse } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import {
  and,
  arrayOverlaps,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  sql,
} from 'drizzle-orm'
import { workCatalogCategoryLock } from '../work/core/work-integrity-lock'
import {
  CreateCategoryDto,
  QueryAppCategoryPageDto,
  QueryCategoryDto,
  UpdateCategoryDto,
  UpdateCategorySortDto,
  UpdateCategoryStatusDto,
} from './dto/category.dto'

/**
 * 作品分类服务
 *
 * 负责分类的 CRUD、排序交换、启用状态管理，以及关联作品检查。
 * 分类删除或禁用前必须校验无关联作品，防止运营分类下架后影响作品可见性。
 */
@Injectable()
export class WorkCategoryService {
  // 初始化 WorkCategoryService 依赖。
  constructor(private readonly drizzle: DrizzleService) {}

  // 数据库连接实例。
  private get db() {
    return this.drizzle.db
  }

  // 分类表。
  get workCategory() {
    return this.drizzle.schema.workCategory
  }

  // 分类-作品关联表。
  get workCategoryRelation() {
    return this.drizzle.schema.workCategoryRelation
  }

  // 作品表。
  get work() {
    return this.drizzle.schema.work
  }

  // 分类列表与详情的完整当前 contract；分类表新增列不会经默认查询泄露到 app/admin。
  private buildCategoryReadSelect() {
    return {
      id: this.workCategory.id,
      name: this.workCategory.name,
      description: this.workCategory.description,
      icon: this.workCategory.icon,
      contentType: this.workCategory.contentType,
      sortOrder: this.workCategory.sortOrder,
      isEnabled: this.workCategory.isEnabled,
      popularity: this.workCategory.popularity,
      createdAt: this.workCategory.createdAt,
      updatedAt: this.workCategory.updatedAt,
    }
  }

  private getCategoryReadColumns() {
    return {
      id: true,
      name: true,
      description: true,
      icon: true,
      contentType: true,
      sortOrder: true,
      isEnabled: true,
      popularity: true,
      createdAt: true,
      updatedAt: true,
    } as const
  }

  // 创建分类，未指定排序时自动追加到末尾；popularity 初始化为 0，由作品关联或外部事件驱动更新。
  async createCategory(createCategoryInput: CreateCategoryDto) {
    if (!createCategoryInput.sortOrder) {
      createCategoryInput.sortOrder =
        (await this.resolveNextCategorySortOrder()) + 1
    }

    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.workCategory).values(createCategoryInput),
      { duplicate: '分类名称已存在' },
    )
    return true
  }

  // 分页查询分类，支持按名称模糊匹配、启用状态筛选、内容类型数组重叠查询。
  async getCategoryPage(queryDto: QueryCategoryDto) {
    const { name, isEnabled, contentType, ...pageParams } = queryDto

    const conditions: SQL[] = []

    if (name) {
      conditions.push(buildILikeCondition(this.workCategory.name, name)!)
    }
    if (isEnabled !== undefined) {
      conditions.push(eq(this.workCategory.isEnabled, isEnabled))
    }

    let where = conditions.length > 0 ? and(...conditions) : undefined

    const values = jsonParse(contentType || []) as number[]
    if (values.length > 0) {
      where = and(where, arrayOverlaps(this.workCategory.contentType, values))
    }

    const orderBy = pageParams.orderBy?.trim()
      ? pageParams.orderBy
      : { sortOrder: 'asc' as const }

    const page = this.drizzle.buildPage(pageParams)
    const orderQuery = this.drizzle.buildOrderBy(orderBy, {
      table: this.workCategory,
    })
    const [list, total] = await Promise.all([
      this.db
        .select(this.buildCategoryReadSelect())
        .from(this.workCategory)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.workCategory, where),
    ])

    return toPageResult(
      list.map((item) => this.toCategoryOutputDto(item)),
      total,
      page,
    )
  }

  async getAppCategoryPage(queryDto: QueryAppCategoryPageDto) {
    const { name, contentType } = queryDto
    const conditions: SQL[] = [eq(this.workCategory.isEnabled, true)]

    if (name) {
      conditions.push(buildILikeCondition(this.workCategory.name, name)!)
    }

    const values = this.parseCategoryContentTypes(contentType)
    if (values.length > 0) {
      conditions.push(arrayOverlaps(this.workCategory.contentType, values))
    }

    const pageParams = this.drizzle.buildPageParams(queryDto, {
      table: this.workCategory,
      fallbackOrderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    if (pageParams.dateRange?.gte) {
      conditions.push(
        gte(this.workCategory.createdAt, pageParams.dateRange.gte),
      )
    }
    if (pageParams.dateRange?.lt) {
      conditions.push(lt(this.workCategory.createdAt, pageParams.dateRange.lt))
    }

    const where = and(...conditions)
    const [list, total] = await Promise.all([
      this.db
        .select(this.buildCategoryReadSelect())
        .from(this.workCategory)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(this.workCategory, where),
    ])

    return toPageResult(
      list.map((item) => this.toCategoryOutputDto(item)),
      total,
      pageParams.page,
    )
  }

  // 获取分类详情，未命中时抛出业务异常，避免上层误把空结果当成可编辑分类。
  async getCategoryDetail(input: IdDto) {
    const category = await this.db.query.workCategory.findFirst({
      where: { id: input.id },
      columns: this.getCategoryReadColumns(),
    })
    if (!category) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '分类不存在',
      )
    }
    return this.toCategoryOutputDto(category)
  }

  // 更新分类，禁用前校验无关联作品；名称重复由共享错误处理转换为业务异常。
  async updateCategory(updateCategoryDto: UpdateCategoryDto) {
    const { id, ...updateData } = updateCategoryDto

    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [
          exclusiveIntegrityLock(workCatalogCategoryLock(id)),
        ])
        if (
          updateData.isEnabled === false &&
          (await this.checkCategoryHasWorks(id, tx))
        ) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '该分类存在关联作品，不能禁用。',
          )
        }
        const result = await tx
          .update(this.workCategory)
          .set(updateData)
          .where(eq(this.workCategory.id, id))
        this.drizzle.assertAffectedRows(result, '分类不存在')
      },
      messages: { duplicate: '分类名称已存在' },
    })
    return true
  }

  // 更新分类启用状态，禁用前同样要校验没有未删除作品关联，避免通过状态入口绕过完整性约束。
  async updateCategoryStatus(updateStatusDto: UpdateCategoryStatusDto) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [
          exclusiveIntegrityLock(workCatalogCategoryLock(updateStatusDto.id)),
        ])
        if (
          !updateStatusDto.isEnabled &&
          (await this.checkCategoryHasWorks(updateStatusDto.id, tx))
        ) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '该分类存在关联作品，不能禁用。',
          )
        }
        const result = await tx
          .update(this.workCategory)
          .set({ isEnabled: updateStatusDto.isEnabled })
          .where(eq(this.workCategory.id, updateStatusDto.id))
        this.drizzle.assertAffectedRows(result, '分类不存在')
      },
    })
    return true
  }

  // 交换两个分类的排序值，在事务中使用临时排序值避免唯一约束或并发中间态。
  async updateCategorySort(updateSortDto: UpdateCategorySortDto) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        const rows = await tx
          .select({
            id: this.workCategory.id,
            sortOrder: this.workCategory.sortOrder,
          })
          .from(this.workCategory)
          .where(
            inArray(this.workCategory.id, [
              updateSortDto.dragId,
              updateSortDto.targetId,
            ]),
          )

        const dragCategory = rows.find((row) => row.id === updateSortDto.dragId)
        const targetCategory = rows.find(
          (row) => row.id === updateSortDto.targetId,
        )

        if (!dragCategory || !targetCategory) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '分类不存在',
          )
        }
        if (dragCategory.sortOrder === targetCategory.sortOrder) {
          return true
        }

        const temporarySortOrder =
          (await this.resolveMinimumCategorySortOrder(tx)) - 1

        await tx
          .update(this.workCategory)
          .set({ sortOrder: temporarySortOrder })
          .where(eq(this.workCategory.id, dragCategory.id))
        await tx
          .update(this.workCategory)
          .set({ sortOrder: dragCategory.sortOrder })
          .where(eq(this.workCategory.id, targetCategory.id))
        await tx
          .update(this.workCategory)
          .set({ sortOrder: targetCategory.sortOrder })
          .where(eq(this.workCategory.id, dragCategory.id))

        return true
      },
    })
    return true
  }

  // 删除分类，删除前校验无关联作品，保证数据完整性。
  async deleteCategory(input: IdDto) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [
          exclusiveIntegrityLock(workCatalogCategoryLock(input.id)),
        ])
        if (await this.checkCategoryHasWorks(input.id, tx)) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '该分类存在关联作品，不能删除。',
          )
        }
        const result = await tx
          .delete(this.workCategory)
          .where(eq(this.workCategory.id, input.id))
        this.drizzle.assertAffectedRows(result, '分类不存在')
      },
    })
    return true
  }

  // 检查分类是否存在未软删的关联作品，用于删除或禁用分类前的完整性校验。仅统计未软删作品，已软删作品不计入。
  private async checkCategoryHasWorks(
    categoryId: number,
    runner: DbTransaction,
  ) {
    const rows = await runner
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

  private async resolveNextCategorySortOrder() {
    const [row] = await this.db
      .select({
        value: sql<number>`max(${this.workCategory.sortOrder})`.mapWith(Number),
      })
      .from(this.workCategory)

    return row?.value ?? 0
  }

  private async resolveMinimumCategorySortOrder(db = this.db) {
    const [row] = await db
      .select({
        value: sql<number>`min(${this.workCategory.sortOrder})`.mapWith(Number),
      })
      .from(this.workCategory)

    return row?.value ?? 0
  }

  private parseCategoryContentTypes(contentType?: string): number[] {
    return jsonParse(contentType || [], []) as number[]
  }

  private toCategoryOutputDto(category: WorkCategorySelect) {
    return {
      ...category,
      icon: category.icon ?? null,
      contentType: category.contentType ?? null,
      description: category.description ?? null,
    }
  }
}
