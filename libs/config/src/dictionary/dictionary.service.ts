import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto/base.dto';
import { DragReorderDto } from '@libs/platform/dto/drag-reorder.dto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, eq, inArray } from 'drizzle-orm'
import {
  CreateDictionaryDto,
  CreateDictionaryItemDto,
  QueryAllDictionaryItemDto,
  QueryDictionaryDto,
  QueryDictionaryItemDto,
  UpdateDictionaryDto,
  UpdateDictionaryItemDto,
} from './dto/dictionary.dto'

/**
 * 字典服务
 *
 * 负责字典与字典项的查询、写入、状态切换和排序维护。
 */
@Injectable()
export class LibDictionaryService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例 */
  private get db() {
    return this.drizzle.db
  }

  /** 字典表 */
  private get systemDictionary() {
    return this.drizzle.schema.systemDictionary
  }

  /** 字典项表 */
  private get systemDictionaryItem() {
    return this.drizzle.schema.systemDictionaryItem
  }

  /**
   * 根据分页查询 DTO 组装通用筛选条件。
   * 字典与字典项列表都复用同一套名称、编码、启用状态过滤逻辑，避免两处条件分叉。
   */
  private buildSearchConditions(
    table: typeof this.systemDictionary | typeof this.systemDictionaryItem,
    filters: QueryDictionaryDto | QueryDictionaryItemDto,
  ) {
    const conditions: SQL[] = []
    if (filters.code) {
      conditions.push(buildILikeCondition(table.code, filters.code)!)
    }
    if (filters.name) {
      conditions.push(buildILikeCondition(table.name, filters.name)!)
    }
    if (filters.isEnabled !== undefined) {
      conditions.push(eq(table.isEnabled, filters.isEnabled))
    }
    return conditions
  }

  /**
   * 解析逗号分隔的字典编码列表。
   * app/public 侧允许一次查询多个字典编码；若最终没有有效编码，直接按业务异常处理。
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
   * 断言目标字典编码存在，避免字典项写入到悬空父级。
   */
  private async assertDictionaryExists(dictionaryCode: string) {
    const data = await this.db.query.systemDictionary.findFirst({
      where: { code: dictionaryCode },
      columns: { id: true },
    })

    if (!data) {
      throw new BadRequestException('数据字典不存在')
    }
  }

  /**
   * 分页查询字典列表。
   */
  async findDictionaries(queryDto: QueryDictionaryDto) {
    const conditions = this.buildSearchConditions(this.systemDictionary, queryDto)

    return this.drizzle.ext.findPagination(this.systemDictionary, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      ...queryDto,
    })
  }

  /**
   * 按主键查询字典详情，未命中时抛出 `NotFoundException`。
   */
  async findDictionaryById(dto: IdDto) {
    const data = await this.db.query.systemDictionary.findFirst({
      where: { id: dto.id },
    })
    if (!data) {
      throw new NotFoundException('字典不存在')
    }
    return data
  }

  /**
   * 创建字典。
   * 未显式传入 `isEnabled` 时默认启用，唯一约束异常统一由 `withErrorHandling` 转换。
   */
  async createDictionary(dto: CreateDictionaryDto) {
    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.systemDictionary).values({
        ...dto,
        isEnabled: dto.isEnabled ?? true,
      }),
    )
    return true
  }

  /**
   * 更新字典主体字段。
   * 当字典编码发生变更时，会在同一事务内同步刷新所有子项的 `dictionaryCode`，避免父子关系失联。
   */
  async updateDictionary(dto: UpdateDictionaryDto) {
    const { id, code, ...otherUpdateData } = dto

    await this.drizzle.withTransaction(async (tx) => {
      const currentDictionary = await tx.query.systemDictionary.findFirst({
        where: { id },
        columns: { code: true },
      })

      if (!currentDictionary) {
        throw new NotFoundException('字典不存在')
      }

      const updateData = code === undefined
        ? otherUpdateData
        : { ...otherUpdateData, code }
      const result = await tx
        .update(this.systemDictionary)
        .set(updateData)
        .where(eq(this.systemDictionary.id, id))

      this.drizzle.assertAffectedRows(result, '字典不存在')

      // 字典编码变更时，同步刷新子项绑定编码，避免父子关系失联。
      if (code && code !== currentDictionary.code) {
        await tx
          .update(this.systemDictionaryItem)
          .set({ dictionaryCode: code })
          .where(eq(this.systemDictionaryItem.dictionaryCode, currentDictionary.code))
      }
    })

    return true
  }

  /**
   * 切换字典启用状态。
   */
  async updateDictionaryStatus(dto: UpdateEnabledStatusDto) {
    const data = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.systemDictionary)
        .set({ isEnabled: dto.isEnabled })
        .where(eq(this.systemDictionary.id, dto.id)),
    )
    this.drizzle.assertAffectedRows(data, '字典不存在')
    return true
  }

  /**
   * 删除字典。
   * 若仍存在关联字典项则拒绝删除，避免破坏字典项的父级语义。
   */
  async deleteDictionary(dto: IdDto) {
    const currentDictionary = await this.findDictionaryById(dto)
    const hasItems = await this.db.query.systemDictionaryItem.findFirst({
      where: { dictionaryCode: currentDictionary.code },
    })
    if (hasItems) {
      throw new BadRequestException('该字典还有关联字典项，无法删除')
    }

    const data = await this.drizzle.withErrorHandling(() =>
      this.db.delete(this.systemDictionary).where(eq(this.systemDictionary.id, dto.id)),
    )
    this.drizzle.assertAffectedRows(data, '字典不存在')
    return true
  }

  /**
   * 分页查询字典项列表。
   * `dictionaryCode` 支持逗号分隔的多值筛选，默认按 `sortOrder asc` 返回。
   */
  async findDictionaryItems(queryDto: QueryDictionaryItemDto) {
    const { dictionaryCode } = queryDto
    const conditions = this.buildSearchConditions(this.systemDictionaryItem, queryDto)
    const dictionaryCodes = this.parseDictionaryCodes(dictionaryCode)

    if (dictionaryCodes.length > 0) {
      conditions.push(inArray(this.systemDictionaryItem.dictionaryCode, dictionaryCodes))
    }

    const orderBy = queryDto.orderBy?.trim()
      ? queryDto.orderBy
      : { sortOrder: 'asc' as const }

    return this.drizzle.ext.findPagination(this.systemDictionaryItem, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      ...queryDto,
      orderBy,
    })
  }

  /**
   * 查询所有启用的字典项列表。
   * 该入口供 app/public 场景使用，只返回启用项并按排序字段升序排列。
   */
  async findAllDictionaryItems(dto: QueryAllDictionaryItemDto) {
    return this.db.query.systemDictionaryItem.findMany({
      where: {
        isEnabled: true,
        dictionaryCode: { in: this.parseDictionaryCodes(dto.dictionaryCode) },
      },
      orderBy: (item) => [asc(item.sortOrder), asc(item.id)],
    })
  }

  /**
   * 创建字典项。
   * 写入前先校验父级字典存在，避免出现悬空 `dictionaryCode`。
   */
  async createDictionaryItem(dto: CreateDictionaryItemDto) {
    await this.assertDictionaryExists(dto.dictionaryCode)
    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.systemDictionaryItem).values({
        ...dto,
        isEnabled: dto.isEnabled ?? true,
        sortOrder: dto.sortOrder ?? undefined,
      }),
    )
    return true
  }

  /**
   * 更新字典项主体字段。
   * 若请求中带了新的 `dictionaryCode`，会先校验目标字典存在。
   */
  async updateDictionaryItem(dto: UpdateDictionaryItemDto) {
    if (dto.dictionaryCode) {
      await this.assertDictionaryExists(dto.dictionaryCode)
    }
    const { id, sortOrder, ...data } = dto
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.systemDictionaryItem)
        .set({
          ...data,
          sortOrder: sortOrder ?? undefined,
        })
        .where(eq(this.systemDictionaryItem.id, id)),
    )

    this.drizzle.assertAffectedRows(result, '字典项不存在')

    return true
  }

  /**
   * 切换字典项启用状态。
   */
  async updateDictionaryItemStatus(dto: UpdateEnabledStatusDto) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.systemDictionaryItem)
        .set({ isEnabled: dto.isEnabled })
        .where(eq(this.systemDictionaryItem.id, dto.id)),
    )

    this.drizzle.assertAffectedRows(result, '字典项不存在')
    return true
  }

  /**
   * 交换两条字典项的排序位置。
   * 排序操作要求两条记录属于同一 `dictionaryCode`，由 `swapField` 在底层完成约束校验。
   */
  async updateDictionaryItemSort(dto: DragReorderDto) {
    return this.drizzle.ext.swapField(this.systemDictionaryItem, {
      where: [{ id: dto.dragId }, { id: dto.targetId }],
      sourceField: 'dictionaryCode',
    })
  }

  /**
   * 删除字典项。
   */
  async deleteDictionaryItem(dto: IdDto) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db.delete(this.systemDictionaryItem).where(eq(this.systemDictionaryItem.id, dto.id)),
    )
    this.drizzle.assertAffectedRows(result, '字典项不存在')
    return true
  }
}
