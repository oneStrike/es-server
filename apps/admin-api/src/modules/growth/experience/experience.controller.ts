import {
  QueryUserExperienceRecordDto,
  UserExperienceRecordDetailDto,
  UserExperienceRecordDto,
  UserExperienceStatsDto,
} from '@libs/growth/experience/dto/experience-record.dto'
import { UserExperienceService } from '@libs/growth/experience/experience.service'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator'
import { IdDto } from '@libs/platform/dto/base.dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
/**
 * 用户经验记录管理控制器。
 * 仅暴露经验流水与统计查询，不再承载规则配置入口。
 */
@Controller('admin/growth/experience')
@ApiTags('用户成长/经验管理')
export class ExperienceController {
  constructor(private readonly experienceService: UserExperienceService) {}

  @Get('record/page')
  @ApiPageDoc({
    summary: '获取用户经验记录分页',
    model: UserExperienceRecordDto,
  })
  async getExperienceRecords(@Query() query: QueryUserExperienceRecordDto) {
    return this.experienceService.getExperienceRecordPage(query)
  }

  @Get('record/detail')
  @ApiDoc({
    summary: '获取用户经验记录详情',
    model: UserExperienceRecordDetailDto,
  })
  async getExperienceRecord(@Query() dto: IdDto) {
    return this.experienceService.getExperienceRecordDetail(dto.id)
  }

  @Get('stats')
  @ApiDoc({
    summary: '获取用户经验统计信息',
    model: UserExperienceStatsDto,
  })
  async getUserExperienceStats(@Query('userId') userId: number) {
    return this.experienceService.getUserExperienceStats(userId)
  }
}
