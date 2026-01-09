export interface TrieNode {
  children: Map<string, TrieNode>
  fail: TrieNode | null
  output: boolean
  word: string | null
  depth: number
}

export function createTrieNode(depth: number = 0): TrieNode {
  return {
    children: new Map(),
    fail: null,
    output: false,
    word: null,
    depth,
  }
}
