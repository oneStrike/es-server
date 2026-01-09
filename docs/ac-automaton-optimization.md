# AC 自动机优化建议

## 当前实现分析

### 优点
1. 实现了标准的 AC 自动机算法，时间复杂度为 O(n + m)
2. 使用 Map 存储子节点，支持任意字符
3. 代码结构清晰，注释完整

### 存在的问题

## 1. 性能优化

### 1.1 match 方法优化
**问题：**
- `node.children.has(char)` 和 `node.children.get(char)` 两次查询可以优化为一次
- `collectResults` 使用递归，可能导致栈溢出

**优化方案：**
```typescript
match(text: string): MatchResult[] {
  if (!this.built) {
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

// 使用迭代代替递归
private collectResults(
  node: TrieNode,
  endPos: number,
  results: MatchResult[],
): void {
  let current: TrieNode | null = node
  while (current) {
    if (current.word) {
      results.push({
        word: current.word,
        start: endPos - current.word.length + 1,
        end: endPos,
      })
    }
    current = current.fail && current.fail.output ? current.fail : null
  }
}
```

### 1.2 getWordCount 缓存优化
**问题：**
- 每次调用都遍历整个 Trie 树，性能开销大

**优化方案：**
```typescript
private wordCount: number = 0

build(words: string[]): void {
  if (words.length === 0) {
    return
  }

  this.clear()
  this.built = false
  this.wordCount = 0

  for (const word of words) {
    if (word.length === 0) {
      continue
    }
    this.insert(word)
    this.wordCount++
  }

  this.buildFailLinks()
  this.built = true
}

getWordCount(): number {
  return this.wordCount
}
```

### 1.3 buildFailLinks 优化
**问题：**
- `fail.children.get(char) || this.root` 可能导致重复查询

**优化方案：**
```typescript
private buildFailLinks(): void {
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

      const failNode = fail?.children.get(char)
      child.fail = failNode || this.root

      if (child.fail.output) {
        child.output = true
      }

      queue.push(child)
    }
  }
}
```

## 2. 使用优化

### 2.1 敏感词去重
**问题：**
- 可能插入重复的敏感词，浪费内存和影响性能

**优化方案：**
```typescript
build(words: string[]): void {
  if (words.length === 0) {
    return
  }

  this.clear()
  this.built = false
  this.wordCount = 0

  const uniqueWords = new Set(words.filter(w => w.length > 0))

  for (const word of uniqueWords) {
    this.insert(word)
    this.wordCount++
  }

  this.buildFailLinks()
  this.built = true
}
```

### 2.2 匹配结果去重
**问题：**
- 可能返回重复的匹配结果

**优化方案：**
```typescript
match(text: string, unique: boolean = false): MatchResult[] {
  if (!this.built) {
    return []
  }

  const results: MatchResult[] = []
  const seen = new Set<string>()
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
      this.collectResults(node, i, results, unique ? seen : null)
    }
  }

  return results
}

private collectResults(
  node: TrieNode,
  endPos: number,
  results: MatchResult[],
  seen: Set<string> | null = null,
): void {
  let current: TrieNode | null = node
  while (current) {
    if (current.word) {
      const key = `${current.word}-${endPos}`
      if (!seen || !seen.has(key)) {
        results.push({
          word: current.word,
          start: endPos - current.word.length + 1,
          end: endPos,
        })
        if (seen) {
          seen.add(key)
        }
      }
    }
    current = current.fail && current.fail.output ? current.fail : null
  }
}
```

### 2.3 最大匹配数量限制
**问题：**
- 可能返回过多的匹配结果，影响性能

