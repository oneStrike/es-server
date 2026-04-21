import type { SensitiveWordLevelEnum, SensitiveWordTypeEnum } from './sensitive-word-constant'
import 'reflect-metadata'
import { MatchModeEnum } from './sensitive-word-constant'
import { SensitiveWordDetectService } from './sensitive-word-detect.service'

function createWord(params: {
  id: number
  word: string
  matchMode?: MatchModeEnum
  level?: SensitiveWordLevelEnum
  type?: SensitiveWordTypeEnum
}) {
  return {
    id: params.id,
    word: params.word,
    replaceWord: null,
    level: params.level ?? 2,
    type: params.type ?? 5,
    matchMode: params.matchMode ?? MatchModeEnum.EXACT,
    isEnabled: true,
    version: 0,
    remark: null,
    createdBy: null,
    updatedBy: null,
    hitCount: 0,
    lastHitAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('SensitiveWordDetectService', () => {
  it('falls back to direct db loading when cache preload fails on startup', async () => {
    const cacheService = {
      preloadCache: jest.fn().mockRejectedValue(new Error('redis unavailable')),
      getAllWords: jest.fn(),
      loadAllWordsFromDb: jest.fn().mockResolvedValue([
        createWord({
          id: 1,
          word: '违禁词',
        }),
      ]),
    }
    const service = new SensitiveWordDetectService(cacheService as never)

    await service.onModuleInit()

    expect(cacheService.loadAllWordsFromDb).toHaveBeenCalledTimes(1)
    expect(service.isReady()).toBe(true)
    expect(service.getMatchedWords({ content: '这里有违禁词' }).hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          word: '违禁词',
        }),
      ]),
    )
  })

  it('detects each topic field independently instead of allowing cross-field matches', () => {
    const cacheService = {
      preloadCache: jest.fn(),
      getAllWords: jest.fn(),
      loadAllWordsFromDb: jest.fn(),
    }
    const service = new SensitiveWordDetectService(cacheService as never)
    service.initialize([
      createWord({
        id: 1,
        word: '标题正文',
      }),
    ])

    const separated = (
      service as unknown as {
        getMatchedWordsWithMetadataBySegments: (
          inputs: Array<{ field: 'title' | 'content'; content: string }>,
        ) => { hits: Array<{ word: string }> }
      }
    ).getMatchedWordsWithMetadataBySegments([
      { field: 'title', content: '标题' },
      { field: 'content', content: '正文' },
    ])

    expect(separated.hits).toEqual([])
  })
})
