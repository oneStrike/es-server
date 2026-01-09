import type { TrieNode } from './trie-node'
import { createTrieNode } from './trie-node'

/**
 * 匹配结果接口
 * 包含匹配到的敏感词及其在文本中的位置信息
 */
export interface MatchResult {
  word: string
  start: number
  end: number
}

/**
 * AC自动机类（Aho-Corasick Automaton）
 * 基于AC自动机算法实现的多模式字符串匹配
 *
 * AC自动机是一种高效的多模式字符串匹配算法，时间复杂度为O(n + m)，
 * 其中n是文本长度，m是所有模式串的总长度。
 *
 * 主要特点：
 * - 可以同时匹配多个敏感词
 * - 使用失败指针（fail link）优化匹配过程
 * - 支持敏感词的动态构建和清空
 */
export class ACAutomaton {
  private root: TrieNode
  private built: boolean

  /**
   * 构造函数
   * 初始化AC自动机，创建根节点
   */
  constructor() {
    this.root = createTrieNode()
    this.built = false
  }

  /**
   * 构建AC自动机
   * 将敏感词列表插入到Trie树中，并构建失败指针
   * @param words - 敏感词列表
   */
  build(words: string[]) {
    if (!words || words.length === 0) {
      return
    }

    this.clear()
    this.built = false

    for (const word of words) {
      if (!word || word.length === 0) {
        continue
      }
      this.insert(word)
    }

    this.buildFailLinks()
    this.built = true
  }

  /**
   * 将敏感词插入到Trie树中
   * @param word - 敏感词
   */
  private insert(word: string) {
    let node = this.root
    for (let i = 0; i < word.length; i++) {
      const char = word[i]
      if (!node.children.has(char)) {
        node.children.set(char, createTrieNode(node.depth + 1))
      }
      node = node.children.get(char)!
    }
    node.output = true
    node.word = word
  }

  /**
   * 构建失败指针（fail link）
   * 失败指针用于在匹配失败时快速跳转到下一个可能的匹配位置
   * 使用广度优先搜索（BFS）遍历Trie树构建失败指针
   */
  private buildFailLinks() {
    const queue: TrieNode[] = []

    this.root.fail = null

    for (const child of this.root.children.values()) {
      child.fail = this.root
      queue.push(child)
    }

    while (queue.length > 0) {
      const current = queue.shift()!

      for (const [char, child] of current.children.entries()) {
        let fail = current.fail
        while (fail && !fail.children.has(char)) {
          fail = fail.fail
        }

        if (fail) {
          child.fail = fail.children.get(char) || this.root
        } else {
          child.fail = this.root
        }

        if (child.fail.output) {
          child.output = true
        }

        queue.push(child)
      }
    }
  }

  /**
   * 在文本中执行多模式匹配
   * 遍历文本中的每个字符，使用AC自动机查找所有匹配的敏感词
   * @param text - 待匹配的文本
   * @returns 匹配结果列表，包含所有匹配到的敏感词及其位置
   */
  match(text: string) {
    if (!this.built) {
      return []
    }

    if (!text || text.length === 0) {
      return []
    }

    const results: MatchResult[] = []
    let node = this.root

    for (let i = 0; i < text.length; i++) {
      const char = text[i]

      while (node !== this.root) {
        const child = node.children.get(char)
        if (child) {
          node = child
          break
        }
        node = node.fail || this.root
      }

      if (node === this.root) {
        const child = node.children.get(char)
        if (child) {
          node = child
        }
      }

      if (node.output) {
        this.collectResults(node, i, results)
      }
    }

    return results
  }

  /**
   * 检查文本中是否包含任何敏感词
   * @param text - 待检查的文本
   * @returns 是否包含敏感词
   */
  hasMatch(text: string) {
    if (!this.built) {
      return false
    }

    if (!text || text.length === 0) {
      return false
    }

    let node = this.root

    for (let i = 0; i < text.length; i++) {
      const char = text[i]

      while (node !== this.root) {
        const child = node.children.get(char)
        if (child) {
          node = child
          break
        }
        node = node.fail || this.root
      }

      if (node === this.root) {
        const child = node.children.get(char)
        if (child) {
          node = child
        }
      }

      if (node.output) {
        return true
      }
    }

    return false
  }

  /**
   * 在文本中查找第一个匹配的敏感词
   * @param text - 待匹配的文本
   * @returns 第一个匹配结果，如果没有匹配则返回null
   */
  findFirstMatch(text: string) {
    if (!this.built) {
      return null
    }

    if (!text || text.length === 0) {
      return null
    }

    let node = this.root

    for (let i = 0; i < text.length; i++) {
      const char = text[i]

      while (node !== this.root) {
        const child = node.children.get(char)
        if (child) {
          node = child
          break
        }
        node = node.fail || this.root
      }

      if (node === this.root) {
        const child = node.children.get(char)
        if (child) {
          node = child
        }
      }

      if (node.output) {
        const result = this.findFirstResult(node, i)
        if (result) {
          return result
        }
      }
    }

    return null
  }

  /**
   * 从当前节点开始查找第一个匹配结果
   * @param node - 当前节点
   * @param endPos - 匹配结束位置
   * @returns 第一个匹配结果，如果没有匹配则返回null
   */
  private findFirstResult(node: TrieNode, endPos: number) {
    let current: TrieNode | null = node

    while (current) {
      if (current.word) {
        return {
          word: current.word,
          start: endPos - current.word.length + 1,
          end: endPos,
        }
      }

      current = current.fail
    }

    return null
  }

  /**
   * 收集匹配结果
   * 从当前节点开始，沿着失败指针链收集所有匹配的敏感词
   * @param node - 当前节点
   * @param endPos - 匹配结束位置
   * @param results - 匹配结果列表
   */
  private collectResults(
    node: TrieNode,
    endPos: number,
    results: MatchResult[],
  ) {
    let current: TrieNode | null = node

    while (current) {
      if (current.word) {
        results.push({
          word: current.word,
          start: endPos - current.word.length + 1,
          end: endPos,
        })
      }

      current = current.fail
    }
  }

  /**
   * 清空AC自动机
   * 重置Trie树和构建状态
   */
  clear() {
    this.root = createTrieNode()
    this.built = false
  }

  /**
   * 检查AC自动机是否已构建
   * @returns 是否已构建
   */
  isBuilt() {
    return this.built
  }

  /**
   * 获取敏感词数量
   * @returns 敏感词数量
   */
  getWordCount() {
    let count = 0
    const stack: TrieNode[] = [this.root]

    while (stack.length > 0) {
      const node = stack.pop()!
      if (node.output) {
        count++
      }
      for (const child of node.children.values()) {
        stack.push(child)
      }
    }

    return count
  }
}
