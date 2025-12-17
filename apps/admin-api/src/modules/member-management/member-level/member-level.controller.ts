import { ApiDoc } from '@libs/base/decorators'
import { IdDto, UpdateStatusDto } from '@libs/base/dto'
import {
  BaseMemberLevelDto,
  CreateMemberLevelDto,
  MemberLevelService,
  UpdateMemberLevelDto,
} from '@libs/member'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('会员模块/会员等级')
@Controller('/admin/member-level')
export class MemberLevelController {
  constructor(private readonly memberLevelService: MemberLevelService) {}

  @ApiDoc({
    summary: '获取会员等级列表',
    model: BaseMemberLevelDto,
  })
  @Get('/list')
  async getMemberLevelList() {
    return this.memberLevelService.getMemberLevelList()
  }

  @ApiDoc({
    summary: '获取会员等级详情',
    model: BaseMemberLevelDto,
  })
  @Get('/detail')
  async getMemberLevelDetail(@Query() idDto: IdDto) {
    return this.memberLevelService.getMemberLevelDetail(idDto)
  }

  @ApiDoc({
    summary: '创建会员等级',
    model: IdDto,
  })
  @Post('/create')
  async createMemberLevel(@Body() createMemberLevelDto: CreateMemberLevelDto) {
    return this.memberLevelService.createMemberLevel(createMemberLevelDto)
  }

  @ApiDoc({
    summary: '更新会员等级',
    model: IdDto,
  })
  @Post('/update')
  async updateMemberLevel(@Body() updateMemberLevelDto: UpdateMemberLevelDto) {
    return this.memberLevelService.updateMemberLevel(updateMemberLevelDto)
  }

  @ApiDoc({
    summary: '删除会员等级',
    model: IdDto,
  })
  @Post('/delete')
  async deleteMemberLevel(@Body() deleteMemberLevelDto: IdDto) {
    return this.memberLevelService.deleteMemberLevel(deleteMemberLevelDto)
  }

  @ApiDoc({
    summary: '更新会员等级状态',
    model: IdDto,
  })
  @Post('/change-status')
  async changeMemberLevelStatus(@Body() statusDto: UpdateStatusDto) {
    return this.memberLevelService.changeMemberLevelStatus(statusDto)
  }
}
