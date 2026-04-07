import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import {
  AssignForumTagToTopicDto,
  CreateForumTagDto,
  QueryForumTagDto,
  UpdateForumTagDto,
} from './dto/forum-tag.dto'

/**
 * 论坛标签服务类
 * 提供对论坛标签的增删改查、标签与主题的关联管理等操作
 */
@Injectable()
export class ForumTagService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  /**
   * 获取标签的 数据模型
   */
  get forumTag() {
    return this.drizzle.schema.forumTag
  }

  /**
   * 获取主题的 数据模型
   */
  get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  /**
   * 获取主题标签关联的 数据模型
   */
  get forumTopicTag() {
    return this.drizzle.schema.forumTopicTag
  }

  private async checkTagHasTopics(id: number) {
    const rows = await this.db
      .select({ topicId: this.forumTopicTag.topicId })
      .from(this.forumTopicTag)
      .innerJoin(
        this.forumTopic,
        eq(this.forumTopic.id, this.forumTopicTag.topicId),
      )
      .where(
        and(
          eq(this.forumTopicTag.tagId, id),
          isNull(this.forumTopic.deletedAt),
        ),
      )
      .limit(1)

    return rows.length > 0
  }

  /**
   * 创建新的论坛标签
   * @param createForumTagDto 创建标签的数据传输对象
   * @returns 创建成功的标签
   * @throws BadRequestException 如果标签名称已存在
   */
  async createTag(createForumTagDto: CreateForumTagDto) {
    const { name, ...tagData } = createForumTagDto

    const existingTag = await this.db.query.forumTag.findFirst({
      where: { name },
    })

    if (existingTag) {
      throw new BadRequestException('该标签名称已存在')
    }

    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.forumTag).values({
        ...tagData,
        name,
      }),
    )
    return true
  }

  /**
   * 查询论坛标签列表（支持分页）
   * @param queryForumTagDto 查询条件的数据传输对象
   * @returns 分页后的标签列表
   */
  async getTags(queryForumTagDto: QueryForumTagDto) {
    const { name, isEnabled } = queryForumTagDto

    const conditions: SQL[] = []

    if (isEnabled !== undefined) {
      conditions.push(eq(this.forumTag.isEnabled, isEnabled))
    }
    if (name) {
      conditions.push(buildILikeCondition(this.forumTag.name, name)!)
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const orderBy = queryForumTagDto.orderBy?.trim()
      ? queryForumTagDto.orderBy
      : { sortOrder: 'asc' as const }

    const page = await this.drizzle.ext.findPagination(this.forumTag, {
      where,
      ...queryForumTagDto,
      orderBy,
    })
    const tagIds = page.list.map((item) => item.id)
    const countRows = tagIds.length
      ? await this.db
          .select({
            tagId: this.forumTopicTag.tagId,
            count: sql<number>`count(*)`,
          })
          .from(this.forumTopicTag)
          .where(inArray(this.forumTopicTag.tagId, tagIds))
          .groupBy(this.forumTopicTag.tagId)
      : []
    const countMap = new Map(
      countRows.map((row) => [row.tagId, Number(row.count)]),
    )
    return {
      ...page,
      list: page.list.map((item) => ({
        ...item,
        _count: {
          topicTags: countMap.get(item.id) ?? 0,
        },
      })),
    }
  }

  /**
   * 根据ID获取论坛标签详情
   * @param id 标签ID
   * @returns 标签详情，包含最近使用该标签的主题
   * @throws NotFoundException 如果标签不存在
   */
  async getTagById(id: number) {
    const tag = await this.db.query.forumTag.findFirst({
      where: { id },
    })

    if (!tag) {
      throw new NotFoundException('标签不存在')
    }

    const topicRows = await this.db
      .select({
        id: this.forumTopic.id,
        title: this.forumTopic.title,
        createdAt: this.forumTopic.createdAt,
      })
      .from(this.forumTopicTag)
      .innerJoin(
        this.forumTopic,
        eq(this.forumTopic.id, this.forumTopicTag.topicId),
      )
      .where(
        and(
          eq(this.forumTopicTag.tagId, id),
          isNull(this.forumTopic.deletedAt),
        ),
      )
      .orderBy(
        desc(this.forumTopicTag.createdAt),
        asc(this.forumTopicTag.topicId),
      )
      .limit(10)

    return {
      ...tag,
      topics: topicRows,
    }
  }

  /**
   * 更新论坛标签信息
   * @param updateForumTagDto 更新标签的数据传输对象
   * @returns 更新后的标签
   * @throws NotFoundException 如果标签不存在
   * @throws BadRequestException 如果标签名称已存在
   */
  async updateTag(updateForumTagDto: UpdateForumTagDto) {
    const { id, name, ...updateData } = updateForumTagDto

    const tag = await this.db.query.forumTag.findFirst({ where: { id } })

    if (!tag) {
      throw new NotFoundException('标签不存在')
    }

    if (name) {
      const existingTag = await this.db.query.forumTag.findFirst({
        where: { name },
      })

      if (existingTag && existingTag.id !== id) {
        throw new BadRequestException('该标签名称已存在')
      }
    }

    if (updateData.isEnabled === false && (await this.checkTagHasTopics(id))) {
      throw new BadRequestException('该标签已被使用，无法禁用')
    }

    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.forumTag)
        .set({ name, ...updateData })
        .where(eq(this.forumTag.id, id)), { notFound: '标签不存在' },)
    return true
  }

  /**
   * 删除论坛标签
   * @param id 标签ID
   * @returns 删除操作结果
   * @throws NotFoundException 如果标签不存在
   * @throws BadRequestException 如果标签已被使用
   */
  async deleteTag(id: number) {
    const tag = await this.db.query.forumTag.findFirst({ where: { id } })

    if (!tag) {
      throw new NotFoundException('标签不存在')
    }

    if (await this.checkTagHasTopics(id)) {
      throw new BadRequestException('该标签已被使用，无法删除')
    }

    await this.drizzle.withErrorHandling(() =>
      this.db.delete(this.forumTag).where(eq(this.forumTag.id, id)), { notFound: '标签不存在' },)

    return true
  }

  /**
   * 为主题分配标签
   * @param assignTagToTopicDto 分配标签的数据传输对象
   * @returns 创建的主题标签关联
   * @throws NotFoundException 如果主题或标签不存在
   * @throws BadRequestException 如果标签未启用或已关联
   */
  async assignTagToTopic(assignTagToTopicDto: AssignForumTagToTopicDto) {
    const { topicId, tagId } = assignTagToTopicDto

    const topic = await this.db.query.forumTopic.findFirst({
      where: { id: topicId, deletedAt: { isNull: true } },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const tag = await this.db.query.forumTag.findFirst({ where: { id: tagId } })

    if (!tag) {
      throw new NotFoundException('标签不存在')
    }

    if (!tag.isEnabled) {
      throw new BadRequestException('该标签未启用')
    }

    const existingRelation = await this.db.query.forumTopicTag.findFirst({
      where: { topicId, tagId },
    })

    if (existingRelation) {
      throw new BadRequestException('该主题已关联此标签')
    }

    // 关联关系与使用次数同步更新
    return this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        await tx.insert(this.forumTopicTag).values({
          topicId,
          tagId,
        })
        const rows = await tx
          .update(this.forumTag)
          .set({ useCount: sql`${this.forumTag.useCount} + 1` })
          .where(eq(this.forumTag.id, tagId))
        this.drizzle.assertAffectedRows(rows, '标签不存在')
        return true
      }),
    )
  }

  /**
   * 从主题移除标签
   * @param removeTagFromTopicDto 移除标签的数据传输对象
   * @returns 移除操作结果
   * @throws NotFoundException 如果主题未关联该标签
   */
  async removeTagFromTopic(
    removeTagFromTopicDto: AssignForumTagToTopicDto,
  ) {
    const { topicId, tagId } = removeTagFromTopicDto

    const topicTag = await this.db.query.forumTopicTag.findFirst({
      where: { topicId, tagId },
    })

    if (!topicTag) {
      throw new NotFoundException('该主题未关联此标签')
    }

    // 解除关联并回收使用次数
    return this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        await tx
          .delete(this.forumTopicTag)
          .where(
            and(
              eq(this.forumTopicTag.topicId, topicId),
              eq(this.forumTopicTag.tagId, tagId),
            ),
          )
        const rows = await tx
          .update(this.forumTag)
          .set({ useCount: sql`${this.forumTag.useCount} - 1` })
          .where(eq(this.forumTag.id, tagId))
        this.drizzle.assertAffectedRows(rows, '标签不存在')
        return true
      }),
    )
  }

  /**
   * 获取主题的所有标签
   * @param topicId 主题ID
   * @returns 主题关联的标签列表
   * @throws NotFoundException 如果主题不存在
   */
  async getTopicTags(topicId: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: { id: topicId, deletedAt: { isNull: true } },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    return this.db
      .select({
        id: this.forumTag.id,
        name: this.forumTag.name,
        icon: this.forumTag.icon,
        description: this.forumTag.description,
        isEnabled: this.forumTag.isEnabled,
        useCount: this.forumTag.useCount,
        sortOrder: this.forumTag.sortOrder,
        createdAt: this.forumTag.createdAt,
        updatedAt: this.forumTag.updatedAt,
      })
      .from(this.forumTopicTag)
      .innerJoin(this.forumTag, eq(this.forumTag.id, this.forumTopicTag.tagId))
      .where(eq(this.forumTopicTag.topicId, topicId))
      .orderBy(asc(this.forumTag.sortOrder), asc(this.forumTag.id))
  }

  /**
   * 获取热门标签
   * @param limit 返回的标签数量，默认为10
   * @returns 热门标签列表，按使用次数降序排列
   */
  async getPopularTags(limit = 10) {
    return this.db.query.forumTag.findMany({
      where: {
        isEnabled: true,
      },
      orderBy: (tag, { desc }) => [desc(tag.useCount)],
      limit,
    })
  }

  /**
   * 获取启用的标签列表
   * @returns 启用的标签列表，按排序值升序排列
   */
  async getEnabledTags() {
    return this.db.query.forumTag.findMany({
      where: {
        isEnabled: true,
      },
      orderBy: (tag, { asc }) => [asc(tag.sortOrder), asc(tag.id)],
    })
  }
}
