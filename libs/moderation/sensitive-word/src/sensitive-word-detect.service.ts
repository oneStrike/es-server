import type { sensitiveWord } from '@db/schema'
import type { SensitiveWordLevelEnum } from './sensitive-word-constant'
import type {
  FuzzyMatchResult,
  MatchedWord,
  MatchResult,
  SensitiveWordDetectedHit,
  SensitiveWordDetectResult,
  SensitiveWordInternalDetectResult,
} from './sensitive-word.types'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import {
  SensitiveWordDetectDto,
  SensitiveWordReplaceDto,
} from './dto/sensitive-word.dto'
import { SensitiveWordCacheService } from './sensitive-word-cache.service'
import { MatchModeEnum } from './sensitive-word-constant'
import { ACAutomaton } from './utils/ac-automaton'
import { FuzzyMatcher } from './utils/fuzzy-matcher'

/**
 * 敏感词检测服务类
 * 提供敏感词检测、过滤、替换等功能
 * 支持精确匹配和模糊匹配两种模式
 */
@Injectable()
export class SensitiveWordDetectService implements OnModuleInit {
  private readonly logger = new Logger(SensitiveWordDetectService.name)
  private automaton: ACAutomaton
  private fuzzyMatcher: FuzzyMatcher
  private wordMap: Map<string, typeof sensitiveWord.$inferSelect>
  private isInitialized: boolean

  /**
   * 构造函数
   * @param cacheService - 缓存服务
   */
  constructor(private readonly cacheService: SensitiveWordCacheService) {
    this.automaton = new ACAutomaton()
    this.fuzzyMatcher = new FuzzyMatcher()
    this.wordMap = new Map()
    this.isInitialized = false
  }

  /**
   * 模块初始化钩子
   * 预加载缓存并初始化敏感词检测器
   */
  async onModuleInit(): Promise<void> {
    await this.cacheService.preloadCache()
    const words = await this.cacheService.getAllWords()
    this.initialize(words)
  }

  /**
   * 初始化敏感词检测器
   * @param words - 敏感词列表
   */
  initialize(words: Array<typeof sensitiveWord.$inferSelect>) {
    if (!words || words.length === 0) {
      this.automaton.clear()
      this.wordMap.clear()
      this.isInitialized = false
      return
    }

    const exactWordList = words
      .filter((w) => w.isEnabled && w.word)
      .filter((w) => w.matchMode === MatchModeEnum.EXACT)
      .map((w) => w.word)

    this.automaton.build(exactWordList)

    const fuzzyWordList = words
      .filter(
        (w) => w.isEnabled && w.word && w.matchMode === MatchModeEnum.FUZZY,
      )
      .map((w) => w.word)

    this.fuzzyMatcher.setWords(fuzzyWordList)

    this.wordMap.clear()
    words.forEach((w) => {
      if (w.isEnabled && w.word) {
        this.wordMap.set(w.word, w)
      }
    })

    this.isInitialized = true
    this.logger.log(
      `初始化敏感词检测器，共 ${this.wordMap.size} 个敏感词（${exactWordList.length} 个精确匹配，${fuzzyWordList.length} 个模糊匹配）`,
    )
  }

  /**
   * 重新加载敏感词
   * 从缓存中重新加载敏感词数据并初始化检测器
   */
  async reloadWords(): Promise<void> {
    const words = await this.cacheService.getAllWords()
    this.initialize(words)
    this.logger.log('已从缓存重新加载敏感词')
  }

  /**
   * 获取包含内部元数据的敏感词命中结果。
   * 该结果供写路径记录命中统计与替换裁剪使用，不直接暴露给 HTTP 层。
   */
  getMatchedWordsWithMetadata(
    dto: SensitiveWordDetectDto,
  ): SensitiveWordInternalDetectResult {
    const { content } = dto

    if (!this.isInitialized || !content) {
      return {
        hits: [],
        publicHits: [],
      }
    }

    const hits = this.collectDetectedHits(content)

    return {
      hits,
      publicHits: hits.map((hit) => this.toPublicHit(hit)),
      highestLevel: this.resolveHighestLevel(hits),
    }
  }

  /**
   * 获取内容中匹配的敏感词列表
   * @param dto 检测参数，包含文本与匹配模式
   * @returns 匹配的敏感词列表
   */
  getMatchedWords(dto: SensitiveWordDetectDto): SensitiveWordDetectResult {
    const result = this.getMatchedWordsWithMetadata(dto)

    return {
      hits: result.publicHits,
      highestLevel: result.highestLevel,
    }
  }

