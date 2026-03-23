import type { Db } from '@db/core'
import type { IFollowTargetResolver } from '../interfaces/follow-target-resolver.interface'
import { DrizzleService } from '@db/core'
import { MessageNotificationTypeEnum } from '@libs/message/notification'
import { MessageOutboxService } from '@libs/message/outbox'
import { AppUserCountService } from '@libs/user'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
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
    private readonly messageOutboxService: MessageOutboxService,
  ) {}

  private get appUserCount() {
    return this.drizzle.schema.appUserCount
  }

  onModuleInit() {
    this.followService.registerResolver(this)
  }

  async ensureExists(tx: Db, targetId: number, actorUserId: number) {
    if (targetId === actorUserId) {
      throw new BadRequestException('不能关注自己')
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
      throw new BadRequestException('目标用户不存在')
    }

    return { ownerUserId: targetId }
  }

  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    const user = await tx.query.appUser.findFirst({
      where: {
        id: targetId,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!user) {
      throw new NotFoundException('目标用户不存在')
    }

    await this.appUserCountService.updateFollowersCount(tx, targetId, delta)
  }

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

    await this.messageOutboxService.enqueueNotificationEventInTx(
      tx,
      {
        eventType: MessageNotificationTypeEnum.USER_FOLLOW,
        bizKey: `notify:follow:${this.targetType}:${targetId}:actor:${actorUserId}:receiver:${receiverUserId}`,
        payload: {
          receiverUserId,
          actorUserId,
          type: MessageNotificationTypeEnum.USER_FOLLOW,
          targetType: this.targetType,
          targetId,
          title: '你有新的关注',
          content: '有人关注了你',
        },
      },
    )
  }

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
            followingCount: this.appUserCount.followingCount,
            followersCount: this.appUserCount.followersCount,
          })
          .from(this.appUserCount)
          .where(inArray(this.appUserCount.userId, userIds))
      : []
    const countMap = new Map(countRows.map((item) => [item.userId, item] as const))

    return new Map(
      users.map((user) => [
        user.id,
        {
          id: user.id,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl ?? undefined,
          signature: user.signature ?? undefined,
          followingCount: countMap.get(user.id)?.followingCount ?? 0,
          followersCount: countMap.get(user.id)?.followersCount ?? 0,
        },
      ]),
    )
  }
}
