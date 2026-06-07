import type { Db } from '@db/core'
import type { ForumTopicSelect } from '@db/schema'
import type {
  ApprovedTopicRewardParams,
  FollowingPublicForumTopicQuery,
  ForumTopicClientContext,
  PublicForumTopicDetailContext,
  PublicForumTopicQueryWithUser,
  TopicAuditActorOptions,
  TopicGovernanceSnapshot,
  UpdateTopicStatusData,
  UpdateTopicStatusOptions,
} from './forum-topic.type'
import { Injectable } from '@nestjs/common'
import {
  AdminForumTopicDetailDto,
  CreateForumTopicDto,
  MoveForumTopicDto,
  PublicForumTopicDetailDto,
  QueryForumTopicDto,
  UpdateForumTopicAuditStatusDto,
  UpdateForumTopicDto,
  UpdateForumTopicFeaturedDto,
  UpdateForumTopicHiddenDto,
  UpdateForumTopicLockedDto,
  UpdateForumTopicPinnedDto,
} from './dto/forum-topic.dto'
import { ForumTopicCommandService } from './forum-topic-command.service'
import { ForumTopicQueryService } from './forum-topic-query.service'

// 论坛主题模块公开 API facade。
// 外部入口和跨模块消费者只依赖本服务；读写事实由 query/command owner service 承担。
@Injectable()
export class ForumTopicService {
  constructor(
    private readonly queryService: ForumTopicQueryService,
    private readonly commandService: ForumTopicCommandService,
  ) {}

  // 在既有事务中获取仍可治理的主题快照。
  async getActiveTopicByIdInTx(tx: Db, id: number) {
    return this.commandService.getActiveTopicByIdInTx(tx, id)
  }

  // 创建论坛主题并返回新主题 ID。
  async createForumTopic(
    createTopicDto: CreateForumTopicDto,
    context: ForumTopicClientContext = {},
  ) {
    return this.commandService.createForumTopic(createTopicDto, context)
  }

  // 获取后台主题详情。
  async getTopicById(id: number): Promise<AdminForumTopicDetailDto> {
    return this.queryService.getTopicById(id)
  }

  // 获取公开主题详情并补齐当前用户交互状态。
  async getPublicTopicById(
    id: number,
    context: PublicForumTopicDetailContext = {},
  ): Promise<PublicForumTopicDetailDto> {
    return this.queryService.getPublicTopicById(id, context)
  }

  // 获取评论系统使用的主题目标快照。
  async getTopicCommentTarget(id: number, userId?: number) {
    return this.queryService.getTopicCommentTarget(id, userId)
  }

  // 获取后台主题分页。
  async getTopics(queryForumTopicDto: QueryForumTopicDto) {
    return this.queryService.getTopics(queryForumTopicDto)
  }

  // 获取公开主题分页。
  async getPublicTopics(query: PublicForumTopicQueryWithUser) {
    return this.queryService.getPublicTopics(query)
  }

  // 获取公开热门主题分页。
  async getHotPublicTopics(query: PublicForumTopicQueryWithUser) {
    return this.queryService.getHotPublicTopics(query)
  }

  // 获取当前用户关注来源聚合出的公开主题分页。
  async getFollowingPublicTopics(query: FollowingPublicForumTopicQuery) {
    return this.queryService.getFollowingPublicTopics(query)
  }

  // 批量获取收藏列表需要的主题详情。
  async batchGetFavoriteTopicDetails(targetIds: number[], userId?: number) {
    return this.queryService.batchGetFavoriteTopicDetails(targetIds, userId)
  }

  // 管理端更新主题内容。
  async updateTopic(
    updateForumTopicDto: UpdateForumTopicDto,
    context: ForumTopicClientContext = {},
    actorUserId?: number,
  ) {
    return this.commandService.updateTopic(
      updateForumTopicDto,
      context,
      actorUserId,
    )
  }

  // 在既有事务中删除当前主题快照。
  async deleteTopicWithCurrentInTx(
    tx: Db,
    topic: ForumTopicSelect,
    context: ForumTopicClientContext = {},
    actorUserId = topic.userId,
  ) {
    return this.commandService.deleteTopicWithCurrentInTx(
      tx,
      topic,
      context,
      actorUserId,
    )
  }

  // 管理端删除主题。
  async deleteTopic(
    id: number,
    context: ForumTopicClientContext = {},
    actorUserId?: number,
  ) {
    return this.commandService.deleteTopic(id, context, actorUserId)
  }

  // 移动主题到目标板块。
  async moveTopic(input: MoveForumTopicDto) {
    return this.commandService.moveTopic(input)
  }

