import type { Db } from '@db/core'
import type {
  EmojiAssetSnapshot,
  EmojiAssetSnapshotRow,
  EmojiCatalogPack,
  EmojiCatalogQueryInput,
  EmojiRecentItem,
  EmojiRecentListInput,
  EmojiRecentUsageItem,
  EmojiSearchInput,
  EmojiShortcodeAsset,
  EmojiUnicodeAsset,
  RecordEmojiRecentUsageInput,
} from './emoji.type'
import { DrizzleService, escapeLikePattern } from '@db/core'
import { Injectable } from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm'
import {
  EMOJI_RECENT_LIMIT_DEFAULT,
  EMOJI_RECENT_LIMIT_MAX,
  EMOJI_SEARCH_LIMIT_DEFAULT,
  EMOJI_SEARCH_LIMIT_MAX,
  EmojiAssetKindEnum,
  EmojiSceneEnum,
} from './emoji.constant'

/**
 * 表情目录服务，负责目录加载、搜索与最近使用记录。
 * - 所有读取接口只返回"启用且未删除"的包与资源。
 * - scene 通过 sceneType 数组包含关系控制可见性，不使用位掩码。
 */
@Injectable()
export class EmojiCatalogService {
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

  private get emojiRecentUsage() {
    return this.drizzle.schema.emojiRecentUsage
  }

  /**
   * 构建场景包含条件。
   * - sceneType 为 smallint[]，通过数组包含运算表达单场景可见性。
   */
  private buildSceneContainsCondition(scene: EmojiSceneEnum) {
    return sql`${this.emojiPack.sceneType} @> ARRAY[${scene}]::smallint[]`
  }

  /**
   * 构建表情包有效状态条件。
   * - 条件包括：已启用、未删除、当前场景可见。
   */
  private buildActivePackCondition(scene: EmojiSceneEnum) {
    return and(
      eq(this.emojiPack.isEnabled, true),
      isNull(this.emojiPack.deletedAt),
      this.buildSceneContainsCondition(scene),
    )!
  }

  /**
   * 构建表情资源有效状态条件。
   * - 条件包括：已启用、未删除。
   */
  private buildActiveAssetCondition() {
    return and(
      eq(this.emojiAsset.isEnabled, true),
      isNull(this.emojiAsset.deletedAt),
    )!
  }

  /**
   * 规范化搜索数量限制。
   * - 默认值为 EMOJI_SEARCH_LIMIT_DEFAULT。
   * - 限制在 1 到 EMOJI_SEARCH_LIMIT_MAX 之间。
   */
  private normalizeSearchLimit(limit?: number) {
    const value = limit ?? EMOJI_SEARCH_LIMIT_DEFAULT
    return Math.max(1, Math.min(EMOJI_SEARCH_LIMIT_MAX, value))
  }

  /**
   * 规范化最近使用数量限制。
   * - 默认值为 EMOJI_RECENT_LIMIT_DEFAULT。
   * - 限制在 1 到 EMOJI_RECENT_LIMIT_MAX 之间。
   */
  private normalizeRecentLimit(limit?: number) {
    const value = limit ?? EMOJI_RECENT_LIMIT_DEFAULT
    return Math.max(1, Math.min(EMOJI_RECENT_LIMIT_MAX, value))
  }

  /**
   * 将数据库行转换为表情资源快照。
   * - 处理类型转换（kind、keywords）。
   * - 合并表情包信息到快照对象。
   */
  private toAssetSnapshot(row: EmojiAssetSnapshotRow) {
    return {
      id: row.id,
      kind: row.kind as EmojiAssetKindEnum,
      shortcode: row.shortcode,
      unicodeSequence: row.unicodeSequence,
      imageUrl: row.imageUrl,
      staticUrl: row.staticUrl,
      isAnimated: row.isAnimated,
      category: row.category,
      keywords: row.keywords as Record<string, string[]> | null,
      packId: row.packId,
      packCode: row.packCode,
      packName: row.packName,
      packIconUrl: row.packIconUrl,
      packSortOrder: row.packSortOrder,
      sortOrder: row.sortOrder,
    }
  }

