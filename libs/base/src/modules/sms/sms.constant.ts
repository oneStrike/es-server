/**
 * 短信模块常量定义
 * 覆盖错误文案、错误映射与模板码
 */
/// 短信错误文案
export const SmsErrorMessages = {
  /** 配置未找到 */
  CONFIG_NOT_FOUND: '阿里云短信配置未定义',
}

/// 阿里云短信错误码映射
export const SmsErrorMap = {
  /** 请求频率过快 */
  'biz.FREQUENCY': '请求频率过快，请稍后再试！',
  /** 验证码校验失败 */
  'isv.ValidateFail': '验证码校验失败！',
}

/// 短信模板码枚举
export enum SmsTemplateCodeEnum {
  /** 登录/注册 */
  LOGIN_REGISTER = '100001',
  /** 修改绑定手机号 */
  MODIFY_BIND_PHONE = '100002',
  /** 重置密码 */
  RESET_PASSWORD = '100003',
  /** 绑定新手机号 */
  BIND_NEW_PHONE = '100004',
  /** 验证绑定手机号 */
  VERIFY_BIND_PHONE = '100005',
}

/// 默认短信配置
export const defaultConfig = {
  /** 默认模板码 */
  templateCode: SmsTemplateCodeEnum.LOGIN_REGISTER,
  /** 阿里云短信服务地址 */
  endpoint: 'dypnsapi.aliyuncs.com',
}
