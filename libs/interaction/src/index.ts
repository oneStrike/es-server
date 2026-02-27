// 基类服务
export * from './base-interaction.service'
// 评论点赞模块
export * from './comment-like/comment-like.module'

export * from './comment-like/comment-like.service'

export * from './comment-like/dto/comment-like.dto'

// 评论举报模块
export * from './comment-report/comment-report.module'

export * from './comment-report/comment-report.service'
export * from './comment-report/dto/comment-report.dto'
// 评论模块
export * from './comment/comment.module'

export * from './comment/comment.service'
export * from './comment/dto/comment.dto'
// 计数处理器
export * from './counter/counter.module'

export * from './counter/counter.service'
export * from './download/download.constant'
// 下载模块
export * from './download/download.module'
export * from './download/download.service'

export * from './download/dto/download.dto'
// DTO
export * from './dto/base-interaction.dto'
export * from './favorite/dto/favorite.dto'

// 收藏模块
export * from './favorite/favorite.module'
export * from './favorite/favorite.service'
// 常量与类型
export * from './interaction.constant'

// 事件系统
export * from './interaction.event'
// 主模块
export * from './interaction.module'
export * from './interaction.types'

export * from './like/dto/like.dto'
// 点赞模块
export * from './like/like.module'
export * from './like/like.service'

export * from './purchase/dto/purchase.dto'
// 购买模块
export * from './purchase/purchase.module'
export * from './purchase/purchase.service'

export * from './validator/target-validator.registry'
// 目标校验器
export * from './validator/validator.module'

export * from './view/dto/view.dto'
// 浏览记录模块
export * from './view/view.module'
// 注意：ITargetValidationResult 和 ITargetValidator 已从 validator/index.ts 导出
// 不需要重复导出 './validator/target-validator.interface'

export * from './view/view.service'