  /**
   * 获取指定场景下的表情目录。
   * - 只返回当前场景可见且启用的表情包及其资源。
   * - 结果按表情包排序值、资源排序值组织。
   */
  async listCatalog(
    input: EmojiCatalogQueryInput,
  ): Promise<EmojiCatalogPack[]> {
    const { scene } = input

    const packs = await this.db
      .select({
        id: this.emojiPack.id,
        code: this.emojiPack.code,
        name: this.emojiPack.name,
        iconUrl: this.emojiPack.iconUrl,
        sortOrder: this.emojiPack.sortOrder,
      })
      .from(this.emojiPack)
      .where(this.buildActivePackCondition(scene))
      .orderBy(this.emojiPack.sortOrder, this.emojiPack.id)

    if (packs.length === 0) {
      return []
    }

    const packIds = packs.map((item) => item.id)
    const assets = await this.db
      .select({
        id: this.emojiAsset.id,
        kind: this.emojiAsset.kind,
        shortcode: this.emojiAsset.shortcode,
        unicodeSequence: this.emojiAsset.unicodeSequence,
        imageUrl: this.emojiAsset.imageUrl,
        staticUrl: this.emojiAsset.staticUrl,
        isAnimated: this.emojiAsset.isAnimated,
        category: this.emojiAsset.category,
        keywords: this.emojiAsset.keywords,
        packId: this.emojiAsset.packId,
        sortOrder: this.emojiAsset.sortOrder,
      })
      .from(this.emojiAsset)
      .where(
        and(
          this.buildActiveAssetCondition(),
          inArray(this.emojiAsset.packId, packIds),
        ),
      )
      .orderBy(
        this.emojiAsset.packId,
        this.emojiAsset.sortOrder,
        this.emojiAsset.id,
      )

    const assetsByPackId = new Map<number, EmojiAssetSnapshot[]>()

    for (const asset of assets) {
      const pack = packs.find((item) => item.id === asset.packId)
      if (!pack) {
        continue
      }
      const snapshot = this.toAssetSnapshot({
        ...asset,
        packCode: pack.code,
        packName: pack.name,
        packIconUrl: pack.iconUrl,
        packSortOrder: pack.sortOrder,
      })
      if (!assetsByPackId.has(pack.id)) {
        assetsByPackId.set(pack.id, [])
      }
      assetsByPackId.get(pack.id)!.push(snapshot)
    }

    return packs.map((pack) => ({
      packId: pack.id,
      packCode: pack.code,
      packName: pack.name,
      packIconUrl: pack.iconUrl,
      sortOrder: pack.sortOrder,
      assets: assetsByPackId.get(pack.id) ?? [],
    }))
  }

  /**
   * 按关键字搜索表情资源。
   * - 搜索范围包括 shortcode、category、unicodeSequence 和 keywords。
   * - 只返回当前场景可见且启用的资源。
   * - 结果数量受 EMOJI_SEARCH_LIMIT_MAX 限制。
   */
  async search(input: EmojiSearchInput): Promise<EmojiAssetSnapshot[]> {
    const { scene } = input
    const keyword = input.q.trim()
    if (!keyword) {
      return []
    }

    const limit = this.normalizeSearchLimit(input.limit)
    const escapedKeyword = escapeLikePattern(keyword)
    const keywordLike = `%${escapedKeyword}%`

    const searchCondition = or(
      ilike(this.emojiAsset.shortcode, keywordLike),
      ilike(this.emojiAsset.category, keywordLike),
      ilike(this.emojiAsset.unicodeSequence, keywordLike),
      // keywords 是 jsonb，当前按文本搜索保证兼容多语言关键词结构。
      sql`${this.emojiAsset.keywords}::text ilike ${keywordLike}`,
    )

    const rows = await this.db
      .select({
        id: this.emojiAsset.id,
        kind: this.emojiAsset.kind,
        shortcode: this.emojiAsset.shortcode,
        unicodeSequence: this.emojiAsset.unicodeSequence,
        imageUrl: this.emojiAsset.imageUrl,
        staticUrl: this.emojiAsset.staticUrl,
        isAnimated: this.emojiAsset.isAnimated,
        category: this.emojiAsset.category,
        keywords: this.emojiAsset.keywords,
        packId: this.emojiPack.id,
        packCode: this.emojiPack.code,
        packName: this.emojiPack.name,
        packIconUrl: this.emojiPack.iconUrl,
        packSortOrder: this.emojiPack.sortOrder,
        sortOrder: this.emojiAsset.sortOrder,
      })
      .from(this.emojiAsset)
      .innerJoin(this.emojiPack, eq(this.emojiAsset.packId, this.emojiPack.id))
      .where(
        and(
          this.buildActiveAssetCondition(),
          this.buildActivePackCondition(scene),
          searchCondition,
        ),
      )
      .orderBy(
        this.emojiPack.sortOrder,
        this.emojiAsset.sortOrder,
        this.emojiAsset.id,
      )
      .limit(limit)

    return rows.map((row) => this.toAssetSnapshot(row))
  }

