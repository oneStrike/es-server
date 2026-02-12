import type { Cache } from 'cache-manager'
import type { CaptchaConfig } from './captcha.types'
import { Buffer } from 'node:buffer'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import * as svgCaptcha from 'svg-captcha'
import { v4 as uuid } from 'uuid'

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
    ttl: 600 * 1000, // 1分钟
  }

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * 生成SVG验证码
   * @param prefix 缓存key前缀
   * @param config 验证码配置
   * @returns 包含验证码图片和ID的对象
   */
  async generateSvgCaptcha(prefix: string, config?: CaptchaConfig) {
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
      captcha: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`,
      captchaId: uniqueId,
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
   * 删除验证码（使用后应删除）
   * @param prefix 缓存key前缀
   * @param id 验证码ID
   */
  async remove(prefix: string, id: string): Promise<void> {
    const cacheKey = prefix + id
    await this.cacheManager.del(cacheKey)
  }
}
