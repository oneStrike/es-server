// BK-Tree 节点类，用于构建 Burkhard-Keller 树，支持基于编辑距离的模糊搜索。
export class BKTreeNode {
  word: string
  children: Map<number, BKTreeNode>

  constructor(word: string) {
    this.word = word
    this.children = new Map()
  }
}

// BK-Tree 类，一种基于编辑距离的树形数据结构，用于高效的模糊字符串搜索。
// 时间复杂度：构建 O(n log n)，查询 O(log n) 平均情况。
export class BKTree {
  private root: BKTreeNode | null = null
  private maxDistance: number = 2

  // 构造函数，参数 maxDistance 为最大编辑距离，默认为 2。
  constructor(maxDistance: number = 2) {
    this.maxDistance = maxDistance
  }

  // 设置最大编辑距离。
  setMaxDistance(distance: number) {
    this.maxDistance = distance
  }

  // 构建 BK-Tree。
  build(words: string[]) {
    this.root = null
    for (const word of words) {
      if (word && word.length > 0) {
        this.insert(word)
      }
    }
  }

  // 插入单词到 BK-Tree。
  private insert(word: string) {
    if (!this.root) {
      this.root = new BKTreeNode(word)
      return
    }

    let node = this.root
    while (true) {
      const distance = this.calculateLevenshteinDistance(word, node.word)
      if (distance === 0) {
        return
      }

      if (!node.children.has(distance)) {
        node.children.set(distance, new BKTreeNode(word))
        return
      }
      node = node.children.get(distance)!
    }
  }

  // 搜索与给定单词距离小于等于 maxDistance 的所有单词。
  search(query: string) {
    if (!this.root) {
      return []
    }

    const results: string[] = []
    this.searchRecursive(this.root, query, results)
    return results
  }

  // 递归搜索 BK-Tree。
  private searchRecursive(node: BKTreeNode, query: string, results: string[]) {
    const distance = this.calculateLevenshteinDistance(query, node.word)

    if (distance <= this.maxDistance) {
      results.push(node.word)
    }

    for (const [d, child] of node.children) {
      if (
        d >= distance - this.maxDistance &&
        d <= distance + this.maxDistance
      ) {
        this.searchRecursive(child, query, results)
      }
    }
  }

  // 计算两个字符串的 Levenshtein 距离，使用滚动数组优化空间复杂度，并添加提前终止机制。
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
