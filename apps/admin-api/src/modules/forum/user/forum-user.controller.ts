import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BatchOperationResponseDto, IdDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { ForumUserService } from './forum-user.service'
import {
  AdjustPointsDto,
  BaseForumProfileDto,
  CreateForumProfileDto,
  QueryForumProfileDto,
  UpdateBanStatusDto,
  UpdateForumProfileDto,
} from './dto/forum-user.dto'

/**
 * 论坛用户管理控制器
 * 提供论坛用户相关的API接口
 */
@ApiTags('论坛管理/用户管理模块')
@Controller('admin/forum/user')
export class ForumUserController {
  constructor(private readonly forumUserService: ForumUserService) {}

  /**
   * 创建论坛用户资料
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建论坛用户资料',
    model: IdDto,
  })
  async create(@Body() body: CreateForumProfileDto) {
    return this.forumUserService.createForumProfile(body)
  }

  /**
   * 分页查询论坛用户资料列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询论坛用户资料列表',
    model: BaseForumProfileDto,
  })
  async getPage(@Query() query: QueryForumProfileDto) {
    return this.forumUserService.getForumProfilePage(query)
  }

  /**
   * 获取论坛用户资料详情
   */
  @Get('/detail')
  @ApiDoc({
    summary: '获取论坛用户资料详情',
    model: BaseForumProfileDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.forumUserService.getForumProfileDetail(query.id)
  }

  /**
   * 更新论坛用户资料
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新论坛用户资料',
    model: IdDto,
  })
  async update(@Body() body: UpdateForumProfileDto) {
    return this.forumUserService.updateForumProfile(body)
  }

  /**
   * 软删除论坛用户资料
   */
  @Post('/delete')
  @ApiDoc({
    summary: '软删除论坛用户资料',
    model: IdDto,
  })
  async delete(@Body() body: IdDto) {
    return this.forumUserService.deleteForumProfile(body.id)
  }

  /**
   * 调整用户积分
   */
  @Post('/adjust-points')
  @ApiDoc({
    summary: '调整用户积分',
    model: IdDto,
  })
  async adjustPoints(@Body() body: AdjustPointsDto) {
    return this.forumUserService.adjustPoints(body)
  }

  /**
   * 更新用户封禁状态
   */
  @Post('/update-ban-status')
  @ApiDoc({
    summary: '更新用户封禁状态',
    model: BatchOperationResponseDto,
  })
  async updateBanStatus(@Body() body: UpdateBanStatusDto) {
    return this.forumUserService.updateBanStatus(body.id, body.isBanned)
  }
}
