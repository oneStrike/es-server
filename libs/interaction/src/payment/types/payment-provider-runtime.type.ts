import type {
  PaymentOrderSelect,
  PaymentProviderCertificateSelect,
  PaymentProviderConfigVersionSelect,
  PaymentProviderCredentialSelect,
} from '@db/schema'
import type {
  PaymentProviderConfigSnapshot,
  PaymentProviderCredentialMaterial,
} from './payment.type'

/** 支付订单引用的 provider 配置版本字段。 */
export type PaymentProviderOrderVersionReference = Pick<
  PaymentOrderSelect,
  'providerConfigId' | 'providerConfigVersion' | 'providerConfigVersionId'
>

/** 按订单不可变版本读取 provider 运行时所需的最小投影。 */
export type PaymentProviderConfigVersionRuntimeSnapshot = Pick<
  PaymentProviderConfigVersionSelect,
  | 'alipayPublicCredentialId'
  | 'appCertificateId'
  | 'appId'
  | 'appPrivateCredentialId'
  | 'channel'
  | 'configSnapshot'
  | 'configVersion'
  | 'id'
  | 'isActive'
  | 'mchId'
  | 'notifyUrl'
  | 'platformCertificateId'
  | 'providerConfigId'
  | 'returnUrl'
  | 'rootCertificateId'
  | 'status'
  | 'wechatApiV3CredentialId'
>

/** 不可变版本快照还原的 provider 适配器配置。 */
export interface PaymentProviderAdapterConfig extends PaymentProviderConfigSnapshot {
  /** 应用私钥凭据引用。 */
  privateKeyRef: string | null
  /** 支付宝平台公钥凭据引用。 */
  publicKeyRef: string | null
  /** 微信 APIv3 key 凭据引用。 */
  apiV3KeyRef: string | null
  /** 微信应用证书引用。 */
  appCertRef: string | null
  /** 微信平台证书引用。 */
  platformCertRef: string | null
  /** 微信根证书引用。 */
  rootCertRef: string | null
}

/** 不可变版本中实际写入订单的凭据选择快照。 */
export interface PaymentProviderCredentialSnapshot {
  /** 应用私钥凭据 ID。 */
  appPrivateCredentialId: number | null
  /** 支付宝平台公钥凭据 ID。 */
  alipayPublicCredentialId: number | null
  /** 微信 APIv3 key 凭据 ID。 */
  wechatApiV3CredentialId: number | null
  /** 应用证书 ID。 */
  appCertificateId: number | null
  /** 平台证书 ID。 */
  platformCertificateId: number | null
  /** 根证书 ID。 */
  rootCertificateId: number | null
  /** 订单写入的 provider 证书 ID 集合。 */
  providerCertificateIds: number[]
}

/** 创建支付订单时 Runtime 一次性返回的不可变版本及材料。 */
export interface PaymentProviderCreateOrderRuntime {
  /** 不可变版本主键。 */
  id: number
  /** 不可变版本号。 */
  configVersion: number
  /** 原始不可变配置快照，用于订单持久化。 */
  configSnapshot: PaymentProviderConfigVersionRuntimeSnapshot['configSnapshot']
  /** 不可变凭据版本引用。 */
  credentialVersionRef: string
  /** 不可变凭据选择快照。 */
  credentialSnapshot: PaymentProviderCredentialSnapshot
  /** 适配器消费的不可变配置。 */
  adapterConfig: PaymentProviderAdapterConfig
  /** 适配器消费的实际凭据材料。 */
  credentialMaterial: PaymentProviderCredentialMaterial
}

/** 订单中保存的凭据选择字段。 */
export type PaymentProviderOrderCredentialReference = Pick<
  PaymentOrderSelect,
  'alipayPublicCredentialId' | 'wechatApiV3CredentialId'
>

/** 解析订单凭据材料所需的不可变配置字段。 */
export type PaymentProviderOrderCredentialConfig = Pick<
  PaymentProviderAdapterConfig,
  'apiV3KeyRef' | 'configMetadata' | 'platformCertRef' | 'publicKeyRef'
>

/** 凭据元数据的最小查询投影。 */
export type PaymentProviderCredentialMaterialSource = Pick<
  PaymentProviderCredentialSelect,
  'metadata'
>

/** 证书元数据的最小查询投影。 */
export type PaymentProviderCertificateMaterialSource = Pick<
  PaymentProviderCertificateSelect,
  'metadata' | 'serialNo'
>

/** 凭据元数据中允许读取的字段名列表。 */
export type PaymentProviderMaterialFieldNames = readonly string[]

/** 受控解析后的 JSON 元数据对象。 */
export type PaymentProviderMetadata = Record<string, unknown>

/** 微信回调中可选的平台证书序列号。 */
export type PaymentProviderWechatPlatformSerialNumber = string | undefined

/** 可用于解密微信通知的 APIv3 key 材料。 */
export type PaymentProviderWechatCredentialMaterial = Required<
  Pick<PaymentProviderCredentialMaterial, 'wechatApiV3Key'>
>
