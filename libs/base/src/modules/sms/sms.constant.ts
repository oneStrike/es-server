export const SmsErrorMessages = {
  CONFIG_NOT_FOUND: '阿里云短信配置未定义',
}

export const SmsErrorMap = {
  'biz.FREQUENCY': '请求频率过快，请稍后再试！',
  'isv.ValidateFail': '验证码校验失败！',
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

export const defaultConfig = {
  templateCode: SmsTemplateCodeEnum.LOGIN_REGISTER,
  endpoint: 'dypnsapi.aliyuncs.com',
}
