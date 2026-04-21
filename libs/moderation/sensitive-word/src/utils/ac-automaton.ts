import type { MatchResult, TrieNode } from '../sensitive-word.types'
import { createTrieNode } from './trie-node'

// AC 自动机类（Aho-Corasick Automaton），基于 AC 自动机算法实现的多模式字符串匹配。
// AC 自动机是一种高效的多模式字符串匹配算法，时间复杂度为 O(n + m)，其中 n 是文本长度，m 是所有模式串的总长度。
// 主要特点：可以同时匹配多个敏感词；使用失败指针（fail link）优化匹配过程；支持敏感词的动态构建和清空。
export class ACAutomaton {
  private root: TrieNode
  private built: boolean

  // 构造函数，初始化 AC 自动机，创建根节点。
  constructor() {
    this.root = createTrieNode()
    this.built = false
  }

  // 构建 AC 自动机，将敏感词列表插入到 Trie 树中，并构建失败指针。
  build(words: string[]) {
    this.clear()
    this.built = false

    if (!words || words.length === 0) {
      return
    }

    for (const word of words) {
      if (!word || word.length === 0) {
        continue
      }
      this.insert(word)
    }

    this.buildFailLinks()
    this.built = true
  }

  // 将敏感词插入到 Trie 树中。
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

  // 构建失败指针（fail link），失败指针用于在匹配失败时快速跳转到下一个可能的匹配位置。
  // 使用广度优先搜索（BFS）遍历 Trie 树构建失败指针。
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

  // 在文本中执行多模式匹配，遍历文本中的每个字符，使用 AC 自动机查找所有匹配的敏感词。
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

  // 检查文本中是否包含任何敏感词。
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

  // 在文本中查找第一个匹配的敏感词。
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

  // 从当前节点开始查找第一个匹配结果。
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

  // 收集匹配结果，从当前节点开始，沿着失败指针链收集所有匹配的敏感词。
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

  // 清空 AC 自动机，重置 Trie 树和构建状态。
  clear() {
    this.root = createTrieNode()
    this.built = false
  }

  // 检查 AC 自动机是否已构建。
  isBuilt() {
    return this.built
  }

  // 获取敏感词数量。
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
