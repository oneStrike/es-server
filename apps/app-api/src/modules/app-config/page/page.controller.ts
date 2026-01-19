import {
  ClientPageResponseDto,
  LibAppPageService,
} from '@libs/app-config/page'
import { ApiPageDoc } from '@libs/base/decorators'
import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('客户端页面配置模块')
@Controller('app/page-config')
export class AppPageController {
  constructor(private readonly libAppPageService: LibAppPageService) {}

  @Get('/list')
  @ApiPageDoc({
    summary: '查询页面配置列表',
    model: ClientPageResponseDto,
  })
  async findPage() {
    return this.libAppPageService.findActivePages()
  }
}
