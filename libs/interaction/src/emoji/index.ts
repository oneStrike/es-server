/**
 * 表情模块公共导出。
 * - 包含表情包管理、目录查询、文本解析等能力。
 * - 上层应用通过 EmojiModule 导入即可使用全部服务。
 */
export * from './dto/emoji.dto'
export * from './emoji-asset.service'
export * from './emoji-catalog.service'
export * from './emoji-parser.service'
export * from './emoji.constant'
export * from './emoji.module'
export type { EmojiParseToken } from './emoji.type'