  /**
   * 检测内容中的敏感词
   * @param dto - 检测请求对象
   * @returns 检测结果，包含最高敏感词级别和匹配的敏感词列表
   */
  detect(dto: SensitiveWordDetectDto) {
    const result = this.getMatchedWords(dto)

    return {
      highestLevel: result.highestLevel,
      hits: result.hits || [],
    }
  }

  /**
   * 获取文件的敏感词最高等级
   * @param dto - 检测请求对象
   * @returns 敏感词最高等级，如果没有敏感词则返回 undefined
   */
  getHighestSensitiveWordLevel(dto: SensitiveWordDetectDto) {
    return this.getMatchedWordsWithMetadata(dto).highestLevel
  }

  /**
   * 替换文本中的敏感词
   * @param dto - 替换请求对象
   * @returns 替换后的文本
   */
  replaceSensitiveWords(dto: SensitiveWordReplaceDto) {
    if (!this.isInitialized || !dto.content) {
      return dto.content
    }

    const { hits } = this.getMatchedWordsWithMetadata(dto)
    const replacementHits = this.resolveReplacementHits(hits)

    if (replacementHits.length === 0) {
      return dto.content
    }

    return this.replaceWords(dto.content, replacementHits, dto.replaceChar)
  }

  /**
   * 替换文本中的敏感词（内部方法）
   * @param text - 原始文本
   * @param matchedWords - 匹配到的敏感词列表
   * @param replaceChar - 替换字符，仅在敏感词未配置替换词时使用
   * @returns 替换后的文本
   */
  private replaceWords(
    text: string,
    matchedWords: SensitiveWordDetectedHit[],
    replaceChar?: string,
  ): string {
    if (matchedWords.length === 0) {
      return text
    }

    let cursor = 0
    let result = ''

    matchedWords.forEach((matched) => {
      const replacement = matched.replaceWord
        ? matched.replaceWord
        : (replaceChar || '*').repeat(matched.word.length)

      result += text.slice(cursor, matched.start)
      result += replacement
      cursor = matched.end + 1
    })

    result += text.slice(cursor)
    return result
  }

  /**
   * 检查检测器是否已初始化
   * @returns 是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized
  }

  /**
   * 获取敏感词数量
   * @returns 敏感词数量
   */
  getWordCount(): number {
    return this.wordMap.size
  }

  /**
   * 收集所有模式下的命中结果，并在同一词条同一区间维度做去重。
   */
  private collectDetectedHits(content: string): SensitiveWordDetectedHit[] {
    const exactHits = this.normalizeResults(
      this.automaton.match(content),
      MatchModeEnum.EXACT,
    )
    const fuzzyHits = this.normalizeFuzzyResults(this.fuzzyMatcher.match(content))

    const dedupeMap = new Map<string, SensitiveWordDetectedHit>()
    ;[...exactHits, ...fuzzyHits].forEach((hit) => {
      const key = `${hit.sensitiveWordId}:${hit.start}:${hit.end}`
      const existing = dedupeMap.get(key)
      if (!existing || this.compareHitPriority(hit, existing) < 0) {
        dedupeMap.set(key, hit)
      }
    })

    return this.collapseOverlappingWordHits(
      [...dedupeMap.values()].sort((prev, next) =>
        this.compareHitPriority(prev, next),
      ),
    )
  }

  /**
   * 将 AC / BK-Tree 原始结果归一化为内部富命中结构。
   */
  private normalizeResults(
    results: Array<MatchResult | FuzzyMatchResult>,
    matchMode: MatchModeEnum,
  ): SensitiveWordDetectedHit[] {
    return results.flatMap((result) => {
      const wordInfo = this.wordMap.get(result.word)
      if (!wordInfo || wordInfo.matchMode !== matchMode) {
        return []
      }

      return [
        {
          sensitiveWordId: wordInfo.id,
          word: result.word,
          start: result.start,
          end: result.end,
          level: wordInfo.level,
          type: wordInfo.type,
          replaceWord: wordInfo.replaceWord,
          matchMode: wordInfo.matchMode,
        },
      ]
    })
  }

