import { MatchModeEnum, SensitiveWordLevelEnum, SensitiveWordTypeEnum } from './sensitive-word-constant'
import { SensitiveWordDetectService } from './sensitive-word-detect.service'

describe('sensitiveWordDetectService', () => {
  let service: SensitiveWordDetectService
  let cacheService: { preloadCache: jest.Mock, getAllWords: jest.Mock }

  beforeEach(() => {
    cacheService = {
      preloadCache: jest.fn(),
      getAllWords: jest.fn().mockResolvedValue([]),
    }
    service = new SensitiveWordDetectService(cacheService as any)
  })

  it('matchModeEnum 只保留 EXACT 和 FUZZY', () => {
    const enumValues = Object.values(MatchModeEnum).filter(
      (value): value is number => typeof value === 'number',
    )

    expect(enumValues).toEqual([
      MatchModeEnum.EXACT,
      MatchModeEnum.FUZZY,
    ])
  })

  it('默认检测会同时合并 EXACT 和 FUZZY 词条命中', () => {
    service.initialize([
      {
        id: 1,
        word: '测试',
        replaceWord: null,
        isEnabled: true,
        level: SensitiveWordLevelEnum.SEVERE,
        type: SensitiveWordTypeEnum.AD,
        matchMode: MatchModeEnum.EXACT,
        version: 0,
        remark: null,
        createdBy: null,
        updatedBy: null,
        hitCount: 0,
        lastHitAt: null,
        createdAt: new Date('2026-04-15T00:00:00.000Z'),
        updatedAt: new Date('2026-04-15T00:00:00.000Z'),
      },
      {
        id: 2,
        word: '禁止',
        replaceWord: null,
        isEnabled: true,
        level: SensitiveWordLevelEnum.GENERAL,
        type: SensitiveWordTypeEnum.OTHER,
        matchMode: MatchModeEnum.FUZZY,
        version: 0,
        remark: null,
        createdBy: null,
        updatedBy: null,
        hitCount: 0,
        lastHitAt: null,
        createdAt: new Date('2026-04-15T00:00:00.000Z'),
        updatedAt: new Date('2026-04-15T00:00:00.000Z'),
      },
    ] as any)

    const result = service.getMatchedWords({
      content: '这里有测试，还有禁上内容',
    })

    expect(result.hits.map((item) => item.word)).toEqual(['测试', '禁止'])
    expect(result.highestLevel).toBe(SensitiveWordLevelEnum.SEVERE)
  })

  it('替换文本时支持 replaceWord 比原词更短或更长', () => {
    service.initialize([
      {
        id: 1,
        word: '非常坏',
        replaceWord: '净',
        isEnabled: true,
        level: SensitiveWordLevelEnum.SEVERE,
        type: SensitiveWordTypeEnum.AD,
        matchMode: MatchModeEnum.EXACT,
        version: 0,
        remark: null,
        createdBy: null,
        updatedBy: null,
        hitCount: 0,
        lastHitAt: null,
        createdAt: new Date('2026-04-15T00:00:00.000Z'),
        updatedAt: new Date('2026-04-15T00:00:00.000Z'),
      },
      {
        id: 2,
        word: '坏词',
        replaceWord: '已净化',
        isEnabled: true,
        level: SensitiveWordLevelEnum.GENERAL,
        type: SensitiveWordTypeEnum.OTHER,
        matchMode: MatchModeEnum.EXACT,
        version: 0,
        remark: null,
        createdBy: null,
        updatedBy: null,
        hitCount: 0,
        lastHitAt: null,
        createdAt: new Date('2026-04-15T00:00:00.000Z'),
        updatedAt: new Date('2026-04-15T00:00:00.000Z'),
      },
    ] as any)

    expect(
      service.replaceSensitiveWords({
        content: '非常坏和坏词',
      }),
    ).toBe('净和已净化')
  })
})
