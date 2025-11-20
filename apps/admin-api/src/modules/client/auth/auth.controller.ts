import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * 客户端认证控制器
 * 提供登出等认证相关接口
 */
@ApiTags('客户端认证模块')
@Controller('client/auth')
export class ClientAuthController {
  constructor() {}
}
