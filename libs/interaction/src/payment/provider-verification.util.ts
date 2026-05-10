import type {
  PaymentProviderSignatureInput,
  SignedFieldValue,
} from './types/payment.type'
import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import process from 'node:process'

// 将未知 payload 收敛为普通对象，供 provider 验签字段读取复用。
export function readRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }
  return input as Record<string, unknown>
}

// 读取并裁剪 provider payload 中的非空字符串字段。
export function readStringField(
  record: Record<string, unknown> | null,
  field: string,
) {
  const value = record?.[field]
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null
}

// 读取 provider payload 中允许字符串传输的有限数字字段。
export function readNumberField(
  record: Record<string, unknown> | null,
  field: string,
) {
  const value = record?.[field]
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

// 通过配置 metadata 中的环境变量名读取本地验签密钥引用。
export function readVerificationSecret(metadata: unknown) {
  const metadataRecord = readRecord(metadata)
  const envKey = readStringField(metadataRecord, 'verifySecretEnvKey')
  if (!envKey) {
    return null
  }
  const secret = process.env[envKey]
  return secret && secret.length > 0 ? secret : null
}

// 构造 provider 本地验签使用的稳定字段串。
export function buildCanonicalProviderPayload(
  fields: Record<string, SignedFieldValue>,
) {
  return Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n')
}

// 使用 HMAC-SHA256 常量时间比较校验 provider 签名。
export function verifyHmacSha256Signature(
  input: PaymentProviderSignatureInput,
) {
  const signature = input.signature.trim().replace(/^sha256=/i, '')
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return false
  }

  const expected = createHmac('sha256', input.secret)
    .update(buildCanonicalProviderPayload(input.fields))
    .digest('hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  const actualBuffer = Buffer.from(signature, 'hex')
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  )
}

// 校验 provider 回调时间戳是否落在允许的时钟偏移范围内。
export function isFreshTimestamp(input: number, maxSkewMs: number) {
  if (!Number.isFinite(input)) {
    return false
  }
  return Math.abs(Date.now() - input) <= maxSkewMs
}
