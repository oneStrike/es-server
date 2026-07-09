import {
  BaseForumModeratorLifecycleLogDto,
  QueryForumModeratorLifecycleLogDto,
} from '@libs/forum/moderator/dto/moderator-lifecycle-log.dto'
import { ForumModeratorLifecycleLogService } from '@libs/forum/moderator/moderator-lifecycle-log.service'
import { ApiPageDoc } from '@libs/platform/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'

@Controller('admin/forum/moderator-lifecycle-log')
@ApiTags('论坛管理/版主生命周期日志')
export class ModeratorLifecycleLogController {
  constructor(
    private readonly lifecycleLogService: ForumModeratorLifecycleLogService,
  ) {}

  @Get('page')
  @AdminPermission({
    code: 'forum:moderator:lifecycle:log:page',
    name: '分页查询版主生命周期日志',
    groupCode: 'forum:moderator:lifecycle:log',
  })
  @ApiPageDoc({
    summary: '分页查询版主生命周期日志',
    model: BaseForumModeratorLifecycleLogDto,
  })
  async getPage(@Query() query: QueryForumModeratorLifecycleLogDto) {
    return this.lifecycleLogService.getAdminLifecycleLogPage(query)
  }
}
