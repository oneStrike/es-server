import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import {
  CreateTagInput,
  DeleteTagInput,
  QueryTagInput,
  UpdateTagInput,
  UpdateTagSortInput,
} from './tag.type'

@Injectable()
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
      createTagDto.sortOrder = (await this.drizzle.ext.maxOrder(this.workTag)) + 1
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .insert(this.workTag)
          .values({
            ...createTagDto,
            popularity: 0,
          }),
      { duplicate: 'Tag name already exists' },
    )
    return true
  }

  async getTagPage(queryDto: QueryTagInput) {
    const { name, isEnabled, ...pageParams } = queryDto

    if (!pageParams.orderBy) {
      pageParams.orderBy = JSON.stringify({ sortOrder: 'desc' })
    }

    const where = this.drizzle.buildWhere(this.workTag, {
      and: {
        name: name ? { like: name } : undefined,
        isEnabled,
      },
    })

    return this.drizzle.ext.findPagination(this.workTag, {
      where,
      ...pageParams,
    })
  }

  async getTagDetail(id: number) {
    const tag = await this.db.query.workTag.findFirst({
      where: { id },
    })
    if (!tag) {
      throw new BadRequestException('Tag not found')
    }
    return tag
  }

  async updateTag(updateTagDto: UpdateTagInput) {
    const { id, ...updateData } = updateTagDto

    if (updateData.isEnabled === false && (await this.checkTagHasWorks(id))) {
      throw new BadRequestException('Tag has related works and cannot be disabled')
    }

    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workTag)
          .set(updateData)
          .where(eq(this.workTag.id, id)),
      { duplicate: 'Tag name already exists' },
    )
    this.drizzle.assertAffectedRows(result, 'Tag not found')
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
      throw new BadRequestException('Tag has related works and cannot be disabled')
    }

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workTag)
        .set({ isEnabled })
        .where(eq(this.workTag.id, id)),
    )
    this.drizzle.assertAffectedRows(result, 'Tag not found')
    return true
  }

  async deleteTagBatch(dto: DeleteTagInput) {
    if (!(await this.drizzle.ext.exists(this.workTag, eq(this.workTag.id, dto.id)))) {
      throw new BadRequestException('Tag not found')
    }

    if (await this.checkTagHasWorks(dto.id)) {
      throw new BadRequestException('Tag has related works and cannot be deleted')
    }

    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .delete(this.workTag)
        .where(eq(this.workTag.id, dto.id)),
    )
    this.drizzle.assertAffectedRows(rows, 'Tag not found')
    return true
  }

  async checkTagHasWorks(tagId: number) {
    const rows = await this.db
      .select({ workId: this.workTagRelation.workId })
      .from(this.workTagRelation)
      .innerJoin(this.work, eq(this.work.id, this.workTagRelation.workId))
      .where(
        and(
          eq(this.workTagRelation.tagId, tagId),
          isNull(this.work.deletedAt),
        ),
      )
      .limit(1)

    return rows.length > 0
  }
}
