import type { SQL } from 'drizzle-orm'
import { DrizzleService } from '@db/drizzle.service'
import { DragReorderDto, UpdateEnabledStatusDto } from '@libs/base/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, inArray, like, ne } from 'drizzle-orm'
import {
  CreateDictionaryDto,
  CreateDictionaryItemDto,
  QueryDictionaryDto,
  QueryDictionaryItemDto,
  UpdateDictionaryDto,
  UpdateDictionaryItemDto,
} from './dto/dictionary.dto'

@Injectable()
export class LibDictionaryService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get dictionary() {
    return this.drizzle.schema.dictionary
  }

  private get dictionaryItem() {
    return this.drizzle.schema.dictionaryItem
  }

  async createDictionary(dto: CreateDictionaryDto) {
    await this.checkDictionaryUnique(dto.code, dto.name)
    const [result] = await this.db
      .insert(this.dictionary)
      .values({
        ...dto,
        isEnabled: dto.isEnabled ?? true,
      })
      .returning({ id: this.dictionary.id })
    return result
  }

  async updateDictionary(dto: UpdateDictionaryDto) {
    await this.checkDictionaryUnique(dto.code, dto.name, dto.id)
    const [result] = await this.db
      .update(this.dictionary)
      .set(dto)
      .where(eq(this.dictionary.id, dto.id))
      .returning({ id: this.dictionary.id })
    if (!result) {
      throw new BadRequestException('字典不存在')
    }
    return result
  }

  async updateDictionaryStatus(dto: UpdateEnabledStatusDto) {
    const [result] = await this.db
      .update(this.dictionary)
      .set({ isEnabled: dto.isEnabled })
      .where(eq(this.dictionary.id, dto.id))
      .returning({ id: this.dictionary.id })
    if (!result) {
      throw new BadRequestException('字典不存在')
    }
    return result
  }

  async deleteDictionary(id: number) {
    const [result] = await this.db
      .delete(this.dictionary)
      .where(eq(this.dictionary.id, id))
      .returning({ id: this.dictionary.id })
    if (!result) {
      throw new BadRequestException('字典不存在')
    }
    return result
  }

  async findDictionaries(queryDto: QueryDictionaryDto) {
    const {
      code,
      name,
      pageIndex,
      pageSize,
      startDate,
      endDate,
      orderBy,
      ...otherDto
    } = queryDto
    const whereConditions = this.buildDictionaryWhere(code, name, otherDto)
    return this.drizzle.ext.findPagination(this.dictionary, {
      where: whereConditions,
      pageIndex,
      pageSize,
      startDate,
      endDate,
      orderBy,
    })
  }

  async findDictionaryById(id: number) {
    const [result] = await this.db
      .select()
      .from(this.dictionary)
      .where(eq(this.dictionary.id, id))
      .limit(1)
    return result ?? null
  }

  async createDictionaryItem(dto: CreateDictionaryItemDto) {
    await this.checkDictionaryItemUnique(dto.dictionaryCode, dto.code, dto.name)
    const [result] = await this.db
      .insert(this.dictionaryItem)
      .values({
        ...dto,
        isEnabled: dto.isEnabled ?? true,
      })
      .returning({ id: this.dictionaryItem.id })
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
      .update(this.dictionaryItem)
      .set(data)
      .where(eq(this.dictionaryItem.id, id))
      .returning({ id: this.dictionaryItem.id })
    if (!result) {
      throw new BadRequestException('字典项不存在')
    }
    return result
  }

  async updateDictionaryItemStatus(dto: UpdateEnabledStatusDto) {
    const [result] = await this.db
      .update(this.dictionaryItem)
      .set({ isEnabled: dto.isEnabled })
      .where(eq(this.dictionaryItem.id, dto.id))
      .returning({ id: this.dictionaryItem.id })
    if (!result) {
      throw new BadRequestException('字典项不存在')
    }
    return result
  }

  async deleteDictionaryItem(id: number) {
    const [result] = await this.db
      .delete(this.dictionaryItem)
      .where(eq(this.dictionaryItem.id, id))
      .returning({ id: this.dictionaryItem.id })
    if (!result) {
      throw new BadRequestException('字典项不存在')
    }
    return result
  }

  async findDictionaryItems(queryDto: QueryDictionaryItemDto) {
    const {
      code,
      name,
      dictionaryCode,
      pageIndex,
      pageSize,
      orderBy,
      ...otherDto
    } = queryDto
    const whereConditions = this.buildDictionaryItemWhere(
      code,
      name,
      dictionaryCode,
      otherDto,
    )
    return this.drizzle.ext.findPagination(this.dictionaryItem, {
      where: whereConditions,
      pageIndex,
      pageSize,
      orderBy,
    })
  }

  async findAllDictionaryItems(dictionaryCode: string) {
    const codes = dictionaryCode.split(',')
    return this.db
      .select()
      .from(this.dictionaryItem)
      .where(inArray(this.dictionaryItem.dictionaryCode, codes))
  }

  async updateDictionaryItemSort(dto: DragReorderDto) {
    return this.drizzle.ext.swapField(this.dictionaryItem, {
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
      conditions.push(like(this.dictionary.code, `%${code}%`))
    }
    if (name) {
      conditions.push(like(this.dictionary.name, `%${name}%`))
    }
    if (otherDto?.isEnabled !== undefined) {
      conditions.push(eq(this.dictionary.isEnabled, otherDto.isEnabled))
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
      conditions.push(like(this.dictionaryItem.code, `%${code}%`))
    }
    if (name) {
      conditions.push(like(this.dictionaryItem.name, `%${name}%`))
    }
    if (dictionaryCodes) {
      conditions.push(
        inArray(this.dictionaryItem.dictionaryCode, dictionaryCodes.split(',')),
      )
    }
    if (otherDto?.isEnabled !== undefined) {
      conditions.push(eq(this.dictionaryItem.isEnabled, otherDto.isEnabled))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  private async checkDictionaryUnique(
    code: string,
    name: string,
    excludeId?: number,
  ) {
    const baseConditions: SQL[] = []
    if (excludeId) {
      baseConditions.push(ne(this.dictionary.id, excludeId))
    }

    const codeExists = await this.drizzle.ext.exists(
      this.dictionary,
      and(eq(this.dictionary.code, code), ...baseConditions),
    )
    if (codeExists) {
      throw new BadRequestException('字典编码已存在')
    }

    const nameExists = await this.drizzle.ext.exists(
      this.dictionary,
      and(eq(this.dictionary.name, name), ...baseConditions),
    )
    if (nameExists) {
      throw new BadRequestException('字典名称已存在')
    }
  }

  private async checkDictionaryItemUnique(
    dictionaryCode: string,
    code: string,
    name: string,
    excludeId?: number,
  ) {
    const baseConditions: SQL[] = [
      eq(this.dictionaryItem.dictionaryCode, dictionaryCode),
    ]

    if (excludeId) {
      baseConditions.push(ne(this.dictionaryItem.id, excludeId))
    }

    const codeExists = await this.drizzle.ext.exists(
      this.dictionaryItem,
      and(...baseConditions, eq(this.dictionaryItem.code, code)),
    )
    if (codeExists) {
      throw new BadRequestException('该字典下编码已存在')
    }

    const nameExists = await this.drizzle.ext.exists(
      this.dictionaryItem,
      and(...baseConditions, eq(this.dictionaryItem.name, name)),
    )
    if (nameExists) {
      throw new BadRequestException('该字典下名称已存在')
    }
  }
}
