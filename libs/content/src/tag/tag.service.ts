import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto/base.dto';
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import {
  CreateTagDto,
  QueryTagDto,
  UpdateTagDto,
  UpdateTagSortDto,
} from './dto/tag.dto'

@Injectable()
/**
 * 作品标签领域服务，负责标签的增删改查、排序调整与启用状态维护。
 * 对“禁用/删除”这类会影响线上可见性的操作，统一执行关联作品存在性校验。
 */
export class WorkTagService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** 标签表。 */
  get workTag() {
    return this.drizzle.schema.workTag
  }

  /** 标签-作品关联表。 */
  get workTagRelation() {
    return this.drizzle.schema.workTagRelation
  }

  /** 作品表。 */
  get work() {
    return this.drizzle.schema.work
  }

  /**
   * 创建标签。
   * 未指定排序值时自动追加到末尾；人气值沿用数据库默认值，由后续互动数据驱动更新。
   */
  async createTag(createTagDto: CreateTagDto) {
    if (!createTagDto.sortOrder) {
      createTagDto.sortOrder =
        (await this.drizzle.ext.maxOrder({
          column: this.workTag.sortOrder,
        })) + 1
    }

    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.workTag).values(createTagDto),
      { duplicate: '标签名称已存在' },
    )
    return true
  }

  /**
   * 分页查询标签。
   * 未显式传入排序时，默认遵循后台维护的 sortOrder 升序。
   */
  async getTagPage(queryDto: QueryTagDto) {
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

    return this.drizzle.ext.findPagination(this.workTag, {
      where,
      ...pageParams,
      orderBy,
    })
  }

  /**
   * 获取标签详情。
   * 未命中时按业务异常处理，避免上层把空结果误当成可编辑标签。
   */
  async getTagDetail(input: IdDto) {
    const tag = await this.db.query.workTag.findFirst({
      where: { id: input.id },
    })
    if (!tag) {
      throw new BadRequestException('标签不存在')
    }
    return tag
  }

  /**
   * 更新标签主体字段。
   * 该入口只处理基础资料编辑；启用状态切换统一走 `updateTagStatus`，避免约束分散。
   */
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

  /**
   * 交换两个标签的排序值。
   * 使用 `swapField` 保证单次请求内的排序更新原子性。
   */
  async updateTagSort(updateSortDto: UpdateTagSortDto) {
    await this.drizzle.ext.swapField(this.workTag, {
      where: [{ id: updateSortDto.dragId }, { id: updateSortDto.targetId }],
    })
    return true
  }

  /**
   * 更新标签启用状态。
   * 禁用入口与编辑入口共享同一套“存在关联作品时不可禁用”的完整性约束。
   */
  async updateTagStatus(input: UpdateEnabledStatusDto) {
    if (!input.isEnabled && (await this.checkTagHasWorks(input.id))) {
      throw new BadRequestException('标签存在关联的作品，不能禁用')
    }

    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workTag)
        .set({ isEnabled: input.isEnabled })
        .where(eq(this.workTag.id, input.id)), { notFound: '标签不存在' },)
    return true
  }

  /**
   * 删除单个标签。
   * 删除前会校验标签存在且未关联任何未软删作品，避免线上作品标签语义失真。
   */
  async deleteTagBatch(dto: IdDto) {
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

    await this.drizzle.withErrorHandling(() =>
      this.db.delete(this.workTag).where(eq(this.workTag.id, dto.id)), { notFound: '标签不存在' },)
    return true
  }

  /**
   * 校验标签是否仍关联未软删作品。
   * 该约束用于阻止标签被禁用或删除后导致线上作品标签语义失真。
   */
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
}
