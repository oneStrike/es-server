export const ErrorMessages = {
  CONFIG_NOT_FOUND: '阿里云短信配置未定义',
}

export enum SmsTemplateCodeEnum {
  // 登录/注册
  LOGIN_REGISTER = '100001',
  // 修改绑定手机号
  MODIFY_BIND_PHONE = '100002',
  // 重置密码
  RESET_PASSWORD = '100003',
  // 绑定新手机号
  BIND_NEW_PHONE = '100004',
  // 验证绑定手机号
  VERIFY_BIND_PHONE = '100005',
}
