import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuid } from 'uuid'
import { ClientJwtPayload, RefreshTokenPayload } from '@/common/interfaces/jwt-payload.interface'
import { BaseJwtService } from '@/common/module/jwt/base-jwt.service'
import { JwtBlacklistService } from '@/common/module/jwt/jwt-blacklist.service'
import { CLIENT_AUTH_CONFIG } from '@/config/jwt.config'

@Injectable()
export class ClientJwtService extends BaseJwtService<ClientJwtPayload> {
  constructor(
    jwtService: JwtService,
    jwtBlacklistService: JwtBlacklistService,
  ) {
    super(jwtService, jwtBlacklistService, CLIENT_AUTH_CONFIG, 'client')
  }

  protected buildAccessPayload(
    payload: Omit<ClientJwtPayload, 'iat' | 'exp' | 'jti' | 'aud' | 'role'>,
  ): ClientJwtPayload {
    return {
      ...payload,
      role: 'client',
      jti: uuid(),
      aud: CLIENT_AUTH_CONFIG.aud,
    }
  }

  protected buildRefreshPayload(
    payload: Pick<ClientJwtPayload, 'sub' | 'username'>,
  ): RefreshTokenPayload {
    return {
      sub: payload.sub,
      username: payload.username,
      type: 'refresh' as const,
      role: 'client' as const,
      jti: uuid(),
    }
  }
}