  /**
   * 获取用户最近使用的表情列表。
   * - 按最后使用时间倒序、使用次数倒序排列。
   * - 当时间和次数相同时，按 emojiAssetId 升序稳定决胜。
   * - 只返回当前场景可见且启用的资源。
   * - 结果数量受 EMOJI_RECENT_LIMIT_MAX 限制。
   */
  async listRecent(input: EmojiRecentListInput): Promise<EmojiRecentItem[]> {
    const { scene, userId } = input
    const limit = this.normalizeRecentLimit(input.limit)

    const rows = await this.db
      .select({
        id: this.emojiAsset.id,
        kind: this.emojiAsset.kind,
        shortcode: this.emojiAsset.shortcode,
        unicodeSequence: this.emojiAsset.unicodeSequence,
        imageUrl: this.emojiAsset.imageUrl,
        staticUrl: this.emojiAsset.staticUrl,
        isAnimated: this.emojiAsset.isAnimated,
        category: this.emojiAsset.category,
        keywords: this.emojiAsset.keywords,
        packId: this.emojiPack.id,
        packCode: this.emojiPack.code,
        packName: this.emojiPack.name,
        packIconUrl: this.emojiPack.iconUrl,
        packSortOrder: this.emojiPack.sortOrder,
        sortOrder: this.emojiAsset.sortOrder,
        lastUsedAt: this.emojiRecentUsage.lastUsedAt,
        useCount: this.emojiRecentUsage.useCount,
      })
      .from(this.emojiRecentUsage)
      .innerJoin(
        this.emojiAsset,
        eq(this.emojiRecentUsage.emojiAssetId, this.emojiAsset.id),
      )
      .innerJoin(this.emojiPack, eq(this.emojiAsset.packId, this.emojiPack.id))
      .where(
        and(
          eq(this.emojiRecentUsage.userId, userId),
          eq(this.emojiRecentUsage.scene, scene),
          this.buildActiveAssetCondition(),
          this.buildActivePackCondition(scene),
        ),
      )
      .orderBy(
        desc(this.emojiRecentUsage.lastUsedAt),
        desc(this.emojiRecentUsage.useCount),
        asc(this.emojiRecentUsage.emojiAssetId),
      )
      .limit(limit)

    return rows.map((row) => ({
      ...this.toAssetSnapshot(row),
      lastUsedAt: row.lastUsedAt,
      useCount: row.useCount,
    }))
  }

