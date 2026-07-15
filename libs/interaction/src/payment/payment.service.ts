import type {
  PaymentOrderSelect,
  PaymentProviderCertificateSelect,
  PaymentProviderConfigInsert,
  PaymentProviderConfigSelect,
  PaymentProviderConfigVersionSelect,
  PaymentProviderCredentialSelect,
  PaymentReconciliationRecordSelect,
} from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  PaidOrderActivationOrder,
  PreparedPaidOrderActivation,
} from '../membership/types/membership.type'
import type {
  ConfirmPaymentOrderContext,
  PaymentOrderPublicResult,
  PaymentOrderStatusResult,
  PaymentProviderAdapter,
  PaymentProviderConfigSnapshot,
  PaymentProviderConfigWriteDto,
  PaymentProviderConfigWriteValues,
  PaymentProviderCredentialMaterial,
  PaymentProviderOrderSnapshot,
  PaymentTx,
  ProviderPaymentNotifyRequest,
} from '../payment/types/payment.type'
import { createHash } from 'node:crypto'
import process from 'node:process'
import { acquireIntegrityLocks, DrizzleService, toPageResult } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils'
import { Injectable, Logger } from '@nestjs/common'
import { and, asc, eq, gte, lt, sql } from 'drizzle-orm'
import {
  MembershipPaidOrderActivationSnapshotDriftError,
  MembershipService,
} from '../membership/membership.service'
import {
  AdminPaymentOrderPageItemDto,
  AdminPaymentProviderConfigPageItemDto,
  AdminPaymentReconciliationPageItemDto,
  ConfirmPaymentOrderDto,
  CreatePaymentProviderConfigDto,
  PaymentProviderAccountOptionDto,
  PaymentProviderAccountOptionQueryDto,
  PaymentProviderCertificateOptionDto,
  PaymentProviderCertificateOptionQueryDto,
  PaymentProviderCredentialOptionDto,
  PaymentProviderCredentialOptionQueryDto,
  ProviderPaymentNotifyAckDto,
  QueryPaymentOrderDto,
  QueryPaymentProviderConfigDto,
  QueryPaymentReconciliationDto,
  RepairPaidPaymentOrderDto,
  UpdatePaymentProviderConfigDto,
} from '../payment/dto/payment.dto'
import { PAYMENT_PROVIDER_ADAPTERS } from '../payment/payment-provider.adapter'
import {
  PaymentChannelEnum,
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
} from '../payment/payment.constant'
import { WalletService } from '../wallet/wallet.service'

const PAYMENT_CREDENTIAL_TYPE = {
  APP_PRIVATE_KEY: 1,
  ALIPAY_PUBLIC_KEY: 2,
  WECHAT_API_V3_KEY: 3,
} as const

const PAYMENT_CERTIFICATE_TYPE = {
  APP_CERTIFICATE: 1,
  PLATFORM_CERTIFICATE: 2,
  ROOT_CERTIFICATE: 3,
} as const

const PAYMENT_NOTIFY_PROCESS_STATUS = {
  PENDING: 1,
  PROCESSED: 2,
  DUPLICATE: 3,
  FAILED: 4,
} as const

const PAYMENT_NOTIFY_VERIFY_STATUS = {
  PENDING: 1,
  SUCCESS: 2,
  FAILED: 3,
} as const

type PaymentProviderConfigFilter = Pick<
  QueryPaymentProviderConfigDto,
  | 'channel'
  | 'paymentScene'
  | 'platform'
  | 'environment'
  | 'clientAppKey'
  | 'isEnabled'
>

type PaymentProviderAccountOptionSource = Pick<
  PaymentProviderConfigSelect,
  | 'id'
  | 'configName'
  | 'appId'
  | 'mchId'
  | 'channel'
  | 'paymentScene'
  | 'platform'
  | 'environment'
  | 'clientAppKey'
  | 'configVersion'
  | 'isEnabled'
>

type PaymentProviderAccountLabelConfigSource = Pick<
  PaymentProviderConfigSelect,
  'id' | 'configName' | 'appId' | 'mchId'
>

type PaymentProviderAccountLabelOrderSource = Pick<
  PaymentOrderSelect,
  'id' | 'providerConfigId' | 'configSnapshot'
>

type AdminPaymentOrderPageSource = Pick<
  PaymentOrderSelect,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'orderNo'
  | 'userId'
  | 'orderType'
  | 'channel'
  | 'paymentScene'
  | 'platform'
  | 'environment'
  | 'clientAppKey'
  | 'subscriptionMode'
  | 'status'
  | 'payableAmount'
  | 'paidAmount'
  | 'targetId'
  | 'providerConfigId'
  | 'providerConfigVersion'
  | 'configSnapshot'
  | 'providerTradeNo'
  | 'paidAt'
  | 'closedAt'
  | 'refundedAt'
>

type PaymentProviderCredentialOptionSource = Pick<
  PaymentProviderCredentialSelect,
  | 'id'
  | 'displayName'
  | 'versionLabel'
  | 'maskedIdentifier'
  | 'channel'
  | 'credentialType'
  | 'fingerprint'
  | 'status'
  | 'expiredAt'
>

type PaymentProviderCertificateOptionSource = Pick<
  PaymentProviderCertificateSelect,
  | 'id'
  | 'displayName'
  | 'versionLabel'
  | 'serialNo'
  | 'channel'
  | 'certificateType'
  | 'fingerprint'
  | 'status'
  | 'expiredAt'
>

type PaymentProviderCredentialSelectionSource = Pick<
  PaymentProviderCredentialSelect,
  | 'id'
  | 'channel'
  | 'credentialType'
  | 'credentialRef'
  | 'versionLabel'
  | 'displayName'
  | 'maskedIdentifier'
  | 'fingerprint'
  | 'status'
>

type PaymentProviderCertificateSelectionSource = Pick<
  PaymentProviderCertificateSelect,
  | 'id'
  | 'channel'
  | 'certificateType'
  | 'certificateRef'
  | 'serialNo'
  | 'versionLabel'
  | 'displayName'
  | 'fingerprint'
  | 'status'
>

type PaymentProviderCredentialMaterialSource = Pick<
  PaymentProviderCredentialSelect,
  'metadata'
>

type PaymentProviderCertificateMaterialSource = Pick<
  PaymentProviderCertificateSelect,
  'metadata' | 'serialNo'
>

type AdminPaymentProviderConfigPageSource = Pick<
  PaymentProviderConfigSelect,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'channel'
  | 'paymentScene'
  | 'platform'
  | 'environment'
  | 'clientAppKey'
  | 'configName'
  | 'appId'
  | 'mchId'
  | 'notifyUrl'
  | 'returnUrl'
  | 'allowedReturnDomains'
  | 'certMode'
  | 'configMetadata'
  | 'sortOrder'
  | 'isEnabled'
>

type PaymentReconciliationPageSource = Pick<
  PaymentReconciliationRecordSelect,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'paymentOrderId'
  | 'orderNo'
  | 'channel'
  | 'mismatchType'
  | 'status'
  | 'localStatus'
  | 'providerStatus'
  | 'providerTradeNo'
  | 'localAmount'
  | 'providerAmount'
  | 'currency'
  | 'evidence'
  | 'handledRemark'
>

type PaymentProviderConfigVersionWriteSource = Pick<
  PaymentProviderConfigSelect,
  | 'allowedReturnDomains'
  | 'apiV3KeyRef'
  | 'appCertRef'
  | 'appId'
  | 'certMode'
  | 'channel'
  | 'clientAppKey'
  | 'configMetadata'
  | 'configName'
  | 'configVersion'
  | 'credentialVersionRef'
  | 'environment'
  | 'id'
  | 'isEnabled'
  | 'mchId'
  | 'notifyUrl'
  | 'paymentScene'
  | 'platform'
  | 'platformCertRef'
  | 'privateKeyRef'
  | 'publicKeyRef'
  | 'returnUrl'
  | 'rootCertRef'
>

type PaymentProviderConfigVersionIdSnapshot = Pick<
  PaymentProviderConfigVersionSelect,
  'id'
>

type PaymentProviderConfigWriteSnapshot = Pick<
  PaymentProviderConfigSelect,
  'channel' | 'configMetadata'
>

type PaymentRepairReconciliationSnapshot = Pick<
  PaymentReconciliationRecordSelect,
  | 'id'
  | 'localStatus'
  | 'mismatchType'
  | 'orderNo'
  | 'providerAmount'
  | 'providerStatus'
  | 'providerTradeNo'
  | 'status'
>

type PaymentProviderConfigVersionOrderSnapshot = Pick<
  PaymentProviderConfigVersionSelect,
  | 'appId'
  | 'channel'
  | 'configSnapshot'
  | 'configVersion'
  | 'isActive'
  | 'mchId'
  | 'notifyUrl'
  | 'providerConfigId'
  | 'returnUrl'
  | 'status'
>

type PaymentProviderConfigForOrderSnapshot = PaymentProviderConfigSnapshot &
  Pick<
    PaymentProviderConfigSelect,
    'apiV3KeyRef' | 'platformCertRef' | 'publicKeyRef'
  >

type PaymentNotifyOrderSnapshot = PaymentProviderOrderSnapshot &
  Pick<
    PaymentOrderSelect,
    | 'alipayPublicCredentialId'
    | 'id'
    | 'paidAmount'
    | 'providerConfigVersion'
    | 'providerConfigVersionId'
    | 'providerTradeNo'
    | 'orderType'
    | 'targetId'
    | 'userId'
    | 'wechatApiV3CredentialId'
  >

type PaymentNotifyEventOrderSnapshot = Pick<
  PaymentOrderSelect,
  'id' | 'orderNo'
>

type PaymentOrderPaidStateSnapshot = PaymentNotifyEventOrderSnapshot &
  Pick<PaymentOrderSelect, 'paidAmount' | 'providerTradeNo' | 'status'>

type PaymentOrderConfirmationSnapshot = PaymentNotifyOrderSnapshot &
  Pick<PaymentOrderSelect, 'orderType' | 'subscriptionMode' | 'userId'>

type PaymentOrderManualConfirmationSnapshot = PaymentOrderPaidStateSnapshot &
  Pick<
    PaymentOrderSelect,
    'orderType' | 'payableAmount' | 'subscriptionMode' | 'targetId' | 'userId'
  >

type PaymentOrderPublicResultSource = Pick<
  PaymentOrderSelect,
  'orderNo' | 'orderType' | 'payableAmount' | 'status' | 'subscriptionMode'
