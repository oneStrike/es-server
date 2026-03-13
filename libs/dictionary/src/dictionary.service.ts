import type { SQL } from 'drizzle-orm'
import { DrizzleService } from '@db/drizzle.service'
import { DragReorderDto, UpdateEnabledStatusDto } from '@libs/platform/dto'
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

/**
 * 字典服务
 * 提供字典和字典项的增删改查、状态管理、排序等功能
 */
@Injectable()
export class LibDictionaryService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例 */
  private get db() {
    return this.drizzle.db
  }

  /** 字典表 */
  private get dictionary() {
    return this.drizzle.schema.dictionary
  }

  /** 字典项表 */
  private get dictionaryItem() {
    return this.drizzle.schema.dictionaryItem
  }

  /**
   * 创建字典
   * @param dto - 创建字典的数据传输对象
   * @returns 创建的字典 ID
   * @throws BadRequestException - 当字典编码或名称已存在时抛出
   */
  async createDictionary(dto: CreateDictionaryDto) {
    try {
      // 检查编码和名称的唯一性
      const [result] = await this.db
        .insert(this.dictionary)
        .values({
          ...dto,
          isEnabled: dto.isEnabled ?? true,
        })
        .returning({ id: this.dictionary.id })
      return result
    } catch (error) {
      console.log(
        '🚀 ~ LibDictionaryService ~ createDictionary ~ error:',
        error.cause,
      )
    }
  }

  /**
   * 更新字典
   * @param dto - 更新字典的数据传输对象
   * @returns 更新的字典 ID
   * @throws BadRequestException - 当字典不存在或编码/名称冲突时抛出
   */
  async updateDictionary(dto: UpdateDictionaryDto) {
    // 检查编码和名称的唯一性（排除当前记录）
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

  /**
   * 更新字典启用状态
   * @param dto - 更新状态的数据传输对象
   * @returns 更新的字典 ID
   * @throws BadRequestException - 当字典不存在时抛出
   */
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

  /**
   * 删除字典
   * @param id - 字典 ID
   * @returns 删除的字典 ID
   * @throws BadRequestException - 当字典不存在时抛出
   */
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

  /**
   * 分页查询字典列表
   * @param queryDto - 查询条件数据传输对象
   * @returns 分页字典列表
   */
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
    // 构建查询条件
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

  /**
   * 根据 ID 查询字典
   * @param id - 字典 ID
   * @returns 字典信息，不存在返回 null
   */
  async findDictionaryById(id: number) {
    const [result] = await this.db
      .select()
      .from(this.dictionary)
      .where(eq(this.dictionary.id, id))
      .limit(1)
    return result ?? null
  }

  /**
   * 创建字典项
   * @param dto - 创建字典项的数据传输对象
   * @returns 创建的字典项 ID
   * @throws BadRequestException - 当同一字典下编码或名称已存在时抛出
   */
  async createDictionaryItem(dto: CreateDictionaryItemDto) {
    // 检查同一字典下编码和名称的唯一性
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

  /**
   * 更新字典项
   * @param dto - 更新字典项的数据传输对象
   * @returns 更新的字典项 ID
   * @throws BadRequestException - 当字典项不存在或编码/名称冲突时抛出
   */
  async updateDictionaryItem(dto: UpdateDictionaryItemDto) {
    // 检查同一字典下编码和名称的唯一性（排除当前记录）
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

  /**
   * 更新字典项启用状态
   * @param dto - 更新状态的数据传输对象
   * @returns 更新的字典项 ID
   * @throws BadRequestException - 当字典项不存在时抛出
   */
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

  /**
   * 删除字典项
   * @param id - 字典项 ID
   * @returns 删除的字典项 ID
   * @throws BadRequestException - 当字典项不存在时抛出
   */
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

  /**
   * 分页查询字典项列表
   * @param queryDto - 查询条件数据传输对象
   * @returns 分页字典项列表
   */
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
    // 构建查询条件
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

  /**
   * 根据字典编码查询所有字典项
   * 支持多个字典编码，用逗号分隔
   * @param dictionaryCode - 字典编码，多个用逗号分隔
   * @returns 字典项列表
   */
  async findAllDictionaryItems(dictionaryCode: string) {
    return this.db
      .select()
      .from(this.dictionaryItem)
      .where(
        and(
          inArray(
            this.dictionaryItem.dictionaryCode,
            dictionaryCode.split(','),
          ),
          eq(this.dictionaryItem.isEnabled, true),
        ),
      )
  }

  /**
   * 更新字典项排序（拖拽排序）
   * @param dto - 拖拽排序的数据传输对象
   * @returns 排序是否成功
   */
  async updateDictionaryItemSort(dto: DragReorderDto) {
    // 使用 swapField 交换两条记录的 sortOrder 字段值
    // sourceField 确保只有同一字典下的项才能交换顺序
    return this.drizzle.ext.swapField(this.dictionaryItem, {
      where: [{ id: dto.dragId }, { id: dto.targetId }],
      sourceField: 'dictionaryCode',
    })
  }

  /**
   * 构建字典查询条件
   * @param code - 字典编码（模糊查询）
   * @param name - 字典名称（模糊查询）
   * @param otherDto - 其他查询条件
   * @returns 组合后的 SQL 查询条件
   */
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
    conditions.push(eq(this.dictionary.isEnabled, otherDto?.isEnabled))
    return conditions.length > 0 ? and(...conditions) : undefined
  }

  /**
   * 构建字典项查询条件
   * @param code - 字典项编码（模糊查询）
   * @param name - 字典项名称（模糊查询）
   * @param dictionaryCodes - 字典编码列表（逗号分隔）
   * @param otherDto - 其他查询条件
   * @returns 组合后的 SQL 查询条件
   */
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

  /**
   * 检查字典编码和名称的唯一性
   * @param code - 字典编码
   * @param name - 字典名称
   * @param excludeId - 排除的记录 ID（用于更新时排除自身）
   * @throws BadRequestException - 当编码或名称已存在时抛出
   */
  private async checkDictionaryUnique(
    code: string,
    name: string,
    excludeId?: number,
  ) {
    const baseConditions: SQL[] = []
    // 如果指定了 excludeId，则排除该记录（用于更新场景）
    if (excludeId) {
      baseConditions.push(ne(this.dictionary.id, excludeId))
    }

    // 检查编码是否已存在
    const codeExists = await this.drizzle.ext.exists(
      this.dictionary,
      and(eq(this.dictionary.code, code), ...baseConditions),
    )
    if (codeExists) {
      throw new BadRequestException('字典编码已存在')
    }

    // 检查名称是否已存在
    const nameExists = await this.drizzle.ext.exists(
      this.dictionary,
      and(eq(this.dictionary.name, name), ...baseConditions),
    )
    if (nameExists) {
      throw new BadRequestException('字典名称已存在')
    }
  }

  /**
   * 检查字典项编码和名称的唯一性（同一字典内）
   * @param dictionaryCode - 所属字典编码
   * @param code - 字典项编码
   * @param name - 字典项名称
   * @param excludeId - 排除的记录 ID（用于更新时排除自身）
   * @throws BadRequestException - 当编码或名称在同一字典下已存在时抛出
   */
  private async checkDictionaryItemUnique(
    dictionaryCode: string,
    code: string,
    name: string,
    excludeId?: number,
  ) {
    // 基础条件：必须在同一字典下
    const baseConditions: SQL[] = [
      eq(this.dictionaryItem.dictionaryCode, dictionaryCode),
    ]

    // 如果指定了 excludeId，则排除该记录（用于更新场景）
    if (excludeId) {
      baseConditions.push(ne(this.dictionaryItem.id, excludeId))
    }

    // 检查编码是否已存在
    const codeExists = await this.drizzle.ext.exists(
      this.dictionaryItem,
      and(...baseConditions, eq(this.dictionaryItem.code, code)),
    )
    if (codeExists) {
      throw new BadRequestException('该字典下编码已存在')
    }

    // 检查名称是否已存在
    const nameExists = await this.drizzle.ext.exists(
      this.dictionaryItem,
      and(...baseConditions, eq(this.dictionaryItem.name, name)),
    )
    if (nameExists) {
      throw new BadRequestException('该字典下名称已存在')
    }
  }
}
