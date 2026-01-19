import type { JwtUserInfoInterface } from '@libs/base/types'
import type { FastifyRequest } from 'fastify'
import { ApiDoc } from '@libs/base/decorators'
import { CurrentUser } from '@libs/base/decorators/current-user.decorator'
import { IdDto } from '@libs/base/dto'
import {
  BaseForumConfigDto,
  ForumConfigHistoryItemDto,
  ForumConfigService,
  UpdateForumConfigDto,
} from '@libs/forum/config'
import { Body, Controller, Get, Post, Req } from '@nestjs/common'
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
    @Req() req: FastifyRequest,
  ) {
    return this.forumConfigService.updateConfig(updateDto, currentUser.sub, req)
  }

  @Post('reset')
  @ApiDoc({
    summary: '重置为默认配置',
    model: BaseForumConfigDto,
  })
  async resetToDefault(@Req() req: FastifyRequest) {
    return this.forumConfigService.resetToDefault(req)
  }

  @Get('history')
  @ApiDoc({
    summary: '获取配置变更历史',
    model: ForumConfigHistoryItemDto,
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
    @Req() req?: FastifyRequest,
  ) {
    return this.forumConfigService.restoreFromHistory(
      restoreDto.id,
      currentUser?.sub,
      req,
    )
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除配置历史记录',
    model: BaseForumConfigDto,
  })
  async deleteConfigHistory(
    @Body() deleteDto: IdDto,
    @CurrentUser() currentUser?: JwtUserInfoInterface,
  ) {
    return this.forumConfigService.deleteConfigHistory(
      deleteDto.id,
      currentUser?.sub,
    )
  }
}
