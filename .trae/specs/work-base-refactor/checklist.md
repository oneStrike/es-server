# Work 基表与通用服务层重构验收清单（方案C）

## T01 Work 基表与作品类型常量
- [ ] Prisma schema 能生成 Work 模型
- [ ] Work.type 字段使用 Int 类型（1=漫画, 2=小说），不使用 Prisma enum
- [ ] WorkTypeEnum 在 libs/base/src/constant 中定义（TypeScript 层面使用）
- [ ] Work 表包含所有公共字段
- [ ] Work 表索引定义正确

## T02 漫画扩展表
- [ ] WorkComic 与 Work 关联完整
- [ ] WorkComic 已移除冗余字段
- [ ] WorkComic 仅保留 workId 和时间戳字段

## T03 小说扩展表
- [ ] Prisma 模型可生成
- [ ] WorkNovel 与 Work 关联正确
- [ ] WorkNovel 包含 wordCount 字段

## T04 作者/分类/标签关系表
- [ ] WorkAuthorRelation 唯一约束生效
- [ ] WorkCategoryRelation 唯一约束生效
- [ ] WorkTagRelation 唯一约束生效
- [ ] 旧表已删除

## T05 收藏/点赞关系表
- [ ] WorkFavorite 唯一约束生效
- [ ] WorkFavorite workType 字段使用 Int 类型
- [ ] WorkLike 唯一约束生效
- [ ] 旧表已删除

## T06 通用章节表
- [ ] 章节可通过 workId 查询到所属作品
- [ ] workType 字段使用 Int 类型（1=漫画, 2=小说）
- [ ] contentPath 字段预留内容存储
- [ ] 唯一约束 (workId, sortOrder) 生效
- [ ] 旧表已删除

## T07 Prisma 生成
- [ ] 生成脚本完成且无类型缺失
- [ ] 新模型在服务层可正确导入

## T08 通用作品服务
- [ ] WorkService CRUD 方法实现完整
- [ ] WorkService 互动方法实现完整
- [ ] WorkService 用户状态方法实现完整
- [ ] WorkService 我的记录方法实现完整
- [ ] DTO 使用 BaseDto 继承
- [ ] DTO 使用自定义校验器
- [ ] 服务可正常注入和使用

## T09 通用章节服务
- [ ] WorkChapterService CRUD 方法实现完整
- [ ] WorkChapterService 互动方法实现完整
- [ ] WorkChapterService 用户状态方法实现完整
- [ ] WorkChapterService 我的记录方法实现完整
- [ ] DTO 复用 BaseWorkDto 关联字段
- [ ] DTO 使用自定义校验器
- [ ] 服务可正常注入和使用

## T10 通用评论服务
- [ ] WorkCommentService CRUD 方法实现完整
- [ ] WorkCommentService 查询方法实现完整
- [ ] WorkCommentService 审核方法实现完整
- [ ] WorkCommentService 举报方法实现完整
- [ ] DTO 复用 BaseDto, IdDto, PageDto
- [ ] DTO 使用自定义校验器
- [ ] 服务可正常注入和使用

## T11 内容处理服务
- [ ] ComicContentService 方法实现完整
- [ ] NovelContentService 方法实现完整
- [ ] DTO 复用 IdDto
- [ ] 服务可正常注入和使用

## T12 漫画 Controller 重构
- [ ] 客户端漫画接口功能正常
- [ ] 客户端章节接口功能正常
- [ ] 客户端评论接口功能正常
- [ ] 管理端漫画接口功能正常
- [ ] 管理端章节接口功能正常
- [ ] 管理端评论接口功能正常
- [ ] 管理端内容接口功能正常
- [ ] 模块导入正确

## T13 小说 Controller 新增
- [ ] 客户端小说接口功能正常
- [ ] 客户端章节接口功能正常
- [ ] 客户端评论接口功能正常
- [ ] 管理端小说接口功能正常
- [ ] 管理端章节接口功能正常
- [ ] 管理端评论接口功能正常
- [ ] 管理端内容接口功能正常
- [ ] 模块导入正确

## T14 章节互动表
- [ ] WorkChapterLike 唯一约束生效
- [ ] WorkChapterPurchase 唯一约束生效
- [ ] WorkChapterDownload 唯一约束生效
- [ ] 旧表已删除

## T15 统一评论表
- [ ] WorkComment 索引定义正确
- [ ] WorkComment workType 字段使用 Int 类型（1=漫画, 2=小说）
- [ ] WorkComment 支持作品评论
- [ ] WorkComment 支持章节评论
- [ ] WorkComment 支持审核流程
- [ ] WorkCommentReport 举报记录功能正常
- [ ] 旧表已删除

## T16 删除旧服务
- [ ] libs/content/src/comic/ 目录已删除
- [ ] 无引用错误

## T17 数据迁移
- [ ] 迁移脚本可正常执行
- [ ] Work 表数据迁移正确
- [ ] 关系表数据迁移正确
- [ ] 互动表数据迁移正确
- [ ] 章节表数据迁移正确
- [ ] 评论表数据迁移正确
- [ ] 验证脚本可正常执行

## T18 测试验证
- [ ] Prisma 迁移执行成功
- [ ] Prisma 生成执行成功
- [ ] lint 检查通过
- [ ] typecheck 检查通过
- [ ] 漫画接口功能正常
- [ ] 小说接口功能正常

## T19 种子文件重构
- [ ] Work 基表种子数据正确
- [ ] WorkComic 扩展表种子数据正确
- [ ] WorkNovel 扩展表种子数据正确
- [ ] 关系表种子数据正确
- [ ] 评论表种子数据正确
- [ ] 小说示例数据正确
- [ ] 种子数据可正常执行

## 小说模块可用性确认
- [ ] 作品 CRUD 可用
- [ ] 作品互动可用
- [ ] 章节 CRUD 可用
- [ ] 章节互动可用
- [ ] 章节内容可用
- [ ] 评论系统可用
- [ ] 作者/分类/标签关联可用
