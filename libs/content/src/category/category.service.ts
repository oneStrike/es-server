import type { SQL } from 'drizzle-orm'
import type { WorkCategorySelect } from '@db/schema'
import type { CursorContextFingerprint } from '@libs/platform/utils'
import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'

import { BusinessErrorCode } from '@libs/platform/constant'
import { IdDto } from '@libs/platform/dto/base.dto'
import { BusinessException } from '@libs/platform/exceptions'
import {
  assertSameCursorContextFingerprint,
  jsonParse,
  normalizeCursorNumberArray,
  normalizeCursorText,
  parseCursorContextFingerprint,
} from '@libs/platform/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, arrayOverlaps, asc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm'
import {
  CreateCategoryDto,
  QueryAppCategoryCursorDto,
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
        .select()
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

  async getAppCategoryCursorPage(queryDto: QueryAppCategoryCursorDto) {
    const { name, contentType } = queryDto
    const conditions: SQL[] = [eq(this.workCategory.isEnabled, true)]
    const cursorContext = this.buildCategoryCursorContext(queryDto)

    if (name) {
      conditions.push(buildILikeCondition(this.workCategory.name, name)!)
    }

    const values = this.parseCategoryContentTypes(contentType)
    if (values.length > 0) {
      conditions.push(arrayOverlaps(this.workCategory.contentType, values))
    }

    const cursor = this.parseCategoryCursor(queryDto.cursor, cursorContext)
    if (cursor) {
      conditions.push(this.buildCategoryCursorWhere(cursor))
    }

    const where = and(...conditions)
    const page = this.drizzle.buildPage({ pageSize: queryDto.pageSize })
    const rows = await this.db
      .select()
      .from(this.workCategory)
      .where(where)
      .orderBy(asc(this.workCategory.sortOrder), asc(this.workCategory.id))
      .limit(page.limit + 1)
    const list = rows.slice(0, page.limit)
    const hasMore = rows.length > page.limit

    return {
      list: list.map((item) => this.toCategoryOutputDto(item)),
      pageSize: page.pageSize,
      hasMore,
      nextCursor:
        hasMore && list.length > 0
          ? this.encodeCategoryCursor(list[list.length - 1], cursorContext)
          : null,
    }
  }

  // 获取分类详情，未命中时抛出业务异常，避免上层误把空结果当成可编辑分类。
  async getCategoryDetail(input: IdDto) {
    const category = await this.db.query.workCategory.findFirst({
      where: { id: input.id },
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

    if (
      updateData.isEnabled === false &&
      (await this.checkCategoryHasWorks(id))
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '该分类存在关联作品，不能禁用。',
      )
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workCategory)
          .set(updateData)
          .where(eq(this.workCategory.id, id)),
      {
        duplicate: '分类名称已存在',
        notFound: '分类不存在',
      },
    )
    return true
  }

  // 更新分类启用状态，禁用前同样要校验没有未删除作品关联，避免通过状态入口绕过完整性约束。
  async updateCategoryStatus(updateStatusDto: UpdateCategoryStatusDto) {
    if (
      !updateStatusDto.isEnabled &&
      (await this.checkCategoryHasWorks(updateStatusDto.id))
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '该分类存在关联作品，不能禁用。',
      )
    }
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workCategory)
          .set({ isEnabled: updateStatusDto.isEnabled })
          .where(eq(this.workCategory.id, updateStatusDto.id)),
      { notFound: '分类不存在' },
    )
    return true
  }

  // 交换两个分类的排序值，在事务中使用临时排序值避免唯一约束或并发中间态。
  async updateCategorySort(updateSortDto: UpdateCategorySortDto) {
    await this.drizzle.withTransaction(async (tx) => {
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
    })
    return true
  }

  // 删除分类，删除前校验无关联作品，保证数据完整性。
  async deleteCategory(input: IdDto) {
    if (await this.checkCategoryHasWorks(input.id)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '该分类存在关联作品，不能删除。',
      )
    }
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .delete(this.workCategory)
          .where(eq(this.workCategory.id, input.id)),
      { notFound: '分类不存在' },
    )
    return true
  }

  // 检查分类是否存在未软删的关联作品，用于删除或禁用分类前的完整性校验。仅统计未软删作品，已软删作品不计入。
  private async checkCategoryHasWorks(categoryId: number) {
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

  private async resolveNextCategorySortOrder() {
    const [row] = await this.db
      .select({ value: sql<number>`max(${this.workCategory.sortOrder})` })
      .from(this.workCategory)

    return row?.value ?? 0
  }

  private async resolveMinimumCategorySortOrder(db = this.db) {
    const [row] = await db
      .select({ value: sql<number>`min(${this.workCategory.sortOrder})` })
      .from(this.workCategory)

    return row?.value ?? 0
  }

  private encodeCategoryCursor(
    category: Pick<WorkCategorySelect, 'sortOrder' | 'id'>,
    context: CursorContextFingerprint,
  ) {
    return Buffer.from(
      JSON.stringify({ sortOrder: category.sortOrder, id: category.id, context }),
    ).toString('base64url')
  }

  private parseCategoryCursor(
    cursor?: string | null,
    expectedContext?: CursorContextFingerprint,
  ) {
    if (!cursor?.trim()) {
      return undefined
    }

    try {
      const payload = JSON.parse(
        Buffer.from(cursor.trim(), 'base64url').toString('utf8'),
      ) as Record<string, unknown>
      const sortOrder = Number(payload.sortOrder)
      const id = Number(payload.id)
      const context = parseCursorContextFingerprint(payload.context)

      if (
        !Number.isInteger(sortOrder) ||
        sortOrder < 0 ||
        !Number.isInteger(id) ||
        id <= 0
      ) {
        throw new TypeError('invalid category cursor')
      }

      if (expectedContext) {
        assertSameCursorContextFingerprint(
          context,
          expectedContext,
          () => new BadRequestException('分类分页游标与查询条件不匹配'),
        )
      }

      return { sortOrder, id }
    }
    catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }
      throw new BadRequestException('分类分页游标非法')
    }
  }

  private buildCategoryCursorContext(
    queryDto: Pick<QueryAppCategoryCursorDto, 'name' | 'contentType'>,
  ): CursorContextFingerprint {
    return {
      name: normalizeCursorText(queryDto.name),
      contentType: normalizeCursorNumberArray(
        this.parseCategoryContentTypes(queryDto.contentType),
      ),
    }
  }

  private parseCategoryContentTypes(contentType?: string): number[] {
    return normalizeCursorNumberArray(jsonParse(contentType || [], []))
  }

  private buildCategoryCursorWhere(cursor: { sortOrder: number; id: number }) {
    return or(
      gt(this.workCategory.sortOrder, cursor.sortOrder),
      and(
        eq(this.workCategory.sortOrder, cursor.sortOrder),
        gt(this.workCategory.id, cursor.id),
      ),
    )!
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
