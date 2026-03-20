import type { SQL } from 'drizzle-orm'
import { DrizzleService } from '@db/core'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { eq, like } from 'drizzle-orm'
import {
  CreateDictionaryInput,
  CreateDictionaryItemInput,
  DictionaryDragReorderInput,
  DictionaryItemPageQueryInput,
  DictionaryPageQueryInput,
  UpdateDictionaryEnabledInput,
  UpdateDictionaryInput,
  UpdateDictionaryItemInput,
} from './dictionary.type'

/**
 * 字典服务
 *
 * 提供字典和字典项的完整管理功能，包括：
 * - 字典的增删改查、状态管理
 * - 字典项的增删改查、状态管理、拖拽排序
 *
 * @class LibDictionaryService
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
   * 构建通用搜索条件
   *
   * @param table - 数据表（字典表或字典项表）
   * @param filters - 查询过滤条件
   * @returns SQL 条件数组
   */
  private buildSearchConditions(
    table: typeof this.dictionary | typeof this.dictionaryItem,
    filters: DictionaryPageQueryInput,
  ) {
    const conditions: SQL[] = []
    if (filters.code) {
      conditions.push(like(table.code, `%${filters.code}%`))
    }
    if (filters.name) {
      conditions.push(like(table.name, `%${filters.name}%`))
    }
    if (filters.isEnabled !== undefined) {
      conditions.push(eq(table.isEnabled, filters.isEnabled))
    }
    return conditions
  }

  /**
   * 解析字典编码字符串
   *
   * 将逗号分隔的字典编码字符串转换为数组
   *
   * @param dictionaryCode - 字典编码字符串，多个编码用逗号分隔
   * @returns 字典编码数组
   * @throws BadRequestException - 当编码为空时抛出
   */
  private parseDictionaryCodes(dictionaryCode?: string) {
    const codes = (dictionaryCode ?? '')
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean)

    if (codes.length === 0) {
      throw new BadRequestException('字典编码不能为空')
    }

    return codes
  }

  /**
   * 断言字典存在
   *
   * @param dictionaryCode - 字典编码
   * @throws BadRequestException - 当字典不存在时抛出
   */
  private async assertDictionaryExists(dictionaryCode: string) {
    const data = await this.db.query.dictionary.findFirst({
      where: { code: dictionaryCode },
      columns: { id: true },
    })

    if (!data) {
      throw new BadRequestException('数据字典不存在')
    }
  }

  /**
   * 分页查询字典列表
   *
   * @param queryDto - 查询条件数据传输对象
   * @returns 分页字典列表
   */
  async findDictionaries(queryDto: DictionaryPageQueryInput) {
    return this.drizzle.ext.findPagination(this.dictionary, {
      where: this.drizzle.buildWhere(this.dictionary, {
        and: {
          isEnabled: queryDto.isEnabled,
          code: { like: queryDto.code },
          name: { like: queryDto.name },
        },
      }),
      ...queryDto,
    })
  }

  /**
   * 根据 ID 查询字典
   *
   * @param id - 字典 ID
   * @returns 字典信息
   * @throws NotFoundException - 当字典不存在时抛出
   */
  async findDictionaryById(id: number) {
    const data = await this.db.query.dictionary.findFirst({
      where: { id },
    })
    if (!data) {
      throw new NotFoundException('字典不存在')
    }
    return data
  }

  /**
   * 创建字典
   *
   * @param dto - 创建字典的数据传输对象
   * @returns 是否成功
   * @throws BadRequestException - 当字典编码或名称已存在时抛出
   */
  async createDictionary(dto: CreateDictionaryInput) {
    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.dictionary).values({
        ...dto,
        isEnabled: dto.isEnabled ?? true,
      }),
    )
    return true
  }

  /**
   * 更新字典
   *
   * @param dto - 更新字典的数据传输对象
   * @returns 是否成功
   * @throws BadRequestException - 当字典不存在或编码/名称冲突时抛出
   */
  async updateDictionary(dto: UpdateDictionaryInput) {
    const { id, ...updateData } = dto
    const data = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.dictionary)
        .set(updateData)
        .where(eq(this.dictionary.id, id)),
    )
    this.drizzle.assertAffectedRows(data, '字典不存在')
    return true
  }

  /**
   * 更新字典启用状态
   *
   * @param dto - 更新状态的数据传输对象
   * @returns 是否成功
   * @throws BadRequestException - 当字典不存在时抛出
   */
  async updateDictionaryStatus(dto: UpdateDictionaryEnabledInput) {
    const data = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.dictionary)
        .set({ isEnabled: dto.isEnabled })
        .where(eq(this.dictionary.id, dto.id)),
    )
    this.drizzle.assertAffectedRows(data, '字典不存在')
    return true
  }

  /**
   * 删除字典
   *
   * @param id - 字典 ID
   * @returns 是否成功
   * @throws BadRequestException - 当字典不存在或仍有关联字典项时抛出
   */
  async deleteDictionary(id: number) {
    const dictionary = await this.findDictionaryById(id)
    const hasItems = await this.db.query.dictionaryItem.findFirst({
      where: { dictionaryCode: dictionary.code },
    })
    if (hasItems) {
      throw new BadRequestException('该字典还有关联字典项，无法删除')
    }

    const data = await this.drizzle.withErrorHandling(() =>
      this.db.delete(this.dictionary).where(eq(this.dictionary.id, id)),
    )
    this.drizzle.assertAffectedRows(data, '字典不存在')
    return true
  }

  /**
   * 分页查询字典项列表
   *
   * @param queryDto - 查询条件数据传输对象
   * @returns 分页字典项列表
   */
  async findDictionaryItems(queryDto: DictionaryItemPageQueryInput) {
    const { dictionaryCode } = queryDto

    return this.drizzle.ext.findPagination(this.dictionaryItem, {
      where: this.drizzle.buildWhere(
        this.dictionaryItem,
        {
          and: {
            code: { like: queryDto.code },
            name: { like: queryDto.name },
            isEnabled: queryDto.isEnabled,
            dictionaryCode: {
              in: this.parseDictionaryCodes(dictionaryCode),
            },
          },
        },
      ),
      ...queryDto,
    })
  }

  /**
   * 根据字典编码查询所有启用的字典项
   *
   * 支持多个字典编码，用逗号分隔
   *
   * @param dictionaryCode - 字典编码，多个用逗号分隔
   * @returns 字典项列表（按排序字段升序）
   */
  async findAllDictionaryItems(dictionaryCode: string) {
    return this.db.query.dictionaryItem.findMany({
      where: {
        isEnabled: true,
        dictionaryCode: { in: this.parseDictionaryCodes(dictionaryCode) },
      },
      orderBy: { sortOrder: 'asc' },
    })
  }

  /**
   * 创建字典项
   *
   * @param dto - 创建字典项的数据传输对象
   * @returns 是否成功
   * @throws BadRequestException - 当同一字典下编码或名称已存在时抛出
   */
  async createDictionaryItem(dto: CreateDictionaryItemInput) {
    await this.assertDictionaryExists(dto.dictionaryCode)
    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.dictionaryItem).values({
        ...dto,
        isEnabled: dto.isEnabled ?? true,
      }),
    )
    return true
  }

  /**
   * 更新字典项
   *
   * @param dto - 更新字典项的数据传输对象
   * @returns 是否成功
   * @throws BadRequestException - 当字典项不存在或编码/名称冲突时抛出
   */
  async updateDictionaryItem(dto: UpdateDictionaryItemInput) {
    await this.assertDictionaryExists(dto.dictionaryCode)
    const { id, ...data } = dto
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.dictionaryItem)
        .set(data)
        .where(eq(this.dictionaryItem.id, id)),
    )

    this.drizzle.assertAffectedRows(result, '字典项不存在')

    return true
  }

  /**
   * 更新字典项启用状态
   *
   * @param dto - 更新状态的数据传输对象
   * @returns 是否成功
   * @throws BadRequestException - 当字典项不存在时抛出
   */
  async updateDictionaryItemStatus(dto: UpdateDictionaryEnabledInput) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.dictionaryItem)
        .set({ isEnabled: dto.isEnabled })
        .where(eq(this.dictionaryItem.id, dto.id)),
    )

    this.drizzle.assertAffectedRows(result, '字典项不存在')
    return true
  }

  /**
   * 更新字典项排序（拖拽排序）
   *
   * 通过交换两条记录的 sortOrder 字段值实现拖拽排序
   *
   * @param dto - 拖拽排序的数据传输对象
   * @returns 排序是否成功
   */
  async updateDictionaryItemSort(dto: DictionaryDragReorderInput) {
    return this.drizzle.ext.swapField(this.dictionaryItem, {
      where: [{ id: dto.dragId }, { id: dto.targetId }],
      sourceField: 'dictionaryCode',
    })
  }

  /**
   * 删除字典项
   *
   * @param id - 字典项 ID
   * @returns 是否成功
   * @throws BadRequestException - 当字典项不存在时抛出
   */
  async deleteDictionaryItem(id: number) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db.delete(this.dictionaryItem).where(eq(this.dictionaryItem.id, id)),
    )
    this.drizzle.assertAffectedRows(result, '字典项不存在')
    return true
  }
}
