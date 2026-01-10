import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  AddExperienceDto,
  BaseExperienceRuleDto,
  CreateExperienceRuleDto,
  ExperienceService,
  QueryExperienceRecordDto,
  QueryExperienceRuleDto,
  UpdateExperienceRuleDto,
} from '@libs/forum'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/experience')
@ApiTags('论坛模块/经验管理')
export class ExperienceController {
  constructor(private readonly experienceService: ExperienceService) {}

  @Get('rules/page')
  @ApiPageDoc({
    summary: '获取经验规则分页',
    model: BaseExperienceRuleDto,
  })
  async getExperienceRules(@Query() query: QueryExperienceRuleDto) {
    return this.experienceService.getExperienceRulePage(query)
  }

  @Get('rules/detail')
  @ApiDoc({
    summary: '获取经验规则详情',
    model: BaseExperienceRuleDto,
  })
  async getExperienceRule(@Query() dto: IdDto) {
    return this.experienceService.getExperienceRuleDetail(dto.id)
  }

  @Post('rules/create')
  @ApiDoc({
    summary: '创建经验规则',
    model: BaseExperienceRuleDto,
  })
  async createExperienceRule(@Body() dto: CreateExperienceRuleDto) {
    return this.experienceService.createExperienceRule(dto)
  }

  @Post('rules/update')
  @ApiDoc({
    summary: '更新经验规则',
    model: BaseExperienceRuleDto,
  })
  async updateExperienceRule(@Body() dto: UpdateExperienceRuleDto) {
    return this.experienceService.updateExperienceRule(dto)
  }

  @Post('rules/delete')
  @ApiDoc({
    summary: '删除经验规则',
    model: BaseExperienceRuleDto,
  })
  async deleteExperienceRule(@Body() dto: IdDto) {
    return this.experienceService.deleteExperienceRule(dto.id)
  }

  @Post('add')
  @ApiDoc({
    summary: '增加经验',
    model: BaseExperienceRuleDto,
  })
  async addExperience(@Body() dto: AddExperienceDto) {
    return this.experienceService.addExperience(dto)
  }

  @Get('records/page')
  @ApiPageDoc({
    summary: '获取经验记录分页',
    model: BaseExperienceRuleDto,
  })
  async getExperienceRecords(@Query() query: QueryExperienceRecordDto) {
    return this.experienceService.getExperienceRecordPage(query)
  }

  @Get('records/detail')
  @ApiDoc({
    summary: '获取经验记录详情',
    model: BaseExperienceRuleDto,
  })
  async getExperienceRecord(@Query() dto: IdDto) {
    return this.experienceService.getExperienceRecordDetail(dto.id)
  }

  @Get('user-stats')
  @ApiDoc({
    summary: '获取用户经验统计',
    model: BaseExperienceRuleDto,
  })
  async getUserExperienceStats(@Query('profileId') profileId: number) {
    return this.experienceService.getUserExperienceStats(profileId)
  }
}
