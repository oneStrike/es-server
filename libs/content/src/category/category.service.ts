import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { IdDto } from '@libs/platform/dto'
import { jsonParse } from '@libs/platform/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, arrayOverlaps, eq, isNull } from 'drizzle-orm'
import {
  CreateCategoryDto,
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
  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** 分类表。 */
  get workCategory() {
    return this.drizzle.schema.workCategory
  }

  /** 分类-作品关联表。 */
  get workCategoryRelation() {
    return this.drizzle.schema.workCategoryRelation
  }

  /** 作品表。 */
  get work() {
    return this.drizzle.schema.work
  }

  /**
   * 创建分类
   *
   * 未指定排序时自动追加到末尾；popularity 初始化为 0，由作品关联或外部事件驱动更新。
   */
  async createCategory(createCategoryInput: CreateCategoryDto) {
    if (!createCategoryInput.sortOrder) {
      createCategoryInput.sortOrder =
        (await this.drizzle.ext.maxOrder({
          column: this.workCategory.sortOrder,
        })) + 1
    }

    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.workCategory).values(createCategoryInput),
      { duplicate: '分类名称已存在' },
    )
    return true
  }

  /**
   * 分页查询分类
   *
   * 支持按名称模糊匹配、启用状态筛选、内容类型数组重叠查询。
   * contentType 使用 PostgreSQL 数组重叠操作符 &&，匹配任意一个指定类型即返回。
   * 未显式传入排序时，默认遵循后台维护的 sortOrder 升序。
   */
  async getCategoryPage(queryDto: QueryCategoryDto) {
    const { name, isEnabled, contentType, ...pageParams } = queryDto

    const conditions: SQL[] = []

    if (name) {
      conditions.push(
        buildILikeCondition(this.workCategory.name, name)!,
      )
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

    return this.drizzle.ext.findPagination(this.workCategory, {
      where,
      ...pageParams,
      orderBy,
    })
  }

  /**
   * 获取分类详情。
   * 未命中时抛出业务异常，避免上层误把空结果当成可编辑分类。
   */
  async getCategoryDetail(input: IdDto) {
    const category = await this.db.query.workCategory.findFirst({
      where: { id: input.id },
    })
    if (!category) {
      throw new BadRequestException('分类不存在')
    }
    return category
  }

  /**
   * 更新分类
   *
   * 禁用前校验无关联作品；名称重复抛出 BadRequestException。
   * @throws BadRequestException 分类存在关联作品时禁用失败，或名称重复
   */
  async updateCategory(updateCategoryDto: UpdateCategoryDto) {
    const { id, ...updateData } = updateCategoryDto

    if (
      updateData.isEnabled === false &&
      (await this.checkCategoryHasWorks(id))
    ) {
      throw new BadRequestException('该分类存在关联作品，不能禁用。')
    }

    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workCategory)
          .set(updateData)
          .where(eq(this.workCategory.id, id)),
      { duplicate: '分类名称已存在' },
    )
    this.drizzle.assertAffectedRows(result, '分类不存在')
    return true
  }

  /**
   * 更新分类启用状态。
   * 禁用前同样要校验没有未删除作品关联，避免通过状态入口绕过完整性约束。
   */
  async updateCategoryStatus(updateStatusDto: UpdateCategoryStatusDto) {
    if (
      !updateStatusDto.isEnabled &&
      (await this.checkCategoryHasWorks(updateStatusDto.id))
    ) {
      throw new BadRequestException('该分类存在关联作品，不能禁用。')
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

  /**
   * 交换两个分类的排序值
   *
   * 使用 ext.swapField 保证原子性，避免并发问题。
   */
  async updateCategorySort(updateSortDto: UpdateCategorySortDto) {
    await this.drizzle.ext.swapField(this.workCategory, {
      where: [{ id: updateSortDto.dragId }, { id: updateSortDto.targetId }],
    })
    return true
  }

  /**
   * 删除分类
   *
   * 删除前校验无关联作品，保证数据完整性。
   * @throws BadRequestException 分类存在关联作品时删除失败
   */
  async deleteCategory(input: IdDto) {
    if (await this.checkCategoryHasWorks(input.id)) {
      throw new BadRequestException(
        '该分类存在关联作品，不能删除。',
      )
    }
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .delete(this.workCategory)
        .where(eq(this.workCategory.id, input.id)),
    )
    this.drizzle.assertAffectedRows(result, '分类不存在')
    return true
  }

  /**
   * 检查分类是否存在未软删的关联作品
   *
   * 用于删除或禁用分类前的完整性校验。仅统计未软删作品，已软删作品不计入。
   */
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
}