  /**
   * 在既有事务中批量写入最近使用记录。
   * - 调用方需先完成事实写入，确保"消息发送成功才记 recent"的口径。
   * - 同一 userId+scene+emojiAssetId 只保留一条聚合记录，冲突时原子累加 useCount。
   * - 会再次校验资产在当前场景下仍然可见，避免脏 token 写入 recent。
   */
  async recordRecentUsageInTx(
    tx: Db,
    input: RecordEmojiRecentUsageInput,
  ): Promise<void> {
    const { items, scene, userId } = input
    if (items.length === 0) {
      return
    }

    const validItems = await this.filterActiveRecentUsageItems(tx, scene, items)
    if (validItems.length === 0) {
      return
    }

    const now = new Date()
    for (const item of validItems) {
      await tx
        .insert(this.emojiRecentUsage)
        .values({
          userId,
          scene,
          emojiAssetId: item.emojiAssetId,
          useCount: item.useCount,
          lastUsedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            this.emojiRecentUsage.userId,
            this.emojiRecentUsage.scene,
            this.emojiRecentUsage.emojiAssetId,
          ],
          set: {
            useCount: sql`${this.emojiRecentUsage.useCount} + ${item.useCount}`,
            lastUsedAt: now,
          },
        })
    }
  }

  /**
   * 过滤出当前场景仍可用的最近使用聚合项。
   * - 只保留启用、未删除、且对 scene 可见的表情资源。
   * - 同时过滤掉非正数 useCount，避免异常 token 产生脏数据。
   */
  private async filterActiveRecentUsageItems(
    tx: Db,
    scene: EmojiSceneEnum,
    items: EmojiRecentUsageItem[],
  ): Promise<EmojiRecentUsageItem[]> {
    const sanitizedItems = items.filter((item) => item.useCount > 0)
    if (sanitizedItems.length === 0) {
      return []
    }

    const targetAssetIds = [...new Set(sanitizedItems.map((item) => item.emojiAssetId))]
    const targets = await tx
      .select({ id: this.emojiAsset.id })
      .from(this.emojiAsset)
      .innerJoin(this.emojiPack, eq(this.emojiAsset.packId, this.emojiPack.id))
      .where(
        and(
          inArray(this.emojiAsset.id, targetAssetIds),
          this.buildActiveAssetCondition(),
          this.buildActivePackCondition(scene),
        ),
      )
    const activeIds = new Set(targets.map((item) => item.id))
    return sanitizedItems.filter((item) => activeIds.has(item.emojiAssetId))
  }

  /**
   * 根据短码列表批量查询自定义表情。
   * - 用于文本解析器将短码替换为表情图片。
   * - 只返回当前场景可见且启用的 CUSTOM 类型资源。
   * - 空输入直接返回空 Map，避免无意义 SQL。
   */
  async findCustomAssetsByShortcodes(
    scene: EmojiSceneEnum,
    shortcodes: string[],
  ): Promise<Map<string, EmojiShortcodeAsset>> {
    // 解析器调用场景中，空输入直接返回空映射，避免无意义 SQL。
    const uniqueShortcodes = [...new Set(shortcodes.filter(Boolean))]
    if (uniqueShortcodes.length === 0) {
      return new Map()
    }

    const rows = await this.db
      .select({
        emojiAssetId: this.emojiAsset.id,
        shortcode: this.emojiAsset.shortcode,
        packCode: this.emojiPack.code,
        packName: this.emojiPack.name,
        imageUrl: this.emojiAsset.imageUrl,
        staticUrl: this.emojiAsset.staticUrl,
        isAnimated: this.emojiAsset.isAnimated,
      })
      .from(this.emojiAsset)
      .innerJoin(this.emojiPack, eq(this.emojiAsset.packId, this.emojiPack.id))
      .where(
        and(
          this.buildActiveAssetCondition(),
          this.buildActivePackCondition(scene),
          eq(this.emojiAsset.kind, EmojiAssetKindEnum.CUSTOM),
          isNotNull(this.emojiAsset.shortcode),
          inArray(this.emojiAsset.shortcode, uniqueShortcodes),
          isNotNull(this.emojiAsset.imageUrl),
        ),
      )

    const map = new Map<string, EmojiShortcodeAsset>()
    for (const row of rows) {
      if (!row.shortcode || !row.imageUrl) {
        continue
      }
      map.set(row.shortcode, {
        emojiAssetId: row.emojiAssetId,
        shortcode: row.shortcode,
        packCode: row.packCode,
        packName: row.packName,
        imageUrl: row.imageUrl,
        staticUrl: row.staticUrl,
        isAnimated: row.isAnimated,
        ariaLabel: `${row.packName}:${row.shortcode}`,
      })
    }
    return map
  }

  /**
   * 根据 Unicode 序列批量查询平台托管的 Unicode 表情。
   * - 用于解析器为 unicode token 补齐 emojiAssetId。
   * - 若同一序列命中多个可用资源，按包排序和资源排序取首个，保证结果稳定。
   */
  async findUnicodeAssetsBySequences(
    scene: EmojiSceneEnum,
    unicodeSequences: string[],
  ): Promise<Map<string, EmojiUnicodeAsset>> {
    const uniqueUnicodeSequences = [...new Set(unicodeSequences.filter(Boolean))]
    if (uniqueUnicodeSequences.length === 0) {
      return new Map()
    }

    const rows = await this.db
      .select({
        emojiAssetId: this.emojiAsset.id,
        unicodeSequence: this.emojiAsset.unicodeSequence,
      })
      .from(this.emojiAsset)
      .innerJoin(this.emojiPack, eq(this.emojiAsset.packId, this.emojiPack.id))
      .where(
        and(
          this.buildActiveAssetCondition(),
          this.buildActivePackCondition(scene),
          eq(this.emojiAsset.kind, EmojiAssetKindEnum.UNICODE),
          isNotNull(this.emojiAsset.unicodeSequence),
          inArray(this.emojiAsset.unicodeSequence, uniqueUnicodeSequences),
        ),
      )
      .orderBy(
        this.emojiPack.sortOrder,
        this.emojiAsset.sortOrder,
        this.emojiAsset.id,
      )

    const map = new Map<string, EmojiUnicodeAsset>()
    for (const row of rows) {
      if (!row.unicodeSequence || map.has(row.unicodeSequence)) {
        continue
      }
      map.set(row.unicodeSequence, {
        emojiAssetId: row.emojiAssetId,
        unicodeSequence: row.unicodeSequence,
      })
    }
    return map
  }
}
