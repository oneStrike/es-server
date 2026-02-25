// 常量与类型
export * from './interaction.constant'
export * from './interaction.types'

// 事件系统
export * from './interaction.event'

// 基类服务
export * from './base-interaction.service'

// DTO
export * from './dto/base-interaction.dto'

// 点赞模块
export * from './like/like.module'
export * from './like/like.service'
export * from './like/dto/like.dto'

// 收藏模块
export * from './favorite/favorite.module'
export * from './favorite/favorite.service'
export * from './favorite/dto/favorite.dto'

// 浏览记录模块
export * from './view/view.module'
export * from './view/view.service'
export * from './view/dto/view.dto'

// 评论模块
export * from './comment/comment.module'
export * from './comment/comment.service'
export * from './comment/dto/comment.dto'

// 评论点赞模块
export * from './comment-like/comment-like.module'
export * from './comment-like/comment-like.service'
export * from './comment-like/dto/comment-like.dto'

// 评论举报模块
export * from './comment-report/comment-report.module'
export * from './comment-report/comment-report.service'
export * from './comment-report/dto/comment-report.dto'

// 下载模块
export * from './download/download.module'
export * from './download/download.service'
export * from './download/dto/download.dto'

// 计数处理器
export * from './counter/counter.module'
export * from './counter/counter.service'

// 目标校验器
export * from './validator/validator.module'
export * from './validator/target-validator.registry'
// 注意：ITargetValidationResult 和 ITargetValidator 已从 validator/index.ts 导出
// 不需要重复导出 './validator/target-validator.interface'

// 主模块
export * from './interaction.module'
