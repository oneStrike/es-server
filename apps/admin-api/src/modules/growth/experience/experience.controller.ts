import {
  AddUserExperienceDto,
  BaseUserExperienceRuleDto,
  CreateUserExperienceRuleDto,
  QueryUserExperienceRecordDto,
  QueryUserExperienceRuleDto,
  UpdateUserExperienceRuleDto,
  UserExperienceService,
} from '@libs/growth'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * 用户经验规则管理控制器
 * 提供经验规则的创建、更新、删除、查询等管理接口
 *
 * @class ExperienceController
 */
@Controller('/admin/growth/experience-rules')
@ApiTags('用户成长/经验管理')
export class ExperienceController {
  constructor(private readonly experienceService: UserExperienceService) {}

  @Get('rules-page')
  @ApiPageDoc({
    summary: '获取用户经验规则分页',
    model: BaseUserExperienceRuleDto,
  })
  async getExperienceRules(@Query() query: QueryUserExperienceRuleDto) {
    return this.experienceService.getExperienceRulePage(query)
  }

  @Get('rules-detail')
  @ApiDoc({
    summary: '获取用户经验规则详情',
    model: BaseUserExperienceRuleDto,
  })
  async getExperienceRule(@Query() dto: IdDto) {
    return this.experienceService.getExperienceRuleDetail(dto.id)
  }

  @Post('rules-create')
  @ApiDoc({
    summary: '创建用户经验规则',
    model: BaseUserExperienceRuleDto,
  })
  async createExperienceRule(@Body() dto: CreateUserExperienceRuleDto) {
    return this.experienceService.createExperienceRule(dto)
  }

  @Post('rules-update')
  @ApiDoc({
    summary: '更新用户经验规则',
    model: BaseUserExperienceRuleDto,
  })
  async updateExperienceRule(@Body() dto: UpdateUserExperienceRuleDto) {
    return this.experienceService.updateExperienceRule(dto)
  }

  @Post('rules-delete')
  @ApiDoc({
    summary: '删除用户经验规则',
    model: BaseUserExperienceRuleDto,
  })
  async deleteExperienceRule(@Body() dto: IdDto) {
    return this.experienceService.deleteExperienceRule(dto.id)
  }

  @Post('add')
  @ApiDoc({
    summary: '增加用户经验',
    model: BaseUserExperienceRuleDto,
  })
  async addExperience(@Body() dto: AddUserExperienceDto) {
    return this.experienceService.addExperience(dto)
  }

  @Get('records-page')
  @ApiPageDoc({
    summary: '获取用户经验记录分页',
    model: BaseUserExperienceRuleDto,
  })
  async getExperienceRecords(@Query() query: QueryUserExperienceRecordDto) {
    return this.experienceService.getExperienceRecordPage(query)
  }

  @Get('records-detail')
  @ApiDoc({
    summary: '获取用户经验记录详情',
    model: BaseUserExperienceRuleDto,
  })
  async getExperienceRecord(@Query() dto: IdDto) {
    return this.experienceService.getExperienceRecordDetail(dto.id)
  }

  @Get('user-stats')
  @ApiDoc({
    summary: '获取用户经验统计信息',
    model: BaseUserExperienceRuleDto,
  })
  async getUserExperienceStats(@Query('userId') userId: number) {
    return this.experienceService.getUserExperienceStats(userId)
  }
}

