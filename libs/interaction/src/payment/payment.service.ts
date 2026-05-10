import type { PaymentOrderSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  ConfirmPaymentOrderContext,
  PaymentOrderPublicResult,
  PaymentTx,
} from '../payment/types/payment.type'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, Logger } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { MembershipService } from '../membership/membership.service'
import {
  AdminPaymentOrderPageItemDto,
  ConfirmPaymentOrderDto,
  CreatePaymentProviderConfigDto,
  QueryPaymentOrderDto,
  QueryPaymentProviderConfigDto,
  UpdatePaymentProviderConfigDto,
} from '../payment/dto/payment.dto'
import { PAYMENT_PROVIDER_ADAPTERS } from '../payment/payment-provider.adapter'
import {
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
  PaymentSubscriptionModeEnum,
} from '../payment/payment.constant'
import { WalletService } from '../wallet/wallet.service'

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name)

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly walletService: WalletService,
    private readonly membershipService: MembershipService,
  ) {}

  // 获取支付订单表定义。
  private get paymentOrder() {
    return this.drizzle.schema.paymentOrder
  }

  // 获取当前请求使用的 Drizzle 查询实例。
  private get db() {
    return this.drizzle.db
  }

  // 获取支付 provider 配置表定义。
  private get paymentProviderConfig() {
    return this.drizzle.schema.paymentProviderConfig
  }

  // 分页查询支付订单。
  async getPaymentOrderPage(dto: QueryPaymentOrderDto) {
    const conditions: SQL[] = []
    if (dto.orderType !== undefined) {
      conditions.push(eq(this.paymentOrder.orderType, dto.orderType))
    }
    if (dto.status !== undefined) {
      conditions.push(eq(this.paymentOrder.status, dto.status))
    }
    const page = await this.drizzle.ext.findPagination(this.paymentOrder, {
      ...dto,
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: dto.orderBy ?? JSON.stringify({ createdAt: 'desc', id: 'desc' }),
    })
    return {
      ...page,
      list: page.list.map((order) => this.toAdminPaymentOrderPageItem(order)),
    }
  }

  // 将支付订单行映射为后台分页视图，分页契约禁止透出原始上下文和 provider payload。
  private toAdminPaymentOrderPageItem(
    order: PaymentOrderSelect,
  ): AdminPaymentOrderPageItemDto {
    return {
      id: order.id,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderNo: order.orderNo,
      userId: order.userId,
      orderType: order.orderType,
      channel: order.channel,
      paymentScene: order.paymentScene,
      platform: order.platform,
      environment: order.environment,
      clientAppKey: order.clientAppKey,
      subscriptionMode: order.subscriptionMode,
      autoRenewAgreementId: order.autoRenewAgreementId,
      status: order.status,
      payableAmount: order.payableAmount,
      paidAmount: order.paidAmount,
      targetId: order.targetId,
      providerConfigId: order.providerConfigId,
      providerConfigVersion: order.providerConfigVersion,
      credentialVersionRef: order.credentialVersionRef,
      providerTradeNo: order.providerTradeNo,
      paidAt: order.paidAt,
      closedAt: order.closedAt,
      refundedAt: order.refundedAt,
    }
  }

  // 启用或停用支付 provider 配置。
  async updatePaymentProviderStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.paymentProviderConfig)
          .set({ isEnabled })
          .where(eq(this.paymentProviderConfig.id, id)),
      {
        notFound: '支付 provider 配置不存在',
        duplicate: '支付 provider 启用配置已存在',
      },
    )
    return true
  }

  // 更新支付 provider 配置并推进配置版本。
  async updatePaymentProviderConfig(dto: UpdatePaymentProviderConfigDto) {
    const { id, ...data } = dto
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.paymentProviderConfig)
          .set({
            ...data,
            clientAppKey:
              data.clientAppKey === undefined
                ? undefined
                : this.normalizeKey(data.clientAppKey),
            appId:
              data.appId === undefined
                ? undefined
                : this.normalizeKey(data.appId),
            mchId:
              data.mchId === undefined
                ? undefined
                : this.normalizeKey(data.mchId),
          })
          .where(eq(this.paymentProviderConfig.id, id)),
      {
        notFound: '支付 provider 配置不存在',
        duplicate: '支付 provider 启用配置已存在',
      },
    )
    return true
  }

  // 标准化可选业务键，空值统一落为空字符串。
  private normalizeKey(input?: string | null) {
    return input?.trim() ?? ''
  }

  // 创建支付 provider 配置。
  async createPaymentProviderConfig(dto: CreatePaymentProviderConfigDto) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.paymentProviderConfig).values({
          ...dto,
          clientAppKey: this.normalizeKey(dto.clientAppKey),
          appId: this.normalizeKey(dto.appId),
          mchId: this.normalizeKey(dto.mchId),
        }),
      { duplicate: '支付 provider 启用配置已存在' },
    )
    return true
  }

  // 分页查询支付 provider 配置。
  async getPaymentProviderConfigPage(dto: QueryPaymentProviderConfigDto) {
    const conditions = this.buildPaymentProviderConfigConditions(dto)
    return this.drizzle.ext.findPagination(this.paymentProviderConfig, {
      ...dto,
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: dto.orderBy ?? JSON.stringify({ sortOrder: 'asc', id: 'asc' }),
    })
  }

  // 构建支付 provider 配置分页查询条件。
  private buildPaymentProviderConfigConditions(
    dto: QueryPaymentProviderConfigDto,
  ) {
    const conditions: SQL[] = []
    if (dto.channel !== undefined) {
      conditions.push(eq(this.paymentProviderConfig.channel, dto.channel))
    }
    if (dto.paymentScene !== undefined) {
      conditions.push(
        eq(this.paymentProviderConfig.paymentScene, dto.paymentScene),
      )
    }
    if (dto.platform !== undefined) {
      conditions.push(eq(this.paymentProviderConfig.platform, dto.platform))
    }
    if (dto.environment !== undefined) {
      conditions.push(
        eq(this.paymentProviderConfig.environment, dto.environment),
      )
    }
    if (dto.clientAppKey !== undefined) {
      conditions.push(
        eq(
          this.paymentProviderConfig.clientAppKey,
          this.normalizeKey(dto.clientAppKey),
        ),
      )
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.paymentProviderConfig.isEnabled, dto.isEnabled))
    }
    return conditions
  }

  // 确认 provider 已验签支付结果，app 场景必须绑定当前用户订单。
  async confirmPaymentOrder(
    dto: ConfirmPaymentOrderDto,
    context?: ConfirmPaymentOrderContext,
  ) {
    const order = await this.db.query.paymentOrder.findFirst({
      where: { orderNo: dto.orderNo },
    })
    if (!order) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '支付订单不存在',
      )
    }
    if (context?.userId !== undefined && order.userId !== context.userId) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '支付订单不存在',
      )
    }

    const config = await this.getPaymentProviderConfigById(
      order.providerConfigId,
    )
    const adapter = this.getPaymentAdapter(order.channel)
    const notifyInput = {
      order,
      config,
      payload: dto.notifyPayload ?? undefined,
    }
    if (!adapter.verifyNotify(notifyInput)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付回调验签失败',
      )
    }
    const parsed = adapter.parseNotify(notifyInput)
    const providerTradeNo = parsed.providerTradeNo
    const paidAmount = parsed.paidAmount
    const agreementNo = parsed.agreementNo
    if (!providerTradeNo || paidAmount === undefined) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付回调缺少已验签交易字段',
      )
    }
    const autoRenewAgreementNo =
      order.subscriptionMode === PaymentSubscriptionModeEnum.AUTO_RENEW_SIGNING
        ? this.requireAutoRenewAgreementNo(agreementNo)
        : undefined
    if (
      paidAmount !== order.payableAmount ||
      (dto.paidAmount != null && dto.paidAmount !== paidAmount) ||
      (dto.providerTradeNo != null && dto.providerTradeNo !== providerTradeNo)
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '支付回调金额或交易号与订单不一致',
      )
    }

    if (order.status === PaymentOrderStatusEnum.PAID) {
      this.assertPaidOrderMatchesNotify(order, paidAmount, providerTradeNo)
      return this.toPaymentOrderResult(order, {})
    }

    if (order.status !== PaymentOrderStatusEnum.PENDING) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '当前订单状态不允许支付确认',
      )
    }

    return this.drizzle.withTransaction(async (tx) => {
      const [paidOrder] = await tx
        .update(this.paymentOrder)
        .set({
          status: PaymentOrderStatusEnum.PAID,
          paidAmount,
          providerTradeNo,
          notifyPayload: dto.notifyPayload,
          paidAt: new Date(),
        })
        .where(
          and(
            eq(this.paymentOrder.id, order.id),
            eq(this.paymentOrder.status, PaymentOrderStatusEnum.PENDING),
          ),
        )
        .returning()

      if (!paidOrder) {
        const latestOrder = await tx.query.paymentOrder.findFirst({
          where: { id: order.id },
        })
        if (latestOrder?.status === PaymentOrderStatusEnum.PAID) {
          this.assertPaidOrderMatchesNotify(
            latestOrder,
            paidAmount,
            providerTradeNo,
          )
          return this.toPaymentOrderResult(latestOrder, {})
        }
        if (latestOrder) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '当前订单状态不允许支付确认',
          )
        }
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '支付订单不存在',
        )
      }

      await this.settlePaidOrder(tx, paidOrder, autoRenewAgreementNo)

      this.logger.log(
        `payment_order_paid orderNo=${paidOrder.orderNo} userId=${paidOrder.userId} orderType=${paidOrder.orderType} providerConfigId=${paidOrder.providerConfigId} providerConfigVersion=${paidOrder.providerConfigVersion}`,
      )

      return this.toPaymentOrderResult(paidOrder, {})
    })
  }

  // 后台手工确认只用于运营审计入口，禁止绕过金额、交易号和幂等校验。
  async confirmPaymentOrderManually(dto: ConfirmPaymentOrderDto) {
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
      order.subscriptionMode === PaymentSubscriptionModeEnum.AUTO_RENEW_SIGNING
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '自动续费签约订单不能手工确认',
      )
    }
    const paidAmount = dto.paidAmount
    const providerTradeNo = dto.providerTradeNo
    if (paidAmount === undefined || paidAmount === null || !providerTradeNo) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '手工确认缺少实付金额或第三方交易号',
      )
    }
    if (paidAmount !== order.payableAmount) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '手工确认金额与订单不一致',
      )
    }

    if (order.status === PaymentOrderStatusEnum.PAID) {
      this.assertPaidOrderMatchesNotify(order, paidAmount, providerTradeNo)
      return this.toPaymentOrderResult(order, {})
    }

    if (order.status !== PaymentOrderStatusEnum.PENDING) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '当前订单状态不允许支付确认',
      )
    }

    return this.drizzle.withTransaction(async (tx) => {
      const [paidOrder] = await tx
        .update(this.paymentOrder)
        .set({
          status: PaymentOrderStatusEnum.PAID,
          paidAmount,
          providerTradeNo,
          notifyPayload: dto.notifyPayload ?? null,
          paidAt: new Date(),
        })
        .where(
          and(
            eq(this.paymentOrder.id, order.id),
            eq(this.paymentOrder.status, PaymentOrderStatusEnum.PENDING),
          ),
        )
        .returning()

      if (!paidOrder) {
        const latestOrder = await tx.query.paymentOrder.findFirst({
          where: { id: order.id },
        })
        if (latestOrder?.status === PaymentOrderStatusEnum.PAID) {
          this.assertPaidOrderMatchesNotify(
            latestOrder,
            paidAmount,
            providerTradeNo,
          )
          return this.toPaymentOrderResult(latestOrder, {})
        }
        if (latestOrder) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '当前订单状态不允许支付确认',
          )
        }
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '支付订单不存在',
        )
      }

      await this.settlePaidOrder(tx, paidOrder)

      this.logger.log(
        `payment_order_manually_paid orderNo=${paidOrder.orderNo} userId=${paidOrder.userId} orderType=${paidOrder.orderType} providerTradeNo=${paidOrder.providerTradeNo}`,
      )

      return this.toPaymentOrderResult(paidOrder, {})
    })
  }

  // 将支付订单行映射为 App 公开支付结果，禁止透出 provider 内部字段。
  private toPaymentOrderResult(
    order: PaymentOrderSelect,
    clientPayPayload: Record<string, unknown>,
  ): PaymentOrderPublicResult {
    return {
      orderNo: order.orderNo,
      orderType: order.orderType,
      status: order.status,
      subscriptionMode: order.subscriptionMode,
      payableAmount: order.payableAmount,
      clientPayPayload,
    }
  }

  // 已支付幂等分支仍必须与本次已验签回调事实一致。
  private assertPaidOrderMatchesNotify(
    order: PaymentOrderSelect,
    paidAmount: number,
    providerTradeNo: string,
  ) {
    if (
      order.paidAmount !== paidAmount ||
      (order.providerTradeNo !== null &&
        order.providerTradeNo !== providerTradeNo)
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '支付回调金额或交易号与已支付订单不一致',
      )
    }
  }

  // 自动续费签约订单必须携带 provider 已验签协议号，禁止本地合成协议身份。
  private requireAutoRenewAgreementNo(agreementNo?: string) {
    if (!agreementNo) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '自动续费回调缺少已验签协议号',
      )
    }
    return agreementNo
  }

  // 获取指定支付渠道的 provider 适配器。
  private getPaymentAdapter(channel: number) {
    const adapter = PAYMENT_PROVIDER_ADAPTERS.find(
      (candidate) => candidate.channel === channel,
    )
    if (!adapter) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '不支持的支付渠道',
      )
    }
    return adapter
  }

  // 根据 ID 读取支付 provider 配置。
  private async getPaymentProviderConfigById(id: number) {
    const config = await this.db.query.paymentProviderConfig.findFirst({
      where: { id },
    })
    if (!config) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '支付 provider 配置不存在',
      )
    }
    return config
  }

  // 已支付订单的资产/会员结算统一从这里分派，避免 admin 和 app 出现两套发放路径。
  private async settlePaidOrder(
    tx: PaymentTx,
    order: PaymentOrderSelect,
    agreementNo?: string,
  ) {
    if (order.orderType === PaymentOrderTypeEnum.CURRENCY_RECHARGE) {
      await this.walletService.applyRechargeSettlement(tx, order)
      return
    }
    if (order.orderType === PaymentOrderTypeEnum.VIP_SUBSCRIPTION) {
      await this.membershipService.activatePaidOrder(tx, order, agreementNo)
      return
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '不支持的支付订单类型',
    )
  }
}