  /**
   * 归一化模糊匹配结果，并按“同词条同起点”保留最佳候选。
   * BK-Tree 会产出多个不同长度的候选子串，这里统一裁成稳定结果。
   */
  private normalizeFuzzyResults(results: FuzzyMatchResult[]) {
    const candidateMap = new Map<string, SensitiveWordDetectedHit & { distance: number }>()

    results.forEach((result) => {
      const wordInfo = this.wordMap.get(result.word)
      if (!wordInfo || wordInfo.matchMode !== MatchModeEnum.FUZZY) {
        return
      }

      const candidate: SensitiveWordDetectedHit & { distance: number } = {
        sensitiveWordId: wordInfo.id,
        word: result.word,
        start: result.start,
        end: result.end,
        level: wordInfo.level,
        type: wordInfo.type,
        replaceWord: wordInfo.replaceWord,
        matchMode: wordInfo.matchMode,
        distance: result.distance,
      }
      const key = `${candidate.sensitiveWordId}:${candidate.start}`
      const existing = candidateMap.get(key)

      if (
        !existing ||
        candidate.distance < existing.distance ||
        (candidate.distance === existing.distance &&
          this.compareHitPriority(candidate, existing) < 0)
      ) {
        candidateMap.set(key, candidate)
      }
    })

    const collapsedCandidates: Array<
      SensitiveWordDetectedHit & { distance: number }
    > = []

    ;[...candidateMap.values()]
      .sort((prev, next) => {
        if (prev.start !== next.start) {
          return prev.start - next.start
        }

        if (prev.distance !== next.distance) {
          return prev.distance - next.distance
        }

        return this.compareHitPriority(prev, next)
      })
      .forEach((candidate) => {
        const lastCandidate = collapsedCandidates.at(-1)
        if (
          lastCandidate &&
          lastCandidate.sensitiveWordId === candidate.sensitiveWordId &&
          candidate.start <= lastCandidate.end
        ) {
          if (
            candidate.distance < lastCandidate.distance ||
            (candidate.distance === lastCandidate.distance &&
              this.compareHitPriority(candidate, lastCandidate) < 0)
          ) {
            collapsedCandidates[collapsedCandidates.length - 1] = candidate
          }
          return
        }

        collapsedCandidates.push(candidate)
      })

    return collapsedCandidates.map(({ distance: _distance, ...hit }) => hit)
  }

  /**
   * 将内部富命中结构裁成对外命中结构。
   */
  private toPublicHit(hit: SensitiveWordDetectedHit): MatchedWord {
    return {
      word: hit.word,
      start: hit.start,
      end: hit.end,
      level: hit.level,
      type: hit.type,
      replaceWord: hit.replaceWord,
    }
  }

  /**
   * 计算命中结果中的最高敏感等级。
   * 数值越小表示等级越高。
   */
  private resolveHighestLevel(
    hits: SensitiveWordDetectedHit[],
  ): SensitiveWordLevelEnum | undefined {
    return hits.reduce<SensitiveWordLevelEnum | undefined>((current, hit) => {
      if (current === undefined || hit.level < current) {
        return hit.level
      }

      return current
    }, undefined)
  }

  /**
   * 替换前裁剪重叠命中区间。
   * 优先级固定为：start 更小优先；同 start 取更长命中；再取更高严重级；最后取 EXACT。
   */
  private resolveReplacementHits(hits: SensitiveWordDetectedHit[]) {
    const sortedHits = this.collapseOverlappingWordHits(
      [...hits].sort((prev, next) => this.compareHitPriority(prev, next)),
    )
    const selectedHits: SensitiveWordDetectedHit[] = []

    for (const hit of sortedHits) {
      const lastSelected = selectedHits.at(-1)
      if (lastSelected && hit.start <= lastSelected.end) {
        continue
      }

      selectedHits.push(hit)
    }

    return selectedHits
  }

  /**
   * 统一比较命中优先级。
   * 兼容检测结果排序、同位命中去重与替换冲突裁剪。
   */
  private compareHitPriority(
    prev: SensitiveWordDetectedHit,
    next: SensitiveWordDetectedHit,
  ) {
    if (prev.start !== next.start) {
      return prev.start - next.start
    }

    const prevLength = prev.end - prev.start
    const nextLength = next.end - next.start
    if (prevLength !== nextLength) {
      return nextLength - prevLength
    }

    if (prev.level !== next.level) {
      return prev.level - next.level
    }

    if (prev.matchMode !== next.matchMode) {
      return prev.matchMode - next.matchMode
    }

    if (prev.end !== next.end) {
      return prev.end - next.end
    }

    return prev.word.localeCompare(next.word)
  }

  /**
   * 折叠同一词条的重叠命中区间。
   * 主要用于压缩 BK-Tree 产出的相邻候选，避免同一处模糊命中被重复上报。
   */
  private collapseOverlappingWordHits(hits: SensitiveWordDetectedHit[]) {
    const collapsedHits: SensitiveWordDetectedHit[] = []

    hits.forEach((hit) => {
      const lastHit = collapsedHits.at(-1)
      if (
        lastHit &&
        lastHit.sensitiveWordId === hit.sensitiveWordId &&
        hit.start <= lastHit.end
      ) {
        if (this.compareHitPriority(hit, lastHit) < 0) {
          collapsedHits[collapsedHits.length - 1] = hit
        }
        return
      }

      collapsedHits.push(hit)
    })

    return collapsedHits
  }
}
