import type { DbTransaction } from '@db/core'
import type {
  PaymentProviderCertificateSelect,
  PaymentProviderConfigInsert,
  PaymentProviderConfigSelect,
  PaymentProviderConfigVersionSelect,
  PaymentProviderCredentialSelect,
} from '@db/schema'
import type {
  CreatePaymentProviderConfigDto,
  QueryPaymentProviderConfigDto,
  UpdatePaymentProviderConfigDto,
} from '../dto/payment.dto'

/** 支付配置元数据允许的开放键值集合，消费前由 owner service 收窄。 */
export type PaymentProviderMetadataRecord = Record<string, unknown>

/** 配置、版本轮换与版本写入共享的显式事务上下文。 */
export type PaymentProviderConfigTx = DbTransaction

/** 支付 provider 配置分页与账号选项共用的筛选字段。 */
export type PaymentProviderConfigFilter = Pick<
  QueryPaymentProviderConfigDto,
  | 'channel'
  | 'paymentScene'
  | 'platform'
  | 'environment'
  | 'clientAppKey'
  | 'isEnabled'
>

/** 支付 provider 配置写入 DTO，覆盖创建与去除 ID 的更新输入。 */
export type PaymentProviderConfigWriteDto =
  CreatePaymentProviderConfigDto | Omit<UpdatePaymentProviderConfigDto, 'id'>

/** 支付 provider 配置落库前的可选写入字段集合。 */
export type PaymentProviderConfigWriteValues =
  Partial<PaymentProviderConfigInsert>

/** 支付 provider 配置版本写入时需要保持一致的当前配置字段。 */
export type PaymentProviderConfigVersionWriteSource = Pick<
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

/** 用于拒绝覆盖既有不可变配置版本的最小版本记录。 */
export type PaymentProviderConfigVersionIdSnapshot = Pick<
  PaymentProviderConfigVersionSelect,
  'id'
>

/** 更新配置前读取的最小当前配置快照。 */
export type PaymentProviderConfigWriteSnapshot = Pick<
  PaymentProviderConfigSelect,
  'channel' | 'configMetadata'
>

/** 后台支付账号选项需要的配置字段投影。 */
export type PaymentProviderAccountOptionSource = Pick<
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

/** 构建支付账号展示名所需的配置字段。 */
export type PaymentProviderAccountLabelConfigSource = Pick<
  PaymentProviderConfigSelect,
  'id' | 'configName' | 'appId' | 'mchId'
>

/** 后台配置分页视图需要的配置字段投影。 */
export type AdminPaymentProviderConfigPageSource = Pick<
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

/** 支付凭据下拉选项需要的安全字段投影。 */
export type PaymentProviderCredentialOptionSource = Pick<
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

/** 校验后台选择凭据时需要的最小凭据字段投影。 */
export type PaymentProviderCredentialSelectionSource = Pick<
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

/** 支付证书下拉选项需要的安全字段投影。 */
export type PaymentProviderCertificateOptionSource = Pick<
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

/** 校验后台选择证书时需要的最小证书字段投影。 */
export type PaymentProviderCertificateSelectionSource = Pick<
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

/** 不可变配置版本中固化的凭据与证书选择结果。 */
export interface PaymentProviderSelectionSnapshot {
  alipayPublicCredentialId: number | null
  appCertificateId: number | null
  appPrivateCredentialId: number | null
  platformCertificateId: number | null
  rootCertificateId: number | null
  wechatApiV3CredentialId: number | null
}

/** 解析可选凭据选择并写入配置引用时的内部参数。 */
export interface ResolveOptionalCredentialWriteValueInput {
  channel: number
  dtoValue: number | null | undefined
  expectedType: number
  label: string
  metadataField: string
  metadataPatch: PaymentProviderMetadataRecord
  targetField: 'apiV3KeyRef' | 'privateKeyRef' | 'publicKeyRef'
  writeValues: PaymentProviderConfigWriteValues
}

/** 解析可选证书选择并写入配置引用时的内部参数。 */
export interface ResolveOptionalCertificateWriteValueInput {
  channel: number
  dtoValue: number | null | undefined
  expectedType: number
  label: string
  metadataField: string
  metadataPatch: PaymentProviderMetadataRecord
  targetField: 'appCertRef' | 'platformCertRef' | 'rootCertRef'
  writeValues: PaymentProviderConfigWriteValues
}
