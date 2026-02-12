import { ApiDoc } from '@libs/base/decorators'
import { UserGrowthOverviewDto } from '@libs/user/growth-overview'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { UserGrowthOverviewService } from './overview.service'

@Controller('/admin/user-growth/overview')
@ApiTags('用户成长/概览')
export class UserGrowthOverviewController {
  constructor(private readonly overviewService: UserGrowthOverviewService) {}

  @Get()
  @ApiDoc({
    summary: '获取用户成长概览',
    model: UserGrowthOverviewDto,
  })
  async getOverview(@Query('userId') userId: number) {
    return this.overviewService.getOverview(userId)
  }
}
