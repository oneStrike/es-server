import { ApiPageDoc } from '@libs/base/decorators'
import {
  ClientPageResponseDto,
  LibClientPageService,
} from '@libs/client-config/page'
import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * 客户端页面配置控制器
 * 提供页面配置相关的API接口
 */
@ApiTags('客户端页面配置模块')
@Controller('client/page-config')
export class ClientPageController {
  constructor(private readonly libClientPageService: LibClientPageService) {}

  /**
   * 分页查询页面配置列表
   */
  @Get('/list')
  @ApiPageDoc({
    summary: '查询页面配置列表',
    model: ClientPageResponseDto,
  })
  async findPage() {
    return this.libClientPageService.findActivePages()
  }
}
