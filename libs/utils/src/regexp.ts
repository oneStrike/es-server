/**
 * 常用正则表达式集合
 */

/**
 * 用户名：4-16位字母、数字、下划线
 */
export const USERNAME_REGEXP = /^\w{4,16}$/

/**
 * 密码：8-20位，至少包含字母、数字
 */
export const PASSWORD_REGEXP =
  /^(?=.*[a-z])(?=.*\d)[\w!@#$%^&*()+=[\]{};':"\\|,.<>?-]{8,20}$/i

/**
 * 强密码：8-20位，必须包含大小写字母、数字和特殊字符
 */
export const STRONG_PASSWORD_REGEXP =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()+=[\]{};':"\\|,.<>?-])[\w!@#$%^&*()+=[\]{};':"\\|,.<>?-]{8,20}$/

/**
 * 邮箱地址
 */
export const EMAIL_REGEXP = /^[\w.%+-]+@[\w.-]+\.[a-z]{2,}$/i

/**
 * 中国大陆手机号
 */
export const MOBILE_PHONE_REGEXP = /^1[3-9]\d{9}$/

/**
 * 固定电话（中国）
 */
export const LANDLINE_PHONE_REGEXP = /^0\d{2,3}-?\d{7,8}$/

/**
 * 身份证号（18位）
 */
export const ID_CARD_REGEXP =
  /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[0-9x]$/i

/**
 * 中文姓名：2-10个中文字符
 */
export const CHINESE_NAME_REGEXP = /^[\u4E00-\u9FA5]{2,10}$/

/**
 * 只包含中文
 */
export const CHINESE_REGEXP = /^[\u4E00-\u9FA5]+$/

/**
 * 只包含英文字母
 */
export const ENGLISH_REGEXP = /^[a-z]+$/i

/**
 * 只包含数字
 */
export const NUMBER_REGEXP = /^\d+$/

/**
 * 整数（正整数、负整数、0）
 */
export const INTEGER_REGEXP = /^-?\d+$/

/**
 * 正整数
 */
export const POSITIVE_INTEGER_REGEXP = /^[1-9]\d*$/

/**
 * 负整数
 */
export const NEGATIVE_INTEGER_REGEXP = /^-[1-9]\d*$/

/**
 * 浮点数
 */
export const FLOAT_REGEXP = /^-?\d+\.\d+$/

/**
 * 正浮点数
 */
export const POSITIVE_FLOAT_REGEXP = /^(?:[1-9]\d*\.\d+|0\.0*[1-9]\d*)$/

/**
 * URL地址
 */
export const URL_REGEXP =
  /^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?$/i

/**
 * HTTP/HTTPS URL
 */
export const HTTP_URL_REGEXP =
  /^https?:\/\/([a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?$/i

/**
 * IPv4地址
 */
export const IPV4_REGEXP =
  /^((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/

/**
 * IPv6地址
 */
export const IPV6_REGEXP = /^(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i

/**
 * 端口号：1-65535
 */
export const PORT_REGEXP =
  /^([1-9]|[1-9]\d{1,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/

/**
 * 邮政编码（中国）
 */
export const POSTAL_CODE_REGEXP = /^[1-9]\d{5}$/

/**
 * QQ号：5-11位数字
 */
export const QQ_REGEXP = /^[1-9]\d{4,10}$/

/**
 * 微信号：6-20位，字母开头，允许字母、数字、减号、下划线
 */
export const WECHAT_REGEXP = /^[a-z][\w-]{5,19}$/i

/**
 * 银行卡号：13-19位数字
 */
export const BANK_CARD_REGEXP = /^\d{13,19}$/

/**
 * 车牌号（新能源+普通）
 */
export const LICENSE_PLATE_REGEXP =
  /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-HJ-NP-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳]$/

/**
 * 统一社会信用代码
 */
export const CREDIT_CODE_REGEXP =
  /^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/

/**
 * 日期格式：YYYY-MM-DD
 */
export const DATE_REGEXP = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/**
 * 日期时间格式：YYYY-MM-DD HH:mm:ss
 */
export const DATETIME_REGEXP =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/

/**
 * 时间格式：HH:mm:ss
 */
export const TIME_REGEXP = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/

/**
 * 十六进制颜色值
 */
export const HEX_COLOR_REGEXP = /^#(?:[0-9a-f]{6}|[0-9a-f]{3})$/i

/**
 * Base64字符串
 */
export const BASE64_REGEXP = /^[A-Z0-9+/]*={0,2}$/i

/**
 * MD5哈希值
 */
export const MD5_REGEXP = /^[a-f0-9]{32}$/i

/**
 * UUID
 */
export const UUID_REGEXP =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 文件扩展名
 */
export const FILE_EXTENSION_REGEXP = /\.([a-z0-9]+)$/i

/**
 * HTML标签
 */
export const HTML_TAG_REGEXP = /<[^>]+>/g

/**
 * 空白字符（空格、制表符、换行符等）
 */
export const WHITESPACE_REGEXP = /\s+/g

/**
 * 版本号：x.y.z
 */
export const VERSION_REGEXP = /^\d+\.\d+\.\d+$/

/**
 * JSON字符串（简单检测）
 */
export const JSON_REGEXP = /^[[{].*[\]}]$/

/**
 * 验证工具函数
 */
export const RegExpValidator = {
  /** 验证用户名 */
  isUsername: (value: string) => USERNAME_REGEXP.test(value),

  /** 验证密码 */
  isPassword: (value: string) => PASSWORD_REGEXP.test(value),

  /** 验证强密码 */
  isStrongPassword: (value: string) => STRONG_PASSWORD_REGEXP.test(value),

  /** 验证邮箱 */
  isEmail: (value: string) => EMAIL_REGEXP.test(value),

  /** 验证手机号 */
  isMobilePhone: (value: string) => MOBILE_PHONE_REGEXP.test(value),

  /** 验证身份证号 */
  isIdCard: (value: string) => ID_CARD_REGEXP.test(value),

  /** 验证URL */
  isUrl: (value: string) => URL_REGEXP.test(value),

  /** 验证IPv4 */
  isIPv4: (value: string) => IPV4_REGEXP.test(value),

  /** 验证IPv6 */
  isIPv6: (value: string) => IPV6_REGEXP.test(value),

  /** 验证日期 */
  isDate: (value: string) => DATE_REGEXP.test(value),

  /** 验证时间 */
  isTime: (value: string) => TIME_REGEXP.test(value),

  /** 验证十六进制颜色 */
  isHexColor: (value: string) => HEX_COLOR_REGEXP.test(value),

  /** 验证UUID */
  isUUID: (value: string) => UUID_REGEXP.test(value),
}