  // 在既有事务中移动主题。
  async moveTopicInTx(
    tx: Db,
    input: MoveForumTopicDto,
    currentSectionId?: number,
  ) {
    return this.commandService.moveTopicInTx(tx, input, currentSectionId)
  }

  // 在既有事务中更新主题治理状态字段。
  async updateTopicStatusInTx(
    tx: Db,
    id: number,
    updateData: UpdateTopicStatusData,
    options?: UpdateTopicStatusOptions,
    sectionId?: number,
  ) {
    return this.commandService.updateTopicStatusInTx(
      tx,
      id,
      updateData,
      options,
      sectionId,
    )
  }

  // 更新主题置顶状态。
  async updateTopicPinned(updateTopicPinnedDto: UpdateForumTopicPinnedDto) {
    return this.commandService.updateTopicPinned(updateTopicPinnedDto)
  }

  // 在既有事务中更新主题置顶状态。
  async updateTopicPinnedInTx(
    tx: Db,
    updateTopicPinnedDto: UpdateForumTopicPinnedDto,
  ) {
    return this.commandService.updateTopicPinnedInTx(tx, updateTopicPinnedDto)
  }

  // 更新主题精华状态。
  async updateTopicFeatured(
    updateTopicFeaturedDto: UpdateForumTopicFeaturedDto,
  ) {
    return this.commandService.updateTopicFeatured(updateTopicFeaturedDto)
  }

  // 在既有事务中更新主题精华状态。
  async updateTopicFeaturedInTx(
    tx: Db,
    updateTopicFeaturedDto: UpdateForumTopicFeaturedDto,
  ) {
    return this.commandService.updateTopicFeaturedInTx(
      tx,
      updateTopicFeaturedDto,
    )
  }

  // 更新主题锁定状态。
  async updateTopicLocked(updateTopicLockedDto: UpdateForumTopicLockedDto) {
    return this.commandService.updateTopicLocked(updateTopicLockedDto)
  }

  // 在既有事务中更新主题锁定状态。
  async updateTopicLockedInTx(
    tx: Db,
    updateTopicLockedDto: UpdateForumTopicLockedDto,
  ) {
    return this.commandService.updateTopicLockedInTx(tx, updateTopicLockedDto)
  }

  // 更新主题隐藏状态。
  async updateTopicHidden(updateTopicHiddenDto: UpdateForumTopicHiddenDto) {
    return this.commandService.updateTopicHidden(updateTopicHiddenDto)
  }

  // 在既有事务中更新主题隐藏状态。
  async updateTopicHiddenInTx(
    tx: Db,
    updateTopicHiddenDto: UpdateForumTopicHiddenDto,
    currentTopic?: TopicGovernanceSnapshot,
  ) {
    return this.commandService.updateTopicHiddenInTx(
      tx,
      updateTopicHiddenDto,
      currentTopic,
    )
  }

  // 更新主题审核状态。
  async updateTopicAuditStatus(
    updateTopicAuditStatusDto: UpdateForumTopicAuditStatusDto,
    options?: TopicAuditActorOptions,
  ) {
    return this.commandService.updateTopicAuditStatus(
      updateTopicAuditStatusDto,
      options,
    )
  }

  // 在既有事务中更新主题审核状态。
  async updateTopicAuditStatusInTx(
    tx: Db,
    updateTopicAuditStatusDto: UpdateForumTopicAuditStatusDto,
    options?: TopicAuditActorOptions,
    currentTopic?: TopicGovernanceSnapshot,
  ) {
    return this.commandService.updateTopicAuditStatusInTx(
      tx,
      updateTopicAuditStatusDto,
      options,
      currentTopic,
    )
  }

  // 补发审核通过主题的成长奖励。
  async rewardApprovedTopicIfNeeded(params: ApprovedTopicRewardParams) {
    return this.commandService.rewardApprovedTopicIfNeeded(params)
  }

  // 构建审核通过主题的成长奖励 payload，供治理链路补建 settlement 事实。
  buildApprovedTopicGrowthEventPayload(params: ApprovedTopicRewardParams) {
    return this.commandService.buildApprovedTopicGrowthEventPayload(params)
  }

  // 用户编辑自己的主题。
  async updateUserTopic(
    userId: number,
    input: UpdateForumTopicDto,
    context: ForumTopicClientContext = {},
  ) {
    return this.commandService.updateUserTopic(userId, input, context)
  }

  // 用户删除自己的主题。
  async deleteUserTopic(
    userId: number,
    id: number,
    context: ForumTopicClientContext = {},
  ) {
    return this.commandService.deleteUserTopic(userId, id, context)
  }
}
