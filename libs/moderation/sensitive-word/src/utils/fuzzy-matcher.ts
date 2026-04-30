import type { FuzzyMatchResult } from '../sensitive-word.type'
import { BKTree } from './bk-tree'

// 模糊匹配器类，基于 Levenshtein 距离和 BK-Tree 实现模糊敏感词匹配。
export class FuzzyMatcher {
  private words: string[]
  private maxDistance: number
  private bkTree: BKTree
  private useBKTree: boolean
  private maxWordLength: number

  constructor(maxDistance: number = 2, useBKTree: boolean = true) {
    if (maxDistance < 0) {
      throw new Error('maxDistance 必须为非负数')
    }
    this.words = []
    this.maxDistance = maxDistance
    this.bkTree = new BKTree(maxDistance)
    this.useBKTree = useBKTree
    this.maxWordLength = 0
  }

  // 设置待匹配词表，并同步 BK-Tree 与最长词长度。
  setWords(words: string[]) {
    if (!words) {
      this.words = []
      this.maxWordLength = 0
      if (this.useBKTree) {
        this.bkTree.build([])
      }
      return
    }

    this.words = words.filter((word) => word && word.length > 0)
    this.maxWordLength = this.words.reduce(
      (current, word) => Math.max(current, word.length),
      0,
    )
    if (this.useBKTree) {
      this.bkTree.build(this.words)
    }
  }

  // 动态调整最大编辑距离后，重建 BK-Tree 保持查询边界一致。
  setMaxDistance(distance: number) {
    if (distance < 0) {
      throw new Error('maxDistance 必须为非负数')
    }
    this.maxDistance = distance
    this.bkTree.setMaxDistance(distance)
    if (this.useBKTree && this.words.length > 0) {
      this.bkTree.build(this.words)
    }
  }

  // 判断文本中是否存在任意模糊命中。
  hasMatch(text: string): boolean {
    if (!text || text.length === 0 || this.words.length === 0) {
      return false
    }

    return this.match(text).length > 0
  }

  // 返回第一个模糊命中，供只关心"是否命中"的场景复用。
  findFirstMatch(text: string) {
    if (!text || text.length === 0 || this.words.length === 0) {
      return null
    }

    const results = this.match(text)
    return results.length > 0 ? results[0] : null
  }

  // 根据当前策略选择 BK-Tree 或暴力匹配。
  match(text: string) {
    if (!text || text.length === 0) {
      return []
    }

    if (this.useBKTree && this.words.length > 0) {
      return this.matchWithBKTree(text)
    }

    return this.matchBruteForce(text)
  }

  // BK-Tree 路径按"最长词长 + 最大编辑距离"扩窗，避免长词被固定常数截断。
  private matchWithBKTree(text: string) {
    const results: FuzzyMatchResult[] = []
    const textLen = text.length
    const maxWindowLength = Math.max(1, this.maxWordLength + this.maxDistance)

    for (let i = 0; i < textLen; i++) {
      const maxEnd = Math.min(i + maxWindowLength, textLen)
      for (let j = i + 1; j <= maxEnd; j++) {
        const substring = text.substring(i, j)
        const matchedWords = this.bkTree.search(substring)

        for (const word of matchedWords) {
          if (!this.quickFilter(word, substring)) {
            continue
          }

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

  // 小规模词表时回退暴力匹配，避免 BK-Tree 构建开销。
  private matchBruteForce(text: string) {
    const results: FuzzyMatchResult[] = []

    for (const word of this.words) {
      results.push(...this.matchWord(text, word))
    }

    return results.sort((a, b) => a.start - b.start)
  }

  // 针对单个词条做滑窗模糊匹配。
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

  // 先用长度和字符集合过滤明显不可能的候选，减少完整距离计算。
  private quickFilter(word: string, substring: string) {
    if (Math.abs(word.length - substring.length) > this.maxDistance) {
      return false
    }

    const wordSet = new Set(word)
    const substringSet = new Set(substring)
    const commonChars = [...wordSet].filter((char) =>
      substringSet.has(char),
    ).length

    if (commonChars === 0) {
      return false
    }

    return wordSet.size - commonChars <= this.maxDistance
  }

  // 使用滚动数组计算 Levenshtein 距离，并在超阈值时提前终止。
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
