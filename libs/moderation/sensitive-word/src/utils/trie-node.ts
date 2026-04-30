import type { TrieNode } from '../sensitive-word.type'

export function createTrieNode(depth: number = 0): TrieNode {
  return {
    children: new Map(),
    fail: null,
    output: false,
    word: null,
    depth,
  }
}
