import { Buffer } from 'node:buffer'
import { scrypt as _scrypt, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { BadRequestException, Injectable } from '@nestjs/common'

const scrypt = promisify(_scrypt)

/**
 * 密码加密服务。
 * 基于 scrypt 算法提供密码加密与验证，供认证链路统一复用。
 */
@Injectable()
export class ScryptService {
  // 使用 scrypt 算法加密密码，返回 "salt.hash" 格式字符串。
  async encryptPassword(password: string, salt?: string): Promise<string> {
    // 输入验证
    if (!password || password.length < 8) {
      throw new BadRequestException('密码长度至少为8个字符')
    }

    // 如果没有提供盐值，则随机生成一个（增加到16字节）
    if (!salt) {
      salt = randomBytes(16).toString('hex')
    }

    // 使用 scrypt 算法加密密码，使用自定义参数
    const key = (await scrypt(password, salt, 64)) as Buffer

    // 返回 "salt.hash" 格式的字符串
    return `${salt}.${key.toString('hex')}`
  }

  // 比较输入密码与存储的加密密码是否匹配，使用常量时间比较防止时序攻击。
  async verifyPassword(
    inputPassword: string,
    storedPassword: string,
  ): Promise<boolean> {
    // 输入验证
    if (!inputPassword || !storedPassword) {
      return false
    }

    try {
      // 从存储的密码中提取盐值
      const parts = storedPassword.split('.')
      if (parts.length !== 2) {
        return false
      }

      const salt = parts[0]
      const storedHash = parts[1]

      // 使用相同的盐值加密输入的密码
      const encryptedInput = await this.encryptPassword(inputPassword, salt)
      const inputHash = encryptedInput.split('.')[1]

      // 使用常量时间比较防止时序攻击
      const inputBuffer = Buffer.from(inputHash, 'hex')
      const storedBuffer = Buffer.from(storedHash, 'hex')
      return timingSafeEqual(inputBuffer, storedBuffer)
    } catch {
      return false
    }
  }
}
