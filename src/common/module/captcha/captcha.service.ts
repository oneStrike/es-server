import { Buffer } from 'node:buffer'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { Cache } from 'cache-manager'
import * as svgCaptcha from 'svg-captcha'
import { v4 as uuid } from 'uuid'

/**
 * 验证码服务配置接口
 */
export interface CaptchaConfig {
  /** 验证码长度 */
  size?: number
  /** 排除的字符 */
  ignoreChars?: string
  /** 噪声线条数量 */
  noise?: number
  /** 验证码字符是否有颜色 */
  color?: boolean
  /** 缓存过期时间（毫秒） */
  ttl?: number
}

/**
 * 验证码服务
 * 提供验证码生成、验证、删除等功能
 * 支持多种验证码类型扩展（SVG、图片、短信等）
 */
@Injectable()
export class CaptchaService {
  /** 默认配置 */
  private readonly defaultConfig: Required<CaptchaConfig> = {
    size: 4,
    ignoreChars: '0o1i',
    noise: 3,
    color: true,
    ttl: 60 * 1000, // 1分钟
  }

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * 生成SVG验证码
   * @param prefix 缓存key前缀
   * @param config 验证码配置
   * @returns 包含验证码图片和ID的对象
   */
  async generateSvgCaptcha(
    prefix: string,
    config?: CaptchaConfig,
  ): Promise<{ data: string, id: string }> {
    const finalConfig = { ...this.defaultConfig, ...config }

    const captcha = svgCaptcha.create({
      size: finalConfig.size,
      ignoreChars: finalConfig.ignoreChars,
      noise: finalConfig.noise,
      color: finalConfig.color,
    })

    const uniqueId = uuid()
    const cacheKey = prefix + uniqueId

    // 将验证码文本存入缓存
    await this.cacheManager.set(cacheKey, captcha.text, finalConfig.ttl)

    return {
      data: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`,
      id: uniqueId,
    }
  }

  /**
   * 验证验证码
   * @param prefix 缓存key前缀
   * @param id 验证码ID
   * @param userInput 用户输入的验证码
   * @param ignoreCase 是否忽略大小写（默认true）
   * @returns 验证是否通过
   */
  async verify(
    prefix: string,
    id: string,
    userInput: string,
    ignoreCase = true,
  ): Promise<boolean> {
    const cacheKey = prefix + id
    const cachedText = await this.cacheManager.get<string>(cacheKey)

    if (!cachedText) {
      return false
    }

    const expectedText = ignoreCase
      ? String(cachedText).toLowerCase()
      : String(cachedText)
    const inputText = ignoreCase
      ? String(userInput).toLowerCase()
      : String(userInput)

    return expectedText === inputText
  }

  /**
   * 获取验证码文本（用于校验）
   * @param prefix 缓存key前缀
   * @param id 验证码ID
   * @returns 验证码文本，不存在返回null
   */
  async getCaptchaText(prefix: string, id: string): Promise<string | null> {
    const cacheKey = prefix + id
    const value = await this.cacheManager.get<string>(cacheKey)
    return value ?? null
  }

  /**
   * 删除验证码（使用后应删除）
   * @param prefix 缓存key前缀
   * @param id 验证码ID
   */
  async remove(prefix: string, id: string): Promise<void> {
    const cacheKey = prefix + id
    await this.cacheManager.del(cacheKey)
  }

  /**
   * 检查验证码是否存在
   * @param prefix 缓存key前缀
   * @param id 验证码ID
   * @returns 是否存在
   */
  async exists(prefix: string, id: string): Promise<boolean> {
    const cacheKey = prefix + id
    const value = await this.cacheManager.get(cacheKey)
    return value !== null && value !== undefined
  }
}