**优化方案：**
```typescript
match(text: string, options: { unique?: boolean; maxResults?: number } = {}): MatchResult[] {
  if (!this.built) {
    return []
  }

  const results: MatchResult[] = []
  const seen = options.unique ? new Set<string>() : null
  let node = this.root

  for (let i = 0; i < text.length; i++) {
    if (options.maxResults && results.length >= options.maxResults) {
      break
    }

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
      this.collectResults(node, i, results, seen, options.maxResults)
    }
  }

  return results
}

private collectResults(
  node: TrieNode,
  endPos: number,
  results: MatchResult[],
  seen: Set<string> | null = null,
  maxResults?: number,
): void {
  let current: TrieNode | null = node
  while (current) {
    if (maxResults && results.length >= maxResults) {
      break
    }

    if (current.word) {
      const key = `${current.word}-${endPos}`
      if (!seen || !seen.has(key)) {
        results.push({
          word: current.word,
          start: endPos - current.word.length + 1,
          end: endPos,
        })
        if (seen) {
          seen.add(key)
        }
      }
    }
    current = current.fail && current.fail.output ? current.fail : null
  }
}
```

### 2.4 敏感词长度限制
**问题：**
- 过长的敏感词可能影响性能

**优化方案：**
```typescript
private maxWordLength: number = 100

setMaxWordLength(maxLength: number): void {
  this.maxWordLength = maxLength
}

private insert(word: string): void {
  if (word.length > this.maxWordLength) {
    return
  }

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
```

## 3. 内存优化

### 3.1 使用对象代替 Map
**问题：**
- Map 对象在 JavaScript 中可能不是最优的选择

**优化方案：**
```typescript
export interface TrieNode {
  children: Record<string, TrieNode>
  fail: TrieNode | null
  output: boolean
  word: string | null
  depth: number
}

export function createTrieNode(depth: number = 0): TrieNode {
  return {
    children: {},
    fail: null,
    output: false,
    word: null,
    depth,
  }
}
```

### 3.2 使用数组存储子节点
**问题：**
- 如果字符集有限（如 ASCII），可以使用数组优化

**优化方案：**
```typescript
export interface TrieNode {
  children: (TrieNode | null)[]
  fail: TrieNode | null
  output: boolean
  word: string | null
  depth: number
}

export function createTrieNode(depth: number = 0): TrieNode {
  return {
    children: new Array(256).fill(null),
    fail: null,
    output: false,
    word: null,
    depth,
  }
}
```

## 4. 功能优化

### 4.1 批量构建
**问题：**
- 没有批量构建方法，避免多次调用 build

**优化方案：**
```typescript
async buildAsync(words: string[]): Promise<void> {
  if (words.length === 0) {
    return
  }

  this.clear()
  this.built = false
  this.wordCount = 0

  const uniqueWords = new Set(words.filter(w => w.length > 0))

  for (const word of uniqueWords) {
    this.insert(word)
    this.wordCount++
  }

  this.buildFailLinks()
  this.built = true
}
```

### 4.2 前缀匹配
**问题：**
- 没有前缀匹配功能

**优化方案：**
```typescript
startsWith(prefix: string): boolean {
  let node = this.root
  for (let i = 0; i < prefix.length; i++) {
    const char = prefix[i]
    if (!node.children.has(char)) {
      return false
    }
    node = node.children.get(char)!
  }
  return true
}
```

## 5. 优化优先级建议

### 高优先级（建议立即优化）
1. match 方法优化 - 减少查询次数，提升匹配性能
2. getWordCount 缓存优化 - 避免重复计算
3. 敏感词去重 - 避免重复插入

### 中优先级（建议后续优化）
1. collectResults 迭代优化 - 避免递归栈溢出
2. 匹配结果去重 - 避免重复结果
3. 最大匹配数量限制 - 避免返回过多结果

### 低优先级（可选优化）
1. 内存优化 - 根据实际使用场景选择
2. 功能扩展 - 根据业务需求决定

## 总结

当前 AC 自动机实现已经比较完善，但还有一些优化空间。建议优先实现高优先级的优化，这些优化可以显著提升性能，同时不会增加太多复杂度。中优先级的优化可以根据实际使用情况决定是否需要。低优先级的优化可以根据业务需求和性能要求来决定。
