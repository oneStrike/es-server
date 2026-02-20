漫画模块 App 接口缺口 详细任务清单

目标
- 补齐 App 端漫画模块缺失接口，满足客户端功能闭环

范围
- apps/app-api/src/modules/comic/comic.controller.ts
- libs/content/src/comic/core
- libs/content/src/comic/chapter
- libs/content/src/comic/chapter-comment
- 相关 DTO 与分页模型

任务清单

任务 01：新增章节评论详情接口
- 路由：GET /app/comic/chapter/comment/detail
- 输入：IdDto
- 输出：ComicChapterCommentDto
- 依赖服务：ComicChapterCommentService.getComicChapterCommentDetail
- 验收标准：传入已删除或不存在评论返回明确错误；正常返回包含 user、replyTo、children

任务 02：新增章节评论举报列表与进度接口
- 路由：GET /app/comic/chapter/comment/report/page
- 输入：QueryComicChapterCommentReportDto 或新增用户侧查询 DTO
- 输出：BaseComicChapterCommentReportDto 分页
- 过滤策略：强制以当前登录用户为 reporterId
- 可选补充：GET /app/comic/chapter/comment/report/detail
- 验收标准：仅返回当前用户举报记录；状态字段与管理端一致

任务 03：新增用户漫画收藏列表接口
- 路由：GET /app/comic/my/favorites
- 输入：分页参数
- 输出：收藏漫画列表（包含基础信息与用户状态）
- 依赖服务：ComicService 新增分页查询方法
- 验收标准：按收藏时间或漫画更新时间排序，分页稳定

任务 04：新增用户漫画点赞列表接口
- 路由：GET /app/comic/my/likes
- 输入：分页参数
- 输出：点赞漫画列表（包含基础信息与用户状态）
- 依赖服务：ComicService 新增分页查询方法
- 验收标准：仅返回当前用户点赞记录

任务 05：新增用户章节已购列表接口
- 路由：GET /app/comic/my/purchases
- 输入：分页参数
- 输出：已购章节列表（含漫画信息与章节基础信息）
- 依赖服务：ComicChapterService 新增分页查询方法
- 验收标准：按购买时间倒序返回

任务 06：新增用户章节已下载列表接口
- 路由：GET /app/comic/my/downloads
- 输入：分页参数
- 输出：已下载章节列表（含漫画信息与章节基础信息）
- 依赖服务：ComicChapterService 新增分页查询方法
- 验收标准：仅返回当前用户下载记录

任务 07：新增用户阅读记录列表接口
- 路由：GET /app/comic/my/reads
- 输入：分页参数
- 输出：阅读章节列表（含漫画信息与章节基础信息）
- 依赖服务：ComicChapterService 新增分页查询方法
- 验收标准：按最近阅读时间倒序返回

任务 08：补齐 DTO 与分页响应模型
- 新增或复用分页 DTO（Favorites/Likes/Purchases/Downloads/Reads）
- 明确响应字段结构与排序规则
- 验收标准：Swagger 文档可见，字段类型与实际返回一致

任务 09：权限与参数校验
- 所有新增接口强制使用 CurrentUser
- 输入分页参数存在默认值与边界校验
- 验收标准：未登录访问返回统一认证错误
