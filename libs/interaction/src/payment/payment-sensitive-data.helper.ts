const PAYMENT_SENSITIVE_FIELD_ALTERNATIVES =
  'api(?:[_-]?v3)?[_-]?key|key|secret|private|public|cert|signature|pay[_-]?sign|sign|token|authorization|credential'

const PAYMENT_SENSITIVE_ERROR_ASSIGNMENT_PATTERN = new RegExp(
  `((?:${PAYMENT_SENSITIVE_FIELD_ALTERNATIVES})[\\w-]*)(\\s*[:=]\\s*)(?:Bearer\\s+[^\\s,;&]+|"[^"]*"|'[^']*'|[^\\s,;&]+)`,
  'gi',
)

const PAYMENT_SENSITIVE_FIELD_PATTERN = new RegExp(
  PAYMENT_SENSITIVE_FIELD_ALTERNATIVES,
  'i',
)

/** 支付通知和对账记录共用的敏感数据脱敏工具，防止开放 JSON 或错误文本泄漏凭据。 */
export function redactPaymentSensitiveRecord(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return redactPaymentSensitiveValue(input) as Record<string, unknown>
}

/** 将异常文本中的凭据赋值、Bearer token 和 PEM 证书替换为不可恢复的占位符。 */
export function sanitizePaymentSensitiveError(error: unknown): string {
  const message = error instanceof Error ? error.message : '支付通知处理失败'
  return message
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, '[REDACTED]')
    .replace(PAYMENT_SENSITIVE_ERROR_ASSIGNMENT_PATTERN, '$1$2[REDACTED]')
    .replace(/\bBearer\s+[^,\s;}]+/gi, 'Bearer [REDACTED]')
}

// 递归处理 JSON 值，数组和对象中的敏感字段都必须被遮蔽。
function redactPaymentSensitiveValue(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => redactPaymentSensitiveValue(item))
  }
  if (!input || typeof input !== 'object') {
    return input
  }
  const redacted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    redacted[key] = isPaymentSensitiveField(key)
      ? '[REDACTED]'
      : redactPaymentSensitiveValue(value)
  }
  return redacted
}

// 支付协议中密钥、证书、签名和授权字段都不允许进入事件或对账审计载荷。
function isPaymentSensitiveField(key: string): boolean {
  return PAYMENT_SENSITIVE_FIELD_PATTERN.test(key)
}
