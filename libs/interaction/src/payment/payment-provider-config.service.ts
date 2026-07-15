import type { PaymentProviderConfigInsert } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  AdminPaymentProviderConfigPageItemDto,
  CreatePaymentProviderConfigDto,
  PaymentProviderAccountOptionDto,
  PaymentProviderAccountOptionQueryDto,
  PaymentProviderCertificateOptionDto,
  PaymentProviderCertificateOptionQueryDto,
  PaymentProviderCredentialOptionDto,
  PaymentProviderCredentialOptionQueryDto,
  QueryPaymentProviderConfigDto,
  UpdatePaymentProviderConfigDto,
} from './dto/payment.dto'
import type {
  AdminPaymentProviderConfigPageSource,
  PaymentProviderAccountLabelConfigSource,
  PaymentProviderAccountOptionSource,
  PaymentProviderCertificateOptionSource,
  PaymentProviderCertificateSelectionSource,
  PaymentProviderConfigFilter,
  PaymentProviderConfigTx,
  PaymentProviderConfigVersionIdSnapshot,
  PaymentProviderConfigVersionWriteSource,
  PaymentProviderConfigWriteDto,
  PaymentProviderConfigWriteSnapshot,
  PaymentProviderConfigWriteValues,
  PaymentProviderCredentialOptionSource,
  PaymentProviderCredentialSelectionSource,
  PaymentProviderMetadataRecord,
  PaymentProviderSelectionSnapshot,
  ResolveOptionalCertificateWriteValueInput,
  ResolveOptionalCredentialWriteValueInput,
} from './types/payment-provider-config.type'
import {
  acquireIntegrityLocks,
  DrizzleService,
  exclusiveIntegrityLock,
  tableIntegrityLock,
  toPageResult,
} from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, asc, eq, sql } from 'drizzle-orm'
import {
  PaymentChannelEnum,
  PaymentProviderCertificateTypeEnum,
  PaymentProviderCredentialTypeEnum,
} from './payment.constant'

/**
 * 支付 provider 配置的唯一写入 owner。
 * 配置、凭据选择和不可变版本必须在此处一起推进，历史订单不依赖当前可变配置。
 */
@Injectable()
export class PaymentProviderConfigService {
  constructor(private readonly drizzle: DrizzleService) {}

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

  // 选择凭据时仅读取校验和展示所需字段，禁止读出明文材料。
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

  // 选择证书时仅读取校验和展示所需字段，禁止读出证书材料。
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

  // 更新配置后生成不可变版本所需的完整当前配置投影。
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

