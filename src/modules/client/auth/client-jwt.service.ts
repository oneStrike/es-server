import { Injectable } from '@nestjs/common'

import { BaseJwtService } from '@/common/module/jwt/base-jwt.service'
import { CLIENT_AUTH_CONFIG } from '@/config/jwt.config'

@Injectable()
export class ClientJwtService extends BaseJwtService {
  protected readonly config = CLIENT_AUTH_CONFIG
}
