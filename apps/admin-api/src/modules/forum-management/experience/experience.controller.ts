import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  AddForumExperienceDto,
  BaseForumExperienceRuleDto,
  CreateForumExperienceRuleDto,
  ForumExperienceService,
  QueryForumExperienceRecordDto,
  QueryForumExperienceRuleDto,
  UpdateForumExperienceRuleDto,
} from '@libs/forum/experience'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/experience')
@ApiTags('论坛模块/经验管理')
export class ExperienceController {
  constructor(private readonly experienceService: ForumExperienceService) {}

  @Get('rules-page')
  @ApiPageDoc({
    summary: '获取经验规则分页',
    model: BaseForumExperienceRuleDto,
  })
  async getExperienceRules(@Query() query: QueryForumExperienceRuleDto) {
    return this.experienceService.getExperienceRulePage(query)
  }

  @Get('rules-detail')
  @ApiDoc({
    summary: '获取经验规则详情',
    model: BaseForumExperienceRuleDto,
  })
  async getExperienceRule(@Query() dto: IdDto) {
    return this.experienceService.getExperienceRuleDetail(dto.id)
  }

  @Post('rules-create')
  @ApiDoc({
    summary: '创建经验规则',
    model: BaseForumExperienceRuleDto,
  })
  async createExperienceRule(@Body() dto: CreateForumExperienceRuleDto) {
    return this.experienceService.createExperienceRule(dto)
  }

  @Post('rules-update')
  @ApiDoc({
    summary: '更新经验规则',
    model: BaseForumExperienceRuleDto,
  })
  async updateExperienceRule(@Body() dto: UpdateForumExperienceRuleDto) {
    return this.experienceService.updateExperienceRule(dto)
  }

  @Post('rules-delete')
  @ApiDoc({
    summary: '删除经验规则',
    model: BaseForumExperienceRuleDto,
  })
  async deleteExperienceRule(@Body() dto: IdDto) {
    return this.experienceService.deleteExperienceRule(dto.id)
  }

  @Post('add')
  @ApiDoc({
    summary: '增加经验',
    model: BaseForumExperienceRuleDto,
  })
  async addExperience(@Body() dto: AddForumExperienceDto) {
    return this.experienceService.addExperience(dto)
  }

  @Get('records-page')
  @ApiPageDoc({
    summary: '获取经验记录分页',
    model: BaseForumExperienceRuleDto,
  })
  async getExperienceRecords(@Query() query: QueryForumExperienceRecordDto) {
    return this.experienceService.getExperienceRecordPage(query)
  }

  @Get('records-detail')
  @ApiDoc({
    summary: '获取经验记录详情',
    model: BaseForumExperienceRuleDto,
  })
  async getExperienceRecord(@Query() dto: IdDto) {
    return this.experienceService.getExperienceRecordDetail(dto.id)
  }

  @Get('user-stats')
  @ApiDoc({
    summary: '获取用户经验统计',
    model: BaseForumExperienceRuleDto,
  })
  async getUserExperienceStats(@Query('profileId') profileId: number) {
    return this.experienceService.getUserExperienceStats(profileId)
  }
}
