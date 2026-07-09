import {
  QueryUserExperienceRecordDto,
  QueryUserExperienceStatsDto,
  UserExperienceRecordDetailDto,
  UserExperienceRecordDto,
  UserExperienceStatsDto,
} from '@libs/growth/experience/dto/experience-record.dto'
import { UserExperienceService } from '@libs/growth/experience/experience.service'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'
/**
 * 用户经验记录管理控制器。
 * 仅暴露经验流水与统计查询，不再承载规则配置入口。
 */
@Controller('admin/growth/experience')
@ApiTags('用户成长/经验管理')
export class ExperienceController {
  constructor(private readonly experienceService: UserExperienceService) {}

  @Get('record/page')
  @AdminPermission({
    code: 'growth:experience:record:page',
    name: '获取用户经验记录分页',
    groupCode: 'growth:experience',
  })
  @ApiPageDoc({
    summary: '获取用户经验记录分页',
    model: UserExperienceRecordDto,
  })
  async getExperienceRecords(@Query() query: QueryUserExperienceRecordDto) {
    return this.experienceService.getExperienceRecordPage(query)
  }

  @Get('record/detail')
  @AdminPermission({
    code: 'growth:experience:record:detail',
    name: '获取用户经验记录详情',
    groupCode: 'growth:experience',
  })
  @ApiDoc({
    summary: '获取用户经验记录详情',
    model: UserExperienceRecordDetailDto,
  })
  async getExperienceRecord(@Query() dto: IdDto) {
    return this.experienceService.getExperienceRecordDetail(dto.id)
  }

  @Get('stats')
  @AdminPermission({
    code: 'growth:experience:stats',
    name: '获取用户经验统计信息',
    groupCode: 'growth:experience',
  })
  @ApiDoc({
    summary: '获取用户经验统计信息',
    model: UserExperienceStatsDto,
  })
  async getUserExperienceStats(@Query() query: QueryUserExperienceStatsDto) {
    return this.experienceService.getUserExperienceStats(query.userId)
  }
}
