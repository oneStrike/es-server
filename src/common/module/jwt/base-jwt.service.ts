import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuid } from 'uuid'

import { JwtBlacklistService } from '@/common/module/jwt/jwt-blacklist.service'
import { LoggerFactoryService } from '@/common/module/logger/logger-factory.service'
import { CustomLoggerService } from '@/common/module/logger/logger.service'
import { ADMIN_AUTH_CONFIG, CLIENT_AUTH_CONFIG } from '@/config/jwt.config'

type AuthConfig = typeof ADMIN_AUTH_CONFIG | typeof CLIENT_AUTH_CONFIG

@Injectable()
export abstract class BaseJwtService {
  protected logger: CustomLoggerService
  protected abstract readonly config: AuthConfig

  constructor(
    protected readonly jwtService: JwtService,
    protected readonly jwtBlacklistService: JwtBlacklistService,
    protected readonly loggerFactory: LoggerFactoryService,
  ) {
    // 子类会设置具体的logger
  }

  async generateTokens(payload) {
    const startTime = Date.now()
    payload = {
      ...payload,
      jti: uuid(),
      aud: this.config.aud,
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, type: 'access' },
        {
          secret: this.config.secret,
          expiresIn: this.config.expiresIn,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        {
          secret: this.config.refreshSecret,
          expiresIn: this.config.refreshExpiresIn,
        },
      ),
    ])

    const duration = Date.now() - startTime
    this.logger?.logPerformance('generate_tokens', duration, {
      aud: this.config.aud,
    })

    return { accessToken, refreshToken }
  }

  async refreshAccessToken(refreshToken: string) {
    const startTime = Date.now()
    try {
      const { aud, jti, exp, iat, ...payload } =
        await this.jwtService.verifyAsync(refreshToken, {
          secret: this.config.refreshSecret,
        })
      const isBlacklist =
        this.config.aud === 'admin'
          ? await this.jwtBlacklistService.isInAdminBlacklist(jti)
          : await this.jwtBlacklistService.isInClientBlacklist(jti)
      if (
        payload.type !== 'refresh'
        || aud !== this.config.aud
        || isBlacklist
      ) {
        this.logger?.logSecurity('invalid_refresh_token', 'warn', {
          aud: this.config.aud,
          reason: isBlacklist ? 'blacklisted' : 'invalid_type_or_aud',
        })
        throw new UnauthorizedException('登录失效，请重新登录！')
      }

      const newTokens = await this.generateTokens(payload)
      const duration = Date.now() - startTime
      this.logger?.logPerformance('refresh_token', duration)
      return newTokens
    }
    catch (error) {
      this.logger?.error('刷新令牌失败', error.stack, {
        aud: this.config.aud,
      })
      throw error
    }
  }

  protected async tokenTtlMsAndJti(token: string, secret: string) {
    const payload = await this.jwtService.verifyAsync(token, {
      secret,
      ignoreExpiration: true,
    })
    const expTimeMs = payload.exp * 1000
    const currentTimeMs = Date.now()
    const ttlMs = Math.max(0, Math.floor(expTimeMs - currentTimeMs))
    return { ttlMs, jti: payload.jti }
  }

  async logout(accessToken: string, refreshToken?: string): Promise<boolean> {
    try {
      const { jti, ttlMs } = await this.tokenTtlMsAndJti(
        accessToken,
        this.config.secret,
      )
      if (!jti) {
        return false
      }

      // 批量处理黑名单添加（优化性能）
      const blacklistPromises: Promise<void>[] = []

      if (this.config.aud === 'admin') {
        blacklistPromises.push(
          this.jwtBlacklistService.addToAdminBlacklist(jti, ttlMs),
        )
      }
      else {
        blacklistPromises.push(
          this.jwtBlacklistService.addToClientBlacklist(jti, ttlMs),
        )
      }

      if (refreshToken) {
        const { jti: rjti, ttlMs: rttlMs } = await this.tokenTtlMsAndJti(
          refreshToken,
          this.config.refreshSecret,
        )
        if (rjti) {
          if (this.config.aud === 'admin') {
            blacklistPromises.push(
              this.jwtBlacklistService.addToAdminBlacklist(rjti, rttlMs),
            )
          }
          else {
            blacklistPromises.push(
              this.jwtBlacklistService.addToClientBlacklist(rjti, rttlMs),
            )
          }
        }
      }

      // 并行执行所有黑名单添加操作
      await Promise.all(blacklistPromises)

      this.logger?.info('用户登出成功', { aud: this.config.aud })
      return true
    }
    catch (error) {
      this.logger?.error('登出失败', error.stack, { aud: this.config.aud })
      return false
    }
  }
}
