import type { BodyToken } from '../body/body-token.type'
import type { EmojiRecentUsageItem } from './emoji.type'

/**
 * 从正文 token 提取最近使用表情聚合项。
 * 仅统计平台托管且带 emojiAssetId 的 token，并在单条正文内先聚合 useCount。
 */
export function buildRecentEmojiUsageItems(
  bodyTokens: BodyToken[],
): EmojiRecentUsageItem[] {
  const useCountMap = new Map<number, number>()

  for (const token of bodyTokens) {
    if (
      token.type === 'text' ||
      token.type === 'mentionUser' ||
      !('emojiAssetId' in token) ||
      !token.emojiAssetId
    ) {
      continue
    }

    useCountMap.set(
      token.emojiAssetId,
      (useCountMap.get(token.emojiAssetId) ?? 0) + 1,
    )
  }

  return Array.from(useCountMap, ([emojiAssetId, useCount]) => ({
    emojiAssetId,
    useCount,
  }))
}
