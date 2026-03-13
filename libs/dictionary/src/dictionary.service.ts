import type { SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { DrizzleBaseService, DrizzleService } from '@db/drizzle.provider'
import { dictionary, dictionaryItem } from '@db/schema/system/system-dictionary'
import { DbConfig } from '@libs/base/config'
import { DragReorderDto, UpdateEnabledStatusDto } from '@libs/base/dto'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { and, eq, inArray, like, ne, or, sql } from 'drizzle-orm'
import {
  CreateDictionaryDto,
  CreateDictionaryItemDto,
  QueryDictionaryDto,
  QueryDictionaryItemDto,
  UpdateDictionaryDto,
  UpdateDictionaryItemDto,
} from './dto/dictionary.dto'

@Injectable()
export class LibDictionaryService extends DrizzleBaseService<'dictionary'> {
  constructor(@Inject(DrizzleService) drizzleService: DrizzleService) {
    super(drizzleService, 'dictionary')
  }

  async createDictionary(dto: CreateDictionaryDto) {
    await this.checkDictionaryUnique(dto.code, dto.name)
    const [result] = await this.db
      .insert(dictionary)
      .values({
        ...dto,
        isEnabled: dto.isEnabled ?? true,
      })
      .returning({ id: dictionary.id })
    return result
  }

  async updateDictionary(dto: UpdateDictionaryDto) {
    await this.checkDictionaryUnique(dto.code, dto.name, dto.id)
    const [result] = await this.db
      .update(dictionary)
      .set(dto)
      .where(eq(dictionary.id, dto.id))
      .returning({ id: dictionary.id })
    if (!result) {
      throw new BadRequestException('字典不存在')
    }
    return result
  }

  async updateDictionaryStatus(dto: UpdateEnabledStatusDto) {
    const [result] = await this.db
      .update(dictionary)
      .set({ isEnabled: dto.isEnabled })
      .where(eq(dictionary.id, dto.id))
      .returning({ id: dictionary.id })
    if (!result) {
      throw new BadRequestException('字典不存在')
    }
    return result
  }

  async deleteDictionary(id: number) {
    const [result] = await this.db
      .delete(dictionary)
      .where(eq(dictionary.id, id))
      .returning({ id: dictionary.id })
    if (!result) {
      throw new BadRequestException('字典不存在')
    }
    return result
  }

  async findDictionaries(queryDto: QueryDictionaryDto) {
    const { code, name, ...otherDto } = queryDto
    const whereConditions = this.buildDictionaryWhere(code, name, otherDto)
    return this.findPagination(dictionary, whereConditions, otherDto)
  }

  async findDictionaryById(id: number) {
    const [result] = await this.db
      .select()
      .from(dictionary)
      .where(eq(dictionary.id, id))
      .limit(1)
    return result ?? null
  }

  async createDictionaryItem(dto: CreateDictionaryItemDto) {
    await this.checkDictionaryItemUnique(dto.dictionaryCode, dto.code, dto.name)
    const [result] = await this.db
      .insert(dictionaryItem)
      .values({
        ...dto,
        isEnabled: dto.isEnabled ?? true,
      })
      .returning({ id: dictionaryItem.id })
    return result
  }

  async updateDictionaryItem(dto: UpdateDictionaryItemDto) {
    await this.checkDictionaryItemUnique(
      dto.dictionaryCode,
      dto.code,
      dto.name,
      dto.id,
    )
    const { id, ...data } = dto
    const [result] = await this.db
      .update(dictionaryItem)
      .set(data)
      .where(eq(dictionaryItem.id, id))
      .returning({ id: dictionaryItem.id })
    if (!result) {
      throw new BadRequestException('字典项不存在')
    }
    return result
  }

  async updateDictionaryItemStatus(dto: UpdateEnabledStatusDto) {
    const [result] = await this.db
      .update(dictionaryItem)
      .set({ isEnabled: dto.isEnabled })
      .where(eq(dictionaryItem.id, dto.id))
      .returning({ id: dictionaryItem.id })
    if (!result) {
      throw new BadRequestException('字典项不存在')
    }
    return result
  }

  async deleteDictionaryItem(id: number) {
    const [result] = await this.db
      .delete(dictionaryItem)
      .where(eq(dictionaryItem.id, id))
      .returning({ id: dictionaryItem.id })
    if (!result) {
      throw new BadRequestException('字典项不存在')
    }
    return result
  }

  async findDictionaryItems(queryDto: QueryDictionaryItemDto) {
    const { code, name, dictionaryCode, ...otherDto } = queryDto
    const whereConditions = this.buildDictionaryItemWhere(
      code,
      name,
      dictionaryCode,
      otherDto,
    )
    return this.findPagination(dictionaryItem, whereConditions, otherDto)
  }

  async findAllDictionaryItems(dictionaryCode: string) {
    const codes = dictionaryCode.split(',')
    return this.db
      .select()
      .from(dictionaryItem)
      .where(inArray(dictionaryItem.dictionaryCode, codes))
  }

  async updateDictionaryItemSort(dto: DragReorderDto) {
    return this.swapField({
      where: [{ id: dto.dragId }, { id: dto.targetId }],
      sourceField: 'dictionaryCode',
    })
  }

  private buildDictionaryWhere(
    code?: string,
    name?: string,
    otherDto?: Record<string, any>,
  ): SQL | undefined {
    const conditions: SQL[] = []

    if (code) {
      conditions.push(like(dictionary.code, `%${code}%`))
    }
    if (name) {
      conditions.push(like(dictionary.name, `%${name}%`))
    }
    if (otherDto?.isEnabled !== undefined) {
      conditions.push(eq(dictionary.isEnabled, otherDto.isEnabled))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  private buildDictionaryItemWhere(
    code?: string,
    name?: string,
    dictionaryCodes?: string,
    otherDto?: Record<string, any>,
  ): SQL | undefined {
    const conditions: SQL[] = []

    if (code) {
      conditions.push(like(dictionaryItem.code, `%${code}%`))
    }
    if (name) {
      conditions.push(like(dictionaryItem.name, `%${name}%`))
    }
    if (dictionaryCodes) {
      conditions.push(
        inArray(dictionaryItem.dictionaryCode, dictionaryCodes.split(',')),
      )
    }
    if (otherDto?.isEnabled !== undefined) {
      conditions.push(eq(dictionaryItem.isEnabled, otherDto.isEnabled))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  private async findPagination(
    table: PgTable,
    where: SQL | undefined,
    dto: Record<string, any>,
  ) {
    const pageIndex =
      Number(dto.pageIndex) >= 1
        ? Math.floor(Number(dto.pageIndex))
        : DbConfig.query.pageIndex
    const pageSize = Number.isFinite(Number(dto.pageSize))
      ? Math.min(
          Math.max(1, Math.floor(Number(dto.pageSize))),
          DbConfig.query.maxListItemLimit,
        )
      : DbConfig.query.pageSize

    const offset =
      pageIndex >= 1 ? (pageIndex - 1) * pageSize : pageIndex * pageSize

    const tableAsAny = table as any

    const [list, countResult] = await Promise.all([
      this.db
        .select()
        .from(table)
        .where(where)
        .limit(pageSize)
        .offset(offset)
        .orderBy(sql`${tableAsAny.id} DESC`),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(table)
        .where(where),
    ])

    const total = Number(countResult[0]?.count ?? 0)

    return {
      list,
      total,
      pageIndex,
      pageSize,
    }
  }

  private async checkDictionaryUnique(
    code: string,
    name: string,
    excludeId?: number,
  ) {
    const conditions: SQL[] = [
      or(eq(dictionary.code, code), eq(dictionary.name, name))!,
    ]

    if (excludeId) {
      conditions.push(ne(dictionary.id, excludeId))
    }

    const existing = await this.db
      .select()
      .from(dictionary)
      .where(and(...conditions))
      .limit(1)

    if (existing.length > 0) {
      throw new BadRequestException(
        existing[0].code === code ? '字典编码已存在' : '字典名称已存在',
      )
    }
  }

  private async checkDictionaryItemUnique(
    dictionaryCode: string,
    code: string,
    name: string,
    excludeId?: number,
  ) {
    const conditions: SQL[] = [
      eq(dictionaryItem.dictionaryCode, dictionaryCode),
      or(eq(dictionaryItem.code, code), eq(dictionaryItem.name, name))!,
    ]

    if (excludeId) {
      conditions.push(ne(dictionaryItem.id, excludeId))
    }

    const existing = await this.db
      .select()
      .from(dictionaryItem)
      .where(and(...conditions))
      .limit(1)

    if (existing.length > 0) {
      throw new BadRequestException(
        existing[0].code === code ? '该字典下编码已存在' : '该字典下名称已存在',
      )
    }
  }

  private async swapField(options: {
    where: [{ id: number }, { id: number }]
    sourceField?: string
  }): Promise<boolean> {
    const { where, sourceField = 'dictionaryCode' } = options

    return this.db.transaction(async (tx) => {
      const [record1, record2] = await Promise.all([
        tx
          .select()
          .from(dictionaryItem)
          .where(eq(dictionaryItem.id, where[0].id))
          .limit(1),
        tx
          .select()
          .from(dictionaryItem)
          .where(eq(dictionaryItem.id, where[1].id))
          .limit(1),
      ])

      if (!record1[0] || !record2[0]) {
        throw new BadRequestException('数据不存在')
      }

      const r1 = record1[0]
      const r2 = record2[0]

      if (
        sourceField &&
        r1[sourceField as keyof typeof r1] !==
        r2[sourceField as keyof typeof r2]
      ) {
        throw new BadRequestException('数据不是同一来源')
      }

      const sortOrder1 = r1.sortOrder
      const sortOrder2 = r2.sortOrder

      if (sortOrder1 === sortOrder2) {
        return true
      }

      const tempValue = Math.min(sortOrder1 ?? 0, sortOrder2 ?? 0) - 1

      await tx
        .update(dictionaryItem)
        .set({ sortOrder: tempValue })
        .where(eq(dictionaryItem.id, where[0].id))

      await tx
        .update(dictionaryItem)
        .set({ sortOrder: sortOrder1 })
        .where(eq(dictionaryItem.id, where[1].id))

      await tx
        .update(dictionaryItem)
        .set({ sortOrder: sortOrder2 })
        .where(eq(dictionaryItem.id, where[0].id))

      return true
    })
  }
}
