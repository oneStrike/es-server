import type { JwtUserInfoInterface } from '@libs/base/types'
import { ApiDoc } from '@libs/base/decorators'
import { CurrentUser } from '@libs/base/decorators/current-user.decorator'
import { IdDto } from '@libs/base/dto'
import {
  BaseForumConfigDto,
  ForumConfigService,
  UpdateForumConfigDto,
} from '@libs/forum'
import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/config')
@ApiTags('论坛模块/系统配置')
export class ForumConfigController {
  constructor(private readonly forumConfigService: ForumConfigService) {}

  @Get('get')
  @ApiDoc({
    summary: '获取论坛配置',
    model: BaseForumConfigDto,
  })
  async getForumConfig() {
    return this.forumConfigService.getForumConfig()
  }

  @Post('update')
  @ApiDoc({
    summary: '更新论坛配置',
    model: BaseForumConfigDto,
  })
  async updateForumConfig(
    @Body() updateDto: UpdateForumConfigDto,
    @CurrentUser() currentUser: JwtUserInfoInterface,
  ) {
    return this.forumConfigService.updateForumConfig(updateDto, currentUser.sub)
  }

  @Post('reset')
  @ApiDoc({
    summary: '重置为默认配置',
    model: BaseForumConfigDto,
  })
  async resetToDefault() {
    return this.forumConfigService.resetToDefault()
  }

  @Get('history')
  @ApiDoc({
    summary: '获取配置变更历史',
    model: BaseForumConfigDto,
    isArray: true,
  })
  async getConfigHistory() {
    return this.forumConfigService.getConfigHistory()
  }

  @Post('restore')
  @ApiDoc({
    summary: '从历史记录恢复配置',
    model: BaseForumConfigDto,
  })
  async restoreFromHistory(
    @Body() restoreDto: IdDto,
    @CurrentUser() currentUser?: JwtUserInfoInterface,
  ) {
    return this.forumConfigService.restoreFromHistory(
      restoreDto.id,
      currentUser?.sub,
    )
  }
}
