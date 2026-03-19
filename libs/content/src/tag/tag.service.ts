import { DrizzleService } from '@db/core'
import { DragReorderDto, IdDto } from '@libs/platform/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'
import {
  CreateTagInput,
  QueryTagInput,
  UpdateTagInput,
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

  async createTag(createTagDto: CreateTagInput) {
    if (!createTagDto.sortOrder) {
      createTagDto.sortOrder = (await this.drizzle.ext.maxOrder(this.workTag)) + 1
    }

    const [created] = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .insert(this.workTag)
          .values({
            ...createTagDto,
            popularity: 0,
          })
          .returning({ id: this.workTag.id }),
      { duplicate: 'Tag name already exists' },
    )
    return created
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

    const [updated] = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workTag)
          .set(updateData)
          .where(eq(this.workTag.id, id))
          .returning({ id: this.workTag.id }),
      { duplicate: 'Tag name already exists' },
    )
    this.drizzle.assertAffectedRows(updated ? [updated] : [], 'Tag not found')
    return { id }
  }

  async updateTagSort(updateSortDto: DragReorderDto) {
    return this.drizzle.ext.swapField(this.workTag, {
      where: [{ id: updateSortDto.dragId }, { id: updateSortDto.targetId }],
    })
  }

  async updateTagStatus(id: number, isEnabled: boolean) {
    const [updated] = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workTag)
        .set({ isEnabled })
        .where(eq(this.workTag.id, id))
        .returning({ id: this.workTag.id }),
    )
    this.drizzle.assertAffectedRows(updated ? [updated] : [], 'Tag not found')
    return updated
  }

  async deleteTagBatch(dto: IdDto) {
    if (!(await this.drizzle.ext.exists(this.workTag, eq(this.workTag.id, dto.id)))) {
      throw new BadRequestException('Tag not found')
    }

    if (await this.checkTagHasWorks(dto.id)) {
      throw new BadRequestException('Tag has related works and cannot be deleted')
    }

    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .delete(this.workTag)
        .where(eq(this.workTag.id, dto.id))
        .returning({ id: this.workTag.id }),
    )
    this.drizzle.assertAffectedRows(rows, 'Tag not found')
    return { id: dto.id }
  }

  async checkTagHasWorks(tagId: number) {
    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.workTagRelation)
      .where(eq(this.workTagRelation.tagId, tagId))
    return Number(countRow?.count ?? 0) > 0
  }
}
