/**
 * 字符串脱敏工具
 * @param str 原始字符串
 * @param visibleStart 前部保留明文长度
 * @param visibleEnd 后部保留明文长度
 * @returns 脱敏后的字符串
 */
export function maskString(str: string, visibleStart = 3, visibleEnd = 3): string {
  if (!str)
{ return '' }
  // 如果字符串太短，不适合按照 Start/End 截取，则全部掩盖，但为了体验返回固定长度的星号
  if (str.length <= visibleStart + visibleEnd) {
    return '******'
  }
  return `${str.slice(0, visibleStart)}******${str.slice(-visibleEnd)}`
}

/**
 * 判断字符串是否是脱敏状态（包含掩码特征）
 * 用于判断前端传回的是否是未修改的掩码值
 * @param str 字符串
 * @returns 是否包含掩码
 */
export function isMasked(str: string): boolean {
  return str.includes('******')
}
