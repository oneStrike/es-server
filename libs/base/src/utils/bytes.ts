/**
 * 字节转换工具
 * 提供字节数与可读格式之间的转换功能
 */

/**
 * 有效的字节单位类型
 */
export type ByteUnit =
  | 'B'
  | 'KB'
  | 'MB'
  | 'GB'
  | 'TB'
  | 'PB'
  | 'EB'
  | 'ZB'
  | 'YB'

/**
 * 字节转换配置选项
 */
export interface BytesOptions {
  /** 结果精度，默认为 2 */
  precision?: number
  /** 是否强制使用指定单位，默认为 false */
  forceUnit?: ByteUnit | false
  /** 是否添加空格，默认为 false */
  addSpace?: boolean
}

/**
 * 字节单位映射表，用于快速查找单位对应的字节数
 */
export const byteUnits: Record<ByteUnit, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
  PB: 1024 ** 5,
  EB: 1024 ** 6,
  ZB: 1024 ** 7,
  YB: 1024 ** 8,
}

/**
 * 单位显示名称映射表，用于格式化输出
 */
const unitLabels: Record<ByteUnit, string> = {
  B: 'B',
  KB: 'KB',
  MB: 'MB',
  GB: 'GB',
  TB: 'TB',
  PB: 'PB',
  EB: 'EB',
  ZB: 'ZB',
  YB: 'YB',
}

/**
 * 将字节数转换为可读的字符串格式
 * @param bytes 字节数
 * @param options 转换选项
 * @returns 可读的字节大小字符串
 */
export function bytes(bytes: number, options: BytesOptions = {}): string {
  // 参数验证
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes < 0) {
    return '0 B'
  }

  const { precision = 2, forceUnit = false, addSpace = false } = options

  // 如果强制使用指定单位，直接转换
  if (forceUnit) {
    const value = bytes / byteUnits[forceUnit]
    const formattedValue = value.toFixed(precision)
    const space = addSpace ? ' ' : ''
    return `${formattedValue}${space}${unitLabels[forceUnit]}`
  }

  // 自动选择合适的单位
  let unit: ByteUnit = 'B'
  let value = bytes

  // 从大到小检查合适的单位
  const units = Object.keys(byteUnits) as ByteUnit[]
  for (let i = units.length - 1; i > 0; i--) {
    const currentUnit = units[i]
    const unitSize = byteUnits[currentUnit]

    if (bytes >= unitSize) {
      unit = currentUnit
      value = bytes / unitSize
      break
    }
  }

  // 格式化输出
  const formattedValue = value.toFixed(precision)
  const space = addSpace ? ' ' : ''
  return `${formattedValue}${space}${unitLabels[unit]}`
}

/**
 * 将可读的字节字符串转换为字节数
 * @param str 可读的字节大小字符串
 * @returns 字节数
 */
export function parseBytes(str: string): number {
  // 参数验证
  if (typeof str !== 'string' || str.trim() === '') {
    return 0
  }

  // 匹配数字和单位
  const match = str.trim().match(/^([\d.]+)\s*([a-z]+)?$/i)
  if (!match) {
    return 0
  }

  const [, valueStr, unitStr] = match
  const value = Number.parseFloat(valueStr)
  const unit = (unitStr || 'B').toUpperCase() as ByteUnit

  // 检查单位是否有效
  if (!byteUnits[unit]) {
    return 0
  }

  // 计算字节数
  return value * byteUnits[unit]
}

/**
 * 验证字符串是否为有效的字节格式
 * @param str 要验证的字符串
 * @returns 是否为有效的字节格式
 */
export function isValidBytes(str: string): boolean {
  if (typeof str !== 'string' || str.trim() === '') {
    return false
  }

  const match = str.trim().match(/^([\d.]+)\s*([a-z]+)?$/i)
  if (!match) {
    return false
  }

  const [, __notUsed, unitStr] = match
  const unit = (unitStr || 'B').toUpperCase() as ByteUnit

  return Boolean(byteUnits[unit])
}

/**
 * 获取文件大小的友好显示
 * 基于字节数返回合适的显示格式
 * @param byteSize 字节数
 * @param precision 精度
 * @returns 友好的文件大小字符串
 */
export function friendlyFileSize(
  byteSize: number,
  precision: number = 2,
): string {
  return bytes(byteSize, { precision })
}
