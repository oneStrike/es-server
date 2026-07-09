import {
  ForumModeratorActionLogDto,
  QueryAdminForumModeratorActionLogDto,
} from '@libs/forum/moderator/dto/moderator-action-log.dto'
import { ForumModeratorActionLogService } from '@libs/forum/moderator/moderator-action-log.service'
import { ApiPageDoc } from '@libs/platform/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'

@Controller('admin/forum/moderator-action-log')
@ApiTags('论坛管理/版主操作日志')
export class ModeratorActionLogController {
  constructor(
    private readonly forumModeratorActionLogService: ForumModeratorActionLogService,
  ) {}

  @Get('page')
  @AdminPermission({
    code: 'forum:moderator:action:log:page',
    name: '查看版主操作日志',
    groupCode: 'forum:moderator:action:log',
  })
  @ApiPageDoc({
    summary: '查看版主操作日志',
    model: ForumModeratorActionLogDto,
  })
  async getPage(@Query() query: QueryAdminForumModeratorActionLogDto) {
    return this.forumModeratorActionLogService.getAdminActionLogPage(query)
  }
}