  // 启用或停用配置并生成下一条不可变版本，避免订单读取可变状态。
  async updatePaymentProviderStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withErrorHandling(
      async () => {
        await this.drizzle.withTransaction({
          execute: async (tx) => {
            await acquireIntegrityLocks(tx, [
              exclusiveIntegrityLock(
                tableIntegrityLock('payment_provider_config', id),
              ),
            ])
            const [updatedConfig] = await tx
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
            if (updatedConfig.isEnabled) {
              await this.assertPaymentProviderConfigReadyForEnable(
                updatedConfig,
                tx,
              )
            }
            await this.rotatePaymentProviderConfigVersions(
              tx,
              updatedConfig.id,
              updatedConfig.configVersion,
            )
            await this.writePaymentProviderConfigVersion(tx, updatedConfig)
          },
        })
      },
      {
        notFound: '支付 provider 配置不存在',
        duplicate: '支付 provider 启用配置已存在',
      },
    )
    return true
  }

  // 更新配置、校验凭据选择并推进配置版本。
  async updatePaymentProviderConfig(dto: UpdatePaymentProviderConfigDto) {
    const { id, ...data } = dto
    await this.drizzle.withErrorHandling(
      async () => {
        await this.drizzle.withTransaction({
          execute: async (tx) => {
            await acquireIntegrityLocks(tx, [
              exclusiveIntegrityLock(
                tableIntegrityLock('payment_provider_config', id),
              ),
            ])
            const currentConfig = await this.getPaymentProviderConfigById(
              id,
              tx,
            )
            const writeValues =
              await this.buildPaymentProviderConfigWriteValues(
                data,
                currentConfig,
                tx,
              )
            const baseValues = this.toPaymentProviderConfigBaseWriteValues(data)
            const [updatedConfig] = await tx
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
            if (updatedConfig.isEnabled) {
              await this.assertPaymentProviderConfigReadyForEnable(
                updatedConfig,
                tx,
              )
            }
            await this.rotatePaymentProviderConfigVersions(
              tx,
              updatedConfig.id,
              updatedConfig.configVersion,
            )
            await this.writePaymentProviderConfigVersion(tx, updatedConfig)
          },
        })
      },
      {
        notFound: '支付 provider 配置不存在',
        duplicate: '支付 provider 启用配置已存在',
      },
    )
    return true
  }

  // 创建配置及其首个不可变版本，禁止只写当前可变行。
  async createPaymentProviderConfig(dto: CreatePaymentProviderConfigDto) {
    await this.drizzle.withErrorHandling(
      async () => {
        await this.drizzle.withTransaction({
          execute: async (tx) => {
            const writeValues =
              await this.buildPaymentProviderConfigWriteValues(
                dto,
                undefined,
                tx,
              )
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
            const [createdConfig] = await tx
              .insert(this.paymentProviderConfig)
              .values(insertValues)
              .returning(this.paymentProviderConfigVersionWriteSourceSelect)
            if (!createdConfig) {
              throw new BusinessException(
                BusinessErrorCode.RESOURCE_NOT_FOUND,
                '支付 provider 配置创建失败',
              )
            }
            if (createdConfig.isEnabled) {
              await this.assertPaymentProviderConfigReadyForEnable(
                createdConfig,
                tx,
              )
            }
            await this.writePaymentProviderConfigVersion(tx, createdConfig)
          },
        })
      },
      { duplicate: '支付 provider 启用配置已存在' },
    )
    return true
  }

  // 查询后台支付账号选项，返回掩码信息而不暴露配置引用。
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

  // 查询支付凭据选项，禁止向后台返回 credentialRef 或原始材料。
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

  // 查询支付证书选项，禁止向后台返回 certificateRef 或原始材料。
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

  // 分页查询支付 provider 配置，保持后台现有排序与分页语义。
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

  // 标准化可选业务键，空白值统一持久化为空字符串。
  private normalizeKey(input?: string | null) {
    return input?.trim() ?? ''
  }

  // 从 DTO 中剥离仅用于凭据选择的字段，保留可直接更新配置表的字段。
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

  // 校验凭据与证书选择，并构建配置行及元数据的内部写入值。
  private async buildPaymentProviderConfigWriteValues(
    dto: PaymentProviderConfigWriteDto,
    currentConfig: PaymentProviderConfigWriteSnapshot | undefined,
    tx: PaymentProviderConfigTx,
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

    const metadataPatch: PaymentProviderMetadataRecord = {}
    const writeValues: PaymentProviderConfigWriteValues = {}
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
        tx,
      )
      writeValues.credentialVersionRef = credential.credentialRef
      this.writeCredentialMetadata(
        metadataPatch,
        'credentialOptionId',
        credential,
      )
    }
    await this.resolveOptionalCredentialWriteValue(
      {
        channel,
        dtoValue: dto.privateKeyCredentialId,
        expectedType: PaymentProviderCredentialTypeEnum.APP_PRIVATE_KEY,
        label: '应用私钥凭据',
        metadataField: 'privateKeyCredentialId',
        metadataPatch,
        targetField: 'privateKeyRef',
        writeValues,
      },
      tx,
    )
    await this.resolveOptionalCredentialWriteValue(
      {
        channel,
        dtoValue: dto.publicKeyCredentialId,
        expectedType: PaymentProviderCredentialTypeEnum.ALIPAY_PUBLIC_KEY,
        label: '支付宝公钥凭据',
        metadataField: 'publicKeyCredentialId',
        metadataPatch,
        targetField: 'publicKeyRef',
        writeValues,
      },
      tx,
    )
    await this.resolveOptionalCredentialWriteValue(
      {
        channel,
        dtoValue: dto.apiV3KeyCredentialId,
        expectedType: PaymentProviderCredentialTypeEnum.WECHAT_API_V3_KEY,
        label: '微信 APIv3 key 凭据',
        metadataField: 'apiV3KeyCredentialId',
        metadataPatch,
        targetField: 'apiV3KeyRef',
        writeValues,
      },
      tx,
    )
    await this.resolveOptionalCertificateWriteValue(
      {
        channel,
        dtoValue: dto.appCertificateId,
        expectedType: PaymentProviderCertificateTypeEnum.APP_CERTIFICATE,
        label: '应用证书',
        metadataField: 'appCertificateId',
        metadataPatch,
        targetField: 'appCertRef',
        writeValues,
      },
      tx,
    )
    await this.resolveOptionalCertificateWriteValue(
      {
        channel,
        dtoValue: dto.platformCertificateId,
        expectedType: PaymentProviderCertificateTypeEnum.PLATFORM_CERTIFICATE,
        label: '平台证书',
        metadataField: 'platformCertificateId',
        metadataPatch,
        targetField: 'platformCertRef',
        writeValues,
      },
      tx,
    )
    await this.resolveOptionalCertificateWriteValue(
      {
        channel,
        dtoValue: dto.rootCertificateId,
        expectedType: PaymentProviderCertificateTypeEnum.ROOT_CERTIFICATE,
        label: '根证书',
        metadataField: 'rootCertificateId',
        metadataPatch,
        targetField: 'rootCertRef',
        writeValues,
      },
      tx,
    )
    if (Object.keys(metadataPatch).length > 0 || !currentConfig) {
      writeValues.configMetadata = this.mergePaymentConfigMetadata(
        currentConfig?.configMetadata,
        metadataPatch,
      )
    }
    return writeValues
  }

  // 启用前验证实际下单与回调所需的凭据、证书和基础字段，禁止把不可用配置写为当前版本。
  private async assertPaymentProviderConfigReadyForEnable(
    config: PaymentProviderConfigVersionWriteSource,
    tx: PaymentProviderConfigTx,
  ): Promise<void> {
    const selection = this.readPaymentProviderSelectionSnapshot(config)
    this.assertPaymentProviderConfigText(config.appId, '应用 AppID')
    this.assertPaymentProviderConfigText(config.notifyUrl, '支付回调地址')
    this.assertPaymentProviderConfigText(
      config.credentialVersionRef,
      '主凭据引用',
    )
    await this.resolvePaymentCredentialSelection(
      this.requirePaymentProviderSelectionId(
        selection.appPrivateCredentialId,
        '主凭据',
      ),
      config.channel,
      PaymentProviderCredentialTypeEnum.APP_PRIVATE_KEY,
      '主凭据',
      tx,
    )
    if (config.channel === PaymentChannelEnum.ALIPAY) {
      await this.resolvePaymentCredentialSelection(
        this.requirePaymentProviderSelectionId(
          selection.alipayPublicCredentialId,
          '支付宝公钥凭据',
        ),
        config.channel,
        PaymentProviderCredentialTypeEnum.ALIPAY_PUBLIC_KEY,
        '支付宝公钥凭据',
        tx,
      )
      return
    }
    if (config.channel === PaymentChannelEnum.WECHAT) {
      this.assertPaymentProviderConfigText(config.mchId, '微信商户号')
      await this.resolvePaymentCredentialSelection(
        this.requirePaymentProviderSelectionId(
          selection.wechatApiV3CredentialId,
          '微信 APIv3 key 凭据',
        ),
        config.channel,
        PaymentProviderCredentialTypeEnum.WECHAT_API_V3_KEY,
        '微信 APIv3 key 凭据',
        tx,
      )
      await this.resolvePaymentCertificateSelection(
        this.requirePaymentProviderSelectionId(
          selection.appCertificateId,
          '微信应用证书',
        ),
        config.channel,
        PaymentProviderCertificateTypeEnum.APP_CERTIFICATE,
        '微信应用证书',
        tx,
      )
      await this.resolvePaymentCertificateSelection(
        this.requirePaymentProviderSelectionId(
          selection.platformCertificateId,
          '微信平台证书',
        ),
        config.channel,
        PaymentProviderCertificateTypeEnum.PLATFORM_CERTIFICATE,
        '微信平台证书',
        tx,
      )
      return
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '支付渠道不支持启用',
    )
  }

  // 启用配置时要求不可为空的基础标识，避免订单创建或回调地址在运行时才失败。
  private assertPaymentProviderConfigText(
    value: string | null,
    label: string,
  ): void {
    if (value?.trim()) {
      return
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      `启用支付 provider 配置前请填写${label}`,
    )
  }

  // 统一将缺失的配置元数据选择转换为明确的启用前业务错误。
  private requirePaymentProviderSelectionId(
    id: number | null,
    label: string,
  ): number {
    if (id !== null) {
      return id
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      `启用支付 provider 配置前请绑定可用${label}`,
    )
  }

  // 将历史版本标记为已轮换，并恢复当前版本的可选状态。
  private async rotatePaymentProviderConfigVersions(
    tx: PaymentProviderConfigTx,
    providerConfigId: number,
    currentVersion: number,
  ) {
    await tx
      .update(this.paymentProviderConfigVersion)
      .set({ isActive: false, status: 3 })
      .where(
        eq(
          this.paymentProviderConfigVersion.providerConfigId,
          providerConfigId,
        ),
      )
    await tx
      .update(this.paymentProviderConfigVersion)
      .set({ isActive: true, status: 1 })
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

  // 写入唯一不可变配置版本；已存在版本必须失败而不能覆盖。
  private async writePaymentProviderConfigVersion(
    tx: PaymentProviderConfigTx,
    config: PaymentProviderConfigVersionWriteSource,
  ) {
    const selection = this.readPaymentProviderSelectionSnapshot(config)
    const values = this.buildPaymentProviderConfigVersionValues(
      config,
      selection,
    )
    const existing: PaymentProviderConfigVersionIdSnapshot | undefined =
      await tx.query.paymentProviderConfigVersion.findFirst({
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
    await tx.insert(this.paymentProviderConfigVersion).values(values)
  }

  // 将当前配置和已验证的凭据选择固化为不可变版本记录。
  private buildPaymentProviderConfigVersionValues(
    config: PaymentProviderConfigVersionWriteSource,
    selection: PaymentProviderSelectionSnapshot,
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

  // 生成供订单、验签和后台展示恢复的非明文配置快照。
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

  // 从配置元数据收敛凭据和证书 ID，用于冻结到不可变版本。
  private readPaymentProviderSelectionSnapshot(
    config: PaymentProviderConfigVersionWriteSource,
  ): PaymentProviderSelectionSnapshot {
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

  // 解析单个元数据选择项中的稳定数据库 ID。
  private readSelectionId(
    options: PaymentProviderMetadataRecord | null,
    field: string,
  ) {
    const value = this.asRecord(options?.[field])?.id
    return typeof value === 'number' ? value : null
  }

  // 将 DTO 的可选凭据选择转为配置引用和受限元数据。
  private async resolveOptionalCredentialWriteValue(
    input: ResolveOptionalCredentialWriteValueInput,
    tx: PaymentProviderConfigTx,
  ) {
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
      tx,
    )
    input.writeValues[input.targetField] = credential.credentialRef
    this.writeCredentialMetadata(
      input.metadataPatch,
      input.metadataField,
      credential,
    )
  }

  // 将 DTO 的可选证书选择转为配置引用和受限元数据。
  private async resolveOptionalCertificateWriteValue(
    input: ResolveOptionalCertificateWriteValueInput,
    tx: PaymentProviderConfigTx,
  ) {
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
      tx,
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

  // 校验凭据存在、渠道、用途和启用状态后返回受限字段。
  private async resolvePaymentCredentialSelection(
    id: number | null,
    channel: number,
    expectedType: number | undefined,
    label: string,
    tx: PaymentProviderConfigTx,
  ): Promise<PaymentProviderCredentialSelectionSource> {
    if (id === null) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `${label}不能为空`,
      )
    }
    const credential = await tx.query.paymentProviderCredential.findFirst({
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

  // 校验证书存在、渠道、用途和启用状态后返回受限字段。
  private async resolvePaymentCertificateSelection(
    id: number,
    channel: number,
    expectedType: number,
    label: string,
    tx: PaymentProviderConfigTx,
  ): Promise<PaymentProviderCertificateSelectionSource> {
    const certificate = await tx.query.paymentProviderCertificate.findFirst({
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

  // 在元数据中写入可展示但不含敏感引用的凭据选择快照。
  private writeCredentialMetadata(
    metadataPatch: PaymentProviderMetadataRecord,
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

  // 在元数据中写入可展示但不含敏感引用的证书选择快照。
  private writeCertificateMetadata(
    metadataPatch: PaymentProviderMetadataRecord,
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

  // 显式记录运营侧清空凭据或证书选择，避免遗留旧元数据。
  private writeNullSelectionMetadata(
    metadataPatch: PaymentProviderMetadataRecord,
    group: 'certificateOptions' | 'credentialOptions',
    field: string,
  ) {
    const options = this.ensureMetadataRecord(metadataPatch, group)
    options[field] = null
  }

  // 返回可安全写入元数据的对象字段，必要时替换非对象旧值。
  private ensureMetadataRecord(
    metadata: PaymentProviderMetadataRecord,
    field: string,
  ): PaymentProviderMetadataRecord {
    const current = metadata[field]
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return current as PaymentProviderMetadataRecord
    }
    const next: PaymentProviderMetadataRecord = {}
    metadata[field] = next
    return next
  }

  // 合并旧元数据与本次选择变更，保留未由本次写入覆盖的展示字段。
  private mergePaymentConfigMetadata(
    currentMetadata: unknown,
    metadataPatch: PaymentProviderMetadataRecord,
  ): PaymentProviderMetadataRecord {
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

  // 构建支付 provider 配置的可组合筛选条件。
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

  // 构建支付凭据选项的可组合筛选条件。
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

  // 构建支付证书选项的可组合筛选条件。
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

  // 将配置行映射为后台账号选项，统一掩码账户标识。
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

  // 将配置行映射为后台分页视图，过滤非结构化数组和非对象元数据。
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

  // 将凭据行映射为不包含敏感引用的后台选项。
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

  // 将证书行映射为不包含敏感引用的后台选项。
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

  // 统一构建后台支付账号展示名，账户号只允许显示末四位。
  private buildPaymentProviderAccountLabel(
    config: PaymentProviderAccountLabelConfigSource,
  ) {
    const name = config.configName || `支付账号 ${config.id}`
    const maskedAccount = this.maskIdentifier(config.mchId || config.appId)
    return maskedAccount ? `${name} / ${maskedAccount}` : name
  }

  // 组合展示名时剔除空白片段，保持后台选项易读。
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

  // 掩码账户或证书序列号，只保留末四位用于运营核对。
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

  // 将 JSON 数组收敛为非空字符串数组，避免后台 DTO 泄漏无效值。
  private toNullableStringArray(input: unknown) {
    if (!Array.isArray(input)) {
      return null
    }
    return input.filter(
      (item): item is string => typeof item === 'string' && item.trim() !== '',
    )
  }

  // 只接受普通对象元数据，数组和原始值不能进入配置视图或选择逻辑。
  private asRecord(input: unknown): PaymentProviderMetadataRecord | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null
    }
    return input as PaymentProviderMetadataRecord
  }

  // 根据 ID 读取更新配置所需的最小当前快照。
  private async getPaymentProviderConfigById(
    id: number,
    tx: PaymentProviderConfigTx,
  ): Promise<PaymentProviderConfigWriteSnapshot> {
    const config = await tx.query.paymentProviderConfig.findFirst({
      where: { id },
      columns: { channel: true, configMetadata: true },
    })
    if (!config) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '支付 provider 配置不存在',
      )
    }
    return config
  }
}
