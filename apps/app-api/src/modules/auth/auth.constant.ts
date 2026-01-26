export const AuthErrorMessages = {
  ACCOUNT_OR_PASSWORD_ERROR: '账号或密码错误',
  ACCOUNT_DISABLED: '账号已被禁用，请联系管理员',
  ACCOUNT_NOT_FOUND: '账号不存在',
  PHONE_EXISTS: '手机号已注册',
  EMAIL_EXISTS: '邮箱已注册',
  DEFAULT_LEVEL_NOT_FOUND: '系统配置错误：找不到默认论坛等级',
  PHONE_OR_ACCOUNT_REQUIRED: '手机号或账号不能为空',
  PASSWORD_OR_CODE_REQUIRED: '密码或验证码不能为空',
  VERIFY_CODE_INVALID: '验证码错误或已过期',
  PHONE_REQUIRED_FOR_REGISTER: '注册必须提供手机号',
  PHONE_REQUIRED_FOR_CODE_LOGIN: '验证码登录必须提供手机号',
  ACCOUNT_NOT_BOUND_PHONE: '该账号未绑定手机号，无法使用验证码登录',
  PHONE_MISMATCH: '验证码登录的手机号与账号绑定的手机号不一致',
  DEVICE_NOT_FOUND: '设备不存在',
  NO_PERMISSION_FOR_DEVICE: '无权操作此设备',
  VERIFY_CODE_SEND_FAILED: '验证码发送失败',
  VERIFY_CODE_CHECK_FAILED: '验证码已过期或错误',
  ACCOUNT_LOCKED: (minutes: number) => `账号已锁定，请在 ${minutes} 分钟后重试`,
  PASSWORD_ERROR_WITH_REMAINING: (remaining: number) =>
    `账号或密码错误，还剩 ${remaining} 次机会`,
} as const

export const AuthConstants = {
  // 最大登录失败次数
  LOGIN_MAX_ATTEMPTS: 5,
  // 失败计数过期时间 (5分钟)
  LOGIN_FAIL_TTL: 5 * 60,
  // 账号锁定时间 (30分钟)
  ACCOUNT_LOCK_TTL: 30 * 60,
}

export const AuthRedisKeys = {
  // 登录失败计数 Key
  LOGIN_FAIL_COUNT: (userId: number) => `auth:login:fail:${userId}`,
  // 账号锁定 Key
  LOGIN_LOCK: (userId: number) => `auth:login:lock:${userId}`,
}

export const AuthDefaultValue = {
  IP_ADDRESS_UNKNOWN: 'unknown',
}
