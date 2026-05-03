import type {
  EmojiAssetSelect,
  EmojiPackSelect,
  EmojiRecentUsageSelect,
} from '@db/schema'
import type { BodyToken } from '../body/body-token.type'

import type { EmojiSceneEnum } from './emoji.constant'

/**
 * 分页查询公共输入。
 * - pageIndex/pageSize 语义与 PageDto 保持一致
 */
/** 稳定领域类型 `EmojiPageQueryInput`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface EmojiPageQueryInput {
  pageSize?: number
  pageIndex?: number
  orderBy?: string
}

/**
 * 表情场景过滤参数。
 * - 仅用于内部查询链路，不承载 HTTP DTO 合同。
 */
/** 稳定领域类型 `EmojiSceneQueryParams`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface EmojiSceneQueryParams {
  scene: EmojiSceneEnum
}

/**
 * 最近使用列表查询输入。
 * - scene 为空时按全场景聚合最近使用记录。
 */
export interface EmojiRecentListInput {
  userId: EmojiRecentUsageSelect['userId']
  scene?: EmojiSceneEnum
  limit?: number
}

/**
 * 全场景最近使用查询输入。
 * - 仅供 catalog service 聚合 recent 记录时复用。
 */
export type EmojiRecentAllSceneListInput = Pick<
  EmojiRecentListInput,
  'userId' | 'limit'
>

/**
 * 最近使用聚合项。
 * - 由上游先按 emojiAssetId 聚合，再写入最近使用表。
 */
/** 稳定领域类型 `EmojiRecentUsageItem`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface EmojiRecentUsageItem {
  emojiAssetId: EmojiRecentUsageSelect['emojiAssetId']
  useCount: EmojiRecentUsageSelect['useCount']
}

/**
 * 最近使用批量写入输入。
 * - 用于在事实写入成功后批量更新 userId + scene + emojiAssetId 聚合记录。
 */
/** 稳定领域类型 `RecordEmojiRecentUsageInput`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface RecordEmojiRecentUsageInput extends EmojiSceneQueryParams {
  userId: EmojiRecentUsageSelect['userId']
  items: EmojiRecentUsageItem[]
}

/**
 * 表情资源校验载荷。
 * - 用于 custom / unicode 字段完整性判断
 */
/** 稳定领域类型 `ValidateEmojiAssetPayload`。仅供内部领域/服务链路复用，避免重复定义。 */
export type ValidateEmojiAssetPayload = Partial<
  Pick<EmojiAssetSelect, 'shortcode' | 'unicodeSequence' | 'imageUrl'>
>

/**
 * 表情资源快照行。
 * - 对应目录/搜索/最近使用查询中的 join 投影
 */
/** 稳定领域类型 `EmojiAssetSnapshotRow`。仅供内部领域/服务链路复用，避免重复定义。 */
export type EmojiAssetSnapshotRow = Pick<
  EmojiAssetSelect,
  | 'id'
  | 'kind'
  | 'shortcode'
  | 'unicodeSequence'
  | 'imageUrl'
  | 'staticUrl'
  | 'isAnimated'
  | 'category'
  | 'keywords'
  | 'packId'
  | 'sortOrder'
> & {
  packCode: EmojiPackSelect['code']
  packName: EmojiPackSelect['name']
  packIconUrl: EmojiPackSelect['iconUrl']
  packSortOrder: EmojiPackSelect['sortOrder']
}

/**
 * 表情资源快照。
 * - 统一用于目录、搜索和最近使用返回
 */
/** 稳定领域类型 `EmojiAssetSnapshot`。仅供内部领域/服务链路复用，避免重复定义。 */
export type EmojiAssetSnapshot = Omit<EmojiAssetSnapshotRow, 'keywords'> & {
  keywords: Record<string, string[]> | null
}

/**
 * 目录中的表情包聚合结果。
 * - 含表情包基础信息与资源列表
 */
/** 稳定领域类型 `EmojiCatalogPack`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface EmojiCatalogPack {
  packId: EmojiPackSelect['id']
  packCode: EmojiPackSelect['code']
  packName: EmojiPackSelect['name']
  packIconUrl: EmojiPackSelect['iconUrl']
  sortOrder: EmojiPackSelect['sortOrder']
  assets: EmojiAssetSnapshot[]
}

/**
 * 最近使用记录项。
 * - 在资源快照上补充使用时间和次数
 */
/** 稳定领域类型 `EmojiRecentItem`。仅供内部领域/服务链路复用，避免重复定义。 */
export type EmojiRecentItem = EmojiAssetSnapshot &
  Pick<EmojiRecentUsageSelect, 'lastUsedAt' | 'useCount'>

/**
 * 短码映射结果。
 * - 提供解析器替换 custom 表情所需的最小字段
 */
/** 稳定领域类型 `EmojiShortcodeAsset`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface EmojiShortcodeAsset {
  emojiAssetId: EmojiAssetSelect['id']
  shortcode: NonNullable<EmojiAssetSelect['shortcode']>
  packCode: EmojiPackSelect['code']
  packName: EmojiPackSelect['name']
  imageUrl: NonNullable<EmojiAssetSelect['imageUrl']>
  staticUrl: EmojiAssetSelect['staticUrl']
  isAnimated: EmojiAssetSelect['isAnimated']
  ariaLabel?: string
}

/**
 * Unicode 资源映射结果。
 * - 用于解析器为 Unicode token 补齐平台托管的 emojiAssetId。
 */
/** 稳定领域类型 `EmojiUnicodeAsset`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface EmojiUnicodeAsset {
  emojiAssetId: EmojiAssetSelect['id']
  unicodeSequence: NonNullable<EmojiAssetSelect['unicodeSequence']>
}

/**
 * 文本解析输入。
 * - 在指定场景下执行短码替换
 */
/** 稳定领域类型 `EmojiParseInput`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface EmojiParseInput {
  body: string
  scene: EmojiSceneEnum
}

/**
 * 文本解析输出 token。
 * 仅表示 EmojiParserService 能产出的普通文本与表情 token 子集。
 */
export type EmojiParseToken = Extract<
  BodyToken,
  { type: 'text' | 'emojiUnicode' | 'emojiCustom' }
>
