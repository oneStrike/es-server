/// <reference types="jest" />
import { EmojiSceneEnum } from './emoji.constant'
import { EmojiParserService } from './emoji-parser.service'

describe('EmojiParserService', () => {
  it('parses common composed unicode emoji as single unicode tokens', async () => {
    const emojiCatalogService = {
      findCustomAssetsByShortcodes: jest.fn().mockResolvedValue(new Map()),
      findUnicodeAssetsBySequences: jest.fn().mockResolvedValue(
        new Map([
          ['👍🏻', { emojiAssetId: 11, unicodeSequence: '👍🏻' }],
          ['🇨🇳', { emojiAssetId: 12, unicodeSequence: '🇨🇳' }],
          ['1️⃣', { emojiAssetId: 13, unicodeSequence: '1️⃣' }],
          ['🧑🏽‍💻', { emojiAssetId: 14, unicodeSequence: '🧑🏽‍💻' }],
        ]),
      ),
    }

    const service = new EmojiParserService(emojiCatalogService as never)

    await expect(
      service.parse({
        body: '前👍🏻🇨🇳1️⃣🧑🏽‍💻后',
        scene: EmojiSceneEnum.CHAT,
      }),
    ).resolves.toEqual([
      { type: 'text', text: '前' },
      { type: 'emojiUnicode', unicodeSequence: '👍🏻', emojiAssetId: 11 },
      { type: 'emojiUnicode', unicodeSequence: '🇨🇳', emojiAssetId: 12 },
      { type: 'emojiUnicode', unicodeSequence: '1️⃣', emojiAssetId: 13 },
      { type: 'emojiUnicode', unicodeSequence: '🧑🏽‍💻', emojiAssetId: 14 },
      { type: 'text', text: '后' },
    ])
  })
})
