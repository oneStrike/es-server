import type { JwtUserInfoInterface } from '@libs/base/types'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import {
  BaseUserBalanceRecordDto,
  QueryUserBalanceRecordDto,
} from '@libs/user/balance'
import { BaseUserPointRecordDto } from '@libs/user/point'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { BaseAppUserDto } from '../auth/dto/auth.dto'
import { QueryMyPointRecordDto } from './dto/user-point.dto'
import { UserService } from './user.service'

@ApiTags('用户模块')
@Controller('app/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiDoc({
    summary: '获取用户信息',
    model: BaseAppUserDto,
  })
  async getProfile(@CurrentUser() user: JwtUserInfoInterface) {
    return this.userService.getUserProfile(user.sub)
  }

  @Get('balance/records')
  @ApiPageDoc({
    summary: '分页查询余额流水',
    model: BaseUserBalanceRecordDto,
  })
  async getBalanceRecords(
    @Query() query: QueryUserBalanceRecordDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.userService.getUserBalanceRecords(user.sub, query)
  }

  @Get('points/records')
  @ApiPageDoc({
    summary: '分页查询积分流水',
    model: BaseUserPointRecordDto,
  })
  async getPointRecords(
    @Query() query: QueryMyPointRecordDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.userService.getUserPointRecords(user.sub, query)
  }
}
