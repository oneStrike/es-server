import type { Db } from '@db/core'
import type { SQL } from 'drizzle-orm'
import type { ValidateEmojiAssetPayload } from './emoji.type'
import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'

import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import {
  CreateEmojiAssetDto,
  CreateEmojiPackDto,
  QueryEmojiAssetDto,
  QueryEmojiPackDto,
  UpdateEmojiAssetDto,
  UpdateEmojiPackDto,
  UpdateEmojiPackSceneTypeDto,
} from './dto/emoji.dto'
import {
  normalizeEmojiKeywords,
  normalizeEmojiShortcode,
  normalizeEmojiUnicodeSequence,
} from './emoji-normalizer.helper'
import {
  EmojiAssetKindEnum as AssetKind,
} from './emoji.constant'

/**
 * 表情后台管理服务，负责表情包与表情资源的 CRUD、排序和启用控制。
 * - 删除采用软删除语义，保留历史数据。
 * - 所有写路径统一走 withErrorHandling，并在需要时断言影响行数。
 */
@Injectable()
export class EmojiAssetService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get emojiPack() {
    return this.drizzle.schema.emojiPack
  }

  private get emojiAsset() {
    return this.drizzle.schema.emojiAsset
  }

  /**
   * 分页查询表情包列表。
   * - 默认按 sortOrder 升序、id 升序排列。
   * - 自动排除已软删除的记录。
   */
  async getPackPage(dto: QueryEmojiPackDto) {
    const conditions: SQL[] = [isNull(this.emojiPack.deletedAt)]

    if (dto.code) {
      conditions.push(buildILikeCondition(this.emojiPack.code, dto.code)!)
    }
    if (dto.name) {
      conditions.push(buildILikeCondition(this.emojiPack.name, dto.name)!)
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.emojiPack.isEnabled, dto.isEnabled))
    }
    if (dto.visibleInPicker !== undefined) {
      conditions.push(eq(this.emojiPack.visibleInPicker, dto.visibleInPicker))
    }
    // 空字符串排序参数按未传处理，继续回退到表情包管理端的默认人工排序。
    const orderBy = dto.orderBy?.trim()
      ? dto.orderBy
      : { sortOrder: 'asc' as const, id: 'asc' as const }

    const where = and(...conditions)
    const page = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(orderBy, {
      table: this.emojiPack,
    })
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.emojiPack)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.emojiPack, where),
    ])
    return toPageResult(list, total, page)
  }

  /**
   * 获取表情包详情。
   * - 仅返回未删除的记录。
   * @throws BusinessException 表情包不存在或已删除
   */
  async getPackDetail(id: number) {
    const pack = await this.db.query.emojiPack.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
    })

    if (!pack) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '表情包不存在',
      )
    }
    return pack
  }

  /**
   * 创建表情包。
   * - 自动计算 sortOrder（未指定时取当前最大排序值 +1）。
   * - sceneType 合法性由 DTO 负责校验。
   * @throws BusinessException 表情包编码已存在（由 withErrorHandling 转换）
   */
  async createPack(dto: CreateEmojiPackDto, adminUserId: number) {
    const sortOrder =
      dto.sortOrder ??
      (await this.getMaxPackSortOrder()) + 1

    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.emojiPack).values({
          code: dto.code,
          name: dto.name,
          description: dto.description,
          iconUrl: dto.iconUrl,
          isEnabled: dto.isEnabled ?? true,
          visibleInPicker: dto.visibleInPicker ?? true,
          sceneType: dto.sceneType,
          sortOrder,
          createdById: adminUserId,
          updatedById: adminUserId,
        }),
      { duplicate: '表情包编码已存在' },
    )
    return true
  }

  /**
   * 更新表情包。
   * - 允许部分字段更新，未传入的字段保持原值。
   * - sceneType 合法性由 DTO 负责校验。
   * @throws BusinessException 表情包不存在或已删除
   * @throws BusinessException 表情包编码已存在（由 withErrorHandling 转换）
   */
  async updatePack(dto: UpdateEmojiPackDto, adminUserId: number) {
    const { id, ...updateData } = dto
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.emojiPack)
          .set({
            ...updateData,
            updatedById: adminUserId,
          })
          .where(
            and(eq(this.emojiPack.id, id), isNull(this.emojiPack.deletedAt)),
          ),
      {
        duplicate: '表情包编码已存在',
        notFound: '表情包不存在',
      },
    )
    return true
  }

  /**
   * 更新表情包启用状态。
   * - 用于管理端的启用/禁用切换。
   * @throws BusinessException 表情包不存在或已删除
   */
  async updatePackEnabled(
    id: number,
    isEnabled: boolean,
    adminUserId?: number,
  ) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.emojiPack)
          .set({
            isEnabled,
            ...(adminUserId !== undefined ? { updatedById: adminUserId } : {}),
          })
          .where(
            and(eq(this.emojiPack.id, id), isNull(this.emojiPack.deletedAt)),
          ),
      { notFound: '表情包不存在' },
    )
    return true
  }

  /**
   * 更新表情包场景类型。
   * - 独立接口用于单独修改场景可见性。
   * @throws BusinessException 表情包不存在或已删除
   */
  async updatePackSceneType(
    dto: UpdateEmojiPackSceneTypeDto,
    adminUserId: number,
  ) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.emojiPack)
          .set({
            sceneType: dto.sceneType,
            updatedById: adminUserId,
          })
          .where(
            and(
              eq(this.emojiPack.id, dto.id),
              isNull(this.emojiPack.deletedAt),
            ),
          ),
      { notFound: '表情包不存在' },
    )
    return true
  }

  /**
   * 交换两个表情包的排序值。
   * - 用于管理端的拖拽排序。
   */
  async swapPackSortOrder(dragId: number, targetId: number) {
    return this.drizzle.withTransaction(async (tx) => {
      const rows = await tx
        .select({
          id: this.emojiPack.id,
          sortOrder: this.emojiPack.sortOrder,
        })
        .from(this.emojiPack)
        .where(
          and(
            inArray(this.emojiPack.id, [dragId, targetId]),
            isNull(this.emojiPack.deletedAt),
          ),
        )

      const dragPack = rows.find((row) => row.id === dragId)
      const targetPack = rows.find((row) => row.id === targetId)
      if (!dragPack || !targetPack) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '表情包不存在',
        )
      }
      if (dragPack.sortOrder === targetPack.sortOrder) {
        return true
      }

      const temporarySortOrder = await this.getTemporaryPackSortOrder(tx)
      await tx
        .update(this.emojiPack)
        .set({ sortOrder: temporarySortOrder })
        .where(and(eq(this.emojiPack.id, dragId), isNull(this.emojiPack.deletedAt)))
      await tx
        .update(this.emojiPack)
        .set({ sortOrder: dragPack.sortOrder })
        .where(
          and(eq(this.emojiPack.id, targetId), isNull(this.emojiPack.deletedAt)),
        )
      await tx
        .update(this.emojiPack)
        .set({ sortOrder: targetPack.sortOrder })
        .where(and(eq(this.emojiPack.id, dragId), isNull(this.emojiPack.deletedAt)))
      return true
    })
  }

  /**
   * 删除表情包（软删除）。
   * - 删除前校验：若表情包下存在未删除的资源，禁止删除以避免孤儿资源。
   * @throws BusinessException 表情包不存在或已删除
   * @throws BusinessException 表情包下仍有资源
   */
  async deletePack(id: number) {
    // 删除前保护：存在未删除资源时禁止删除表情包，避免孤儿资源。
    const [pack, assetCountRow] = await Promise.all([
      this.db.query.emojiPack.findFirst({
        where: { id, deletedAt: { isNull: true } },
        columns: { id: true },
      }),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.emojiAsset)
        .where(
          and(
            eq(this.emojiAsset.packId, id),
            isNull(this.emojiAsset.deletedAt),
          ),
        )
        .then((rows) => rows[0]),
    ])

    if (!pack) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '表情包不存在',
      )
    }

    const assetCount = Number(assetCountRow?.count ?? 0)
    if (assetCount > 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '该表情包下还有表情资源，无法删除',
      )
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.emojiPack)
          .set({ deletedAt: new Date() })
          .where(
            and(eq(this.emojiPack.id, id), isNull(this.emojiPack.deletedAt)),
          ),
      { notFound: '表情包不存在' },
    )
    return true
  }

  /**
   * 分页查询表情资源列表。
   * - 默认按 sortOrder 升序、id 升序排列。
   * - 自动排除已软删除的记录。
   */
  async getAssetPage(dto: QueryEmojiAssetDto) {
    const conditions: SQL[] = [isNull(this.emojiAsset.deletedAt)]

    if (dto.packId !== undefined) {
      conditions.push(eq(this.emojiAsset.packId, dto.packId))
    }
    if (dto.kind !== undefined) {
      conditions.push(eq(this.emojiAsset.kind, dto.kind))
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.emojiAsset.isEnabled, dto.isEnabled))
    }
    if (dto.shortcode) {
      conditions.push(
        buildILikeCondition(this.emojiAsset.shortcode, dto.shortcode)!,
      )
    }
    if (dto.category) {
      conditions.push(
        buildILikeCondition(this.emojiAsset.category, dto.category)!,
      )
    }
    // 资源列表沿用包内人工排序，空字符串排序参数同样按未传处理。
    const orderBy = dto.orderBy?.trim()
      ? dto.orderBy
      : { sortOrder: 'asc' as const, id: 'asc' as const }

    const where = and(...conditions)
    const page = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(orderBy, {
      table: this.emojiAsset,
    })
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.emojiAsset)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.emojiAsset, where),
    ])
    return toPageResult(list, total, page)
  }

  /**
   * 获取表情资源详情。
   * - 仅返回未删除的记录。
   * @throws BusinessException 表情资源不存在或已删除
   */
  async getAssetDetail(id: number) {
    const asset = await this.db.query.emojiAsset.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
    })
    if (!asset) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '表情资源不存在',
      )
    }
    return asset
  }

  /**
   * 创建表情资源。
   * - 自动计算 sortOrder（未指定时取当前包内最大排序值 +1）。
   * - 根据 kind 校验必填字段：CUSTOM 需 shortcode+imageUrl，UNICODE 需 unicodeSequence。
   * @throws BusinessException 表情包不存在或字段校验失败
   */
  async createAsset(dto: CreateEmojiAssetDto, adminUserId: number) {
    await this.ensurePackExists(dto.packId)
    const normalizedAsset = this.prepareAssetPayload(dto.kind, dto)

    const sortOrder =
      dto.sortOrder ??
      (await this.getMaxAssetSortOrder(dto.packId)) + 1

    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.emojiAsset).values({
        ...dto,
        ...normalizedAsset,
        sortOrder,
        isAnimated: dto.isAnimated ?? false,
        isEnabled: dto.isEnabled ?? true,
        createdById: adminUserId,
        updatedById: adminUserId,
      }),
    )
    return true
  }

  /**
   * 更新表情资源。
   * - 允许部分字段更新，未传入的字段保持原值。
   * - 若更新 kind，需重新校验字段完整性。
   * @throws BusinessException 表情资源不存在或已删除
   * @throws BusinessException 目标表情包不存在或字段校验失败
   */
  async updateAsset(dto: UpdateEmojiAssetDto, adminUserId: number) {
    if (dto.packId !== undefined) {
      await this.ensurePackExists(dto.packId)
    }

    const current = await this.db.query.emojiAsset.findFirst({
      where: { id: dto.id, deletedAt: { isNull: true } },
    })
    if (!current) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '表情资源不存在',
      )
    }

    const nextKind = dto.kind ?? current.kind
    const normalizedAsset = this.prepareAssetPayload(nextKind, {
      ...current,
      ...dto,
    })

    const { id, ...updateData } = dto
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.emojiAsset)
          .set({
            ...updateData,
            ...normalizedAsset,
            updatedById: adminUserId,
          })
          .where(
            and(eq(this.emojiAsset.id, id), isNull(this.emojiAsset.deletedAt)),
          ),
      { notFound: '表情资源不存在' },
    )
    return true
  }

  /**
   * 更新表情资源启用状态。
   * - 用于管理端的启用/禁用切换。
   * @throws BusinessException 表情资源不存在或已删除
   */
  async updateAssetEnabled(
    id: number,
    isEnabled: boolean,
    adminUserId?: number,
  ) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.emojiAsset)
          .set({
            isEnabled,
            ...(adminUserId !== undefined ? { updatedById: adminUserId } : {}),
          })
          .where(
            and(eq(this.emojiAsset.id, id), isNull(this.emojiAsset.deletedAt)),
          ),
      { notFound: '表情资源不存在' },
    )
    return true
  }

  /**
   * 交换两个表情资源的排序值。
   * - 仅允许同一表情包（packId 相同）内的资源交换顺序。
   */
  async swapAssetSortOrder(dragId: number, targetId: number) {
    return this.drizzle.withTransaction(async (tx) => {
      const rows = await tx
        .select({
          id: this.emojiAsset.id,
          packId: this.emojiAsset.packId,
          sortOrder: this.emojiAsset.sortOrder,
        })
        .from(this.emojiAsset)
        .where(
          and(
            inArray(this.emojiAsset.id, [dragId, targetId]),
            isNull(this.emojiAsset.deletedAt),
          ),
        )

      const dragAsset = rows.find((row) => row.id === dragId)
      const targetAsset = rows.find((row) => row.id === targetId)
      if (!dragAsset || !targetAsset) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '表情资源不存在',
        )
      }
      if (dragAsset.packId !== targetAsset.packId) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '表情资源不属于同一表情包',
        )
      }
      if (dragAsset.sortOrder === targetAsset.sortOrder) {
        return true
      }

      const samePackWhere = and(
        eq(this.emojiAsset.packId, dragAsset.packId),
        isNull(this.emojiAsset.deletedAt),
      )!
      const temporarySortOrder = await this.getTemporaryAssetSortOrder(
        tx,
        samePackWhere,
      )
      await tx
        .update(this.emojiAsset)
        .set({ sortOrder: temporarySortOrder })
        .where(and(eq(this.emojiAsset.id, dragId), isNull(this.emojiAsset.deletedAt)))
      await tx
        .update(this.emojiAsset)
        .set({ sortOrder: dragAsset.sortOrder })
        .where(
          and(eq(this.emojiAsset.id, targetId), isNull(this.emojiAsset.deletedAt)),
        )
      await tx
        .update(this.emojiAsset)
        .set({ sortOrder: targetAsset.sortOrder })
        .where(and(eq(this.emojiAsset.id, dragId), isNull(this.emojiAsset.deletedAt)))
      return true
    })
  }

  /**
   * 删除表情资源（软删除）。
   * @throws BusinessException 表情资源不存在或已删除
   */
  async deleteAsset(id: number) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.emojiAsset)
          .set({ deletedAt: new Date() })
          .where(
            and(eq(this.emojiAsset.id, id), isNull(this.emojiAsset.deletedAt)),
          ),
      { notFound: '表情资源不存在' },
    )
    return true
  }

  /**
   * 根据资源类型校验字段完整性。
   * - CUSTOM 类型：必须提供 shortcode 和 imageUrl。
   * - UNICODE 类型：必须提供 unicodeSequence。
   * @throws BusinessException 字段不满足类型要求
   */
  private prepareAssetPayload(
    kind: CreateEmojiAssetDto['kind'],
    payload: ValidateEmojiAssetPayload,
  ) {
    const shortcode = normalizeEmojiShortcode(payload.shortcode)
    const unicodeSequence = normalizeEmojiUnicodeSequence(payload.unicodeSequence)
    const keywords = normalizeEmojiKeywords(payload.keywords)

    if (kind === AssetKind.CUSTOM) {
      if (!shortcode) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          'custom 表情必须填写 shortcode',
        )
      }
      if (!payload.imageUrl) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          'custom 表情必须填写 imageUrl',
        )
      }
    }
    if (kind === AssetKind.UNICODE && !unicodeSequence) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'unicode 表情必须填写 unicodeSequence',
      )
    }

    return {
      shortcode: kind === AssetKind.CUSTOM ? shortcode : null,
      unicodeSequence: kind === AssetKind.UNICODE ? unicodeSequence : null,
      keywords,
    }
  }

  /**
   * 校验表情包存在且未删除。
   * - 用于创建/更新表情资源前的外键前置校验。
   * @throws BusinessException 表情包不存在或已删除
   */
  private async ensurePackExists(packId: number) {
    const pack = await this.db.query.emojiPack.findFirst({
      where: {
        id: packId,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })
    if (!pack) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '表情包不存在',
      )
    }
  }

  // 获取未删除表情包的最大排序值，供新增表情包追加到末尾。
  private async getMaxPackSortOrder() {
    const [row] = await this.db
      .select({ value: sql<number>`max(${this.emojiPack.sortOrder})` })
      .from(this.emojiPack)
      .where(isNull(this.emojiPack.deletedAt))
    return Number(row?.value ?? 0)
  }

  // 获取目标表情包内未删除资源的最大排序值，供新增资源追加到包内末尾。
  private async getMaxAssetSortOrder(packId: number) {
    const [row] = await this.db
      .select({ value: sql<number>`max(${this.emojiAsset.sortOrder})` })
      .from(this.emojiAsset)
      .where(and(eq(this.emojiAsset.packId, packId), isNull(this.emojiAsset.deletedAt)))
    return Number(row?.value ?? 0)
  }

  // 取小于当前最小值的临时排序值，避免交换过程触发潜在唯一约束。
  private async getTemporaryPackSortOrder(tx: Db) {
    const [row] = await tx
      .select({ value: sql<number>`min(${this.emojiPack.sortOrder})` })
      .from(this.emojiPack)
      .where(isNull(this.emojiPack.deletedAt))
    return Number(row?.value ?? 0) - 1
  }

  // 取包内小于当前最小值的临时排序值，保证交换只影响同包资源。
  private async getTemporaryAssetSortOrder(tx: Db, where: SQL) {
    const [row] = await tx
      .select({ value: sql<number>`min(${this.emojiAsset.sortOrder})` })
      .from(this.emojiAsset)
      .where(where)
    return Number(row?.value ?? 0) - 1
  }
}
