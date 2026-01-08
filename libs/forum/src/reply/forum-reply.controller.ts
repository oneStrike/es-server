import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BatchOperationResponseDto, IdDto, IdsDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  BaseForumReplyDto,
  CreateForumReplyDto,
  QueryForumReplyDto,
  UpdateReplyAuditStatusDto,
  UpdateReplyHiddenDto,
} from './dto/forum-reply.dto'
import { ForumReplyService } from './forum-reply.service'

/**
 * 论坛回复管理控制器
 * 提供论坛回复相关的API接口
 */
@ApiTags('论坛管理/回复管理模块')
@Controller('admin/forum/reply')
export class ForumReplyController {
  constructor(private readonly forumReplyService: ForumReplyService) {}

  /**
   * 创建论坛回复
   * @param body - 创建论坛回复的数据传输对象
   * @returns 创建的论坛回复ID
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建论坛回复',
    model: IdDto,
  })
  async create(@Body() body: CreateForumReplyDto) {
    return this.forumReplyService.createForumReply(body)
  }

  /**
   * 分页查询论坛回复列表
   * @param query - 查询参数
   * @returns 分页的论坛回复列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询论坛回复列表',
    model: BaseForumReplyDto,
  })
  async getPage(@Query() query: QueryForumReplyDto) {
    return this.forumReplyService.getForumReplyPage(query)
  }

  /**
   * 获取论坛回复详情
   * @param query - 包含回复ID的对象
   * @returns 论坛回复详情
   */
  @Get('/detail')
  @ApiDoc({
    summary: '获取论坛回复详情',
    model: BaseForumReplyDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.forumReplyService.getForumReplyDetail(query.id)
  }

  /**
   * 软删除论坛回复
   * @param body - 包含回复ID的对象
   * @returns 操作结果
   */
  @Post('/delete')
  @ApiDoc({
    summary: '软删除论坛回复',
    model: IdDto,
  })
  async delete(@Body() body: IdDto) {
    return this.forumReplyService.deleteForumReply(body.id)
  }

  /**
   * 更新回复审核状态
   * @param body - 更新审核状态的数据传输对象
   * @returns 批量操作响应
   */
  @Post('/update-audit-status')
  @ApiDoc({
    summary: '更新回复审核状态',
    model: BatchOperationResponseDto,
  })
  async updateAuditStatus(@Body() body: UpdateReplyAuditStatusDto) {
    return this.forumReplyService.updateAuditStatus(body.id, body.auditStatus)
  }

  /**
   * 更新回复隐藏状态
   * @param body - 更新隐藏状态的数据传输对象
   * @returns 批量操作响应
   */
  @Post('/update-hidden')
  @ApiDoc({
    summary: '更新回复隐藏状态',
    model: BatchOperationResponseDto,
  })
  async updateHidden(@Body() body: UpdateReplyHiddenDto) {
    return this.forumReplyService.updateHiddenStatus(body.id, body.isHidden)
  }

  /**
   * 批量删除回复
   * @param body - 包含回复ID列表的对象
   * @returns 批量操作响应
   */
  @Post('/batch-delete')
  @ApiDoc({
    summary: '批量删除回复',
    model: BatchOperationResponseDto,
  })
  async batchDelete(@Body() body: IdsDto) {
    return this.forumReplyService.batchDeleteForumReply(body.ids)
  }
}
