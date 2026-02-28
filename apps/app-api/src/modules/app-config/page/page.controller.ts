import { AppPageResponseDto, LibAppPageService } from '@libs/app-config/page'
import { ApiPageDoc } from '@libs/base/decorators'
import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('客户端页面配置模块')
@Controller('app/page')
export class AppPageController {
  constructor(private readonly libAppPageService: LibAppPageService) {}

  @Get('/list')
  @ApiPageDoc({
    summary: '查询页面配置列表',
    model: AppPageResponseDto,
  })
  async findPage() {
    return this.libAppPageService.findActivePages()
  }
}
