import type { WorkTagSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type { WorkTagAdminView } from './tag.type'
import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'

import { BusinessErrorCode } from '@libs/platform/constant'
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm'
import {
  CreateTagDto,
  QueryAppTagPageDto,
  QueryTagDto,
  UpdateTagDto,
  UpdateTagSortDto,
} from './dto/tag.dto'

/**
 * 作品标签领域服务，负责标签的增删改查、排序调整与启用状态维护。
 * 对“禁用/删除”这类会影响线上可见性的操作，统一执行关联作品存在性校验。
 */
@Injectable()
export class WorkTagService {
  // 初始化 WorkTagService 依赖。
  constructor(private readonly drizzle: DrizzleService) {}

  // 数据库连接实例。
  private get db() {
    return this.drizzle.db
  }

  // 标签表。
  get workTag() {
    return this.drizzle.schema.workTag
  }

  // 标签-作品关联表。
  get workTagRelation() {
    return this.drizzle.schema.workTagRelation
  }

  // 作品表。
  get work() {
    return this.drizzle.schema.work
  }

  // 创建标签，未指定排序值时自动追加到末尾；人气值沿用数据库默认值，由后续互动数据驱动更新。
  async createTag(createTagDto: CreateTagDto) {
    if (!createTagDto.sortOrder) {
      createTagDto.sortOrder = (await this.resolveNextTagSortOrder()) + 1
    }

    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.workTag).values(createTagDto),
      { duplicate: '标签名称已存在' },
    )
    return true
  }

  // 分页查询标签，未显式传入排序时，默认遵循后台维护的 sortOrder 升序。
  async getTagPage(queryDto: QueryTagDto) {
    const { where, orderBySql, page } = this.buildTagPageQuery(queryDto)

    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.workTag)
        .where(where)
        .orderBy(...orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.workTag, where),
    ])

    return toPageResult(
      list.map((item) => this.toTagOutputDto(item)),
      total,
      page,
    )
  }

  async getAppTagPage(queryDto: QueryAppTagPageDto) {
    const conditions: SQL[] = [eq(this.workTag.isEnabled, true)]

    if (queryDto.name?.trim()) {
      conditions.push(buildILikeCondition(this.workTag.name, queryDto.name)!)
    }

    const pageParams = this.drizzle.buildPageParams(queryDto, {
      table: this.workTag,
      fallbackOrderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    if (pageParams.dateRange?.gte) {
      conditions.push(gte(this.workTag.createdAt, pageParams.dateRange.gte))
    }
    if (pageParams.dateRange?.lt) {
      conditions.push(lt(this.workTag.createdAt, pageParams.dateRange.lt))
    }

    const where = and(...conditions)
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.workTag)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(this.workTag, where),
    ])

    return toPageResult(
      list.map((item) => this.toTagOutputDto(item)),
      total,
      pageParams.page,
    )
  }

  // 后台分页查询标签；后台运营不展示人气字段，避免把内部指标误当成可运营排序依据。
  async getAdminTagPage(queryDto: QueryTagDto) {
    const { where, orderBySql, page } = this.buildTagPageQuery(queryDto)

    const [list, total] = await Promise.all([
      this.db
        .select({
          id: this.workTag.id,
          name: this.workTag.name,
          icon: this.workTag.icon,
          sortOrder: this.workTag.sortOrder,
          isEnabled: this.workTag.isEnabled,
          description: this.workTag.description,
          createdAt: this.workTag.createdAt,
          updatedAt: this.workTag.updatedAt,
        })
        .from(this.workTag)
        .where(where)
        .orderBy(...orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.workTag, where),
    ])

    return toPageResult(
      list.map((item) => this.toAdminTagOutputDto(item)),
      total,
      page,
    )
  }

  private buildTagPageQuery(queryDto: QueryTagDto) {
    const { name, isEnabled, ...pageParams } = queryDto

    const conditions: SQL[] = []

    if (name?.trim()) {
      conditions.push(buildILikeCondition(this.workTag.name, name)!)
    }
    if (isEnabled !== undefined) {
      conditions.push(eq(this.workTag.isEnabled, isEnabled))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const orderBy = pageParams.orderBy?.trim()
      ? pageParams.orderBy
      : { sortOrder: 'asc' as const }

    const page = this.drizzle.buildPage(pageParams)
    const orderQuery = this.drizzle.buildOrderBy(orderBy, {
      table: this.workTag,
    })

    return { orderBySql: orderQuery.orderBySql, page, where }
  }

  // 获取标签详情，未命中时按业务异常处理，避免上层把空结果误当成可编辑标签。
  async getTagDetail(input: IdDto) {
    const tag = await this.db.query.workTag.findFirst({
      where: { id: input.id },
    })
    if (!tag) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '标签不存在',
      )
    }
    return this.toTagOutputDto(tag)
  }

  // 后台获取标签详情；隐藏人气字段，保持后台详情与后台列表合同一致。
  async getAdminTagDetail(input: IdDto) {
    const tag = await this.db.query.workTag.findFirst({
      where: { id: input.id },
      columns: { popularity: false },
    })
    if (!tag) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '标签不存在',
      )
    }
    return this.toAdminTagOutputDto(tag)
  }

  // 更新标签主体字段，该入口只处理基础资料编辑；启用状态切换统一走 `updateTagStatus`，避免约束分散。
  async updateTag(updateTagDto: UpdateTagDto) {
    const { id, ...updateData } = updateTagDto

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workTag)
          .set(updateData)
          .where(eq(this.workTag.id, id)),
      {
        duplicate: '标签名称已存在',
        notFound: '标签不存在',
      },
    )
    return true
  }

  // 交换两个标签的排序值，在事务中使用临时排序值保持单次请求内的原子性。
  async updateTagSort(updateSortDto: UpdateTagSortDto) {
    await this.drizzle.withTransaction(async (tx) => {
      const rows = await tx
        .select({
          id: this.workTag.id,
          sortOrder: this.workTag.sortOrder,
        })
        .from(this.workTag)
        .where(
          inArray(this.workTag.id, [
            updateSortDto.dragId,
            updateSortDto.targetId,
          ]),
        )

      const dragTag = rows.find((row) => row.id === updateSortDto.dragId)
      const targetTag = rows.find((row) => row.id === updateSortDto.targetId)

      if (!dragTag || !targetTag) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '标签不存在',
        )
      }
      if (dragTag.sortOrder === targetTag.sortOrder) {
        return true
      }

      const temporarySortOrder = (await this.resolveMinimumTagSortOrder(tx)) - 1

      await tx
        .update(this.workTag)
        .set({ sortOrder: temporarySortOrder })
        .where(eq(this.workTag.id, dragTag.id))
      await tx
        .update(this.workTag)
        .set({ sortOrder: dragTag.sortOrder })
        .where(eq(this.workTag.id, targetTag.id))
      await tx
        .update(this.workTag)
        .set({ sortOrder: targetTag.sortOrder })
        .where(eq(this.workTag.id, dragTag.id))

      return true
    })
    return true
  }

  // 更新标签启用状态，禁用入口与编辑入口共享同一套“存在关联作品时不可禁用”的完整性约束。
  async updateTagStatus(input: UpdateEnabledStatusDto) {
    if (!input.isEnabled && (await this.checkTagHasWorks(input.id))) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '标签存在关联的作品，不能禁用',
      )
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workTag)
          .set({ isEnabled: input.isEnabled })
          .where(eq(this.workTag.id, input.id)),
      { notFound: '标签不存在' },
    )
    return true
  }

  // 删除单个标签，删除前会校验标签存在且未关联任何未软删作品，避免线上作品标签语义失真。
  async deleteTagBatch(dto: IdDto) {
    if (!(await this.tagExists(dto.id))) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '标签不存在',
      )
    }

    if (await this.checkTagHasWorks(dto.id)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '标签存在关联的作品，不能删除',
      )
    }

    await this.drizzle.withErrorHandling(
      () => this.db.delete(this.workTag).where(eq(this.workTag.id, dto.id)),
      { notFound: '标签不存在' },
    )
    return true
  }

  // 校验标签是否仍关联未软删作品，该约束用于阻止标签被禁用或删除后导致线上作品标签语义失真。
  private async checkTagHasWorks(tagId: number) {
    const rows = await this.db
      .select({ workId: this.workTagRelation.workId })
      .from(this.workTagRelation)
      .innerJoin(this.work, eq(this.work.id, this.workTagRelation.workId))
      .where(
        and(eq(this.workTagRelation.tagId, tagId), isNull(this.work.deletedAt)),
      )
      .limit(1)

    return rows.length > 0
  }

  private async tagExists(tagId: number) {
    const rows = await this.db
      .select({ id: this.workTag.id })
      .from(this.workTag)
      .where(eq(this.workTag.id, tagId))
      .limit(1)

    return rows.length > 0
  }

  private async resolveNextTagSortOrder() {
    const [row] = await this.db
      .select({ value: sql<number>`max(${this.workTag.sortOrder})` })
      .from(this.workTag)

    return row?.value ?? 0
  }

  private async resolveMinimumTagSortOrder(db = this.db) {
    const [row] = await db
      .select({ value: sql<number>`min(${this.workTag.sortOrder})` })
      .from(this.workTag)

    return row?.value ?? 0
  }

  private toTagOutputDto(tag: WorkTagSelect) {
    return {
      ...tag,
      icon: tag.icon ?? null,
      description: tag.description ?? null,
    }
  }

  private toAdminTagOutputDto(tag: WorkTagAdminView) {
    return {
      ...tag,
      icon: tag.icon ?? null,
      description: tag.description ?? null,
    }
  }
}
