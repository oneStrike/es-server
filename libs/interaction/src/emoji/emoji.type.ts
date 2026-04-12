import type { EmojiAssetSelect, EmojiPackSelect, EmojiRecentUsageSelect } from '@db/schema'
import type { EmojiSceneEnum } from './emoji.constant'

/**
 * 分页查询公共输入。
 * - pageIndex/pageSize 语义与 PageDto 保持一致
 */
export interface EmojiPageQueryInput {
  pageSize?: number
  pageIndex?: number
  orderBy?: string
}

/**
 * 表情目录查询输入。
 * - 按场景筛选可见表情包
 */
export interface EmojiCatalogQueryInput {
  scene: EmojiSceneEnum
}

/**
 * 表情搜索输入。
 * - 按关键字与场景搜索
 */
export interface EmojiSearchInput extends EmojiCatalogQueryInput {
  q: string
  limit?: number
}

/**
 * 最近使用列表查询输入。
 * - 关联用户和场景返回最近使用记录
 */
export interface EmojiRecentListInput extends EmojiCatalogQueryInput {
  userId: EmojiRecentUsageSelect['userId']
  limit?: number
}

/**
 * 最近使用聚合项。
 * - 由上游先按 emojiAssetId 聚合，再写入最近使用表。
 */
export interface EmojiRecentUsageItem {
  emojiAssetId: EmojiRecentUsageSelect['emojiAssetId']
  useCount: EmojiRecentUsageSelect['useCount']
}

/**
 * 最近使用批量写入输入。
 * - 用于在事实写入成功后批量更新 userId + scene + emojiAssetId 聚合记录。
 */
export interface RecordEmojiRecentUsageInput extends EmojiCatalogQueryInput {
  userId: EmojiRecentUsageSelect['userId']
  items: EmojiRecentUsageItem[]
}

/**
 * 表情包分页查询输入。
 * - 复用实体字段并支持管理端筛选
 */
export type QueryEmojiPackPageInput = EmojiPageQueryInput &
  Partial<Pick<EmojiPackSelect, 'code' | 'name' | 'isEnabled' | 'visibleInPicker'>>

/**
 * 创建表情包输入。
 * - 复用表字段并保留 sceneType 必填约束
 * - sceneType 使用 EmojiSceneEnum[]，避免裸 number[] 语义不清
 */
export type CreateEmojiPackInput = Pick<EmojiPackSelect, 'code' | 'name'> & {
  sceneType: EmojiSceneEnum[]
} & Partial<
    Pick<EmojiPackSelect, 'description' | 'iconUrl' | 'sortOrder' | 'visibleInPicker'>
  >

/**
 * 更新表情包输入。
 * - 以 id 定位并按需更新字段
 */
export type UpdateEmojiPackInput = Pick<EmojiPackSelect, 'id'> &
  Partial<
    Pick<
      EmojiPackSelect,
      'code' | 'name' | 'description' | 'iconUrl' | 'sortOrder' | 'visibleInPicker'
    >
  > & {
    sceneType?: EmojiSceneEnum[]
  }

/**
 * 更新表情包场景输入。
 * - 仅允许修改 sceneType
 * - sceneType 单独使用 EmojiSceneEnum[] 约束
 */
export type UpdateEmojiPackSceneTypeInput = Pick<EmojiPackSelect, 'id'> & {
  sceneType: EmojiSceneEnum[]
}

/**
 * 表情资源分页查询输入。
 * - 支持按包、类型、状态和文本字段筛选
 */
export type QueryEmojiAssetPageInput = EmojiPageQueryInput &
  Partial<Pick<EmojiAssetSelect, 'packId' | 'kind' | 'isEnabled' | 'shortcode' | 'category'>>

/**
 * 创建表情资源输入。
 * - 复用实体字段并保留 packId/kind 必填
 */
export type CreateEmojiAssetInput = Pick<EmojiAssetSelect, 'packId' | 'kind'> &
  Partial<
    Pick<
      EmojiAssetSelect,
      'shortcode' | 'unicodeSequence' | 'imageUrl' | 'staticUrl' | 'isAnimated' | 'category' | 'keywords' | 'sortOrder'
    >
  >

/**
 * 更新表情资源输入。
 * - 以 id 定位并按需更新字段
 */
export type UpdateEmojiAssetInput = Pick<EmojiAssetSelect, 'id'> & Partial<CreateEmojiAssetInput>

/**
 * 表情资源校验载荷。
 * - 用于 custom / unicode 字段完整性判断
 */
export type ValidateEmojiAssetPayload = Partial<
  Pick<EmojiAssetSelect, 'shortcode' | 'unicodeSequence' | 'imageUrl'>
>

/**
 * 表情资源快照行。
 * - 对应目录/搜索/最近使用查询中的 join 投影
 */
export type EmojiAssetSnapshotRow = Pick<
  EmojiAssetSelect,
  'id' | 'kind' | 'shortcode' | 'unicodeSequence' | 'imageUrl' | 'staticUrl' | 'isAnimated' | 'category' | 'keywords' | 'packId' | 'sortOrder'
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
export type EmojiAssetSnapshot = Omit<EmojiAssetSnapshotRow, 'keywords'> & {
  keywords: Record<string, string[]> | null
}

/**
 * 目录中的表情包聚合结果。
 * - 含表情包基础信息与资源列表
 */
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
export type EmojiRecentItem = EmojiAssetSnapshot &
  Pick<EmojiRecentUsageSelect, 'lastUsedAt' | 'useCount'>

/**
 * 短码映射结果。
 * - 提供解析器替换 custom 表情所需的最小字段
 */
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
export interface EmojiUnicodeAsset {
  emojiAssetId: EmojiAssetSelect['id']
  unicodeSequence: NonNullable<EmojiAssetSelect['unicodeSequence']>
}

/**
 * 文本解析输入。
 * - 在指定场景下执行短码替换
 */
export interface EmojiParseInput {
  body: string
  scene: EmojiSceneEnum
}

/**
 * 文本解析输出 token。
 * - 保留 text / unicode / custom 三种结构
 */
export type EmojiParseToken =
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'mentionUser'
      userId: number
      nickname: string
      text: string
    }
    | {
      type: 'emojiUnicode'
      unicodeSequence: string
      emojiAssetId?: EmojiAssetSelect['id']
    }
    | {
      type: 'emojiCustom'
      emojiAssetId: EmojiAssetSelect['id']
      shortcode: string
      packCode: string
      imageUrl: string
      staticUrl?: string
      isAnimated: boolean
      ariaLabel?: string
    }
