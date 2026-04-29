import { BadRequestException } from '@nestjs/common'

const SAFE_LINK_PROTOCOLS = new Set(['http', 'https', 'mailto'])

// 判断 href 是否包含空白或控制字符，避免协议混淆。
function hasUnsafeHrefCharacter(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    const code = char.charCodeAt(0)
    if (code <= 31 || code === 127 || char.trim() === '') {
      return true
    }
  }

  return false
}

/**
 * 校验正文 link href。
 * 仅允许安全协议和相对路径，避免 canonical body 持久化可执行链接。
 */
export function assertSafeBodyLinkHref(href: string) {
  const normalizedHref = href.trim()
  if (!normalizedHref) {
    throw new BadRequestException('link href 不能为空')
  }
  if (hasUnsafeHrefCharacter(normalizedHref)) {
    throw new BadRequestException('link href 包含非法空白或控制字符')
  }
  if (normalizedHref.startsWith('//') || normalizedHref.startsWith('\\')) {
    throw new BadRequestException('link href 不允许使用协议相对地址')
  }

  const protocolMatch = normalizedHref.match(/^([a-z][a-z0-9+.-]*):/i)
  if (
    protocolMatch &&
    !SAFE_LINK_PROTOCOLS.has(protocolMatch[1].toLowerCase())
  ) {
    throw new BadRequestException('link href 协议不在白名单内')
  }

  return normalizedHref
}
