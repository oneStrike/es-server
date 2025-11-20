import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { BaseJwtService } from '@/common/module/jwt/base-jwt.service'
import { JwtBlacklistService } from '@/common/module/jwt/jwt-blacklist.service'
import { CLIENT_AUTH_CONFIG } from '@/config/jwt.config'

@Injectable()
export class ClientJwtService extends BaseJwtService {
  protected readonly config = CLIENT_AUTH_CONFIG

  constructor(
    jwtService: JwtService,
    jwtBlacklistService: JwtBlacklistService,
  ) {
    super(jwtService, jwtBlacklistService)
  }
}
