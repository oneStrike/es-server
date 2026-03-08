import type { DictionaryItemWhereInput } from '@libs/base/database'
import { BaseService } from '@libs/base/database'
import { DragReorderDto, UpdateEnabledStatusDto } from '@libs/base/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateDictionaryDto,
  CreateDictionaryItemDto,
  QueryDictionaryDto,
  QueryDictionaryItemDto,
  UpdateDictionaryDto,
  UpdateDictionaryItemDto,
} from './dto/dictionary.dto'

@Injectable()
export class LibDictionaryService extends BaseService {
  get dictionary() {
    return this.prisma.dictionary
  }

  get dictionaryItem() {
    return this.prisma.dictionaryItem
  }

  async createDictionary(dto: CreateDictionaryDto) {
    await this.checkDictionaryUnique(dto.code, dto.name)
    return this.dictionary.create({
      data: {
        ...dto,
        isEnabled: dto.isEnabled ?? true,
      },
      select: { id: true },
    })
  }

  async updateDictionary(dto: UpdateDictionaryDto) {
    await this.checkDictionaryUnique(dto.code, dto.name, dto.id)
    try {
      return await this.dictionary.update({
        where: { id: dto.id },
        data: dto,
        select: { id: true },
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new BadRequestException('字典不存在')
        },
      })
    }
  }

  async updateDictionaryStatus(dto: UpdateEnabledStatusDto) {
    try {
      return await this.dictionary.update({
        where: { id: dto.id },
        data: { isEnabled: dto.isEnabled },
        select: { id: true },
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new BadRequestException('字典不存在')
        },
      })
    }
  }

  async deleteDictionary(id: number) {
    try {
      return await this.dictionary.delete({ where: { id }, select: { id: true } })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new BadRequestException('字典不存在')
        },
      })
    }
  }

  async findDictionaries(queryDto: QueryDictionaryDto) {
    const { code, name, ...otherDto } = queryDto

    return this.dictionary.findPagination({
      where: {
        code: { contains: code },
        name: { contains: name },
        ...otherDto,
      },
    })
  }

  async createDictionaryItem(dto: CreateDictionaryItemDto) {
    await this.checkDictionaryItemUnique(dto.dictionaryCode, dto.code, dto.name)
    return this.dictionaryItem.create({
      data: {
        ...dto,
        isEnabled: dto.isEnabled ?? true,
      },
      select: { id: true },
    })
  }

  async updateDictionaryItem(dto: UpdateDictionaryItemDto) {
    await this.checkDictionaryItemUnique(
      dto.dictionaryCode,
      dto.code,
      dto.name,
      dto.id,
    )
    const { id, ...data } = dto

    try {
      return await this.dictionaryItem.update({
        where: { id },
        data,
        select: { id: true },
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new BadRequestException('字典项不存在')
        },
      })
    }
  }

  async updateDictionaryItemStatus(dto: UpdateEnabledStatusDto) {
    try {
      return await this.dictionaryItem.update({
        where: { id: dto.id },
        data: { isEnabled: dto.isEnabled },
        select: { id: true },
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new BadRequestException('字典项不存在')
        },
      })
    }
  }

  async deleteDictionaryItem(id: number) {
    try {
      return await this.dictionaryItem.delete({
        where: { id },
        select: { id: true },
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new BadRequestException('字典项不存在')
        },
      })
    }
  }

  async findDictionaryItems(queryDto: QueryDictionaryItemDto) {
    const { code, name, dictionaryCode, ...otherDto } = queryDto

    const where: DictionaryItemWhereInput = {
      ...otherDto,
      code: { contains: code },
      name: { contains: name },
    }

    if (dictionaryCode) {
      where.dictionaryCode = { in: dictionaryCode.split(',') }
    }

    return this.dictionaryItem.findPagination({ where })
  }

  async findAllDictionaryItems(dictionaryCode: string) {
    return this.dictionaryItem.findMany({
      where: { dictionaryCode: { in: dictionaryCode.split(',') } },
    })
  }

  async updateDictionaryItemSort(dto: DragReorderDto) {
    return this.dictionaryItem.swapField({
      where: [{ id: dto.dragId }, { id: dto.targetId }],
      sourceField: 'dictionaryCode',
    })
  }

  private async checkDictionaryUnique(
    code: string,
    name: string,
    excludeId?: number,
  ) {
    const where: any = {
      OR: [{ code }, { name }],
    }
    if (excludeId) {
      where.id = { not: excludeId }
    }

    const existing = await this.dictionary.findFirst({ where })

    if (existing) {
      throw new BadRequestException(
        existing.code === code ? '字典编码已存在' : '字典名称已存在',
      )
    }
  }

  private async checkDictionaryItemUnique(
    dictionaryCode: string,
    code: string,
    name: string,
    excludeId?: number,
  ) {
    const where: any = {
      dictionaryCode,
      OR: [{ code }, { name }],
    }
    if (excludeId) {
      where.NOT = { id: excludeId }
    }

    const existing = await this.dictionaryItem.findFirst({ where })

    if (existing) {
      throw new BadRequestException(
        existing.code === code ? '该字典下编码已存在' : '该字典下名称已存在',
      )
    }
  }
}
