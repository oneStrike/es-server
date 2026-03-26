import type { SQL } from 'drizzle-orm'
import { DrizzleService, escapeLikePattern } from '@db/core'
import { jsonParse } from '@libs/platform/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, ilike, isNull, max } from 'drizzle-orm'
import {
  CreateTagInput,
  DeleteTagInput,
  QueryTagInput,
  UpdateTagInput,
  UpdateTagSortInput,
} from './tag.type'

@Injectable()
/**
 * 作品标签领域服务，负责标签的增删改查、排序调整与启用状态维护。
 * 对“禁用/删除”这类会影响线上可见性的操作，统一执行关联作品存在性校验。
 */
export class WorkTagService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  get workTag() {
    return this.drizzle.schema.workTag
  }

  get workTagRelation() {
    return this.drizzle.schema.workTagRelation
  }

  get work() {
    return this.drizzle.schema.work
  }

  async createTag(createTagDto: CreateTagInput) {
    if (!createTagDto.sortOrder) {
      const [result] = await this.db
        .select({
          maxSortOrder: max(this.workTag.sortOrder),
        })
        .from(this.workTag)

      createTagDto.sortOrder = (result?.maxSortOrder || 0) + 1
    }

    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.workTag).values(createTagDto),
      { duplicate: '标签名称已存在' },
    )
    return true
  }

  async getTagPage(queryDto: QueryTagInput) {
    const { name, isEnabled, ...pageParams } = queryDto

    const conditions: SQL[] = []

    if (name?.trim()) {
      conditions.push(ilike(this.workTag.name, `%${escapeLikePattern(name)}%`))
    }
    if (isEnabled !== undefined) {
      conditions.push(eq(this.workTag.isEnabled, isEnabled))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    return this.drizzle.ext.findPagination(this.workTag, {
      where,
      ...pageParams,
      orderBy: pageParams.orderBy || { sortOrder: 'desc' },
    })
  }

  async getTagDetail(id: number) {
    const tag = await this.db.query.workTag.findFirst({
      where: { id },
    })
    if (!tag) {
      throw new BadRequestException('标签不存在')
    }
    return tag
  }

  async updateTag(updateTagDto: UpdateTagInput) {
    const { id, ...updateData } = updateTagDto

    if (updateData.isEnabled === false && (await this.checkTagHasWorks(id))) {
      throw new BadRequestException('标签存在关联的作品，不能禁用')
    }

    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workTag)
          .set(updateData)
          .where(eq(this.workTag.id, id)),
      { duplicate: '标签名称已存在' },
    )
    this.drizzle.assertAffectedRows(result, '标签不存在')
    return true
  }

  async updateTagSort(updateSortDto: UpdateTagSortInput) {
    await this.drizzle.ext.swapField(this.workTag, {
      where: [{ id: updateSortDto.dragId }, { id: updateSortDto.targetId }],
    })
    return true
  }

  async updateTagStatus(id: number, isEnabled: boolean) {
    if (!isEnabled && (await this.checkTagHasWorks(id))) {
      throw new BadRequestException('标签存在关联的作品，不能禁用')
    }

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workTag)
        .set({ isEnabled })
        .where(eq(this.workTag.id, id)),
    )
    this.drizzle.assertAffectedRows(result, '标签不存在')
    return true
  }

  async deleteTagBatch(dto: DeleteTagInput) {
    if (
      !(await this.drizzle.ext.exists(
        this.workTag,
        eq(this.workTag.id, dto.id),
      ))
    ) {
      throw new BadRequestException('标签不存在')
    }

    if (await this.checkTagHasWorks(dto.id)) {
      throw new BadRequestException('标签存在关联的作品，不能删除')
    }

    const rows = await this.drizzle.withErrorHandling(() =>
      this.db.delete(this.workTag).where(eq(this.workTag.id, dto.id)),
    )
    this.drizzle.assertAffectedRows(rows, '标签不存在')
    return true
  }

  /**
   * 校验标签是否仍关联未软删作品。
   * 该约束用于阻止标签被禁用或删除后导致线上作品标签语义失真。
   */
  async checkTagHasWorks(tagId: number) {
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
}
