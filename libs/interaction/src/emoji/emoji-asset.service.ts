import type { SQL } from 'drizzle-orm'
import type {
  ValidateEmojiAssetPayload,
} from './emoji.type'
import { buildILikeCondition, DrizzleService } from '@db/core'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
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
  EmojiAssetKindEnum as AssetKind,
  EmojiSceneEnum,
  isEmojiScene,
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
      conditions.push(
        buildILikeCondition(this.emojiPack.code, dto.code)!,
      )
    }
    if (dto.name) {
      conditions.push(
        buildILikeCondition(this.emojiPack.name, dto.name)!,
      )
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

    return this.drizzle.ext.findPagination(this.emojiPack, {
      where: and(...conditions),
      ...dto,
      orderBy,
    })
  }

  /**
   * 获取表情包详情。
   * - 仅返回未删除的记录。
   * @throws NotFoundException 表情包不存在或已删除
   */
  async getPackDetail(id: number) {
    const pack = await this.db.query.emojiPack.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
    })

    if (!pack) {
      throw new NotFoundException('表情包不存在')
    }
    return pack
  }

  /**
   * 创建表情包。
   * - 自动计算 sortOrder（未指定时取当前最大排序值 +1）。
   * - sceneType 必须包含至少一个有效场景。
   * @throws BadRequestException sceneType 校验失败
   * @throws ConflictException 表情包编码已存在（由 withErrorHandling 转换）
   */
  async createPack(dto: CreateEmojiPackDto, adminUserId: number) {
    this.validateSceneType(dto.sceneType)
    const sortOrder =
      dto.sortOrder ??
      (await this.drizzle.ext.maxOrder({
        column: this.emojiPack.sortOrder,
        where: isNull(this.emojiPack.deletedAt),
      })) + 1

    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.emojiPack).values({
          code: dto.code,
          name: dto.name,
          description: dto.description,
          iconUrl: dto.iconUrl,
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
   * - 若更新 sceneType，需重新校验场景有效性。
   * @throws NotFoundException 表情包不存在或已删除
   * @throws ConflictException 表情包编码已存在（由 withErrorHandling 转换）
   */
  async updatePack(dto: UpdateEmojiPackDto, adminUserId: number) {
    if (dto.sceneType) {
      this.validateSceneType(dto.sceneType)
    }

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
   * @throws NotFoundException 表情包不存在或已删除
   */
  async updatePackEnabled(
    id: number,
    isEnabled: boolean,
    adminUserId?: number,
  ) {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.emojiPack)
        .set({
          isEnabled,
          ...(adminUserId !== undefined ? { updatedById: adminUserId } : {}),
        })
        .where(
          and(eq(this.emojiPack.id, id), isNull(this.emojiPack.deletedAt)),
        ), { notFound: '表情包不存在' },)
    return true
  }

  /**
   * 更新表情包场景类型。
   * - 独立接口用于单独修改场景可见性。
   * @throws BadRequestException sceneType 校验失败
   * @throws NotFoundException 表情包不存在或已删除
   */
  async updatePackSceneType(
    dto: UpdateEmojiPackSceneTypeDto,
    adminUserId: number,
  ) {
    this.validateSceneType(dto.sceneType)
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.emojiPack)
        .set({
          sceneType: dto.sceneType,
          updatedById: adminUserId,
        })
        .where(
          and(eq(this.emojiPack.id, dto.id), isNull(this.emojiPack.deletedAt)),
        ), { notFound: '表情包不存在' },)
    return true
  }

  /**
   * 交换两个表情包的排序值。
   * - 用于管理端的拖拽排序。
   */
  async swapPackSortOrder(dragId: number, targetId: number) {
    return this.drizzle.ext.swapField(this.emojiPack, {
      where: [{ id: dragId }, { id: targetId }],
    })
  }

  /**
   * 删除表情包（软删除）。
   * - 删除前校验：若表情包下存在未删除的资源，禁止删除以避免孤儿资源。
   * @throws NotFoundException 表情包不存在或已删除
   * @throws BadRequestException 表情包下仍有资源
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
      throw new NotFoundException('表情包不存在')
    }

    const assetCount = Number(assetCountRow?.count ?? 0)
    if (assetCount > 0) {
      throw new BadRequestException('该表情包下还有表情资源，无法删除')
    }

    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.emojiPack)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(this.emojiPack.id, id), isNull(this.emojiPack.deletedAt)),
        ), { notFound: '表情包不存在' },)
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

    return this.drizzle.ext.findPagination(this.emojiAsset, {
      where: and(...conditions),
      ...dto,
      orderBy,
    })
  }

  /**
   * 获取表情资源详情。
   * - 仅返回未删除的记录。
   * @throws NotFoundException 表情资源不存在或已删除
   */
  async getAssetDetail(id: number) {
    const asset = await this.db.query.emojiAsset.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
    })
    if (!asset) {
      throw new NotFoundException('表情资源不存在')
    }
    return asset
  }

  /**
   * 创建表情资源。
   * - 自动计算 sortOrder（未指定时取当前包内最大排序值 +1）。
   * - 根据 kind 校验必填字段：CUSTOM 需 shortcode+imageUrl，UNICODE 需 unicodeSequence。
   * @throws BadRequestException 表情包不存在或字段校验失败
   */
  async createAsset(dto: CreateEmojiAssetDto, adminUserId: number) {
    await this.ensurePackExists(dto.packId)
    this.validateAssetPayload(dto.kind, dto)

    const sortOrder =
      dto.sortOrder ??
      (await this.drizzle.ext.maxOrder({
        column: this.emojiAsset.sortOrder,
        where: and(
          eq(this.emojiAsset.packId, dto.packId),
          isNull(this.emojiAsset.deletedAt),
        ),
      })) + 1

    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.emojiAsset).values({
        ...dto,
        sortOrder,
        isAnimated: dto.isAnimated ?? false,
        isEnabled: true,
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
   * @throws NotFoundException 表情资源不存在或已删除
   * @throws BadRequestException 目标表情包不存在或字段校验失败
   */
  async updateAsset(dto: UpdateEmojiAssetDto, adminUserId: number) {
    if (dto.packId !== undefined) {
      await this.ensurePackExists(dto.packId)
    }

    const current = await this.db.query.emojiAsset.findFirst({
      where: { id: dto.id, deletedAt: { isNull: true } },
    })
    if (!current) {
      throw new NotFoundException('表情资源不存在')
    }

    const nextKind = dto.kind ?? current.kind
    this.validateAssetPayload(nextKind, {
      ...current,
      ...dto,
    })

    const { id, ...updateData } = dto
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.emojiAsset)
        .set({
          ...updateData,
          updatedById: adminUserId,
        })
        .where(
          and(eq(this.emojiAsset.id, id), isNull(this.emojiAsset.deletedAt)),
        ), { notFound: '表情资源不存在' },)
    return true
  }

  /**
   * 更新表情资源启用状态。
   * - 用于管理端的启用/禁用切换。
   * @throws NotFoundException 表情资源不存在或已删除
   */
  async updateAssetEnabled(
    id: number,
    isEnabled: boolean,
    adminUserId?: number,
  ) {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.emojiAsset)
        .set({
          isEnabled,
          ...(adminUserId !== undefined ? { updatedById: adminUserId } : {}),
        })
        .where(
          and(eq(this.emojiAsset.id, id), isNull(this.emojiAsset.deletedAt)),
        ), { notFound: '表情资源不存在' },)
    return true
  }

  /**
   * 交换两个表情资源的排序值。
   * - 仅允许同一表情包（packId 相同）内的资源交换顺序。
   */
  async swapAssetSortOrder(dragId: number, targetId: number) {
    // sourceField=packId：仅允许同一表情包内交换顺序。
    return this.drizzle.ext.swapField(this.emojiAsset, {
      where: [{ id: dragId }, { id: targetId }],
      sourceField: 'packId',
    })
  }

  /**
   * 删除表情资源（软删除）。
   * @throws NotFoundException 表情资源不存在或已删除
   */
  async deleteAsset(id: number) {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.emojiAsset)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(this.emojiAsset.id, id), isNull(this.emojiAsset.deletedAt)),
        ), { notFound: '表情资源不存在' },)
    return true
  }

  /**
   * 校验场景类型数组有效性。
   * - 至少包含一个场景。
   * - 所有值必须是 EmojiSceneEnum 中定义的有效场景。
   * @throws BadRequestException 场景类型为空或包含无效值
   */
  private validateSceneType(sceneType: EmojiSceneEnum[]) {
    const unique = [...new Set(sceneType)]
    if (unique.length === 0) {
      throw new BadRequestException('sceneType 至少包含一个场景')
    }
    if (!unique.every(isEmojiScene)) {
      throw new BadRequestException('未知的场景类型')
    }
  }

  /**
   * 根据资源类型校验字段完整性。
   * - CUSTOM 类型：必须提供 shortcode 和 imageUrl。
   * - UNICODE 类型：必须提供 unicodeSequence。
   * @throws BadRequestException 字段不满足类型要求
   */
  private validateAssetPayload(
    kind: CreateEmojiAssetDto['kind'],
    payload: ValidateEmojiAssetPayload,
  ) {
    if (kind === AssetKind.CUSTOM) {
      if (!payload.shortcode) {
        throw new BadRequestException('custom 表情必须填写 shortcode')
      }
      if (!payload.imageUrl) {
        throw new BadRequestException('custom 表情必须填写 imageUrl')
      }
    }
    if (kind === AssetKind.UNICODE && !payload.unicodeSequence) {
      throw new BadRequestException('unicode 表情必须填写 unicodeSequence')
    }
  }

  /**
   * 校验表情包存在且未删除。
   * - 用于创建/更新表情资源前的外键前置校验。
   * @throws BadRequestException 表情包不存在或已删除
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
      throw new BadRequestException('表情包不存在')
    }
  }
}
