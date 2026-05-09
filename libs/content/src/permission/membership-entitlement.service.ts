import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, gt } from 'drizzle-orm'
import { MembershipSubscriptionStatusEnum } from './content-entitlement.constant'

@Injectable()
export class MembershipEntitlementService {
  // 初始化 VIP 权益服务依赖。
  constructor(private readonly drizzle: DrizzleService) {}

  // 读取 db。
  private get db() {
    return this.drizzle.db
  }

  // 读取用户 VIP 订阅表。
  private get userMembershipSubscription() {
    return this.drizzle.schema.userMembershipSubscription
  }

  // 判断用户是否拥有有效 VIP 订阅。
  async hasActiveSubscription(userId: number, now = new Date()) {
    const [subscription] = await this.db
      .select({ id: this.userMembershipSubscription.id })
      .from(this.userMembershipSubscription)
      .where(
        and(
          eq(this.userMembershipSubscription.userId, userId),
          eq(
            this.userMembershipSubscription.status,
            MembershipSubscriptionStatusEnum.ACTIVE,
          ),
          gt(this.userMembershipSubscription.endsAt, now),
        ),
      )
      .limit(1)

    return !!subscription
  }
}
