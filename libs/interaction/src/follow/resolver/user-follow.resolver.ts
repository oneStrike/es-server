import type { Db } from '@db/core'
import type { IFollowTargetResolver } from '../interfaces/follow-target-resolver.interface'
import { DrizzleService } from '@db/core'
import {
  MessageDomainEventFactoryService,
} from '@libs/message/eventing/message-domain-event.factory'
import { MessageDomainEventPublisher as MessageDomainEventPublisherService } from '@libs/message/eventing/message-domain-event.publisher'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { AppUserCountService } from '@libs/user/app-user-count.service'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { inArray } from 'drizzle-orm'
import { FollowTargetTypeEnum } from '../follow.constant'
import { FollowService } from '../follow.service'

/**
 * 用户关注解析器
 * 负责处理用户作为关注目标时的校验、计数和通知
 */
@Injectable()
export class UserFollowResolver implements IFollowTargetResolver, OnModuleInit {
  readonly targetType = FollowTargetTypeEnum.USER

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly followService: FollowService,
    private readonly appUserCountService: AppUserCountService,
    private readonly messageDomainEventPublisher: MessageDomainEventPublisherService,
    private readonly messageDomainEventFactoryService: MessageDomainEventFactoryService,
  ) {}

  private get appUserCount() {
    return this.drizzle.schema.appUserCount
  }

  /**
   * 在模块初始化时注册用户关注解析器。
   */
  onModuleInit() {
    this.followService.registerResolver(this)
  }

  /**
   * 校验被关注用户是否存在且不是自己。
   * 返回 ownerUserId 供后续通知链路直接复用。
   */
  async ensureExists(tx: Db, targetId: number, actorUserId: number) {
    if (targetId === actorUserId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '不能关注自己',
      )
    }

    const user = await tx.query.appUser.findFirst({
      where: {
        id: targetId,
        isEnabled: true,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '目标用户不存在',
      )
    }

    return { ownerUserId: targetId }
  }

  /**
   * 回填用户粉丝计数。
   * 当目标用户不存在时直接报错，避免脏数据静默跳过。
   */
  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    const user = await tx.query.appUser.findFirst({
      where: {
        id: targetId,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '目标用户不存在',
      )
    }

    await this.appUserCountService.updateFollowersCount(tx, targetId, delta)
  }

  /**
   * 在关注成功后写入通知 outbox 事件。
   * 同一用户关注自己不会生成通知。
   */
  async postFollowHook(
    tx: Db,
    targetId: number,
    actorUserId: number,
    options: { ownerUserId?: number },
  ) {
    const receiverUserId = options.ownerUserId ?? targetId
    if (receiverUserId === actorUserId) {
      return
    }

    const actor = await tx.query.appUser.findFirst({
      where: { id: actorUserId },
      columns: { nickname: true },
    })

    await this.messageDomainEventPublisher.publishInTx(
      tx,
      this.messageDomainEventFactoryService.buildUserFollowedEvent({
        receiverUserId,
        actorUserId,
        targetType: this.targetType,
        targetId,
        actorNickname: actor?.nickname ?? undefined,
      }),
    )
  }

  /**
   * 批量查询被关注用户的展示信息与计数字段。
   * 返回值以 targetId 为键，供分页列表直接拼装展示。
   */
  async batchGetDetails(targetIds: number[]) {
    if (targetIds.length === 0) {
      return new Map()
    }

    const users = await this.drizzle.db.query.appUser.findMany({
      where: {
        id: { in: targetIds },
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        nickname: true,
        avatarUrl: true,
        signature: true,
      },
    })
    const userIds = users.map((item) => item.id)
    const countRows = userIds.length
      ? await this.drizzle.db
          .select({
            userId: this.appUserCount.userId,
            followingUserCount: this.appUserCount.followingUserCount,
            followingAuthorCount: this.appUserCount.followingAuthorCount,
            followingSectionCount: this.appUserCount.followingSectionCount,
            followersCount: this.appUserCount.followersCount,
          })
          .from(this.appUserCount)
          .where(inArray(this.appUserCount.userId, userIds))
      : []
    const countMap = new Map(
      countRows.map((item) => [item.userId, item] as const),
    )

    return new Map(
      users.map((user) => [
        user.id,
        {
          id: user.id,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl ?? undefined,
          signature: user.signature ?? undefined,
          followingUserCount: countMap.get(user.id)?.followingUserCount ?? 0,
          followingAuthorCount:
            countMap.get(user.id)?.followingAuthorCount ?? 0,
          followingSectionCount:
            countMap.get(user.id)?.followingSectionCount ?? 0,
          followersCount: countMap.get(user.id)?.followersCount ?? 0,
        },
      ]),
    )
  }
}
