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
