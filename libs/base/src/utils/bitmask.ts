/**
 * Bitmask工具类
 * 提供位掩码相关的实用方法
 */

/**
 * 将数字数组转换为bitmask值
 * @param items 数字数组
 * @returns 对应的bitmask值
 */
export function itemsToBitmask(items: number[]): number {
  return items.reduce((mask, item) => mask | (1 << item), 0)
}
/**
 * 检查给定的bitmask是否包含指定的项
 * @param bitmask 要检查的bitmask
 * @param item 要检查的项
 * @returns 如果包含返回true，否则返回false
 */
export function hasBit(bitmask: number, item: number): boolean {
  return (bitmask & (1 << item)) !== 0
}

/**
 * 从bitmask中提取所有设置的项
 * @param bitmask bitmask值
 * @returns 包含所有设置项的数组
 */
export function extractItems(bitmask: number): number[] {
  const items: number[] = []
  let bit = 0

  while (bitmask > 0) {
    if (bitmask & 1) {
      items.push(bit)
    }
    bitmask >>= 1
    bit++
  }

  return items
}

/**
 * 判断给定数组中的项能组成哪些组合
 * @param items 子项数组，可以是数字数组或字符串数组，表示当前可用的项
 * @param allItems 所有可能的子项数组
 * @returns 所有可能的组合值，返回一维数组，每个元素是一个组合的值（单个项或多个项的和）
 */
export function findCombinations(
  items: (number | string)[],
  allItems: number[],
): number[] {
  const results: number[] = []

  // 将字符串数组转换为数字数组
  const numberItems = items.map((item) =>
    typeof item === 'string' ? Number.parseInt(item, 10) : item,
  )

  // 计算所有可能项的总和
  const totalSum = allItems.reduce((sum, item) => sum + item, 0)

  // 使用回溯算法找出所有可能的组合
  function backtrack(start: number, current: number[]): void {
    // 将当前组合的值添加到结果中
    if (current.length > 0) {
      // 计算当前组合的值（所有项的和）
      const sum = current.reduce((sum, item) => sum + item, 0)
      if (!results.includes(sum)) {
        results.push(sum)
      }
    }

    // 尝试添加剩余的项
    for (let i = start; i < numberItems.length; i++) {
      current.push(numberItems[i])
      backtrack(i + 1, current)
      current.pop()
    }
  }

  // 添加所有可能项的总和
  if (!results.includes(totalSum)) {
    results.push(totalSum)
  }

  backtrack(0, [])
  return results
}
