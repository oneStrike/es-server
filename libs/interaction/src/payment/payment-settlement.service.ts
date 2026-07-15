import type { PaidOrderActivationOrder } from '../membership/types/membership.type'
import type { ConfirmPaymentOrderDto } from './dto/payment.dto'
import type {
  PaymentSettlementAfterPersist,
  PaymentSettlementAfterPersistInput,
  PaymentSettlementExecutionContext,
  PaymentSettlementExecutor,
  PaymentSettlementOrder,
  PaymentSettlementPaidOrder,
  PaymentSettlementPublicResult,
  PaymentSettlementResult,
  SettleVerifiedPaymentInput,
} from './types/payment-settlement.type'
import { acquireIntegrityLocks, DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, Logger } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import {
  MembershipPaidOrderActivationSnapshotDriftError,
  MembershipService,
} from '../membership/membership.service'
import { WalletService } from '../wallet/wallet.service'
import {
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
} from './payment.constant'

/**
 * 支付结算是订单状态、钱包充值和会员履约的唯一事务 owner。
 * 通知事件只能通过 afterPersist 追加到该事务，避免订单已支付但事件未提交的半完成状态。
 */
@Injectable()
export class PaymentSettlementService {
  private readonly logger = new Logger(PaymentSettlementService.name)

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly walletService: WalletService,
    private readonly membershipService: MembershipService,
  ) {}

  // 获取当前请求使用的 Drizzle 查询实例。
  private get db() {
    return this.drizzle.db
  }

  // 获取支付订单表定义。
  private get paymentOrder() {
    return this.drizzle.schema.paymentOrder
  }

  /**
   * 将已验签的支付事实原子推进为已支付并履约。
   * 同一订单的重复通知会核验金额与交易号后通过 afterPersist 记录幂等事实，而不会二次履约。
   */
  async settleVerifiedPayment(
    input: SettleVerifiedPaymentInput,
  ): Promise<PaymentSettlementResult> {
    this.assertPaidOrderMatchesNotify(
      input.order,
      input.paidAmount,
      input.providerTradeNo,
      false,
    )
    if (input.order.status === PaymentOrderStatusEnum.PAID) {
      return this.drizzle.withTransaction({
        execute: async (tx) => {
          const context: PaymentSettlementExecutionContext = {
            tx,
            membershipActivation: undefined,
          }
          const currentOrder = await this.getCurrentPaidOrder(
            context,
            input.order.id,
            input.stateConflictMessage,
          )
          this.assertPaidOrderMatchesNotify(
            currentOrder,
            input.paidAmount,
            input.providerTradeNo,
            true,
          )
          const result: PaymentSettlementResult = {
            order: currentOrder,
            isDuplicate: true,
          }
          await this.runAfterPersist(context, input, result)
          return result
        },
      })
    }
    if (input.order.status !== PaymentOrderStatusEnum.PENDING) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        input.stateConflictMessage,
      )
    }

    return this.executePaidOrderMutationWithMembershipRetry(
      input.order,
      async (context) => {
        const [paidOrder] = await context.tx
          .update(this.paymentOrder)
          .set({
            status: PaymentOrderStatusEnum.PAID,
            paidAmount: input.paidAmount,
            providerTradeNo: input.providerTradeNo,
            notifyPayload: input.notifyPayload,
            paidAt: new Date(),
          })
          .where(
            and(
              eq(this.paymentOrder.id, input.order.id),
              eq(this.paymentOrder.status, PaymentOrderStatusEnum.PENDING),
            ),
          )
          .returning()

        if (!paidOrder) {
          const latestOrder = await context.tx.query.paymentOrder.findFirst({
            where: { id: input.order.id },
          })
          if (latestOrder?.status === PaymentOrderStatusEnum.PAID) {
            this.assertPaidOrderMatchesNotify(
              latestOrder,
              input.paidAmount,
              input.providerTradeNo,
              true,
            )
            const result: PaymentSettlementResult = {
              order: latestOrder,
              isDuplicate: true,
            }
            await this.runAfterPersist(context, input, result)
            return result
          }
          if (!latestOrder) {
            throw new BusinessException(
              BusinessErrorCode.RESOURCE_NOT_FOUND,
              '支付订单不存在',
            )
          }
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            input.stateConflictMessage,
          )
        }

        await this.applyPaidOrderSettlementAfterLocks(context, paidOrder)
        const result: PaymentSettlementResult = {
          order: paidOrder,
          isDuplicate: false,
        }
        await this.runAfterPersist(context, input, result)
        this.logger.log(
          `payment_order_paid orderNo=${paidOrder.orderNo} userId=${paidOrder.userId} orderType=${paidOrder.orderType} providerConfigId=${paidOrder.providerConfigId} providerConfigVersion=${paidOrder.providerConfigVersion}`,
        )
        return result
      },
    )
  }

  /**
   * 后台手工确认只用于已经完成审计的运营入口。
   * 它仍复用唯一结算事务，并拒绝金额、交易号或订单状态不一致的请求。
   */
  async confirmPaymentOrderManually(
    dto: ConfirmPaymentOrderDto,
    afterPersist?: PaymentSettlementAfterPersist,
  ): Promise<PaymentSettlementPublicResult> {
    const order = await this.db.query.paymentOrder.findFirst({
      where: { orderNo: dto.orderNo },
    })
    if (!order) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '支付订单不存在',
      )
    }
    if (
      dto.paidAmount === undefined ||
      dto.paidAmount === null ||
      !dto.providerTradeNo
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '手工确认缺少实付金额或第三方交易号',
      )
    }
    if (dto.paidAmount !== order.payableAmount) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '手工确认金额与订单不一致',
      )
    }

    const result = await this.settleVerifiedPayment({
      order,
      paidAmount: dto.paidAmount,
      providerTradeNo: dto.providerTradeNo,
      notifyPayload: dto.notifyPayload ?? null,
      stateConflictMessage: '当前订单状态不允许支付确认',
      afterPersist,
    })
    this.logger.log(
      `payment_order_manually_paid orderNo=${result.order.orderNo} userId=${result.order.userId} orderType=${result.order.orderType} providerTradeNo=${result.order.providerTradeNo}`,
    )
    return this.toPaymentOrderResult(result.order)
  }

  // 已支付幂等分支必须与本次已经验证的支付事实完全一致。
  private assertPaidOrderMatchesNotify(
    order: PaymentSettlementOrder,
    paidAmount: number,
    providerTradeNo: string,
    requirePaidState: boolean,
  ) {
    if (
      (requirePaidState && order.status !== PaymentOrderStatusEnum.PAID) ||
      (order.status === PaymentOrderStatusEnum.PAID &&
        (order.paidAmount !== paidAmount ||
          (order.providerTradeNo !== null &&
            order.providerTradeNo !== providerTradeNo)))
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '支付回调金额或交易号与已支付订单不一致',
      )
    }
  }

  // 从结算事务内重读已支付订单，避免使用可能过时的入参快照。
  private async getCurrentPaidOrder(
    context: PaymentSettlementExecutionContext,
    orderId: number,
    stateConflictMessage: string,
  ) {
    const order = await context.tx.query.paymentOrder.findFirst({
      where: { id: orderId },
    })
    if (!order || order.status !== PaymentOrderStatusEnum.PAID) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        stateConflictMessage,
      )
    }
    return order
  }

  // 在支付履约完成后、同一事务提交前追加通知等外部事实。
  private async runAfterPersist(
    context: PaymentSettlementExecutionContext,
    input: SettleVerifiedPaymentInput,
    result: PaymentSettlementResult,
  ) {
    if (!input.afterPersist) {
      return
    }
    const callbackInput: PaymentSettlementAfterPersistInput = {
      tx: context.tx,
      result,
    }
    await input.afterPersist(callbackInput)
  }

  // VIP 快照漂移时最多重试一次全新事务；非 VIP 无需会员锁计划。
  private async executePaidOrderMutationWithMembershipRetry<TResult>(
    order: PaidOrderActivationOrder,
    execute: PaymentSettlementExecutor<TResult>,
  ): Promise<TResult> {
    if (order.orderType !== PaymentOrderTypeEnum.VIP_SUBSCRIPTION) {
      return this.drizzle.withTransaction({
        execute: async (tx) => execute({ tx, membershipActivation: undefined }),
      })
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const membershipActivation =
        await this.membershipService.preparePaidOrderActivation(order)
      try {
        return await this.drizzle.withTransaction({
          execute: async (tx) => {
            if (membershipActivation.lockRequests.length > 0) {
              await acquireIntegrityLocks(tx, membershipActivation.lockRequests)
            }
            return execute({ tx, membershipActivation })
          },
        })
      } catch (error) {
        if (
          !(error instanceof MembershipPaidOrderActivationSnapshotDriftError)
        ) {
          throw error
        }
        if (attempt === 1) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            'VIP 套餐履约配置并发变化，请稍后重试',
          )
        }
      }
    }
    throw new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      'VIP 套餐履约配置并发变化，请稍后重试',
    )
  }

  // 已支付订单在完整锁计划获取后按订单类型执行唯一履约路径。
  private async applyPaidOrderSettlementAfterLocks(
    context: PaymentSettlementExecutionContext,
    order: PaymentSettlementPaidOrder,
  ) {
    if (order.orderType === PaymentOrderTypeEnum.CURRENCY_RECHARGE) {
      await this.walletService.applyRechargeSettlement(context.tx, order)
      return
    }
    if (order.orderType === PaymentOrderTypeEnum.VIP_SUBSCRIPTION) {
      if (!context.membershipActivation) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          'VIP 套餐履约锁计划缺失',
        )
      }
      await this.membershipService.activatePaidOrderAfterLocks(
        context.tx,
        order,
        context.membershipActivation,
      )
      return
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '不支持的支付订单类型',
    )
  }

  // 将已支付订单映射为后台确认可返回的最小公开结果。
  private toPaymentOrderResult(
    order: PaymentSettlementPaidOrder,
  ): PaymentSettlementPublicResult {
    return {
      orderNo: order.orderNo,
      orderType: order.orderType,
      status: order.status,
      subscriptionMode: order.subscriptionMode,
      payableAmount: order.payableAmount,
      clientPayPayload: {},
    }
  }
}
