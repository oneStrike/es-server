/**
 * 点赞模块
 *
 * 功能说明：
 * - 提供点赞、取消点赞、查询点赞状态等核心功能
 * - 通过解析器模式支持多种目标类型的点赞操作
 * - 集成成长奖励能力
 *
 * 依赖模块：
 * - GrowthEventBridgeModule：成长事件桥接模块，用于统一派发点赞事件
 */
import { GrowthEventBridgeModule } from '@libs/growth/growth-reward'
import { UserModule } from '@libs/user/core'
import { Module } from '@nestjs/common'
import { LikeGrowthService } from './like-growth.service'
import { LikeService } from './like.service'

@Module({
  imports: [GrowthEventBridgeModule, UserModule],
  providers: [LikeService, LikeGrowthService],
  exports: [LikeService],
})
export class LikeModule {}
