import { Injectable } from '@nestjs/common'
import { v4 as uuid } from 'uuid'

import { BaseJwtService } from '@/common/module/jwt/base-jwt.service'
import { CLIENT_AUTH_CONFIG } from '@/config/jwt.config'

@Injectable()
export class ClientJwtService extends BaseJwtService {
  protected readonly config = CLIENT_AUTH_CONFIG

  protected buildAccessPayload(payload) {
    return {
      ...payload,
      jti: uuid(),
      aud: CLIENT_AUTH_CONFIG.aud,
    }
  }

  protected buildRefreshPayload(payload) {
    return {
      sub: payload.sub,
      username: payload.username,
      type: 'refresh' as const,
      role: 'client' as const,
      jti: uuid(),
    }
  }
}
