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

/**
 * 数据字典服务类
 * 提供字典和字典项的增删改查功能
 */
@Injectable()
export class LibDictionaryService extends BaseService {
  get dictionary() {
    return this.prisma.dictionary
  }

  get dictionaryItem() {
    return this.prisma.dictionaryItem
  }

  // ==================== 字典管理 ====================

  /**
   * 创建数据字典
   */
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

  /**
   * 更新数据字典
   */
  async updateDictionary(dto: UpdateDictionaryDto) {
    await this.checkDictionaryUnique(dto.code, dto.name, dto.id)
    return this.dictionary.update({
      where: { id: dto.id },
      data: dto,
      select: { id: true },
    })
  }

  /**
   * 更新字典状态
   */
  async updateDictionaryStatus(dto: UpdateEnabledStatusDto) {
    await this.ensureDictionaryExists(dto.id)
    return this.dictionary.update({
      where: { id: dto.id },
      data: { isEnabled: dto.isEnabled },
      select: { id: true },
    })
  }

  /**
   * 删除数据字典
   */
  async deleteDictionary(id: number) {
    await this.ensureDictionaryExists(id)
    return this.dictionary.delete({ where: { id }, select: { id: true } })
  }

  /**
   * 分页查询字典列表
   */
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

  // ==================== 字典项管理 ====================

  /**
   * 创建字典项
   */
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

  /**
   * 更新字典项
   */
  async updateDictionaryItem(dto: UpdateDictionaryItemDto) {
    await this.ensureDictionaryItemExists(dto.id)
    await this.checkDictionaryItemUnique(
      dto.dictionaryCode,
      dto.code,
      dto.name,
      dto.id,
    )
    const { id, ...data } = dto
    return this.dictionaryItem.update({
      where: { id },
      data,
      select: { id: true },
    })
  }

  /**
   * 更新字典项状态
   */
  async updateDictionaryItemStatus(dto: UpdateEnabledStatusDto) {
    await this.ensureDictionaryItemExists(dto.id)
    return this.dictionaryItem.update({
      where: { id: dto.id },
      data: { isEnabled: dto.isEnabled },
      select: { id: true },
    })
  }

  /**
   * 删除字典项
   */
  async deleteDictionaryItem(id: number) {
    await this.ensureDictionaryItemExists(id)
    return this.dictionaryItem.delete({
      where: { id },
      select: { id: true },
    })
  }

  /**
   * 分页查询字典项列表
   */
  async findDictionaryItems(queryDto: QueryDictionaryItemDto) {
    const { code, name, dictionaryCode, ...otherDto } = queryDto

    const where: DictionaryItemWhereInput = {
      ...otherDto,
      code: { contains: code },
      name: { contains: name },
    }

    // 仅在有值时添加 dictionaryCode 筛选
    if (dictionaryCode) {
      where.dictionaryCode = { in: dictionaryCode.split(',') }
    }

    return this.dictionaryItem.findPagination({ where })
  }

  /**
   * 获取所有的字典项
   */
  async findAllDictionaryItems(dictionaryCode: string) {
    return this.dictionaryItem.findMany({
      where: { dictionaryCode: { in: dictionaryCode.split(',') } },
    })
  }

  /**
   * 更新字典项排序
   */
  async updateDictionaryItemSort(dto: DragReorderDto) {
    // swapField 内部已做存在性校验，无需额外事务包装
    return this.dictionaryItem.swapField(
      { id: dto.dragId },
      { id: dto.targetId },
      'sortOrder',
    )
  }

  // ==================== 私有方法 ====================

  /**
   * 确保字典存在
   */
  private async ensureDictionaryExists(id: number) {
    if (!(await this.dictionary.exists({ id }))) {
      throw new BadRequestException('字典不存在')
    }
  }

  /**
   * 确保字典项存在
   */
  private async ensureDictionaryItemExists(id: number) {
    if (!(await this.dictionaryItem.exists({ id }))) {
      throw new BadRequestException('字典项不存在')
    }
  }

  /**
   * 检查字典编码和名称唯一性
   */
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

  /**
   * 检查字典项编码和名称唯一性
   */
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
