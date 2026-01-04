import { ApiDoc, ApiPageDoc } from '@libs/common'
import { IdDto } from '@libs/common/dto'
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { ConfigService } from './config.service'
import {
  BatchUpdateSystemConfigDto,
  CreateBadgeBatchDto,
  CreateBadgeDto,
  CreateLevelRuleBatchDto,
  CreateLevelRuleDto,
  CreatePointRuleBatchDto,
  CreatePointRuleDto,
  CreateSystemConfigDto,
  QueryBadgeDto,
  QueryLevelRuleDto,
  QueryPointRuleDto,
  QuerySystemConfigDto,
  UpdateBadgeDto,
  UpdateLevelRuleDto,
  UpdatePointRuleDto,
  UpdateSystemConfigDto,
} from './dto/config.dto'

@ApiTags('论坛管理/系统配置')
@Controller('admin/forum/config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Post('/point-rule/create')
  @ApiDoc({
    summary: '创建积分规则',
    model: IdDto,
  })
  async createPointRule(@Body() dto: CreatePointRuleDto) {
    return this.configService.createPointRule(dto)
  }

  @Put('/point-rule/update/:id')
  @ApiDoc({
    summary: '更新积分规则',
    model: IdDto,
  })
  async updatePointRule(@Param('id') id: number, @Body() dto: UpdatePointRuleDto) {
    return this.configService.updatePointRule(Number(id), dto)
  }

  @Delete('/point-rule/delete/:id')
  @ApiDoc({
    summary: '删除积分规则',
    model: IdDto,
  })
  async deletePointRule(@Param('id') id: number) {
    return this.configService.deletePointRule(Number(id))
  }

  @Get('/point-rule/page')
  @ApiPageDoc({
    summary: '分页查询积分规则',
    model: QueryPointRuleDto,
  })
  async getPointRulePage(@Query() dto: QueryPointRuleDto) {
    return this.configService.getPointRulePage(dto)
  }

  @Get('/point-rule/:id')
  @ApiDoc({
    summary: '获取积分规则详情',
    model: QueryPointRuleDto,
  })
  async getPointRule(@Param('id') id: number) {
    return this.configService.getPointRule(Number(id))
  }

  @Post('/point-rule/batch-create')
  @ApiDoc({
    summary: '批量创建积分规则',
    model: IdDto,
  })
  async createPointRuleBatch(@Body() dto: CreatePointRuleBatchDto) {
    return this.configService.createPointRuleBatch(dto)
  }

  @Post('/level-rule/create')
  @ApiDoc({
    summary: '创建等级规则',
    model: IdDto,
  })
  async createLevelRule(@Body() dto: CreateLevelRuleDto) {
    return this.configService.createLevelRule(dto)
  }

  @Put('/level-rule/update/:id')
  @ApiDoc({
    summary: '更新等级规则',
    model: IdDto,
  })
  async updateLevelRule(@Param('id') id: number, @Body() dto: UpdateLevelRuleDto) {
    return this.configService.updateLevelRule(Number(id), dto)
  }

  @Delete('/level-rule/delete/:id')
  @ApiDoc({
    summary: '删除等级规则',
    model: IdDto,
  })
  async deleteLevelRule(@Param('id') id: number) {
    return this.configService.deleteLevelRule(Number(id))
  }

  @Get('/level-rule/page')
  @ApiPageDoc({
    summary: '分页查询等级规则',
    model: QueryLevelRuleDto,
  })
  async getLevelRulePage(@Query() dto: QueryLevelRuleDto) {
    return this.configService.getLevelRulePage(dto)
  }

  @Get('/level-rule/:id')
  @ApiDoc({
    summary: '获取等级规则详情',
    model: QueryLevelRuleDto,
  })
  async getLevelRule(@Param('id') id: number) {
    return this.configService.getLevelRule(Number(id))
  }

  @Post('/level-rule/batch-create')
  @ApiDoc({
    summary: '批量创建等级规则',
    model: IdDto,
  })
  async createLevelRuleBatch(@Body() dto: CreateLevelRuleBatchDto) {
    return this.configService.createLevelRuleBatch(dto)
  }

  @Post('/badge/create')
  @ApiDoc({
    summary: '创建徽章',
    model: IdDto,
  })
  async createBadge(@Body() dto: CreateBadgeDto) {
    return this.configService.createBadge(dto)
  }

  @Put('/badge/update/:id')
  @ApiDoc({
    summary: '更新徽章',
    model: IdDto,
  })
  async updateBadge(@Param('id') id: number, @Body() dto: UpdateBadgeDto) {
    return this.configService.updateBadge(Number(id), dto)
  }

  @Delete('/badge/delete/:id')
  @ApiDoc({
    summary: '删除徽章',
    model: IdDto,
  })
  async deleteBadge(@Param('id') id: number) {
    return this.configService.deleteBadge(Number(id))
  }

  @Get('/badge/page')
  @ApiPageDoc({
    summary: '分页查询徽章',
    model: QueryBadgeDto,
  })
  async getBadgePage(@Query() dto: QueryBadgeDto) {
    return this.configService.getBadgePage(dto)
  }

  @Get('/badge/:id')
  @ApiDoc({
    summary: '获取徽章详情',
    model: QueryBadgeDto,
  })
  async getBadge(@Param('id') id: number) {
    return this.configService.getBadge(Number(id))
  }

  @Post('/badge/batch-create')
  @ApiDoc({
    summary: '批量创建徽章',
    model: IdDto,
  })
  async createBadgeBatch(@Body() dto: CreateBadgeBatchDto) {
    return this.configService.createBadgeBatch(dto)
  }

  @Post('/system-config/create')
  @ApiDoc({
    summary: '创建系统配置',
    model: IdDto,
  })
  async createSystemConfig(@Body() dto: CreateSystemConfigDto) {
    return this.configService.createSystemConfig(dto)
  }

  @Put('/system-config/update/:id')
  @ApiDoc({
    summary: '更新系统配置',
    model: IdDto,
  })
  async updateSystemConfig(@Param('id') id: number, @Body() dto: UpdateSystemConfigDto) {
    return this.configService.updateSystemConfig(Number(id), dto)
  }

  @Delete('/system-config/delete/:id')
  @ApiDoc({
    summary: '删除系统配置',
    model: IdDto,
  })
  async deleteSystemConfig(@Param('id') id: number) {
    return this.configService.deleteSystemConfig(Number(id))
  }

  @Get('/system-config/page')
  @ApiPageDoc({
    summary: '分页查询系统配置',
    model: QuerySystemConfigDto,
  })
  async getSystemConfigPage(@Query() dto: QuerySystemConfigDto) {
    return this.configService.getSystemConfigPage(dto)
  }

  @Get('/system-config/:id')
  @ApiDoc({
    summary: '获取系统配置详情',
    model: QuerySystemConfigDto,
  })
  async getSystemConfig(@Param('id') id: number) {
    return this.configService.getSystemConfig(Number(id))
  }

  @Get('/system-config/key/:configKey')
  @ApiDoc({
    summary: '根据配置键获取系统配置',
    model: QuerySystemConfigDto,
  })
  async getSystemConfigByKey(@Param('configKey') configKey: string) {
    return this.configService.getSystemConfigByKey(configKey)
  }

  @Post('/system-config/batch-update')
  @ApiDoc({
    summary: '批量更新系统配置',
    model: IdDto,
  })
  async batchUpdateSystemConfig(@Body() dto: BatchUpdateSystemConfigDto) {
    return this.configService.batchUpdateSystemConfig(dto.updates)
  }

  @Get('/statistics')
  @ApiDoc({
    summary: '获取论坛统计数据',
  })
  async getForumStatistics() {
    return this.configService.getForumStatistics()
  }

  @Get('/top-sections')
  @ApiDoc({
    summary: '获取热门板块',
  })
  async getTopSections(@Query('limit') limit?: number) {
    return this.configService.getTopSections(limit ? Number(limit) : 10)
  }

  @Get('/top-users')
  @ApiDoc({
    summary: '获取活跃用户',
  })
  async getTopUsers(@Query('limit') limit?: number) {
    return this.configService.getTopUsers(limit ? Number(limit) : 10)
  }
}
