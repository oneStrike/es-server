import type { ForumSensitiveWord } from '@libs/base/database/prisma-client/client'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import {
  MatchedWordDto,
  SensitiveWordDetectDto,
  SensitiveWordReplaceDto,
} from './dto/sensitive-word-detect.dto'
import { SensitiveWordCacheService } from './sensitive-word-cache.service'
import {
  MatchModeEnum,
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
} from './sensitive-word-constant'
import { SensitiveWordStatisticsService } from './sensitive-word-statistics.service'
import { ACAutomaton, MatchResult } from './utils/ac-automaton'
import { FuzzyMatcher, FuzzyMatchResult } from './utils/fuzzy-matcher'

/**
 * 匹配到的敏感词信息接口
 */
export interface MatchedWord {
  word: string
  start: number
  end: number
  level: SensitiveWordLevelEnum
  type: SensitiveWordTypeEnum
  replaceWord?: string | null
}

/**
 * 敏感词检测选项接口
 */
export interface DetectOptions {
  replace?: boolean
  replaceChar?: string
  matchMode?: MatchModeEnum
}

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
  private wordMap: Map<string, ForumSensitiveWord>
  private isInitialized: boolean

  /**
   * 构造函数
   * @param cacheService - 缓存服务
   * @param statisticsService - 统计服务
   */
  constructor(
    private readonly cacheService: SensitiveWordCacheService,
    private readonly statisticsService: SensitiveWordStatisticsService,
  ) {
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
  initialize(words: ForumSensitiveWord[]) {
    if (!words || words.length === 0) {
      this.automaton.clear()
      this.wordMap.clear()
      this.isInitialized = false
      return
    }

    const wordList = words
      .filter((w) => w.isEnabled && w.word)
      .map((w) => w.word)

    this.automaton.build(wordList)

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
      `Initialized with ${wordList.length} sensitive words (${fuzzyWordList.length} fuzzy)`,
    )
  }

  /**
   * 重新加载敏感词
   * 从缓存中重新加载敏感词数据并初始化检测器
   */
  async reloadWords(): Promise<void> {
    const words = await this.cacheService.getAllWords()
    this.initialize(words)
    this.logger.log('Reloaded sensitive words from cache')
  }

  /**
   * 获取内容中匹配的敏感词列表
   * @param content - 待检测的文本内容
   * @param matchMode - 匹配模式，默认为精确匹配
   * @returns 匹配的敏感词列表
   */
  getMatchedWords(dto: SensitiveWordDetectDto) {
    const { content, matchMode = MatchModeEnum.EXACT } = dto

    if (!this.isInitialized || !content) {
      return {}
    }

    let results: (MatchResult | FuzzyMatchResult)[] = []

    if (matchMode === MatchModeEnum.FUZZY) {
      results = this.fuzzyMatcher.match(content)
    } else {
      results = this.automaton.match(content)
    }

    const matchedWords: MatchedWordDto[] = []
    let highestLevel: SensitiveWordLevelEnum | undefined

    results.forEach((result) => {
      const wordInfo = this.wordMap.get(result.word)
      if (wordInfo) {
        matchedWords.push({
          word: result.word,
          start: result.start,
          end: result.end,
          level: wordInfo.level,
          type: wordInfo.type,
          replaceWord: wordInfo.replaceWord,
        })

        if (highestLevel === undefined || wordInfo.level < highestLevel) {
          highestLevel = wordInfo.level
        }
      }
    })

    return {
      hits: matchedWords,
      highestLevel,
    }
  }

  /**
   * 获取文件的敏感词最高等级
   * @param dto - 检测请求对象
   * @returns 敏感词最高等级，如果没有敏感词则返回 undefined
   */
  getHighestSensitiveWordLevel(dto: SensitiveWordDetectDto) {
    if (!this.isInitialized || !dto.content) {
      return undefined
    }

    const { highestLevel } = this.getMatchedWords(dto)

    return highestLevel
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

    const { hits: matchedWords } = this.getMatchedWords(dto)

    if (matchedWords?.length === 0) {
      return dto.content
    }

    if (matchedWords) {
      return this.replaceWords(dto.content, matchedWords, dto.replaceChar)
    }
    return dto.content
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
    matchedWords: MatchedWordDto[],
    replaceChar?: string,
  ): string {
    if (matchedWords.length === 0) {
      return text
    }

    const result = text.split('')
    matchedWords.forEach((matched) => {
      const replacement = matched.replaceWord
        ? matched.replaceWord
        : (replaceChar || '*').repeat(matched.word.length)

      for (let i = 0; i < matched.word.length; i++) {
        const charIndex = matched.start + i
        if (charIndex < result.length && i < replacement.length) {
          result[charIndex] = replacement[i]
        }
      }
    })

    return result.join('')
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
    return this.automaton.getWordCount()
  }
}