>

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

  // 获取支付 provider 通知事件表定义。
  private get paymentNotifyEvent() {
    return this.drizzle.schema.paymentNotifyEvent
  }

  // 获取当前请求使用的 Drizzle 查询实例。
  private get db() {
    return this.drizzle.db
  }

  // 获取支付 provider 配置表定义。
  private get paymentProviderConfig() {
    return this.drizzle.schema.paymentProviderConfig
  }

  // 获取支付 provider 不可变配置版本表定义。
  private get paymentProviderConfigVersion() {
    return this.drizzle.schema.paymentProviderConfigVersion
  }

  // 获取支付 provider 凭据注册表定义。
  private get paymentProviderCredential() {
    return this.drizzle.schema.paymentProviderCredential
  }

  // 获取支付 provider 证书注册表定义。
  private get paymentProviderCertificate() {
    return this.drizzle.schema.paymentProviderCertificate
  }

  private get paymentProviderCredentialSelectionColumns() {
    return {
      id: true,
      channel: true,
      credentialType: true,
      credentialRef: true,
      versionLabel: true,
      displayName: true,
      maskedIdentifier: true,
      fingerprint: true,
      status: true,
    } as const
  }

  private get paymentProviderCertificateSelectionColumns() {
    return {
      id: true,
      channel: true,
      certificateType: true,
      certificateRef: true,
      serialNo: true,
      versionLabel: true,
      displayName: true,
      fingerprint: true,
      status: true,
    } as const
  }

  private get paymentProviderCredentialMaterialColumns() {
    return {
      metadata: true,
    } as const
  }

  private get paymentProviderCertificateMaterialColumns() {
    return {
      metadata: true,
      serialNo: true,
    } as const
  }

  private get paymentProviderConfigVersionWriteSourceSelect() {
    return {
      id: this.paymentProviderConfig.id,
      channel: this.paymentProviderConfig.channel,
      paymentScene: this.paymentProviderConfig.paymentScene,
      platform: this.paymentProviderConfig.platform,
      environment: this.paymentProviderConfig.environment,
      clientAppKey: this.paymentProviderConfig.clientAppKey,
      configName: this.paymentProviderConfig.configName,
      appId: this.paymentProviderConfig.appId,
      mchId: this.paymentProviderConfig.mchId,
      notifyUrl: this.paymentProviderConfig.notifyUrl,
      returnUrl: this.paymentProviderConfig.returnUrl,
      allowedReturnDomains: this.paymentProviderConfig.allowedReturnDomains,
      certMode: this.paymentProviderConfig.certMode,
      publicKeyRef: this.paymentProviderConfig.publicKeyRef,
      privateKeyRef: this.paymentProviderConfig.privateKeyRef,
      apiV3KeyRef: this.paymentProviderConfig.apiV3KeyRef,
      appCertRef: this.paymentProviderConfig.appCertRef,
      platformCertRef: this.paymentProviderConfig.platformCertRef,
      rootCertRef: this.paymentProviderConfig.rootCertRef,
      configVersion: this.paymentProviderConfig.configVersion,
      credentialVersionRef: this.paymentProviderConfig.credentialVersionRef,
      configMetadata: this.paymentProviderConfig.configMetadata,
      isEnabled: this.paymentProviderConfig.isEnabled,
    } as const
  }

  private get paymentNotifyOrderColumns() {
    return {
      id: true,
      orderNo: true,
      channel: true,
      paymentScene: true,
      status: true,
      payableAmount: true,
      paidAmount: true,
      providerConfigId: true,
      providerConfigVersionId: true,
      providerConfigVersion: true,
      alipayPublicCredentialId: true,
      wechatApiV3CredentialId: true,
      credentialVersionRef: true,
      providerTradeNo: true,
      orderType: true,
      targetId: true,
      userId: true,
    } as const
  }

  private get paymentOrderPaidStateColumns() {
    return {
      id: true,
      orderNo: true,
      status: true,
      paidAmount: true,
      providerTradeNo: true,
    } as const
  }

  private get paymentOrderConfirmationColumns() {
    return {
      ...this.paymentNotifyOrderColumns,
      orderType: true,
      subscriptionMode: true,
      userId: true,
    } as const
  }

  private get paymentOrderManualConfirmationColumns() {
    return {
      ...this.paymentOrderPaidStateColumns,
      orderType: true,
      payableAmount: true,
      subscriptionMode: true,
      targetId: true,
      userId: true,
    } as const
  }

  private get paymentProviderConfigVersionOrderColumns() {
    return {
      providerConfigId: true,
      configVersion: true,
      channel: true,
      appId: true,
      mchId: true,
      notifyUrl: true,
      returnUrl: true,
      configSnapshot: true,
      status: true,
      isActive: true,
    } as const
  }

  private get paymentProviderCredentialNotifyMaterialSelect() {
    return {
      metadata: this.paymentProviderCredential.metadata,
    } as const
  }

  // 获取支付对账记录表定义。
  private get paymentReconciliationRecord() {
    return this.drizzle.schema.paymentReconciliationRecord
  }

  // 分页查询支付订单。
  async getPaymentOrderPage(dto: QueryPaymentOrderDto) {
    const conditions = this.buildPaymentOrderConditions(dto)
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const pageQuery = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(
      dto.orderBy ?? JSON.stringify({ createdAt: 'desc', id: 'desc' }),
      { table: this.paymentOrder },
    )
    const [list, total] = await Promise.all([
      this.db
        .select({
          id: this.paymentOrder.id,
          createdAt: this.paymentOrder.createdAt,
          updatedAt: this.paymentOrder.updatedAt,
          orderNo: this.paymentOrder.orderNo,
          userId: this.paymentOrder.userId,
          orderType: this.paymentOrder.orderType,
          channel: this.paymentOrder.channel,
          paymentScene: this.paymentOrder.paymentScene,
          platform: this.paymentOrder.platform,
          environment: this.paymentOrder.environment,
          clientAppKey: this.paymentOrder.clientAppKey,
          subscriptionMode: this.paymentOrder.subscriptionMode,
          status: this.paymentOrder.status,
          payableAmount: this.paymentOrder.payableAmount,
          paidAmount: this.paymentOrder.paidAmount,
          targetId: this.paymentOrder.targetId,
          providerConfigId: this.paymentOrder.providerConfigId,
          providerConfigVersion: this.paymentOrder.providerConfigVersion,
          configSnapshot: this.paymentOrder.configSnapshot,
          providerTradeNo: this.paymentOrder.providerTradeNo,
          paidAt: this.paymentOrder.paidAt,
          closedAt: this.paymentOrder.closedAt,
          refundedAt: this.paymentOrder.refundedAt,
        })
        .from(this.paymentOrder)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.paymentOrder, where),
    ])
    const page = toPageResult(list, total, pageQuery)
    return {
      ...page,
      list: page.list.map((order) => this.toAdminPaymentOrderPageItem(order)),
    }
  }

  // 将支付订单行映射为后台分页视图，分页契约禁止透出原始上下文和 provider payload。
  private toAdminPaymentOrderPageItem(
    order: AdminPaymentOrderPageSource,
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
      status: order.status,
      payableAmount: order.payableAmount,
      paidAmount: order.paidAmount,
      targetId: order.targetId,
      providerConfigId: order.providerConfigId,
      providerAccountLabel: this.buildPaymentProviderAccountLabel(order),
      providerConfigVersionLabel: this.buildProviderConfigVersionLabel(
        order.providerConfigVersion,
      ),
      providerTradeNo: order.providerTradeNo ?? null,
      paidAt: order.paidAt ?? null,
      closedAt: order.closedAt ?? null,
      refundedAt: order.refundedAt ?? null,
    }
  }

  // 启用或停用支付 provider 配置。
  async updatePaymentProviderStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withErrorHandling(
      async () => {
        const [updatedConfig] = await this.db
          .update(this.paymentProviderConfig)
          .set({
            configVersion: sql`${this.paymentProviderConfig.configVersion} + 1`,
            isEnabled,
          })
          .where(eq(this.paymentProviderConfig.id, id))
          .returning(this.paymentProviderConfigVersionWriteSourceSelect)
        if (!updatedConfig) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '支付 provider 配置不存在',
          )
        }
        await this.rotatePaymentProviderConfigVersions(
          updatedConfig.id,
          updatedConfig.configVersion,
        )
        await this.writePaymentProviderConfigVersion(updatedConfig)
      },
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
    const currentConfig = await this.getPaymentProviderConfigById(id)
    const writeValues = await this.buildPaymentProviderConfigWriteValues(
      data,
      currentConfig,
    )
    const baseValues = this.toPaymentProviderConfigBaseWriteValues(data)
    await this.drizzle.withErrorHandling(
      async () => {
        const [updatedConfig] = await this.db
          .update(this.paymentProviderConfig)
          .set({
            ...baseValues,
            ...writeValues,
            configVersion: sql`${this.paymentProviderConfig.configVersion} + 1`,
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
          .where(eq(this.paymentProviderConfig.id, id))
          .returning(this.paymentProviderConfigVersionWriteSourceSelect)
        if (!updatedConfig) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '支付 provider 配置不存在',
          )
        }
        await this.rotatePaymentProviderConfigVersions(
          updatedConfig.id,
          updatedConfig.configVersion,
        )
        await this.writePaymentProviderConfigVersion(updatedConfig)
      },
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

  private toPaymentProviderConfigBaseWriteValues(
    dto: PaymentProviderConfigWriteDto,
  ): PaymentProviderConfigWriteValues {
    const {
      credentialOptionId: _credentialOptionId,
      privateKeyCredentialId: _privateKeyCredentialId,
      publicKeyCredentialId: _publicKeyCredentialId,
      apiV3KeyCredentialId: _apiV3KeyCredentialId,
      appCertificateId: _appCertificateId,
      platformCertificateId: _platformCertificateId,
      rootCertificateId: _rootCertificateId,
      ...baseValues
    } = dto
    return baseValues
  }

  private async buildPaymentProviderConfigWriteValues(
    dto: PaymentProviderConfigWriteDto,
    currentConfig?: PaymentProviderConfigWriteSnapshot,
  ): Promise<PaymentProviderConfigWriteValues> {
    const channel = dto.channel ?? currentConfig?.channel
    if (channel === undefined) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '选择支付凭据前必须选择支付渠道',
      )
    }
    if (
      currentConfig &&
      dto.channel !== undefined &&
      dto.channel !== currentConfig.channel
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付渠道不可直接切换，请新建支付 provider 配置',
      )
    }

    const metadataPatch: Record<string, unknown> = {}
    const writeValues: Partial<PaymentProviderConfigInsert> = {}

    if (dto.credentialOptionId === undefined && !currentConfig) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '请选择主凭据',
      )
    }

    if (dto.credentialOptionId !== undefined) {
      const credential = await this.resolvePaymentCredentialSelection(
        dto.credentialOptionId,
        channel,
        undefined,
        '主凭据',
      )
      writeValues.credentialVersionRef = credential.credentialRef
      this.writeCredentialMetadata(
        metadataPatch,
        'credentialOptionId',
        credential,
      )
    }

    await this.resolveOptionalCredentialWriteValue({
      channel,
      dtoValue: dto.privateKeyCredentialId,
      expectedType: PAYMENT_CREDENTIAL_TYPE.APP_PRIVATE_KEY,
      label: '应用私钥凭据',
      metadataField: 'privateKeyCredentialId',
      metadataPatch,
      targetField: 'privateKeyRef',
      writeValues,
    })
    await this.resolveOptionalCredentialWriteValue({
      channel,
      dtoValue: dto.publicKeyCredentialId,
      expectedType: PAYMENT_CREDENTIAL_TYPE.ALIPAY_PUBLIC_KEY,
      label: '支付宝公钥凭据',
      metadataField: 'publicKeyCredentialId',
      metadataPatch,
      targetField: 'publicKeyRef',
      writeValues,
    })
    await this.resolveOptionalCredentialWriteValue({
      channel,
      dtoValue: dto.apiV3KeyCredentialId,
      expectedType: PAYMENT_CREDENTIAL_TYPE.WECHAT_API_V3_KEY,
      label: '微信 APIv3 key 凭据',
      metadataField: 'apiV3KeyCredentialId',
      metadataPatch,
      targetField: 'apiV3KeyRef',
      writeValues,
    })
    await this.resolveOptionalCertificateWriteValue({
      channel,
      dtoValue: dto.appCertificateId,
      expectedType: PAYMENT_CERTIFICATE_TYPE.APP_CERTIFICATE,
      label: '应用证书',
      metadataField: 'appCertificateId',
      metadataPatch,
      targetField: 'appCertRef',
      writeValues,
    })
    await this.resolveOptionalCertificateWriteValue({
      channel,
      dtoValue: dto.platformCertificateId,
      expectedType: PAYMENT_CERTIFICATE_TYPE.PLATFORM_CERTIFICATE,
      label: '平台证书',
      metadataField: 'platformCertificateId',
      metadataPatch,
      targetField: 'platformCertRef',
      writeValues,
    })
    await this.resolveOptionalCertificateWriteValue({
      channel,
      dtoValue: dto.rootCertificateId,
      expectedType: PAYMENT_CERTIFICATE_TYPE.ROOT_CERTIFICATE,
      label: '根证书',
      metadataField: 'rootCertificateId',
      metadataPatch,
      targetField: 'rootCertRef',
      writeValues,
    })

    if (Object.keys(metadataPatch).length > 0 || !currentConfig) {
      writeValues.configMetadata = this.mergePaymentConfigMetadata(
        currentConfig?.configMetadata,
        metadataPatch,
      )
    }

    return writeValues
  }

  private async rotatePaymentProviderConfigVersions(
    providerConfigId: number,
    currentVersion: number,
  ) {
    await this.db
      .update(this.paymentProviderConfigVersion)
      .set({
        isActive: false,
        status: 3,
      })
      .where(
        eq(
          this.paymentProviderConfigVersion.providerConfigId,
          providerConfigId,
        ),
      )
    await this.db
      .update(this.paymentProviderConfigVersion)
      .set({
        isActive: true,
        status: 1,
      })
      .where(
        and(
          eq(
            this.paymentProviderConfigVersion.providerConfigId,
            providerConfigId,
          ),
          eq(this.paymentProviderConfigVersion.configVersion, currentVersion),
        ),
      )
  }

  private async writePaymentProviderConfigVersion(
    config: PaymentProviderConfigVersionWriteSource,
  ) {
    const selection = this.readPaymentProviderSelectionSnapshot(config)
    const values = this.buildPaymentProviderConfigVersionValues(
      config,
      selection,
    )
    const existing: PaymentProviderConfigVersionIdSnapshot | undefined =
      await this.db.query.paymentProviderConfigVersion.findFirst({
        where: {
          configVersion: config.configVersion,
          providerConfigId: config.id,
        },
        columns: { id: true },
      })
    if (existing) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付 provider 配置版本已存在，禁止覆盖不可变版本',
      )
    }
    await this.db.insert(this.paymentProviderConfigVersion).values(values)
  }

  private buildPaymentProviderConfigVersionValues(
    config: PaymentProviderConfigVersionWriteSource,
    selection: ReturnType<
      PaymentService['readPaymentProviderSelectionSnapshot']
    >,
  ) {
    return {
      alipayPublicCredentialId: selection.alipayPublicCredentialId,
      allowedReturnDomains: config.allowedReturnDomains,
      appCertificateId: selection.appCertificateId,
      appId: config.appId,
      appPrivateCredentialId: selection.appPrivateCredentialId,
      certMode: config.certMode,
      channel: config.channel,
      clientAppKey: config.clientAppKey,
      configName: config.configName,
      configSnapshot: this.buildPaymentProviderConfigSnapshot(config),
      configVersion: config.configVersion,
      credentialSnapshot: {
        alipayPublicCredentialId: selection.alipayPublicCredentialId,
        apiV3KeyRef: config.apiV3KeyRef,
        appCertRef: config.appCertRef,
        appCertificateId: selection.appCertificateId,
        appPrivateCredentialId: selection.appPrivateCredentialId,
        credentialVersionRef: config.credentialVersionRef,
        platformCertRef: config.platformCertRef,
        platformCertificateId: selection.platformCertificateId,
        privateKeyRef: config.privateKeyRef,
        publicKeyRef: config.publicKeyRef,
        rootCertRef: config.rootCertRef,
        rootCertificateId: selection.rootCertificateId,
        wechatApiV3CredentialId: selection.wechatApiV3CredentialId,
      },
      environment: config.environment,
      isActive: config.isEnabled,
      mchId: config.mchId,
      notifyUrl: config.notifyUrl,
      paymentScene: config.paymentScene,
      platform: config.platform,
      platformCertificateId: selection.platformCertificateId,
      providerConfigId: config.id,
      returnUrl: config.returnUrl,
      rootCertificateId: selection.rootCertificateId,
      status: config.isEnabled ? 1 : 2,
      updatedAt: new Date(),
      wechatApiV3CredentialId: selection.wechatApiV3CredentialId,
    }
  }

  private buildPaymentProviderConfigSnapshot(
    config: PaymentProviderConfigVersionWriteSource,
  ) {
    return {
      allowedReturnDomains: config.allowedReturnDomains,
      apiV3KeyRef: config.apiV3KeyRef,
      appCertRef: config.appCertRef,
      appId: config.appId,
      certMode: config.certMode,
      channel: config.channel,
      clientAppKey: config.clientAppKey,
      configMetadata: config.configMetadata,
      configName: config.configName,
      configVersion: config.configVersion,
      credentialVersionRef: config.credentialVersionRef,
      environment: config.environment,
      mchId: config.mchId,
      notifyUrl: config.notifyUrl,
      paymentScene: config.paymentScene,
      platform: config.platform,
      platformCertRef: config.platformCertRef,
      privateKeyRef: config.privateKeyRef,
      publicKeyRef: config.publicKeyRef,
      returnUrl: config.returnUrl,
      rootCertRef: config.rootCertRef,
    }
  }

  private readPaymentProviderSelectionSnapshot(
    config: Pick<PaymentProviderConfigVersionWriteSource, 'configMetadata'>,
  ) {
    const metadata = this.asRecord(config.configMetadata)
    const credentialOptions = this.asRecord(metadata?.credentialOptions)
    const certificateOptions = this.asRecord(metadata?.certificateOptions)
    const appCertificateId = this.readSelectionId(
      certificateOptions,
      'appCertificateId',
    )
    const platformCertificateId = this.readSelectionId(
      certificateOptions,
      'platformCertificateId',
    )
    const rootCertificateId = this.readSelectionId(
      certificateOptions,
      'rootCertificateId',
    )
    return {
      alipayPublicCredentialId: this.readSelectionId(
        credentialOptions,
        'publicKeyCredentialId',
      ),
      appCertificateId,
      appPrivateCredentialId:
        this.readSelectionId(credentialOptions, 'privateKeyCredentialId') ??
        this.readSelectionId(credentialOptions, 'credentialOptionId'),
      platformCertificateId,
      rootCertificateId,
      wechatApiV3CredentialId: this.readSelectionId(
        credentialOptions,
        'apiV3KeyCredentialId',
      ),
    }
  }

  private readSelectionId(
    options: Record<string, unknown> | null,
    field: string,
  ) {
    const value = this.asRecord(options?.[field])?.id
    return typeof value === 'number' ? value : null
  }

  private async resolveOptionalCredentialWriteValue(input: {
    channel: number
    dtoValue: number | null | undefined
    expectedType: number
    label: string
    metadataField: string
    metadataPatch: Record<string, unknown>
    targetField: 'apiV3KeyRef' | 'privateKeyRef' | 'publicKeyRef'
    writeValues: Partial<PaymentProviderConfigInsert>
  }) {
    if (input.dtoValue === undefined) {
      return
    }
    if (input.dtoValue === null) {
      input.writeValues[input.targetField] = null
      this.writeNullSelectionMetadata(
        input.metadataPatch,
        'credentialOptions',
        input.metadataField,
      )
      return
    }
    const credential = await this.resolvePaymentCredentialSelection(
      input.dtoValue,
      input.channel,
      input.expectedType,
      input.label,
    )
    input.writeValues[input.targetField] = credential.credentialRef
    this.writeCredentialMetadata(
      input.metadataPatch,
      input.metadataField,
      credential,
    )
  }

  private async resolveOptionalCertificateWriteValue(input: {
    channel: number
    dtoValue: number | null | undefined
    expectedType: number
    label: string
    metadataField: string
    metadataPatch: Record<string, unknown>
    targetField: 'appCertRef' | 'platformCertRef' | 'rootCertRef'
    writeValues: Partial<PaymentProviderConfigInsert>
  }) {
    if (input.dtoValue === undefined) {
      return
    }
    if (input.dtoValue === null) {
      input.writeValues[input.targetField] = null
      this.writeNullSelectionMetadata(
        input.metadataPatch,
        'certificateOptions',
        input.metadataField,
      )
      if (input.metadataField === 'platformCertificateId') {
        input.metadataPatch.wechatPlatformSerialNo = null
      }
      return
    }
    const certificate = await this.resolvePaymentCertificateSelection(
      input.dtoValue,
      input.channel,
      input.expectedType,
      input.label,
    )
    input.writeValues[input.targetField] = certificate.certificateRef
    this.writeCertificateMetadata(
      input.metadataPatch,
      input.metadataField,
      certificate,
    )
    if (input.metadataField === 'platformCertificateId') {
      input.metadataPatch.wechatPlatformSerialNo = certificate.serialNo || null
    }
  }

  private async resolvePaymentCredentialSelection(
    id: number | null,
    channel: number,
    expectedType: number | undefined,
    label: string,
  ) {
    if (id === null) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `${label}不能为空`,
      )
    }
    const credential = await this.db.query.paymentProviderCredential.findFirst({
      where: { id },
      columns: this.paymentProviderCredentialSelectionColumns,
    })
    if (!credential) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        `${label}不存在`,
      )
    }
    if (credential.channel !== channel) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `${label}与支付渠道不匹配`,
      )
    }
    if (
      expectedType !== undefined &&
      credential.credentialType !== expectedType
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `${label}用途不匹配`,
      )
    }
    if (credential.status !== 1) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `${label}不可用`,
      )
    }
    return credential
  }

  private async resolvePaymentCertificateSelection(
    id: number,
    channel: number,
    expectedType: number,
    label: string,
  ) {
    const certificate =
      await this.db.query.paymentProviderCertificate.findFirst({
        where: { id },
        columns: this.paymentProviderCertificateSelectionColumns,
      })
    if (!certificate) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        `${label}不存在`,
      )
    }
    if (certificate.channel !== channel) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `${label}与支付渠道不匹配`,
      )
    }
    if (certificate.certificateType !== expectedType) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `${label}用途不匹配`,
      )
    }
    if (certificate.status !== 1) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `${label}不可用`,
      )
    }
    return certificate
  }

  private writeCredentialMetadata(
    metadataPatch: Record<string, unknown>,
    field: string,
    credential: PaymentProviderCredentialSelectionSource,
  ) {
    const credentialOptions = this.ensureMetadataRecord(
      metadataPatch,
      'credentialOptions',
    )
    credentialOptions[field] = {
      id: credential.id,
      label: this.buildOptionLabel(
        credential.displayName,
        credential.versionLabel,
        credential.maskedIdentifier,
        `凭据 ${credential.id}`,
      ),
      maskedIdentifier: credential.maskedIdentifier,
      fingerprint: credential.fingerprint,
      versionLabel: credential.versionLabel,
      status: credential.status,
    }
  }

  private writeCertificateMetadata(
    metadataPatch: Record<string, unknown>,
    field: string,
    certificate: PaymentProviderCertificateSelectionSource,
  ) {
    const certificateOptions = this.ensureMetadataRecord(
      metadataPatch,
      'certificateOptions',
    )
    certificateOptions[field] = {
      id: certificate.id,
      label: this.buildOptionLabel(
        certificate.displayName,
        certificate.versionLabel,
        this.maskIdentifier(certificate.serialNo),
        `证书 ${certificate.id}`,
      ),
      maskedSerialNo: this.maskIdentifier(certificate.serialNo),
      fingerprint: certificate.fingerprint,
      versionLabel: certificate.versionLabel,
      status: certificate.status,
    }
  }

  private writeNullSelectionMetadata(
    metadataPatch: Record<string, unknown>,
    group: 'certificateOptions' | 'credentialOptions',
    field: string,
  ) {
    const options = this.ensureMetadataRecord(metadataPatch, group)
    options[field] = null
  }

  private ensureMetadataRecord(
    metadata: Record<string, unknown>,
    field: string,
  ) {
    const current = metadata[field]
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return current as Record<string, unknown>
    }
    const next: Record<string, unknown> = {}
    metadata[field] = next
    return next
  }

  private mergePaymentConfigMetadata(
    currentMetadata: unknown,
    metadataPatch: Record<string, unknown>,
  ) {
    const current = this.asRecord(currentMetadata) ?? {}
    return {
      ...current,
      ...metadataPatch,
      credentialOptions: {
        ...(this.asRecord(current.credentialOptions) ?? {}),
        ...(this.asRecord(metadataPatch.credentialOptions) ?? {}),
      },
      certificateOptions: {
        ...(this.asRecord(current.certificateOptions) ?? {}),
        ...(this.asRecord(metadataPatch.certificateOptions) ?? {}),
      },
    }
  }

  // 创建支付 provider 配置。
  async createPaymentProviderConfig(dto: CreatePaymentProviderConfigDto) {
    const writeValues = await this.buildPaymentProviderConfigWriteValues(dto)
    if (!writeValues.credentialVersionRef) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '请选择主凭据',
      )
    }
    const insertValues: PaymentProviderConfigInsert = {
      ...writeValues,
      channel: dto.channel,
      paymentScene: dto.paymentScene,
      platform: dto.platform,
      environment: dto.environment,
      clientAppKey: this.normalizeKey(dto.clientAppKey),
      configName: this.normalizeKey(dto.configName),
      appId: this.normalizeKey(dto.appId),
      mchId: this.normalizeKey(dto.mchId),
      notifyUrl: dto.notifyUrl ?? null,
      returnUrl: dto.returnUrl ?? null,
      allowedReturnDomains: dto.allowedReturnDomains ?? [],
      certMode: dto.certMode ?? 1,
      configVersion: 1,
      credentialVersionRef: writeValues.credentialVersionRef,
      sortOrder: dto.sortOrder ?? 0,
      isEnabled: dto.isEnabled ?? true,
    }
    await this.drizzle.withErrorHandling(
      async () => {
        const [createdConfig] = await this.db
          .insert(this.paymentProviderConfig)
          .values(insertValues)
          .returning(this.paymentProviderConfigVersionWriteSourceSelect)
        if (!createdConfig) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '支付 provider 配置创建失败',
          )
        }
        await this.writePaymentProviderConfigVersion(createdConfig)
      },
      { duplicate: '支付 provider 启用配置已存在' },
    )
    return true
  }

  // 查询支付 provider 账号选项；选项只暴露展示名、掩码账号和配置 ID。
  async getPaymentProviderAccountOptions(
    dto: PaymentProviderAccountOptionQueryDto,
  ) {
    const conditions = this.buildPaymentProviderConfigConditions(dto)
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const list = await this.db
      .select({
        id: this.paymentProviderConfig.id,
        configName: this.paymentProviderConfig.configName,
        appId: this.paymentProviderConfig.appId,
        mchId: this.paymentProviderConfig.mchId,
        channel: this.paymentProviderConfig.channel,
        paymentScene: this.paymentProviderConfig.paymentScene,
        platform: this.paymentProviderConfig.platform,
        environment: this.paymentProviderConfig.environment,
        clientAppKey: this.paymentProviderConfig.clientAppKey,
        configVersion: this.paymentProviderConfig.configVersion,
        isEnabled: this.paymentProviderConfig.isEnabled,
      })
      .from(this.paymentProviderConfig)
      .where(where)
      .orderBy(
        asc(this.paymentProviderConfig.sortOrder),
        asc(this.paymentProviderConfig.id),
      )
      .limit(500)

    return list.map((row) => this.toPaymentProviderAccountOption(row))
  }

  // 查询支付凭据选项；禁止返回 credentialRef，只返回 ID、掩码标识和指纹。
  async getPaymentCredentialOptions(
    dto: PaymentProviderCredentialOptionQueryDto,
  ) {
    const conditions = this.buildPaymentCredentialOptionConditions(dto)
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const list = await this.db
      .select({
        id: this.paymentProviderCredential.id,
        displayName: this.paymentProviderCredential.displayName,
        versionLabel: this.paymentProviderCredential.versionLabel,
        maskedIdentifier: this.paymentProviderCredential.maskedIdentifier,
        channel: this.paymentProviderCredential.channel,
        credentialType: this.paymentProviderCredential.credentialType,
        fingerprint: this.paymentProviderCredential.fingerprint,
        status: this.paymentProviderCredential.status,
        expiredAt: this.paymentProviderCredential.expiredAt,
      })
      .from(this.paymentProviderCredential)
      .where(where)
      .orderBy(
        asc(this.paymentProviderCredential.channel),
        asc(this.paymentProviderCredential.credentialType),
        asc(this.paymentProviderCredential.id),
      )
      .limit(500)

    return list.map((row) => this.toPaymentCredentialOption(row))
  }

  // 查询支付证书选项；禁止返回 certificateRef，只返回 ID、序列号掩码和指纹。
  async getPaymentCertificateOptions(
    dto: PaymentProviderCertificateOptionQueryDto,
  ) {
    const conditions = this.buildPaymentCertificateOptionConditions(dto)
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const list = await this.db
      .select({
        id: this.paymentProviderCertificate.id,
        displayName: this.paymentProviderCertificate.displayName,
        versionLabel: this.paymentProviderCertificate.versionLabel,
        serialNo: this.paymentProviderCertificate.serialNo,
        channel: this.paymentProviderCertificate.channel,
        certificateType: this.paymentProviderCertificate.certificateType,
        fingerprint: this.paymentProviderCertificate.fingerprint,
        status: this.paymentProviderCertificate.status,
        expiredAt: this.paymentProviderCertificate.expiredAt,
      })
      .from(this.paymentProviderCertificate)
      .where(where)
      .orderBy(
        asc(this.paymentProviderCertificate.channel),
        asc(this.paymentProviderCertificate.certificateType),
        asc(this.paymentProviderCertificate.id),
      )
      .limit(500)

    return list.map((row) => this.toPaymentCertificateOption(row))
  }

  // 分页查询支付 provider 配置。
  async getPaymentProviderConfigPage(dto: QueryPaymentProviderConfigDto) {
    const conditions = this.buildPaymentProviderConfigConditions(dto)
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(
      dto.orderBy ?? JSON.stringify({ sortOrder: 'asc', id: 'asc' }),
      { table: this.paymentProviderConfig },
    )
    const [list, total] = await Promise.all([
      this.db
        .select({
          id: this.paymentProviderConfig.id,
          createdAt: this.paymentProviderConfig.createdAt,
          updatedAt: this.paymentProviderConfig.updatedAt,
          channel: this.paymentProviderConfig.channel,
          paymentScene: this.paymentProviderConfig.paymentScene,
          platform: this.paymentProviderConfig.platform,
          environment: this.paymentProviderConfig.environment,
          clientAppKey: this.paymentProviderConfig.clientAppKey,
          configName: this.paymentProviderConfig.configName,
          appId: this.paymentProviderConfig.appId,
          mchId: this.paymentProviderConfig.mchId,
          notifyUrl: this.paymentProviderConfig.notifyUrl,
          returnUrl: this.paymentProviderConfig.returnUrl,
          allowedReturnDomains: this.paymentProviderConfig.allowedReturnDomains,
          certMode: this.paymentProviderConfig.certMode,
          configMetadata: this.paymentProviderConfig.configMetadata,
          sortOrder: this.paymentProviderConfig.sortOrder,
          isEnabled: this.paymentProviderConfig.isEnabled,
        })
        .from(this.paymentProviderConfig)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.paymentProviderConfig, where),
    ])

    return toPageResult(
      list.map((row) => this.toAdminPaymentProviderConfigPageItem(row)),
      total,
      page,
    )
  }

  // 分页查询支付对账记录。
  async getPaymentReconciliationPage(dto: QueryPaymentReconciliationDto) {
    const conditions = this.buildPaymentReconciliationConditions(dto)
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(
      dto.orderBy ?? JSON.stringify({ createdAt: 'desc', id: 'desc' }),
      { table: this.paymentReconciliationRecord },
    )
    const [list, total] = await Promise.all([
      this.db
        .select({
          id: this.paymentReconciliationRecord.id,
          createdAt: this.paymentReconciliationRecord.createdAt,
          updatedAt: this.paymentReconciliationRecord.updatedAt,
          paymentOrderId: this.paymentReconciliationRecord.paymentOrderId,
          orderNo: this.paymentReconciliationRecord.orderNo,
          channel: this.paymentReconciliationRecord.channel,
          mismatchType: this.paymentReconciliationRecord.mismatchType,
          status: this.paymentReconciliationRecord.status,
          localStatus: this.paymentReconciliationRecord.localStatus,
          providerStatus: this.paymentReconciliationRecord.providerStatus,
          providerTradeNo: this.paymentReconciliationRecord.providerTradeNo,
          localAmount: this.paymentReconciliationRecord.localAmount,
          providerAmount: this.paymentReconciliationRecord.providerAmount,
          currency: this.paymentReconciliationRecord.currency,
          evidence: this.paymentReconciliationRecord.evidence,
          handledRemark: this.paymentReconciliationRecord.handledRemark,
        })
        .from(this.paymentReconciliationRecord)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.paymentReconciliationRecord, where),
    ])

    return toPageResult(
      list.map((record) => this.toPaymentReconciliationPageItem(record)),
      total,
      page,
    )
  }

  // 受审计异常修复入口：必须带原因和证据，并复用内部幂等结算核心。
  async repairPaidOrder(dto: RepairPaidPaymentOrderDto, adminUserId: number) {
    const reason = dto.reason.trim()
    if (!reason) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '异常修复必须填写原因',
      )
    }
    const evidence = this.sanitizeRepairEvidence(dto.evidence)
    const reconciliationRecord =
      await this.resolveRepairReconciliationRecord(dto)
    const result = await this.confirmPaymentOrderManually({
      orderNo: reconciliationRecord.orderNo,
      paidAmount: reconciliationRecord.providerAmount ?? 0,
      providerTradeNo: reconciliationRecord.providerTradeNo ?? '',
      notifyPayload: {
        source: 'admin_repair_paid',
        adminUserId,
        reason,
        evidence,
        reconciliationRecordId: reconciliationRecord.id,
        providerStatus: reconciliationRecord.providerStatus,
      },
    })

    await this.db
      .update(this.paymentReconciliationRecord)
      .set({
        status: 3,
        handledRemark: reason,
      })
      .where(eq(this.paymentReconciliationRecord.id, reconciliationRecord.id))

    this.logger.log(
      `payment_order_repair_paid orderNo=${reconciliationRecord.orderNo} adminUserId=${adminUserId} reconciliationRecordId=${reconciliationRecord.id}`,
    )
    return result
  }

  private async resolveRepairReconciliationRecord(
    dto: RepairPaidPaymentOrderDto,
  ) {
    const record: PaymentRepairReconciliationSnapshot | null =
      (await this.db.query.paymentReconciliationRecord.findFirst({
        where: { id: dto.reconciliationRecordId },
        columns: {
          id: true,
          orderNo: true,
          mismatchType: true,
          status: true,
          localStatus: true,
          providerStatus: true,
          providerTradeNo: true,
          providerAmount: true,
        },
      })) ?? null
    if (
      !record ||
      record.orderNo !== dto.orderNo ||
      record.mismatchType !== 2 ||
      record.status !== 1 ||
      record.localStatus !== PaymentOrderStatusEnum.PENDING ||
      record.providerAmount !== dto.paidAmount ||
      record.providerTradeNo !== dto.providerTradeNo ||
      !record.providerTradeNo ||
      !this.isProviderPaidStatus(record.providerStatus)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '异常修复必须绑定匹配的 provider 已支付对账记录',
      )
    }
    return record
  }

  // 构建支付 provider 配置分页查询条件。
  private buildPaymentProviderConfigConditions(
    dto: PaymentProviderConfigFilter,
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

  // 构建支付订单分页查询条件。
  private buildPaymentOrderConditions(dto: QueryPaymentOrderDto) {
    const conditions: SQL[] = []
    if (dto.orderNo !== undefined) {
      conditions.push(eq(this.paymentOrder.orderNo, dto.orderNo))
    }
    if (dto.userId !== undefined) {
      conditions.push(eq(this.paymentOrder.userId, dto.userId))
    }
    if (dto.orderType !== undefined) {
      conditions.push(eq(this.paymentOrder.orderType, dto.orderType))
    }
    if (dto.status !== undefined) {
      conditions.push(eq(this.paymentOrder.status, dto.status))
    }
    if (dto.providerTradeNo !== undefined) {
      conditions.push(
        eq(this.paymentOrder.providerTradeNo, dto.providerTradeNo),
      )
    }
    if (dto.channel !== undefined) {
      conditions.push(eq(this.paymentOrder.channel, dto.channel))
    }
    if (dto.paymentScene !== undefined) {
      conditions.push(eq(this.paymentOrder.paymentScene, dto.paymentScene))
    }
    if (dto.platform !== undefined) {
      conditions.push(eq(this.paymentOrder.platform, dto.platform))
    }
    if (dto.environment !== undefined) {
      conditions.push(eq(this.paymentOrder.environment, dto.environment))
    }
    if (dto.clientAppKey !== undefined) {
      conditions.push(
        eq(this.paymentOrder.clientAppKey, this.normalizeKey(dto.clientAppKey)),
      )
    }
    if (dto.providerConfigId !== undefined) {
      conditions.push(
        eq(this.paymentOrder.providerConfigId, dto.providerConfigId),
      )
    }
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      dto.startDate,
      dto.endDate,
    )
    if (dateRange?.gte) {
      conditions.push(gte(this.paymentOrder.createdAt, dateRange.gte))
    }
    if (dateRange?.lt) {
      conditions.push(lt(this.paymentOrder.createdAt, dateRange.lt))
    }
    return conditions
  }

  // 构建凭据选项查询条件。
  private buildPaymentCredentialOptionConditions(
    dto: PaymentProviderCredentialOptionQueryDto,
  ) {
    const conditions: SQL[] = []
    if (dto.channel !== undefined) {
      conditions.push(eq(this.paymentProviderCredential.channel, dto.channel))
    }
    if (dto.credentialType !== undefined) {
      conditions.push(
        eq(this.paymentProviderCredential.credentialType, dto.credentialType),
      )
    }
    if (dto.status !== undefined) {
      conditions.push(eq(this.paymentProviderCredential.status, dto.status))
    }
    return conditions
  }

  // 构建证书选项查询条件。
  private buildPaymentCertificateOptionConditions(
    dto: PaymentProviderCertificateOptionQueryDto,
  ) {
    const conditions: SQL[] = []
    if (dto.channel !== undefined) {
      conditions.push(eq(this.paymentProviderCertificate.channel, dto.channel))
    }
    if (dto.certificateType !== undefined) {
      conditions.push(
        eq(
          this.paymentProviderCertificate.certificateType,
          dto.certificateType,
        ),
      )
    }
    if (dto.status !== undefined) {
      conditions.push(eq(this.paymentProviderCertificate.status, dto.status))
    }
    return conditions
  }

  // 构建支付对账分页查询条件。
  private buildPaymentReconciliationConditions(
    dto: QueryPaymentReconciliationDto,
  ) {
    const conditions: SQL[] = []
    if (dto.orderNo !== undefined) {
      conditions.push(eq(this.paymentReconciliationRecord.orderNo, dto.orderNo))
    }
    if (dto.channel !== undefined) {
      conditions.push(eq(this.paymentReconciliationRecord.channel, dto.channel))
    }
    if (dto.mismatchType !== undefined) {
      conditions.push(
        eq(this.paymentReconciliationRecord.mismatchType, dto.mismatchType),
      )
    }
    if (dto.status !== undefined) {
      conditions.push(eq(this.paymentReconciliationRecord.status, dto.status))
    }
    if (dto.providerTradeNo !== undefined) {
      conditions.push(
        eq(
          this.paymentReconciliationRecord.providerTradeNo,
          dto.providerTradeNo,
        ),
      )
    }
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      dto.startDate,
      dto.endDate,
    )
    if (dateRange?.gte) {
      conditions.push(
        gte(this.paymentReconciliationRecord.createdAt, dateRange.gte),
      )
    }
    if (dateRange?.lt) {
      conditions.push(
        lt(this.paymentReconciliationRecord.createdAt, dateRange.lt),
      )
    }
    return conditions
  }

  // Provider 原生通知入口：公开路由只传入原始请求，状态推进必须经过 service 验签和金额校验。
  async handleProviderPaymentNotify(input: ProviderPaymentNotifyRequest) {
    const adapter = this.getPaymentAdapter(input.channel)
    const payloadHash = this.buildProviderNotifyPayloadHash(input)
    let order: PaymentNotifyOrderSnapshot | null = null
    let orderNo: string | undefined
    let providerTradeNo: string | undefined
    let verified = false

    await this.createPaymentNotifyEvent(input, payloadHash)

    try {
      orderNo = await this.resolveProviderNotifyOrderNo(input, adapter)
      if (!orderNo) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '支付通知缺少站内订单号',
        )
      }

      order =
        (await this.db.query.paymentOrder.findFirst({
          where: { orderNo },
          columns: this.paymentNotifyOrderColumns,
        })) ?? null
      if (!order || order.channel !== input.channel) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '支付订单不存在',
        )
      }
      const paymentOrder = order
      await this.markPaymentNotifyEventOrder(
        input.channel,
        payloadHash,
        paymentOrder,
      )

      const configVersion =
        await this.getPaymentProviderConfigVersionForOrder(paymentOrder)
      const config =
        this.buildPaymentProviderConfigForOrderVersion(configVersion)
      const credentialMaterial =
        await this.resolvePaymentProviderCredentialMaterial(
          paymentOrder,
          config,
        )
      const notifyInput = {
        order: paymentOrder,
        config,
        credentialMaterial,
        payload: this.buildProviderNotifyPayload(input),
      }
      if (!adapter.verifyNotify(notifyInput)) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '支付通知验签失败',
        )
      }
      verified = true

      const parsed = adapter.parseNotify(notifyInput)
      providerTradeNo = parsed.providerTradeNo
      const paidAmount = parsed.paidAmount
      if (!providerTradeNo || paidAmount === undefined) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '支付通知缺少已验签交易字段',
        )
      }
      const verifiedProviderTradeNo = providerTradeNo
      if (paidAmount !== paymentOrder.payableAmount) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '支付通知金额与订单不一致',
        )
      }

      if (paymentOrder.status === PaymentOrderStatusEnum.PAID) {
        this.assertPaidOrderMatchesNotify(
          paymentOrder,
          paidAmount,
          verifiedProviderTradeNo,
        )
        await this.markPaymentNotifyEventProcessed(input.channel, payloadHash, {
          eventType: 1,
          order: paymentOrder,
          processStatus: PAYMENT_NOTIFY_PROCESS_STATUS.DUPLICATE,
          providerTradeNo: verifiedProviderTradeNo,
        })
        return this.buildProviderNotifyAck(input.channel)
      }

      if (paymentOrder.status !== PaymentOrderStatusEnum.PENDING) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '当前订单状态不允许支付通知确认',
        )
      }

      await this.executePaidOrderMutationWithMembershipRetry(
        paymentOrder,
        async (tx, membershipActivation) => {
          const [paidOrder] = await tx
            .update(this.paymentOrder)
            .set({
              status: PaymentOrderStatusEnum.PAID,
              paidAmount,
              providerTradeNo,
              notifyPayload: this.redactProviderNotifyPayload(input.body.raw),
              paidAt: new Date(),
            })
            .where(
              and(
                eq(this.paymentOrder.id, paymentOrder.id),
                eq(this.paymentOrder.status, PaymentOrderStatusEnum.PENDING),
              ),
            )
            .returning()

          if (!paidOrder) {
            const latestOrder: PaymentOrderPaidStateSnapshot | undefined =
              await tx.query.paymentOrder.findFirst({
                where: { id: paymentOrder.id },
                columns: this.paymentOrderPaidStateColumns,
              })
            if (latestOrder?.status === PaymentOrderStatusEnum.PAID) {
              this.assertPaidOrderMatchesNotify(
                latestOrder,
                paidAmount,
                verifiedProviderTradeNo,
              )
              await this.markPaymentNotifyEventProcessed(
                input.channel,
                payloadHash,
                {
                  eventType: 1,
                  order: latestOrder,
                  processStatus: PAYMENT_NOTIFY_PROCESS_STATUS.DUPLICATE,
                  providerTradeNo: verifiedProviderTradeNo,
                },
              )
              return
            }
            throw new BusinessException(
              BusinessErrorCode.STATE_CONFLICT,
              '当前订单状态不允许支付通知确认',
            )
          }

          await this.applyPaidOrderSettlementAfterLocks(
            tx,
            paidOrder,
            membershipActivation,
          )
          await this.markPaymentNotifyEventProcessed(
            input.channel,
            payloadHash,
            {
              eventType: 1,
              order: paidOrder,
              processStatus: PAYMENT_NOTIFY_PROCESS_STATUS.PROCESSED,
              providerTradeNo: verifiedProviderTradeNo,
            },
          )

          this.logger.log(
            `payment_order_paid orderNo=${paidOrder.orderNo} userId=${paidOrder.userId} orderType=${paidOrder.orderType} providerTradeNo=${paidOrder.providerTradeNo}`,
          )
        },
      )

      return this.buildProviderNotifyAck(input.channel)
    } catch (error) {
      await this.markPaymentNotifyEventFailed(input.channel, payloadHash, {
        error,
        order,
        orderNo,
        providerTradeNo,
        verified,
      })
      throw error
    }
  }

  private buildProviderNotifyPayload(input: ProviderPaymentNotifyRequest) {
    return {
      body: input.body.raw,
      headers: input.headers.raw,
      query: input.query.raw,
      rawBody: input.rawBody,
    }
  }

  private buildProviderNotifyPayloadHash(input: ProviderPaymentNotifyRequest) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          body: input.body.raw,
          channel: input.channel,
          headers: input.headers.raw,
          query: input.query.raw,
          rawBody: input.rawBody ?? null,
        }),
      )
      .digest('hex')
  }

  private async createPaymentNotifyEvent(
    input: ProviderPaymentNotifyRequest,
    payloadHash: string,
  ) {
    await this.db
      .insert(this.paymentNotifyEvent)
      .values({
        channel: input.channel,
        eventType: 4,
        payloadHash,
        headers: this.redactProviderNotifyPayload(input.headers.raw),
        redactedPayload: this.redactProviderNotifyPayload({
          ...input.body.raw,
          query: input.query.raw,
          rawBody: input.rawBody ? '[RAW_BODY_PRESENT]' : null,
        }),
        verifyStatus: PAYMENT_NOTIFY_VERIFY_STATUS.PENDING,
        processStatus: PAYMENT_NOTIFY_PROCESS_STATUS.PENDING,
      })
      .onConflictDoNothing()
  }

  private async markPaymentNotifyEventOrder(
    channel: PaymentChannelEnum,
    payloadHash: string,
    order: PaymentNotifyEventOrderSnapshot,
  ) {
    await this.db
      .update(this.paymentNotifyEvent)
      .set({
        orderNo: order.orderNo,
        paymentOrderId: order.id,
      })
      .where(
        and(
          eq(this.paymentNotifyEvent.channel, channel),
          eq(this.paymentNotifyEvent.payloadHash, payloadHash),
        ),
      )
  }

  private async markPaymentNotifyEventProcessed(
    channel: PaymentChannelEnum,
    payloadHash: string,
    input: {
      eventType: number
      order: PaymentNotifyEventOrderSnapshot
      processStatus: number
      providerTradeNo: string
    },
  ) {
    await this.db
      .update(this.paymentNotifyEvent)
      .set({
        eventType: input.eventType,
        orderNo: input.order.orderNo,
        paymentOrderId: input.order.id,
        processStatus: input.processStatus,
        processedAt: new Date(),
        providerTradeNo: input.providerTradeNo,
        verifyStatus: PAYMENT_NOTIFY_VERIFY_STATUS.SUCCESS,
      })
      .where(
        and(
          eq(this.paymentNotifyEvent.channel, channel),
          eq(this.paymentNotifyEvent.payloadHash, payloadHash),
        ),
      )
  }

  private async markPaymentNotifyEventFailed(
    channel: PaymentChannelEnum,
    payloadHash: string,
    input: {
      error: unknown
      order: PaymentNotifyEventOrderSnapshot | null
      orderNo?: string
      providerTradeNo?: string
      verified: boolean
    },
  ) {
    await this.db
      .update(this.paymentNotifyEvent)
      .set({
        errorCode:
          input.error instanceof BusinessException
            ? String(input.error.code)
            : 'UNKNOWN',
        errorMessage: this.sanitizePaymentNotifyError(input.error),
        orderNo: input.order?.orderNo ?? input.orderNo ?? null,
        paymentOrderId: input.order?.id ?? null,
        processStatus: PAYMENT_NOTIFY_PROCESS_STATUS.FAILED,
        processedAt: new Date(),
        providerTradeNo: input.providerTradeNo ?? null,
        verifyStatus: input.verified
          ? PAYMENT_NOTIFY_VERIFY_STATUS.SUCCESS
          : PAYMENT_NOTIFY_VERIFY_STATUS.FAILED,
      })
      .where(
        and(
          eq(this.paymentNotifyEvent.channel, channel),
          eq(this.paymentNotifyEvent.payloadHash, payloadHash),
        ),
      )
  }

  private sanitizePaymentNotifyError(error: unknown) {
    const message = error instanceof Error ? error.message : '支付通知处理失败'
    return message.replace(/secret|private|key|cert|signature/gi, '[REDACTED]')
  }

  private async resolveProviderNotifyOrderNo(
    input: ProviderPaymentNotifyRequest,
    adapter: PaymentProviderAdapter,
  ) {
    const payload = this.buildProviderNotifyPayload(input)
    const directOrderNo = adapter.extractNotifyOrderNo({ payload })
    if (directOrderNo) {
      return directOrderNo
    }

    if (input.channel !== PaymentChannelEnum.WECHAT) {
      return undefined
    }

    const materialCandidates =
      await this.getWechatNotifyCredentialMaterialCandidates(input.channel)
    for (const credentialMaterial of materialCandidates) {
      const orderNo = adapter.extractNotifyOrderNo({
        credentialMaterial,
        payload,
      })
      if (orderNo) {
        return orderNo
      }
    }

    return undefined
  }

  private async getWechatNotifyCredentialMaterialCandidates(
    channel: PaymentChannelEnum,
  ) {
    const credentials = await this.db
      .select(this.paymentProviderCredentialNotifyMaterialSelect)
      .from(this.paymentProviderCredential)
      .where(
        and(
          eq(this.paymentProviderCredential.channel, channel),
          eq(
            this.paymentProviderCredential.credentialType,
            PAYMENT_CREDENTIAL_TYPE.WECHAT_API_V3_KEY,
          ),
        ),
      )
      .limit(100)

    return credentials
      .map((credential) => ({
        wechatApiV3Key: this.resolvePaymentMaterialFromMetadata(
          credential.metadata,
          ['wechatApiV3Key', 'apiV3Key'],
          ['wechatApiV3KeyEnvKey', 'apiV3KeyEnvKey', 'materialEnvKey'],
        ),
      }))
      .filter(
        (
          material,
        ): material is Required<
          Pick<PaymentProviderCredentialMaterial, 'wechatApiV3Key'>
        > => typeof material.wechatApiV3Key === 'string',
      )
  }

  // App 只读支付状态，必须限定当前用户订单。
  async getAppPaymentOrderStatus(
    userId: number,
    orderNo: string,
  ): Promise<PaymentOrderStatusResult> {
    const order = await this.db.query.paymentOrder.findFirst({
      where: { orderNo },
      columns: {
        userId: true,
        orderNo: true,
        status: true,
        orderType: true,
        channel: true,
        paymentScene: true,
        payableAmount: true,
        paidAmount: true,
        paidAt: true,
        closedAt: true,
        clientPayPayload: true,
      },
    })
    if (!order || order.userId !== userId) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '支付订单不存在',
      )
    }

    return {
      orderNo: order.orderNo,
      status: order.status,
      orderType: order.orderType,
      channel: order.channel,
      scene: order.paymentScene,
      payableAmount: order.payableAmount,
      paidAmount: order.paidAmount > 0 ? order.paidAmount : null,
      currency: 'CNY',
      expireAt: null,
      paidAt: order.paidAt ?? null,
      closedAt: order.closedAt ?? null,
      clientPayPayload: this.toSafeClientPayPayload(order.clientPayPayload),
    }
  }

  // 确认 provider 已验签支付结果，app 场景必须绑定当前用户订单。
  async confirmPaymentOrder(
    dto: ConfirmPaymentOrderDto,
    context?: ConfirmPaymentOrderContext,
  ) {
    const order: PaymentOrderConfirmationSnapshot | undefined =
      await this.db.query.paymentOrder.findFirst({
        where: { orderNo: dto.orderNo },
        columns: this.paymentOrderConfirmationColumns,
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

    const configVersion =
      await this.getPaymentProviderConfigVersionForOrder(order)
    const config = this.buildPaymentProviderConfigForOrderVersion(configVersion)
    const credentialMaterial =
      await this.resolvePaymentProviderCredentialMaterial(order, config)
    const adapter = this.getPaymentAdapter(order.channel)
    const notifyInput = {
      order,
      config,
      credentialMaterial,
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
    if (!providerTradeNo || paidAmount === undefined) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付回调缺少已验签交易字段',
      )
    }
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

    return this.executePaidOrderMutationWithMembershipRetry(
      order,
      async (tx, membershipActivation) => {
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
          const latestOrder:
            PaymentOrderManualConfirmationSnapshot | undefined =
            await tx.query.paymentOrder.findFirst({
              where: { id: order.id },
              columns: this.paymentOrderManualConfirmationColumns,
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

        await this.applyPaidOrderSettlementAfterLocks(
          tx,
          paidOrder,
          membershipActivation,
        )

        this.logger.log(
          `payment_order_paid orderNo=${paidOrder.orderNo} userId=${paidOrder.userId} orderType=${paidOrder.orderType} providerConfigId=${paidOrder.providerConfigId} providerConfigVersion=${paidOrder.providerConfigVersion}`,
        )

        return this.toPaymentOrderResult(paidOrder, {})
      },
    )
  }

  // 后台手工确认只用于运营审计入口，禁止绕过金额、交易号和幂等校验。
  async confirmPaymentOrderManually(dto: ConfirmPaymentOrderDto) {
    const order: PaymentOrderManualConfirmationSnapshot | undefined =
      await this.db.query.paymentOrder.findFirst({
        where: { orderNo: dto.orderNo },
        columns: this.paymentOrderManualConfirmationColumns,
      })
    if (!order) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '支付订单不存在',
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

    return this.executePaidOrderMutationWithMembershipRetry(
      order,
      async (tx, membershipActivation) => {
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
          const latestOrder:
            PaymentOrderManualConfirmationSnapshot | undefined =
            await tx.query.paymentOrder.findFirst({
              where: { id: order.id },
              columns: this.paymentOrderManualConfirmationColumns,
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

        await this.applyPaidOrderSettlementAfterLocks(
          tx,
          paidOrder,
          membershipActivation,
        )

        this.logger.log(
          `payment_order_manually_paid orderNo=${paidOrder.orderNo} userId=${paidOrder.userId} orderType=${paidOrder.orderType} providerTradeNo=${paidOrder.providerTradeNo}`,
        )

        return this.toPaymentOrderResult(paidOrder, {})
      },
    )
  }

  // 将支付订单行映射为 App 公开支付结果，禁止透出 provider 内部字段。
  private toPaymentOrderResult(
    order: PaymentOrderPublicResultSource,
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
    order: Pick<
      PaymentOrderPaidStateSnapshot,
      'paidAmount' | 'providerTradeNo'
    >,
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

  private readStringField(
    input: Record<string, unknown>,
    field: string,
  ): string | undefined {
    const value = input[field]
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }

  private buildProviderNotifyAck(
    channel: PaymentChannelEnum,
  ): ProviderPaymentNotifyAckDto | string {
    if (channel === PaymentChannelEnum.ALIPAY) {
      return 'success'
    }
    return { code: 'SUCCESS', message: '成功' }
  }

  private redactProviderNotifyPayload(payload: Record<string, unknown>) {
    const redacted = { ...payload }
    for (const key of Object.keys(redacted)) {
      if (/secret|private|key|cert|signature/i.test(key)) {
        redacted[key] = '[REDACTED]'
      }
    }
    return redacted
  }

  private toSafeClientPayPayload(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null
    }

    const unsafeKeys = new Set([
      'privateKey',
      'apiV3Key',
      'certificate',
      'providerConfigId',
      'providerConfigVersion',
      'credentialVersionRef',
      'publicKeyRef',
      'privateKeyRef',
      'apiV3KeyRef',
    ])
    const source = payload as Record<string, unknown>
    const safePayload: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(source)) {
      if (unsafeKeys.has(key)) {
        continue
      }
      safePayload[key] = value
    }
    return safePayload
  }

  private toPaymentProviderAccountOption(
    config: PaymentProviderAccountOptionSource,
  ): PaymentProviderAccountOptionDto {
    return {
      label: this.buildPaymentProviderAccountLabel(config),
      value: config.id,
      channel: config.channel,
      paymentScene: config.paymentScene,
      platform: config.platform,
      environment: config.environment,
      clientAppKey: config.clientAppKey,
      maskedAppId: this.maskIdentifier(config.appId),
      maskedMchId: this.maskIdentifier(config.mchId),
      configVersion: config.configVersion,
      isEnabled: config.isEnabled,
    }
  }

  private toAdminPaymentProviderConfigPageItem(
    config: AdminPaymentProviderConfigPageSource,
  ): AdminPaymentProviderConfigPageItemDto {
    return {
      id: config.id,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      channel: config.channel,
      paymentScene: config.paymentScene,
      platform: config.platform,
      environment: config.environment,
      clientAppKey: config.clientAppKey,
      configName: config.configName,
      appId: config.appId,
      mchId: config.mchId,
      notifyUrl: config.notifyUrl ?? null,
      returnUrl: config.returnUrl ?? null,
      allowedReturnDomains: this.toNullableStringArray(
        config.allowedReturnDomains,
      ),
      certMode: config.certMode,
      configMetadata: this.asRecord(config.configMetadata),
      sortOrder: config.sortOrder,
      isEnabled: config.isEnabled,
    }
  }

  private toNullableStringArray(input: unknown) {
    if (!Array.isArray(input)) {
      return null
    }
    return input.filter(
      (item): item is string => typeof item === 'string' && item.trim() !== '',
    )
  }

  private toPaymentCredentialOption(
    credential: PaymentProviderCredentialOptionSource,
  ): PaymentProviderCredentialOptionDto {
    return {
      label: this.buildOptionLabel(
        credential.displayName,
        credential.versionLabel,
        credential.maskedIdentifier,
        `凭据 ${credential.id}`,
      ),
      value: credential.id,
      channel: credential.channel,
      credentialType: credential.credentialType,
      versionLabel: credential.versionLabel,
      maskedIdentifier: credential.maskedIdentifier,
      fingerprint: credential.fingerprint,
      status: credential.status,
      expiredAt: credential.expiredAt ?? null,
    }
  }

  private toPaymentCertificateOption(
    certificate: PaymentProviderCertificateOptionSource,
  ): PaymentProviderCertificateOptionDto {
    return {
      label: this.buildOptionLabel(
        certificate.displayName,
        certificate.versionLabel,
        this.maskIdentifier(certificate.serialNo),
        `证书 ${certificate.id}`,
      ),
      value: certificate.id,
      channel: certificate.channel,
      certificateType: certificate.certificateType,
      versionLabel: certificate.versionLabel,
      maskedSerialNo: this.maskIdentifier(certificate.serialNo),
      fingerprint: certificate.fingerprint,
      status: certificate.status,
      expiredAt: certificate.expiredAt ?? null,
    }
  }

  private toPaymentReconciliationPageItem(
    record: PaymentReconciliationPageSource,
  ): AdminPaymentReconciliationPageItemDto {
    return {
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      paymentOrderId: record.paymentOrderId ?? null,
      orderNo: record.orderNo,
      channel: record.channel,
      mismatchType: record.mismatchType,
      status: record.status,
      localStatus: record.localStatus,
      providerStatus: record.providerStatus,
      providerTradeNo: record.providerTradeNo ?? null,
      localAmount: record.localAmount,
      providerAmount: record.providerAmount ?? null,
      currency: record.currency,
      evidence: this.sanitizePublicRecord(record.evidence),
      handledRemark: record.handledRemark ?? null,
      repairPaidAvailable:
        record.status === 1 &&
        record.mismatchType === 2 &&
        record.localStatus === PaymentOrderStatusEnum.PENDING,
      refundExecutionAvailable: false,
    }
  }

  private buildPaymentProviderAccountLabel(
    source:
      | PaymentProviderAccountLabelOrderSource
      | PaymentProviderAccountLabelConfigSource,
  ) {
    const snapshot =
      'configSnapshot' in source
        ? this.sanitizePublicRecord(source.configSnapshot)
        : null
    const configName =
      this.readStringField(snapshot ?? {}, 'configName') ||
      ('configName' in source ? source.configName : '')
    const appId =
      this.readStringField(snapshot ?? {}, 'appId') ||
      ('appId' in source ? source.appId : '')
    const mchId =
      this.readStringField(snapshot ?? {}, 'mchId') ||
      ('mchId' in source ? source.mchId : '')
    const fallbackId =
      'providerConfigId' in source ? source.providerConfigId : source.id
    const name = configName || `支付账号 ${fallbackId}`
    const maskedAccount = this.maskIdentifier(mchId || appId)
    return maskedAccount ? `${name} / ${maskedAccount}` : name
  }

  private buildProviderConfigVersionLabel(version: number) {
    return `配置版本 v${version}`
  }

  private buildOptionLabel(
    displayName: string,
    versionLabel: string,
    maskedIdentifier: string,
    fallback: string,
  ) {
    const parts = [displayName || fallback, versionLabel, maskedIdentifier]
      .map((item) => item.trim())
      .filter(Boolean)
    return parts.join(' / ')
  }

  private maskIdentifier(value?: string | null) {
    const normalized = value?.trim()
    if (!normalized) {
      return ''
    }
    if (normalized.length <= 4) {
      return '****'
    }
    return `****${normalized.slice(-4)}`
  }

  private sanitizeRepairEvidence(evidence: Record<string, unknown>) {
    return this.redactSensitiveRecord(this.sanitizePublicRecord(evidence) ?? {})
  }

  private isProviderPaidStatus(status: string) {
    return ['success', 'trade_success', 'trade_finished', 'paid'].includes(
      status.trim().toLowerCase(),
    )
  }

  private sanitizePublicRecord(input: unknown): Record<string, unknown> | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null
    }
    return this.redactSensitiveRecord(input as Record<string, unknown>)
  }

  private redactSensitiveRecord(input: Record<string, unknown>) {
    const redacted: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      if (/secret|private|key|cert|signature|credential|token/i.test(key)) {
        redacted[key] = '[REDACTED]'
        continue
      }
      redacted[key] = value
    }
    return redacted
  }

  private async getPaymentProviderConfigVersionForOrder(
    order: Pick<
      PaymentNotifyOrderSnapshot,
      'providerConfigId' | 'providerConfigVersion' | 'providerConfigVersionId'
    >,
  ) {
    if (order.providerConfigVersionId == null) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付订单缺少 provider 配置版本',
      )
    }
    const configVersion: PaymentProviderConfigVersionOrderSnapshot | null =
      (await this.db.query.paymentProviderConfigVersion.findFirst({
        where: { id: order.providerConfigVersionId },
        columns: this.paymentProviderConfigVersionOrderColumns,
      })) ?? null
    if (
      !configVersion ||
      configVersion.providerConfigId !== order.providerConfigId ||
      configVersion.configVersion !== order.providerConfigVersion
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付订单缺少有效的 provider 配置版本',
      )
    }
    return configVersion
  }

  // 用订单下单时不可变版本行还原 provider 配置视图；验签不得被当前 admin 配置轮换影响。
  private buildPaymentProviderConfigForOrderVersion(
    version: PaymentProviderConfigVersionOrderSnapshot,
  ): PaymentProviderConfigForOrderSnapshot {
    const snapshot = this.asRecord(version.configSnapshot)
    return {
      id: version.providerConfigId,
      channel: version.channel,
      appId: version.appId,
      mchId: version.mchId,
      notifyUrl: version.notifyUrl,
      returnUrl: version.returnUrl,
      publicKeyRef: this.readSnapshotNullableString(
        snapshot,
        'publicKeyRef',
        null,
      ),
      apiV3KeyRef: this.readSnapshotNullableString(
        snapshot,
        'apiV3KeyRef',
        null,
      ),
      platformCertRef: this.readSnapshotNullableString(
        snapshot,
        'platformCertRef',
        null,
      ),
      credentialVersionRef:
        this.readSnapshotNullableString(
          snapshot,
          'credentialVersionRef',
          null,
        ) ?? '',
      configMetadata: snapshot?.configMetadata ?? null,
    }
  }

  // 凭据材料按订单不可变快照解析，缺少真实材料时 adapter fail closed。
  private async resolvePaymentProviderCredentialMaterial(
    order: Pick<
      PaymentNotifyOrderSnapshot,
      'alipayPublicCredentialId' | 'wechatApiV3CredentialId'
    >,
    config: Pick<
      PaymentProviderConfigForOrderSnapshot,
      'apiV3KeyRef' | 'configMetadata' | 'platformCertRef' | 'publicKeyRef'
    >,
  ): Promise<PaymentProviderCredentialMaterial> {
    const metadata = this.asRecord(config.configMetadata)
    const alipayPublicCredential = await this.resolvePaymentCredentialByIdOrRef(
      order.alipayPublicCredentialId,
      config.publicKeyRef,
    )
    const wechatApiV3Credential = await this.resolvePaymentCredentialByIdOrRef(
      order.wechatApiV3CredentialId,
      config.apiV3KeyRef,
    )
    const platformCertificate = await this.resolvePaymentCertificateByRef(
      config.platformCertRef,
    )

    return {
      alipayPublicKeyPem: this.resolvePaymentMaterialFromMetadata(
        alipayPublicCredential?.metadata,
        ['alipayPublicKeyPem', 'publicKeyPem'],
        ['alipayPublicKeyPemEnvKey', 'publicKeyPemEnvKey', 'materialEnvKey'],
      ),
      wechatApiV3Key: this.resolvePaymentMaterialFromMetadata(
        wechatApiV3Credential?.metadata,
        ['wechatApiV3Key', 'apiV3Key'],
        ['wechatApiV3KeyEnvKey', 'apiV3KeyEnvKey', 'materialEnvKey'],
      ),
      wechatPlatformPublicKeyPem: this.resolvePaymentMaterialFromMetadata(
        platformCertificate?.metadata,
        ['wechatPlatformPublicKeyPem', 'publicKeyPem', 'certificatePem'],
        [
          'wechatPlatformPublicKeyPemEnvKey',
          'publicKeyPemEnvKey',
          'certificatePemEnvKey',
          'materialEnvKey',
        ],
      ),
      wechatPlatformSerialNo:
        this.readStringField(metadata ?? {}, 'wechatPlatformSerialNo') ??
        platformCertificate?.serialNo,
    }
  }

  private async resolvePaymentCredentialByIdOrRef(
    id: number | null,
    credentialRef: string | null,
  ): Promise<PaymentProviderCredentialMaterialSource | null | undefined> {
    if (id != null) {
      return this.db.query.paymentProviderCredential.findFirst({
        where: { id },
        columns: this.paymentProviderCredentialMaterialColumns,
      })
    }
    if (!credentialRef) {
      return null
    }
    return this.db.query.paymentProviderCredential.findFirst({
      where: { credentialRef },
      columns: this.paymentProviderCredentialMaterialColumns,
    })
  }

  private async resolvePaymentCertificateByRef(
    certificateRef: string | null,
  ): Promise<PaymentProviderCertificateMaterialSource | null | undefined> {
    if (!certificateRef) {
      return null
    }
    return this.db.query.paymentProviderCertificate.findFirst({
      where: { certificateRef },
      columns: this.paymentProviderCertificateMaterialColumns,
    })
  }

  private resolvePaymentMaterialFromMetadata(
    metadata: unknown,
    materialFields: string[],
    envKeyFields: string[],
  ) {
    const record = this.asRecord(metadata)
    for (const envKeyField of envKeyFields) {
      const envKey = this.readStringField(record ?? {}, envKeyField)
      if (envKey && process.env[envKey]) {
        return process.env[envKey]
      }
    }
    if (process.env.NODE_ENV === 'test') {
      for (const materialField of materialFields) {
        const material = this.readStringField(record ?? {}, materialField)
        if (material) {
          return material
        }
      }
    }
    return undefined
  }

  private asRecord(input: unknown): Record<string, unknown> | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null
    }
    return input as Record<string, unknown>
  }

  private readSnapshotNullableString(
    snapshot: Record<string, unknown> | null,
    field: string,
    fallback: string | null,
  ) {
    const value = snapshot?.[field]
    if (value === null) {
      return null
    }
    return typeof value === 'string' ? value : fallback
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
    const config: PaymentProviderConfigWriteSnapshot | undefined =
      await this.db.query.paymentProviderConfig.findFirst({
        where: { id },
        columns: {
          channel: true,
          configMetadata: true,
        },
      })
    if (!config) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '支付 provider 配置不存在',
      )
    }
    return config
  }

  /**
   * VIP 支付状态推进前在事务外发现完整锁计划；快照漂移时回滚并最多开启一次全新事务。
   * 非 VIP 订单没有会员锁计划，继续只执行一次事务。
   */
  private async executePaidOrderMutationWithMembershipRetry<TResult>(
    order: PaidOrderActivationOrder,
    execute: (
      tx: PaymentTx,
      membershipActivation: PreparedPaidOrderActivation | undefined,
    ) => Promise<TResult>,
  ): Promise<TResult> {
    if (order.orderType !== PaymentOrderTypeEnum.VIP_SUBSCRIPTION) {
      return this.drizzle.withTransaction({
        execute: async (tx) => execute(tx, undefined),
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
            return execute(tx, membershipActivation)
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

  /** 已支付订单在业务根完成锁获取后按订单类型执行唯一履约路径。 */
  private async applyPaidOrderSettlementAfterLocks(
    tx: PaymentTx,
    order: PaymentOrderSelect,
    membershipActivation: PreparedPaidOrderActivation | undefined,
  ) {
    if (order.orderType === PaymentOrderTypeEnum.CURRENCY_RECHARGE) {
      await this.walletService.applyRechargeSettlement(tx, order)
      return
    }
    if (order.orderType === PaymentOrderTypeEnum.VIP_SUBSCRIPTION) {
      if (!membershipActivation) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          'VIP 套餐履约锁计划缺失',
        )
      }
      await this.membershipService.activatePaidOrderAfterLocks(
        tx,
        order,
        membershipActivation,
      )
      return
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '不支持的支付订单类型',
    )
  }
}
