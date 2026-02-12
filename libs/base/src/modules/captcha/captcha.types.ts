/**
 * 验证码配置
 */
export interface CaptchaConfig {
  /** 图片尺寸 */
  size?: number
  /** 忽略字符集合 */
  ignoreChars?: string
  /** 干扰线数量 */
  noise?: number
  /** 是否彩色 */
  color?: boolean
  /** 过期时间（秒） */
  ttl?: number
}
