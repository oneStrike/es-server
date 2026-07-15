import type { DbExecutor, DbTransaction } from '@db/core'
import type { DictionaryItemSelect, DictionarySelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import {
  acquireIntegrityLocks,
  buildILikeCondition,
  DrizzleService,
  exclusiveIntegrityLock,
  relationIntegrityLock,
  tableIntegrityLock,
  toPageResult,
} from '@db/core'

import { BusinessErrorCode } from '@libs/platform/constant'
import {
  DragReorderDto,
  IdDto,
  UpdateEnabledStatusDto,
} from '@libs/platform/dto'

import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import {
  CreateDictionaryDto,
  CreateDictionaryItemDto,
  QueryAllDictionaryItemDto,
  QueryDictionaryDto,
  QueryDictionaryItemDto,
  UpdateDictionaryDto,
  UpdateDictionaryItemDto,
} from './dto/dictionary.dto'

const DICTIONARY_TABLE = 'sys_dictionary'
const DICTIONARY_ITEM_TABLE = 'sys_dictionary_item'
const DICTIONARY_ITEM_PARENT_RELATION = 'sys_dictionary_item.dictionary_code'
const DICTIONARY_ITEM_SORT_ORDER_ALLOCATION =
  'sys_dictionary_item.sort_order_allocation'

class DictionarySnapshotDriftError extends Error {}

type DictionaryMutationSnapshot = Pick<DictionarySelect, 'id' | 'code'>
type DictionaryItemMutationSnapshot = Pick<
  DictionaryItemSelect,
  'id' | 'dictionaryCode' | 'sortOrder'
>

/**
 * 字典服务
 *
 * 负责字典与字典项的查询、写入、状态切换和排序维护。
 */
@Injectable()
export class LibDictionaryService {
  constructor(private readonly drizzle: DrizzleService) {}

  // 数据库连接实例
  private get db() {
    return this.drizzle.db
  }

  // 字典表
  private get dictionary() {
    return this.drizzle.schema.dictionary
  }

  // 字典项表
  private get dictionaryItem() {
    return this.drizzle.schema.dictionaryItem
  }

  private async withSnapshotRetry<T>(
    execute: () => Promise<T>,
    conflictMessage: string,
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await execute()
      } catch (error) {
        if (!(error instanceof DictionarySnapshotDriftError)) {
          throw error
        }
        if (attempt === 1) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            conflictMessage,
          )
        }
      }
    }

    throw new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      conflictMessage,
    )
  }

  private async readDictionaryMutationSnapshot(
    id: number,
    client: DbExecutor = this.db,
  ): Promise<DictionaryMutationSnapshot | undefined> {
    const [snapshot] = await client
      .select({
        id: this.dictionary.id,
        code: this.dictionary.code,
      })
      .from(this.dictionary)
      .where(eq(this.dictionary.id, id))
      .limit(1)

    return snapshot
  }

  private async readDictionaryItemMutationSnapshot(
    id: number,
    client: DbExecutor = this.db,
  ): Promise<DictionaryItemMutationSnapshot | undefined> {
    const [snapshot] = await this.readDictionaryItemsMutationSnapshot(
      [id],
      client,
    )
    return snapshot
  }

  private async readDictionaryItemsMutationSnapshot(
    ids: readonly number[],
    client: DbExecutor = this.db,
  ): Promise<DictionaryItemMutationSnapshot[]> {
    return client
      .select({
        id: this.dictionaryItem.id,
        dictionaryCode: this.dictionaryItem.dictionaryCode,
        sortOrder: this.dictionaryItem.sortOrder,
      })
      .from(this.dictionaryItem)
      .where(inArray(this.dictionaryItem.id, [...new Set(ids)]))
      .orderBy(this.dictionaryItem.id)
  }

  private isSameDictionaryMutationSnapshot(
    left: DictionaryMutationSnapshot,
    right: DictionaryMutationSnapshot | undefined,
  ) {
    return left.id === right?.id && left.code === right?.code
  }

  private isSameDictionaryItemMutationSnapshot(
    left: DictionaryItemMutationSnapshot,
    right: DictionaryItemMutationSnapshot | undefined,
  ) {
    return (
      left.id === right?.id &&
      left.dictionaryCode === right?.dictionaryCode &&
      left.sortOrder === right?.sortOrder
    )
  }

  private areSameDictionaryItemMutationSnapshots(
    left: DictionaryItemMutationSnapshot[],
    right: DictionaryItemMutationSnapshot[],
  ) {
    return (
      left.length === right.length &&
      left.every((snapshot, index) =>
        this.isSameDictionaryItemMutationSnapshot(snapshot, right[index]),
      )
    )
  }

  // 字典列表与详情的完整稳定 contract，字段新增不能通过默认查询自动进入接口。
  private buildDictionaryReadSelect() {
    return {
      id: this.dictionary.id,
      name: this.dictionary.name,
      code: this.dictionary.code,
      cover: this.dictionary.cover,
      isEnabled: this.dictionary.isEnabled,
      description: this.dictionary.description,
      createdAt: this.dictionary.createdAt,
      updatedAt: this.dictionary.updatedAt,
    }
  }

  private getDictionaryReadColumns() {
    return {
      id: true,
      name: true,
      code: true,
      cover: true,
      isEnabled: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    } as const
  }

  // admin/app 字典项共享的完整稳定 contract，app 的启用态仅由 where 限定。
  private buildDictionaryItemReadSelect() {
    return {
      id: this.dictionaryItem.id,
      dictionaryCode: this.dictionaryItem.dictionaryCode,
      name: this.dictionaryItem.name,
      code: this.dictionaryItem.code,
      sortOrder: this.dictionaryItem.sortOrder,
      cover: this.dictionaryItem.cover,
      isEnabled: this.dictionaryItem.isEnabled,
      description: this.dictionaryItem.description,
      createdAt: this.dictionaryItem.createdAt,
      updatedAt: this.dictionaryItem.updatedAt,
    }
  }

  private getDictionaryItemReadColumns() {
    return {
      id: true,
      dictionaryCode: true,
      name: true,
      code: true,
      sortOrder: true,
      cover: true,
      isEnabled: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    } as const
  }

  // 根据分页查询 DTO 组装通用筛选条件。 字典与字典项列表都复用同一套名称、编码、启用状态过滤逻辑，避免两处条件分叉。
  private buildSearchConditions(
    table: typeof this.dictionary | typeof this.dictionaryItem,
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

  // 解析逗号分隔的字典编码列表。 app/public 侧允许一次查询多个字典编码；若最终没有有效编码，直接按业务异常处理。
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

  // 断言目标字典编码存在，避免字典项写入到悬空父级。
  private async assertDictionaryExists(
    runner: DbTransaction,
    dictionaryCode: string,
  ) {
    const data = await runner.query.dictionary.findFirst({
      where: { code: dictionaryCode },
      columns: { id: true },
    })

    if (!data) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '数据字典不存在',
      )
    }
  }

  // 未显式排序的字典项沿用“追加到现有排序末尾”的业务语义。调用方必须在
  // 初始完整并集中持有全局排序分配锁，确保并发创建不会取得相同的排序值。
  private async allocateDictionaryItemSortOrder(tx: DbTransaction) {
    const [row] = await tx
      .select({
        value:
          sql<number>`coalesce(max(${this.dictionaryItem.sortOrder}), 0)`.mapWith(
            Number,
          ),
      })
      .from(this.dictionaryItem)

    return (row?.value ?? 0) + 1
  }

  // 分页查询字典列表。
  async findDictionaries(queryDto: QueryDictionaryDto) {
    const conditions = this.buildSearchConditions(this.dictionary, queryDto)

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(queryDto)
    const orderQuery = this.drizzle.buildOrderBy(queryDto.orderBy, {
      table: this.dictionary,
    })
    const [list, total] = await Promise.all([
      this.db
        .select(this.buildDictionaryReadSelect())
        .from(this.dictionary)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.dictionary, where),
    ])

    return toPageResult(
      list.map((item) => this.toDictionaryOutputDto(item)),
      total,
      page,
    )
  }

  // 按主键查询字典详情，未命中时抛出 `BusinessException`。
  async findDictionaryById(dto: IdDto) {
    const data = await this.db.query.dictionary.findFirst({
      where: { id: dto.id },
      columns: this.getDictionaryReadColumns(),
    })
    if (!data) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '字典不存在',
      )
    }
    return this.toDictionaryOutputDto(data)
  }

  // 创建字典。 未显式传入 `isEnabled` 时默认启用，唯一约束异常统一由 `withErrorHandling` 转换。
  async createDictionary(dto: CreateDictionaryDto) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [
          exclusiveIntegrityLock(
            relationIntegrityLock(DICTIONARY_ITEM_PARENT_RELATION, dto.code),
          ),
        ])
        await tx.insert(this.dictionary).values({
          ...dto,
          isEnabled: dto.isEnabled ?? true,
        })
      },
    })
    return true
  }

  // 更新字典主体字段。 当字典编码发生变更时，会在同一事务内同步刷新所有子项的 `dictionaryCode`，避免父子关系失联。
  async updateDictionary(dto: UpdateDictionaryDto) {
    const { id, code, ...otherUpdateData } = dto

    return this.withSnapshotRetry(async () => {
      const discoveredDictionary = await this.readDictionaryMutationSnapshot(id)
      if (!discoveredDictionary) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '字典不存在',
        )
      }

      await this.drizzle.withTransaction({
        execute: async (tx) => {
          await acquireIntegrityLocks(tx, [
            exclusiveIntegrityLock(tableIntegrityLock(DICTIONARY_TABLE, id)),
            ...[discoveredDictionary.code, code]
              .filter((value): value is string => value !== undefined)
              .map((value) =>
                exclusiveIntegrityLock(
                  relationIntegrityLock(DICTIONARY_ITEM_PARENT_RELATION, value),
                ),
              ),
          ])

          const lockedDictionary = await this.readDictionaryMutationSnapshot(
            id,
            tx,
          )
          if (
            !this.isSameDictionaryMutationSnapshot(
              discoveredDictionary,
              lockedDictionary,
            )
          ) {
            throw new DictionarySnapshotDriftError()
          }

          const updateData =
            code === undefined ? otherUpdateData : { ...otherUpdateData, code }
          const result = await tx
            .update(this.dictionary)
            .set(updateData)
            .where(eq(this.dictionary.id, id))

          this.drizzle.assertAffectedRows(result, '字典不存在')

          // 字典编码变更时，同步刷新子项绑定编码，避免父子关系失联。
          if (code !== undefined && code !== discoveredDictionary.code) {
            await tx
              .update(this.dictionaryItem)
              .set({ dictionaryCode: code })
              .where(
                eq(
                  this.dictionaryItem.dictionaryCode,
                  discoveredDictionary.code,
                ),
              )
          }
        },
      })

      return true
    }, '字典状态已变化，请重试')
  }

  // 切换字典启用状态。
  async updateDictionaryStatus(dto: UpdateEnabledStatusDto) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [
          exclusiveIntegrityLock(tableIntegrityLock(DICTIONARY_TABLE, dto.id)),
        ])
        const result = await tx
          .update(this.dictionary)
          .set({ isEnabled: dto.isEnabled })
          .where(eq(this.dictionary.id, dto.id))
        this.drizzle.assertAffectedRows(result, '字典不存在')
      },
    })
    return true
  }

  // 删除字典。 若仍存在关联字典项则拒绝删除，避免破坏字典项的父级语义。
  async deleteDictionary(dto: IdDto) {
    return this.withSnapshotRetry(async () => {
      const discoveredDictionary = await this.readDictionaryMutationSnapshot(
        dto.id,
      )
      if (!discoveredDictionary) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '字典不存在',
        )
      }

      await this.drizzle.withTransaction({
        execute: async (tx) => {
          await acquireIntegrityLocks(tx, [
            exclusiveIntegrityLock(
              tableIntegrityLock(DICTIONARY_TABLE, dto.id),
            ),
            exclusiveIntegrityLock(
              relationIntegrityLock(
                DICTIONARY_ITEM_PARENT_RELATION,
                discoveredDictionary.code,
              ),
            ),
          ])

          const lockedDictionary = await this.readDictionaryMutationSnapshot(
            dto.id,
            tx,
          )
          if (
            !this.isSameDictionaryMutationSnapshot(
              discoveredDictionary,
              lockedDictionary,
            )
          ) {
            throw new DictionarySnapshotDriftError()
          }

          const hasItems = await tx.query.dictionaryItem.findFirst({
            where: { dictionaryCode: discoveredDictionary.code },
            columns: { id: true },
          })
          if (hasItems) {
            throw new BusinessException(
              BusinessErrorCode.OPERATION_NOT_ALLOWED,
              '该字典还有关联字典项，无法删除',
            )
          }

          const result = await tx
            .delete(this.dictionary)
            .where(eq(this.dictionary.id, dto.id))
          this.drizzle.assertAffectedRows(result, '字典不存在')
        },
      })
      return true
    }, '字典状态已变化，请重试')
  }

  // 分页查询字典项列表。 `dictionaryCode` 支持逗号分隔的多值筛选，默认按 `sortOrder asc` 返回。
  async findDictionaryItems(queryDto: QueryDictionaryItemDto) {
    const { dictionaryCode } = queryDto
    const conditions = this.buildSearchConditions(this.dictionaryItem, queryDto)
    const dictionaryCodes = this.parseDictionaryCodes(dictionaryCode)

    if (dictionaryCodes.length > 0) {
      conditions.push(
        inArray(this.dictionaryItem.dictionaryCode, dictionaryCodes),
      )
    }

    const orderBy = queryDto.orderBy?.trim()
      ? queryDto.orderBy
      : { sortOrder: 'asc' as const }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(queryDto)
    const orderQuery = this.drizzle.buildOrderBy(orderBy, {
      table: this.dictionaryItem,
    })
    const [list, total] = await Promise.all([
      this.db
        .select(this.buildDictionaryItemReadSelect())
        .from(this.dictionaryItem)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.dictionaryItem, where),
    ])

    return toPageResult(
      list.map((item) => this.toDictionaryItemOutputDto(item)),
      total,
      page,
    )
  }

  // 查询所有启用的字典项列表。 该入口供 app/public 场景使用，只返回启用项并按排序字段升序排列。
  async findAllDictionaryItems(dto: QueryAllDictionaryItemDto) {
    const items = await this.db.query.dictionaryItem.findMany({
      where: {
        isEnabled: true,
        dictionaryCode: { in: this.parseDictionaryCodes(dto.dictionaryCode) },
      },
      orderBy: (item) => [asc(item.sortOrder), asc(item.id)],
      columns: this.getDictionaryItemReadColumns(),
    })
    return items.map((item) => this.toDictionaryItemOutputDto(item))
  }

  // 创建字典项。 写入前先校验父级字典存在，避免出现悬空 `dictionaryCode`。
  async createDictionaryItem(dto: CreateDictionaryItemDto) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [
          exclusiveIntegrityLock(
            relationIntegrityLock(
              DICTIONARY_ITEM_PARENT_RELATION,
              dto.dictionaryCode,
            ),
          ),
          ...(dto.sortOrder === undefined
            ? [
                exclusiveIntegrityLock(
                  relationIntegrityLock(
                    DICTIONARY_ITEM_SORT_ORDER_ALLOCATION,
                    'global',
                  ),
                ),
              ]
            : []),
        ])
        await this.assertDictionaryExists(tx, dto.dictionaryCode)
        await tx.insert(this.dictionaryItem).values({
          ...dto,
          isEnabled: dto.isEnabled ?? true,
          sortOrder:
            dto.sortOrder === undefined
              ? await this.allocateDictionaryItemSortOrder(tx)
              : dto.sortOrder,
        })
      },
    })
    return true
  }

  // 更新字典项主体字段。 若请求中带了新的 `dictionaryCode`，会先校验目标字典存在。
  async updateDictionaryItem(dto: UpdateDictionaryItemDto) {
    const { id, sortOrder, dictionaryCode, ...data } = dto
    return this.withSnapshotRetry(async () => {
      const discoveredItem = await this.readDictionaryItemMutationSnapshot(id)
      if (!discoveredItem) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '字典项不存在',
        )
      }

      const targetDictionaryCode =
        dictionaryCode ?? discoveredItem.dictionaryCode
      await this.drizzle.withTransaction({
        execute: async (tx) => {
          await acquireIntegrityLocks(tx, [
            exclusiveIntegrityLock(
              tableIntegrityLock(DICTIONARY_ITEM_TABLE, id),
            ),
            ...[discoveredItem.dictionaryCode, targetDictionaryCode].map(
              (value) =>
                exclusiveIntegrityLock(
                  relationIntegrityLock(DICTIONARY_ITEM_PARENT_RELATION, value),
                ),
            ),
          ])

          const lockedItem = await this.readDictionaryItemMutationSnapshot(
            id,
            tx,
          )
          if (
            !this.isSameDictionaryItemMutationSnapshot(
              discoveredItem,
              lockedItem,
            )
          ) {
            throw new DictionarySnapshotDriftError()
          }

          if (dictionaryCode !== undefined) {
            await this.assertDictionaryExists(tx, dictionaryCode)
          }

          const result = await tx
            .update(this.dictionaryItem)
            .set({
              ...data,
              ...(dictionaryCode === undefined ? {} : { dictionaryCode }),
              ...(sortOrder === undefined ? {} : { sortOrder }),
            })
            .where(eq(this.dictionaryItem.id, id))
          this.drizzle.assertAffectedRows(result, '字典项不存在')
        },
      })
      return true
    }, '字典项状态已变化，请重试')
  }

  // 切换字典项启用状态。
  async updateDictionaryItemStatus(dto: UpdateEnabledStatusDto) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [
          exclusiveIntegrityLock(
            tableIntegrityLock(DICTIONARY_ITEM_TABLE, dto.id),
          ),
        ])
        const result = await tx
          .update(this.dictionaryItem)
          .set({ isEnabled: dto.isEnabled })
          .where(eq(this.dictionaryItem.id, dto.id))
        this.drizzle.assertAffectedRows(result, '字典项不存在')
      },
    })
    return true
  }

  // 交换两条字典项的排序位置。 排序操作要求两条记录属于同一 `dictionaryCode`，并在同一事务内完成三步交换。
  async updateDictionaryItemSort(dto: DragReorderDto) {
    return this.withSnapshotRetry(async () => {
      const discoveredItems = await this.readDictionaryItemsMutationSnapshot([
        dto.dragId,
        dto.targetId,
      ])
      const discoveredDragItem = discoveredItems.find(
        (row) => row.id === dto.dragId,
      )
      const discoveredTargetItem = discoveredItems.find(
        (row) => row.id === dto.targetId,
      )
      if (!discoveredDragItem || !discoveredTargetItem) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '字典项不存在',
        )
      }

      return this.drizzle.withTransaction({
        execute: async (tx) => {
          await acquireIntegrityLocks(tx, [
            exclusiveIntegrityLock(
              tableIntegrityLock(DICTIONARY_ITEM_TABLE, dto.dragId),
            ),
            exclusiveIntegrityLock(
              tableIntegrityLock(DICTIONARY_ITEM_TABLE, dto.targetId),
            ),
            ...discoveredItems.map((item) =>
              exclusiveIntegrityLock(
                relationIntegrityLock(
                  DICTIONARY_ITEM_PARENT_RELATION,
                  item.dictionaryCode,
                ),
              ),
            ),
          ])

          const lockedItems = await this.readDictionaryItemsMutationSnapshot(
            [dto.dragId, dto.targetId],
            tx,
          )
          if (
            !this.areSameDictionaryItemMutationSnapshots(
              discoveredItems,
              lockedItems,
            )
          ) {
            throw new DictionarySnapshotDriftError()
          }

          const dragItem = lockedItems.find((row) => row.id === dto.dragId)
          const targetItem = lockedItems.find((row) => row.id === dto.targetId)
          if (!dragItem || !targetItem) {
            throw new DictionarySnapshotDriftError()
          }
          if (dragItem.dictionaryCode !== targetItem.dictionaryCode) {
            throw new BusinessException(
              BusinessErrorCode.OPERATION_NOT_ALLOWED,
              '字典项不是同一字典',
            )
          }
          if (dragItem.sortOrder === targetItem.sortOrder) {
            return true
          }

          const [minimumSortOrder] = await tx
            .select({
              value: sql<number>`min(${this.dictionaryItem.sortOrder})`.mapWith(
                Number,
              ),
            })
            .from(this.dictionaryItem)
            .where(
              eq(this.dictionaryItem.dictionaryCode, dragItem.dictionaryCode),
            )
          const temporarySortOrder = (minimumSortOrder?.value ?? 0) - 1

          await tx
            .update(this.dictionaryItem)
            .set({ sortOrder: temporarySortOrder })
            .where(
              and(
                eq(this.dictionaryItem.id, dragItem.id),
                eq(this.dictionaryItem.dictionaryCode, dragItem.dictionaryCode),
              ),
            )
          await tx
            .update(this.dictionaryItem)
            .set({ sortOrder: dragItem.sortOrder })
            .where(
              and(
                eq(this.dictionaryItem.id, targetItem.id),
                eq(this.dictionaryItem.dictionaryCode, dragItem.dictionaryCode),
              ),
            )
          await tx
            .update(this.dictionaryItem)
            .set({ sortOrder: targetItem.sortOrder })
            .where(
              and(
                eq(this.dictionaryItem.id, dragItem.id),
                eq(this.dictionaryItem.dictionaryCode, dragItem.dictionaryCode),
              ),
            )

          return true
        },
      })
    }, '字典项状态已变化，请重试')
  }

  // 删除字典项。
  async deleteDictionaryItem(dto: IdDto) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [
          exclusiveIntegrityLock(
            tableIntegrityLock(DICTIONARY_ITEM_TABLE, dto.id),
          ),
        ])
        const result = await tx
          .delete(this.dictionaryItem)
          .where(eq(this.dictionaryItem.id, dto.id))
        this.drizzle.assertAffectedRows(result, '字典项不存在')
      },
    })
    return true
  }

  private toDictionaryOutputDto(dictionary: DictionarySelect) {
    return {
      ...dictionary,
      cover: dictionary.cover ?? null,
      description: dictionary.description ?? null,
    }
  }

  private toDictionaryItemOutputDto(item: DictionaryItemSelect) {
    return {
      ...item,
      sortOrder: item.sortOrder,
      cover: item.cover ?? null,
      description: item.description ?? null,
    }
  }
}
