/**
 * 模糊匹配结果接口
 */
import { BKTree } from './bk-tree'

export interface FuzzyMatchResult {
  word: string
  start: number
  end: number
  distance: number
}

/**
 * 模糊匹配器类
 * 基于Levenshtein距离算法实现模糊字符串匹配
 * 集成 BK-Tree 数据结构以提升大规模数据下的查询性能
 */
export class FuzzyMatcher {
  private words: string[]
  private maxDistance: number
  private bkTree: BKTree
  private useBKTree: boolean

  /**
   * 构造函数
   * @param maxDistance - 最大编辑距离，默认为2
   * @param useBKTree - 是否使用 BK-Tree 优化，默认为 true
   */
  constructor(maxDistance: number = 2, useBKTree: boolean = true) {
    if (maxDistance < 0) {
      throw new Error('maxDistance must be non-negative')
    }
    this.words = []
    this.maxDistance = maxDistance
    this.bkTree = new BKTree(maxDistance)
    this.useBKTree = useBKTree
  }

  /**
   * 设置待匹配的敏感词列表
   * @param words - 敏感词列表
   */
  setWords(words: string[]) {
    if (!words) {
      this.words = []
      if (this.useBKTree) {
        this.bkTree.build([])
      }
      return
    }
    this.words = words.filter((w) => w && w.length > 0)
    if (this.useBKTree) {
      this.bkTree.build(this.words)
    }
  }

  /**
   * 设置最大编辑距离
   * @param distance - 最大编辑距离
   */
  setMaxDistance(distance: number) {
    if (distance < 0) {
      throw new Error('maxDistance must be non-negative')
    }
    this.maxDistance = distance
    this.bkTree.setMaxDistance(distance)
    if (this.useBKTree && this.words.length > 0) {
      this.bkTree.build(this.words)
    }
  }

  /**
   * 检查文本中是否包含任何模糊匹配的敏感词
   * @param text - 待检查的文本
   * @returns 是否包含匹配的敏感词
   */
  hasMatch(text: string): boolean {
    if (!text || text.length === 0) {
      return false
    }

    if (this.words.length === 0) {
      return false
    }

    const results = this.match(text)
    return results.length > 0
  }

  /**
   * 在文本中查找第一个模糊匹配的敏感词
   * @param text - 待匹配的文本
   * @returns 第一个匹配结果，如果没有匹配则返回null
   */
  findFirstMatch(text: string) {
    if (!text || text.length === 0) {
      return null
    }

    if (this.words.length === 0) {
      return null
    }

    const results = this.match(text)
    if (results.length === 0) {
      return null
    }

    return results[0]
  }

  /**
   * 在文本中执行模糊匹配
   * @param text - 待匹配的文本
   * @returns 模糊匹配结果列表
   */
  match(text: string) {
    if (!text || text.length === 0) {
      return []
    }

    if (this.useBKTree && this.words.length > 0) {
      return this.matchWithBKTree(text)
    }

    return this.matchBruteForce(text)
  }

  /**
   * 使用 BK-Tree 进行模糊匹配
   * 适用于大规模敏感词场景，性能更优
   * @param text - 待匹配的文本
   * @returns 模糊匹配结果列表
   */
  private matchWithBKTree(text: string) {
    const results: FuzzyMatchResult[] = []
    const textLen = text.length

    for (let i = 0; i < textLen; i++) {
      const maxEnd = Math.min(i + this.maxDistance * 2 + 10, textLen)
      for (let j = i + 1; j <= maxEnd; j++) {
        const substring = text.substring(i, j)
        const matchedWords = this.bkTree.search(substring)

        for (const word of matchedWords) {
          const distance = this.calculateLevenshteinDistance(word, substring)
          if (distance <= this.maxDistance) {
            results.push({
              word,
              start: i,
              end: j - 1,
              distance,
            })
          }
        }
      }
    }

    return results.sort((a, b) => a.start - b.start)
  }

  /**
   * 使用暴力算法进行模糊匹配
   * 适用于小规模敏感词场景
   * @param text - 待匹配的文本
   * @returns 模糊匹配结果列表
   */
  private matchBruteForce(text: string) {
    const results: FuzzyMatchResult[] = []

    for (const word of this.words) {
      const matches = this.matchWord(text, word)
      results.push(...matches)
    }

    return results.sort((a, b) => a.start - b.start)
  }

  /**
   * 匹配单个敏感词
   * @param text - 待匹配的文本
   * @param word - 敏感词
   * @returns 模糊匹配结果列表
   */
  private matchWord(text: string, word: string) {
    const results: FuzzyMatchResult[] = []
    const wordLen = word.length
    const textLen = text.length

    for (let i = 0; i <= textLen - wordLen + this.maxDistance; i++) {
      const end = Math.min(i + wordLen + this.maxDistance, textLen)
      const substring = text.substring(i, end)

      if (!this.quickFilter(word, substring)) {
        continue
      }

      const distance = this.calculateLevenshteinDistance(word, substring)

      if (distance <= this.maxDistance) {
        results.push({
          word,
          start: i,
          end: i + substring.length - 1,
          distance,
        })
      }
    }

    return results
  }

  /**
   * 快速过滤明显不匹配的情况
   * 通过字符集合差异和长度差异快速判断是否需要计算完整编辑距离
   * @param word - 敏感词
   * @param substring - 待匹配子串
   * @returns 是否可能匹配
   */
  private quickFilter(word: string, substring: string) {
    if (Math.abs(word.length - substring.length) > this.maxDistance) {
      return false
    }

    const wordSet = new Set(word)
    const substringSet = new Set(substring)
    const commonChars = [...wordSet].filter((char) =>
      substringSet.has(char),
    ).length

    if (wordSet.size - commonChars > this.maxDistance) {
      return false
    }

    return true
  }

  /**
   * 计算两个字符串的Levenshtein距离
   * 使用滚动数组优化空间复杂度，并添加提前终止机制
   * @param str1 - 第一个字符串
   * @param str2 - 第二个字符串
   * @returns 编辑距离
   */
  private calculateLevenshteinDistance(str1: string, str2: string) {
    const len1 = str1.length
    const len2 = str2.length

    if (len1 === 0) {
      return len2
    }
    if (len2 === 0) {
      return len1
    }

    if (Math.abs(len1 - len2) > this.maxDistance) {
      return this.maxDistance + 1
    }

    let prevRow: number[] = Array.from({ length: len2 + 1 }, (_, i) => i)
    let currRow: number[] = Array.from({ length: len2 + 1 }, (_, i) => i)

    for (let i = 1; i <= len1; i++) {
      currRow[0] = i
      let minDistance = len2

      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        currRow[j] = Math.min(
          prevRow[j] + 1,
          currRow[j - 1] + 1,
          prevRow[j - 1] + cost,
        )
        minDistance = Math.min(minDistance, currRow[j])
      }

      if (minDistance > this.maxDistance) {
        return this.maxDistance + 1
      }

      ;[prevRow, currRow] = [currRow, prevRow]
    }

    return prevRow[len2]
  }
}
