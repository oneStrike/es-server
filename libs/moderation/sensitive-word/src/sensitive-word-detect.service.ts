import type { sensitiveWord } from '@db/schema'
import type {
  BaseSensitiveWordHitDto,
  SensitiveWordDetectDto,
  SensitiveWordDetectResponseDto,
  SensitiveWordReplaceDto,
} from './dto/sensitive-word.dto'
import type { SensitiveWordLevelEnum } from './sensitive-word-constant'
import type {
  FuzzyMatchResult,
  MatchResult,
  SensitiveWordDetectedHit,
  SensitiveWordHitFieldKey,
  SensitiveWordInternalDetectResult,
} from './sensitive-word.types'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
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

  constructor(private readonly cacheService: SensitiveWordCacheService) {
    this.automaton = new ACAutomaton()
    this.fuzzyMatcher = new FuzzyMatcher()
    this.wordMap = new Map()
    this.isInitialized = false
  }

  // 启动时优先预热缓存，缓存链路失败后回退数据库直读。
  async onModuleInit(): Promise<void> {
    try {
      const words = await this.loadWordsWithFallback({ preloadCache: true })
      this.initialize(words)
    } catch (error) {
      this.handleInitializationFailure(error)
    }
  }

  // 成功加载空词库也视为就绪，避免把“无词”误判成初始化失败。
  initialize(words: Array<typeof sensitiveWord.$inferSelect>) {
    this.resetDetector()

    const activeWords = words.filter((word) => word.isEnabled && word.word)
    if (activeWords.length === 0) {
      this.isInitialized = true
      this.logger.log('初始化敏感词检测器，共 0 个敏感词')
      return
    }

    const exactWordList = activeWords
      .filter((word) => word.matchMode === MatchModeEnum.EXACT)
      .map((word) => word.word)
    const fuzzyWordList = activeWords
      .filter((word) => word.matchMode === MatchModeEnum.FUZZY)
      .map((word) => word.word)

    this.automaton.build(exactWordList)
    this.fuzzyMatcher.setWords(fuzzyWordList)

    activeWords.forEach((word) => {
      this.wordMap.set(word.word, word)
    })
    this.isInitialized = true
    this.logger.log(
      `初始化敏感词检测器，共 ${this.wordMap.size} 个敏感词（${exactWordList.length} 个精确匹配，${fuzzyWordList.length} 个模糊匹配）`,
    )
  }

  // 重新加载词库时同样允许缓存失败后回退数据库直读。
  async reloadWords(): Promise<void> {
    const words = await this.loadWordsWithFallback()
    this.initialize(words)
    this.logger.log('已重新加载敏感词')
  }

  // 单字段场景默认标记为 content，保证位置语义稳定。
  getMatchedWordsWithMetadata(
    dto: SensitiveWordDetectDto,
  ): SensitiveWordInternalDetectResult {
    return this.getMatchedWordsWithMetadataBySegments([
      {
        field: 'content',
        content: dto.content,
      },
    ])
  }

  // 多字段场景分段检测，避免字段边界拼接制造假命中。
  getMatchedWordsWithMetadataBySegments(
    inputs: Array<{ field: SensitiveWordHitFieldKey, content: string }>,
  ): SensitiveWordInternalDetectResult {
    if (!this.isInitialized) {
      return {
        hits: [],
        publicHits: [],
      }
    }

    const hits = inputs.flatMap((input) =>
      input.content ? this.collectDetectedHits(input.content, input.field) : [],
    )

    return {
      hits,
      publicHits: hits.map((hit) => this.toPublicHit(hit)),
      highestLevel: this.resolveHighestLevel(hits),
    }
  }

  // 对外检测接口直接复用结构化响应 DTO。
  getMatchedWords(dto: SensitiveWordDetectDto): SensitiveWordDetectResponseDto {
    const result = this.getMatchedWordsWithMetadata(dto)
    return {
      hits: result.publicHits,
      highestLevel: result.highestLevel,
    }
  }

  // 管理端 detect 接口保持和 getMatchedWords 一致。
  detect(dto: SensitiveWordDetectDto): SensitiveWordDetectResponseDto {
    return this.getMatchedWords(dto)
  }

  // 获取文本命中的最高敏感词等级。
  getHighestSensitiveWordLevel(dto: SensitiveWordDetectDto) {
    return this.getMatchedWordsWithMetadata(dto).highestLevel
  }

  // 替换逻辑仍只作用于单段文本，不参与多字段位置合并。
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

  // 检测器状态用于管理端自检。
  isReady(): boolean {
    return this.isInitialized
  }

  // 当前已加载词数来自内存词表快照。
  getWordCount(): number {
    return this.wordMap.size
  }

  // 缓存链路失败时回退数据库直读，避免审核在故障窗口内直接失效。
  private async loadWordsWithFallback(options: { preloadCache?: boolean } = {}) {
    try {
      if (options.preloadCache) {
        await this.cacheService.preloadCache()
      }

      return await this.cacheService.getAllWords()
    } catch (cacheError) {
      const cacheMessage =
        cacheError instanceof Error ? cacheError.message : String(cacheError)
      this.logger.warn(`敏感词缓存读取失败，回退数据库直读：${cacheMessage}`)
      return this.cacheService.loadAllWordsFromDb()
    }
  }

  // 完全初始化失败时明确回到未就绪状态，而不是继续输出空命中结论。
  private handleInitializationFailure(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    this.resetDetector()
    this.logger.error(`敏感词检测器初始化失败：${message}`)
  }

  // 每次重建前清空自动机、模糊匹配器和内存索引。
  private resetDetector() {
    this.automaton.clear()
    this.fuzzyMatcher.setWords([])
    this.wordMap.clear()
    this.isInitialized = false
  }

  // 替换时仅处理不重叠命中区间，避免重复覆盖文本。
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

  // 单段文本内部先做去重与冲突裁剪，再回传带字段来源的命中结果。
  private collectDetectedHits(
    content: string,
    field: SensitiveWordHitFieldKey,
  ): SensitiveWordDetectedHit[] {
    const exactHits = this.normalizeResults(
      this.automaton.match(content),
      MatchModeEnum.EXACT,
      field,
    )
    const fuzzyHits = this.normalizeFuzzyResults(
      this.fuzzyMatcher.match(content),
      field,
    )

    const dedupeMap = new Map<string, SensitiveWordDetectedHit>()
    ;[...exactHits, ...fuzzyHits].forEach((hit) => {
      const key = `${hit.field}:${hit.sensitiveWordId}:${hit.start}:${hit.end}`
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

  // 将 AC 自动机结果归一化为内部富命中结构。
  private normalizeResults(
    results: Array<MatchResult | FuzzyMatchResult>,
    matchMode: MatchModeEnum,
    field: SensitiveWordHitFieldKey,
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
          field,
        },
      ]
    })
  }

  // 模糊匹配结果按“同字段 + 同词条 + 同起点”保留最佳候选。
  private normalizeFuzzyResults(
    results: FuzzyMatchResult[],
    field: SensitiveWordHitFieldKey,
  ) {
    const candidateMap = new Map<
      string,
      SensitiveWordDetectedHit & { distance: number }
    >()

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
        field,
        distance: result.distance,
      }
      const key = `${candidate.field}:${candidate.sensitiveWordId}:${candidate.start}`
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
          lastCandidate.field === candidate.field &&
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

  // 对外命中结果保留字段来源，避免多字段场景的位置语义丢失。
  private toPublicHit(hit: SensitiveWordDetectedHit): BaseSensitiveWordHitDto {
    return {
      word: hit.word,
      start: hit.start,
      end: hit.end,
      level: hit.level,
      type: hit.type,
      replaceWord: hit.replaceWord,
      field: hit.field,
    }
  }

  // 数值越小表示敏感等级越高。
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

  // 替换前只保留一组不重叠且优先级最高的命中区间。
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

  // 优先级依次为：起点更小、命中更长、等级更高、EXACT 优先、结束位置更小、词典序。
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

  // 只折叠同字段、同词条的重叠区间，避免跨字段结果被错误合并。
  private collapseOverlappingWordHits(hits: SensitiveWordDetectedHit[]) {
    const collapsedHits: SensitiveWordDetectedHit[] = []

    hits.forEach((hit) => {
      const lastHit = collapsedHits.at(-1)
      if (
        lastHit &&
        lastHit.field === hit.field &&
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
