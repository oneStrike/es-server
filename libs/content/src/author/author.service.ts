import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import {
  CreateAuthorDto,
  QueryAuthorDto,
  UpdateAuthorDto,
} from './dto/author.dto'

/**
 * 作者服务类
 * 提供作者的增删改查等核心业务逻辑
 */
@Injectable()
export class WorkAuthorService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  get workAuthor() {
    return this.drizzle.schema.workAuthor
  }

  /**
   * 创建作者
   * @param createAuthorDto 创建作者的数据
   * @returns 创建的作者信息
   */
  async createAuthor(createAuthorDto: CreateAuthorDto) {
    const [created] = await this.db
      .insert(this.workAuthor)
      .values(createAuthorDto)
      .returning()
    return created
  }

  /**
   * 分页查询作者列表
   * @param queryAuthorDto 查询条件
   * @returns 分页作者列表
   */
  async getAuthorPage(queryAuthorDto: QueryAuthorDto) {
    const {
      name,
      isEnabled,
      nationality,
      gender,
      isRecommended,
      type,
      ...pageDto
    } = queryAuthorDto

    const baseWhere = this.drizzle.buildWhere(this.workAuthor, {
      and: {
        deletedAt: { isNull: true },
        isEnabled,
        nationality,
        gender,
        isRecommended,
        name: name ? { like: name } : undefined,
      },
    })

    let where = baseWhere
    if (type && type !== '[]') {
      const values = JSON.parse(type) as number[]
      if (values.length > 0) {
        const typeArray = sql`ARRAY[${sql.join(values.map((v) => sql`${v}`), sql`, `)}]::smallint[]`
        where = and(where, sql`${this.workAuthor.type} @> ${typeArray}`)
      }
    }

    return this.drizzle.ext.findPagination(this.workAuthor, {
      where,
      ...pageDto,
      omit: ['remark', 'description', 'deletedAt'],
    })
  }

  /**
   * 获取作者详情
   * @param id 作者ID
   * @returns 作者详情信息
   */
  async getAuthorDetail(id: number) {
    const author = await this.db.query.workAuthor.findFirst({
      where: { id, deletedAt: { isNull: true } },
    })

    if (!author) {
      throw new BadRequestException('作者不存在')
    }

    return author
  }

  /**
   * 更新作者信息
   * @param updateAuthorDto 更新作者的数据
   * @returns 更新后的作者信息
   */
  async updateAuthor(updateAuthorDto: UpdateAuthorDto) {
    const { id, ...updateData } = updateAuthorDto

    // 验证作者是否存在
    const existingAuthor = await this.db.query.workAuthor.findFirst({
      where: { id, deletedAt: { isNull: true } },
    })
    if (!existingAuthor) {
      throw new BadRequestException('作者不存在')
    }

    // 更新作者信息
    const [updated] = await this.db
      .update(this.workAuthor)
      .set(updateData)
      .where(and(eq(this.workAuthor.id, id), isNull(this.workAuthor.deletedAt)))
      .returning()
    return updated
  }

  async updateAuthorStatus(id: number, isEnabled: boolean) {
    const [updated] = await this.db
      .update(this.workAuthor)
      .set({ isEnabled })
      .where(and(eq(this.workAuthor.id, id), isNull(this.workAuthor.deletedAt)))
      .returning({ id: this.workAuthor.id })
    this.drizzle.assertAffectedRows(updated ? [updated] : [], '作者不存在')
    return updated
  }

  async updateAuthorRecommended(id: number, isRecommended: boolean) {
    const [updated] = await this.db
      .update(this.workAuthor)
      .set({ isRecommended })
      .where(and(eq(this.workAuthor.id, id), isNull(this.workAuthor.deletedAt)))
      .returning({ id: this.workAuthor.id })
    this.drizzle.assertAffectedRows(updated ? [updated] : [], '作者不存在')
    return updated
  }

  /**
   * 软删除作者
   * @param id 作者ID
   * @returns 删除结果
   */
  async deleteAuthor(id: number) {
    // 验证作者是否存在
    const existingAuthor = await this.db.query.workAuthor.findFirst({
      where: { id, deletedAt: { isNull: true } },
    })
    if (!existingAuthor) {
      throw new BadRequestException('作者不存在')
    }
    if (existingAuthor.workCount && existingAuthor.workCount > 0) {
      throw new BadRequestException(
        `该作者还有 ${existingAuthor.workCount} 个关联作品，无法删除`,
      )
    }

    const [deleted] = await this.db
      .update(this.workAuthor)
      .set({ deletedAt: new Date() })
      .where(and(eq(this.workAuthor.id, id), isNull(this.workAuthor.deletedAt)))
      .returning()
    return deleted
  }
}
