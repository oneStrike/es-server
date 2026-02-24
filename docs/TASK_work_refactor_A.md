 # 方案A原子化任务清单（Work基表与通用关系）

 ## 目标
 - 将漫画作品公共字段上移到 Work 基表
 - 关系表与互动表通用化，为小说/插画扩展打基础
 - 同步调整现有漫画服务与接口，保证功能不回归

 ## 任务清单

 ### T01 新增 Work 基表与作品类型枚举
 - 业务影响：所有作品（漫画/小说/插画）共享公共字段与索引
 - 新增文件
   - prisma\models\work\work.prisma
 - 修改文件
   - libs\base\src\enum\base.enum.ts（新增作品类型枚举）
   - libs\base\src\enum\index.ts（导出枚举）
 - 说明
   - Work 包含名称、封面、简介、语言/地区、年龄分级、发布状态、统计字段、时间戳等
   - Work.type 标识作品类型（漫画/小说/插画）

 ### T02 改造漫画主表为类型扩展表
 - 业务影响：漫画业务仍用 WorkComic，但公共字段迁移到 Work
 - 修改文件
   - prisma\models\work\comic\work-comic.prisma
 - 变更要点
   - 新增 workId 外键关联 Work
   - 保留漫画特有字段（出版社、原作来源、连载状态等）
   - 统一索引策略到 Work（将通用索引迁移）

 ### T03 新增小说与插画扩展表（空壳或最小字段）
 - 业务影响：为后续扩展预留最小可用结构
 - 新增文件
   - prisma\models\work\novel\work-novel.prisma
   - prisma\models\work\illustration\work-illustration.prisma
 - 说明
   - 仅保留类型特有字段，公共字段走 Work

 ### T04 通用化作者/分类/标签关系表
 - 业务影响：所有作品共享关联逻辑，漫画迁移到新表
 - 新增文件
   - prisma\models\work\work-author-relation.prisma
   - prisma\models\work\work-category-relation.prisma
   - prisma\models\work\work-tag-relation.prisma
 - 修改文件
   - prisma\models\work\author\work-author.prisma（关系字段改为通用关系）
   - prisma\models\work\work-category.prisma（关系字段改为通用关系）
   - prisma\models\work\work-tag.prisma（关系字段改为通用关系）
 - 删除文件
   - prisma\models\work\comic\work-comic-author.prisma
   - prisma\models\work\comic\work-comic-category.prisma
   - prisma\models\work\comic\work-comic-tag.prisma

 ### T05 通用化收藏/点赞关系表
 - 业务影响：统一作品互动表，漫画迁移到新表
 - 新增文件
   - prisma\models\work\work-favorite.prisma
   - prisma\models\work\work-like.prisma
 - 修改文件
   - prisma\models\app\app-user.prisma（关联字段改为通用关系）
 - 删除文件
   - prisma\models\work\comic\work-comic-favorite.prisma
   - prisma\models\work\comic\work-comic-like.prisma

 ### T06 章节层结构策略确认与落库
 - 业务影响：漫画章节保持独立，小说章节可复用或新增
 - 修改文件
   - prisma\models\work\comic\work-comic-chapter.prisma（关联字段调整为 workId 或保留 comicId）
 - 新增文件（如选择通用章节）
   - prisma\models\work\work-chapter.prisma
 - 说明
   - 若保持漫画章节独立：仅加 workId 便于跨表查询
   - 若通用章节：需要区分内容类型字段与内容结构

 ### T07 Prisma 生成与类型导出同步
 - 业务影响：确保客户端类型完整可用
 - 修改文件
   - prisma\prismaClient\client.ts（生成）
   - prisma\prismaClient\models.ts（生成）

 ### T08 漫画创建/更新服务改造
 - 业务影响：创建与更新需写入 Work 与 WorkComic
 - 修改文件
   - libs\content\src\comic\core\comic.service.ts
   - libs\content\src\comic\core\dto\comic.dto.ts
 - 变更要点
   - 创建：事务内先建 Work，再建 WorkComic
   - 更新：按字段路由到 Work 或 WorkComic
   - 查询：按 Work+WorkComic 组合返回，接口响应结构保持不变

 ### T09 漫画列表与详情查询重构
 - 业务影响：分页与详情查询走 Work 维度过滤/排序
 - 修改文件
   - libs\content\src\comic\core\comic.service.ts
 - 说明
   - 过滤字段拆分：通用字段走 Work，漫画特有字段走 WorkComic
   - 索引依赖改为 Work 上的通用索引

 ### T10 漫画作者/分类/标签关联逻辑迁移
 - 业务影响：新增与更新漫画时关联表改为通用表
 - 修改文件
   - libs\content\src\comic\core\comic.service.ts
 - 说明
   - 原 WorkComicAuthor/Category/Tag 改为 WorkAuthorRelation/WorkCategoryRelation/WorkTagRelation

 ### T11 漫画收藏/点赞逻辑迁移
 - 业务影响：收藏/点赞记录改写到 WorkFavorite/WorkLike
 - 修改文件
   - libs\content\src\comic\core\comic.service.ts
   - apps\app-api\src\modules\comic\comic.controller.ts
 - 说明
   - 读取/写入时增加 workType=漫画

 ### T12 章节相关服务联动改造
 - 业务影响：章节查询与用户状态与新关系一致
 - 修改文件
   - libs\content\src\comic\chapter\comic-chapter.service.ts
   - libs\content\src\comic\chapter\dto\comic-chapter.dto.ts
   - apps\app-api\src\modules\comic\comic-chapter.controller.ts

 ### T13 章节内容服务与上传逻辑适配
 - 业务影响：若章节结构调整，章节内容字段与上传路径同步
 - 修改文件
   - libs\content\src\comic\chapter-content\chapter-content.service.ts
   - apps\admin-api\src\modules\content-management\comic\chapter-content\chapter-content.controller.ts

 ### T14 评论与举报链路的关联修订
 - 业务影响：评论链路保持漫画专用或准备通用化
 - 修改文件
   - libs\content\src\comic\chapter-comment\comic-chapter-comment.service.ts
   - libs\content\src\comic\chapter-comment\dto\comic-chapter-comment.dto.ts
 - 说明
   - 若通用化，需新增 workComment/workCommentReport 并迁移

 ### T15 数据迁移与回滚脚本
 - 业务影响：旧数据平滑迁移到 Work 体系
 - 新增文件
   - scripts\migrations\work-base-backfill.ts
 - 修改文件
   - prisma\migrations\（生成）
 - 说明
   - 迁移 WorkComic 到 Work
   - 迁移关系表与互动表到通用表
   - 回滚策略需保留映射表或临时字段

 ### T16 管理端与客户端接口验收
 - 业务影响：确保外部 API 不破坏
 - 修改文件
   - apps\admin-api\src\modules\content-management\comic\core\comic.controller.ts
   - apps\app-api\src\modules\comic\comic.controller.ts
 - 说明
   - 若 DTO 字段名保持不变，控制器仅验证与透传

 ### T17 测试、校验与质量门禁
 - 业务影响：确保接口与迁移无回归
 - 修改文件
   - apps\app-api\test\app.e2e-spec.ts（如需补充）
 - 操作项
   - 运行 Prisma 迁移与生成
   - 运行 lint 与 typecheck
   - 运行现有测试与关键接口手工验收
