import type { JwtBlacklistService } from '@/common/module/jwt/jwt-blacklist.service'
import { UnauthorizedException } from '@nestjs/common'

export async function validateJwtPayload(options: {
  payload: any
  expectedAud: string
  blacklistService: JwtBlacklistService
}) {
  const { payload, expectedAud, blacklistService } = options

  if (payload.aud !== expectedAud) {
    throw new UnauthorizedException('登录失效，请重新登录！')
  }

  const jti = payload.jti
  if (!jti) {
    throw new UnauthorizedException('登录失效，请重新登录！')
  }

  const blacklisted =
    expectedAud === 'admin'
      ? await blacklistService.isInAdminBlacklist(jti)
      : await blacklistService.isInClientBlacklist(jti)

  if (blacklisted) {
    throw new UnauthorizedException('登录失效，请重新登录！')
  }

  return payload
}
