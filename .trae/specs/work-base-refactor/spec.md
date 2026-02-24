# Work 基表与通用服务层重构规范（方案C）

## Why
当前漫画作品数据模型存在字段冗余，关系表和互动表仅针对漫画设计，无法支持后续小说扩展。方案C采用彻底重构策略，将公共字段上移到 Work 基表，关系表与互动表通用化，服务层彻底抽象，小说模块同步可用。

## What Changes
- 新增 Work 基表，包含所有作品公共字段
- 改造漫画主表为类型扩展表
- 新增小说扩展表
- 通用化作者/分类/标签关系表
- 通用化收藏/点赞关系表
- 通用化章节表
- 通用化章节互动表（点赞/购买/下载）
- 统一评论表设计（作品评论 + 章节评论）
- **服务层彻底抽象**：通用作品服务、通用章节服务、通用评论服务、内容处理服务
- **小说 Controller 完整新增**：客户端 + 管理端
- **删除旧服务**：libs/content/src/comic/ 目录完全删除
- **种子文件重构**：支持漫画和小说两种作品类型
- **BREAKING**: 数据库结构变更，需要迁移脚本
- **BREAKING**: 服务层完全重构，无向后兼容

## Impact
- Affected specs: 作品模块、章节模块、评论模块、用户互动模块、内容存储模块
- Affected code:
  - `prisma/models/work/` - 所有 Prisma 模型
  - `libs/content/src/work/` - 通用服务层（新增）
  - `libs/content/src/comic/` - 漫画服务层（删除）
  - `libs/base/src/enum/` - 基础枚举
  - `apps/app-api/src/modules/comic/` - 客户端漫画接口
  - `apps/app-api/src/modules/novel/` - 客户端小说接口（新增）
  - `apps/admin-api/src/modules/content-management/comic/` - 管理端漫画接口
  - `apps/admin-api/src/modules/content-management/novel/` - 管理端小说接口（新增）
  - `prisma/seed/modules/work/` - 种子数据

## ADDED Requirements

### Requirement: Work 基表模型
The system SHALL provide a Work base table that contains common fields for all work types (comic/novel).

#### Scenario: Work 基表创建
- **WHEN** creating a new work (comic or novel)
- **THEN** the Work table SHALL contain: id, type, name, alias, cover, description, language, region, ageRating, serialStatus, publisher, originalSource, copyright, disclaimer, isPublished, publishAt, lastUpdated, viewCount, favoriteCount, likeCount, rating, ratingCount, popularity, isRecommended, isHot, isNew, recommendWeight, createdAt, updatedAt, deletedAt
- **AND** Work.type SHALL be an Int field (1=漫画, 2=小说) - **IMPORTANT: Database tables do NOT use Prisma enum**
- **AND** Work SHALL have proper indexes for filtering and sorting

### Requirement: Work Type Enum
The system SHALL provide WorkTypeEnum in base constant package (TypeScript layer only).

#### Scenario: 枚举导出
- **WHEN** importing from `@libs/base/constant`
- **THEN** WorkTypeEnum SHALL be available with values: COMIC = 1, NOVEL = 2
- **AND** This enum is for TypeScript type checking only, NOT for database schema

### Requirement: WorkComic Extension Table
The system SHALL transform WorkComic to an extension table with one-to-one relation to Work.

#### Scenario: 漫画扩展表关联
- **WHEN** querying comic data
- **THEN** WorkComic SHALL have workId foreign key linking to Work
- **AND** WorkComic SHALL NOT contain fields already in Work

### Requirement: WorkNovel Extension Table
The system SHALL provide a WorkNovel extension table with wordCount field.

#### Scenario: 小说扩展表创建
- **WHEN** creating novel extension table
- **THEN** WorkNovel SHALL have workId foreign key linking to Work
- **AND** WorkNovel SHALL contain wordCount field

### Requirement: Generic Author/Category/Tag Relation Tables
The system SHALL provide generic relation tables for author, category, and tag associations.

#### Scenario: 作者关系通用化
- **WHEN** associating work with author
- **THEN** WorkAuthorRelation SHALL use workId as primary association
- **AND** WorkAuthorRelation SHALL have sortOrder and role fields
- **AND** WorkAuthorRelation SHALL have unique constraint on (workId, authorId)

#### Scenario: 分类关系通用化
- **WHEN** associating work with category
- **THEN** WorkCategoryRelation SHALL use workId as primary association
- **AND** WorkCategoryRelation SHALL have sortOrder field
- **AND** WorkCategoryRelation SHALL have unique constraint on (workId, categoryId)

#### Scenario: 标签关系通用化
- **WHEN** associating work with tag
- **THEN** WorkTagRelation SHALL use workId as primary association
- **AND** WorkTagRelation SHALL have unique constraint on (workId, tagId)

### Requirement: Generic Favorite/Like Tables
The system SHALL provide generic favorite and like tables for all work types.

#### Scenario: 收藏关系通用化
- **WHEN** user favorites a work
- **THEN** WorkFavorite SHALL use workId and userId as core fields
- **AND** WorkFavorite SHALL have workType Int field (1=漫画, 2=小说) to distinguish work type
- **AND** WorkFavorite SHALL have unique constraint on (workId, userId)

#### Scenario: 点赞关系通用化
- **WHEN** user likes a work
- **THEN** WorkLike SHALL use workId and userId as core fields
- **AND** WorkLike SHALL have unique constraint on (workId, userId)

### Requirement: Generic Chapter Table
The system SHALL provide a generic chapter table for both comic and novel.

#### Scenario: 通用章节创建
- **WHEN** creating a chapter
- **THEN** WorkChapter SHALL use workId as primary association
- **AND** WorkChapter SHALL have workType Int field (1=漫画, 2=小说) to distinguish work type
- **AND** WorkChapter SHALL contain: title, subtitle, description, sortOrder, readRule, readPoints, downloadRule, downloadPoints, requiredReadLevelId, requiredDownloadLevelId, isPublished, isPreview, canComment, publishAt, viewCount, likeCount, commentCount, purchaseCount, wordCount, contentPath, remark, createdAt, updatedAt, deletedAt
- **AND** WorkChapter SHALL have unique constraint on (workId, sortOrder)

### Requirement: Generic Chapter Interaction Tables
The system SHALL provide generic chapter interaction tables (like, purchase, download).

#### Scenario: 章节点赞通用化
- **WHEN** user likes a chapter
- **THEN** WorkChapterLike SHALL use chapterId and userId as core fields

#### Scenario: 章节购买通用化
- **WHEN** user purchases a chapter
- **THEN** WorkChapterPurchase SHALL use chapterId and userId as core fields

#### Scenario: 章节下载通用化
- **WHEN** user downloads a chapter
- **THEN** WorkChapterDownload SHALL use chapterId and userId as core fields

### Requirement: Unified Comment Table
The system SHALL provide a unified comment table for both work comments and chapter comments.

#### Scenario: 作品评论
- **WHEN** user comments on a work
- **THEN** WorkComment SHALL have workId (required), workType Int (required, 1=漫画, 2=小说), chapterId (null)
- **AND** chapterId IS NULL indicates work comment

#### Scenario: 章节评论
- **WHEN** user comments on a chapter
- **THEN** WorkComment SHALL have workId (required), workType Int (required, 1=漫画, 2=小说), chapterId (required)
- **AND** chapterId NOT NULL indicates chapter comment

#### Scenario: 评论审核与举报
- **WHEN** comment needs review or report
- **THEN** WorkComment SHALL support audit workflow (auditStatus, auditReason, auditAt, auditById, auditRole)
- **AND** WorkCommentReport SHALL support report handling

### Requirement: Generic Work Service
The system SHALL provide a generic WorkService for all work types.

#### Scenario: 作品 CRUD
- **WHEN** performing work operations
- **THEN** WorkService SHALL provide: createWork, updateWork, getWorkDetail, getWorkPage, deleteWork
- **AND** WorkService SHALL accept workType parameter to distinguish work type

#### Scenario: 作品互动
- **WHEN** user interacts with a work
- **THEN** WorkService SHALL provide: incrementViewCount, incrementLikeCount, incrementFavoriteCount

#### Scenario: 用户状态
- **WHEN** checking user status
- **THEN** WorkService SHALL provide: checkUserLiked, checkUserFavorited, getWorkUserStatus

#### Scenario: 我的记录
- **WHEN** querying user's records
- **THEN** WorkService SHALL provide: getMyFavoritePage, getMyLikedPage

### Requirement: Generic Chapter Service
The system SHALL provide a generic WorkChapterService for all work types.

#### Scenario: 章节 CRUD
- **WHEN** performing chapter operations
- **THEN** WorkChapterService SHALL provide: createChapter, updateChapter, getChapterDetail, getChapterPage, deleteChapter, swapChapterNumbers

#### Scenario: 章节互动
- **WHEN** user interacts with a chapter
- **THEN** WorkChapterService SHALL provide: incrementViewCount, incrementLikeCount, incrementPurchaseCount, reportDownload

#### Scenario: 章节用户状态
- **WHEN** checking user status
- **THEN** WorkChapterService SHALL provide: checkUserLiked, checkUserPurchased, checkUserDownloaded, getChapterUserStatus

#### Scenario: 我的章节记录
- **WHEN** querying user's chapter records
- **THEN** WorkChapterService SHALL provide: getMyPurchasedPage, getMyDownloadedPage, getMyReadPage

### Requirement: Generic Comment Service
The system SHALL provide a generic WorkCommentService for all work types.

#### Scenario: 评论 CRUD
- **WHEN** performing comment operations
- **THEN** WorkCommentService SHALL provide: createComment, deleteComment, deleteCommentByAdmin

#### Scenario: 评论查询
- **WHEN** querying comments
- **THEN** WorkCommentService SHALL provide: getCommentPage, getCommentManagePage, getCommentDetail

#### Scenario: 评论审核
- **WHEN** managing comments
- **THEN** WorkCommentService SHALL provide: updateCommentAudit, updateCommentHidden, recalcCommentCount

#### Scenario: 评论举报
- **WHEN** handling reports
- **THEN** WorkCommentService SHALL provide: createCommentReport, getCommentReportPage, handleCommentReport

### Requirement: Content Processing Services
The system SHALL provide separate content services for comic and novel.

#### Scenario: 漫画图片内容
- **WHEN** managing comic chapter images
- **THEN** ComicContentService SHALL provide: getChapterContents, addChapterContent, updateChapterContent, deleteChapterContent, moveChapterContent, clearChapterContents

#### Scenario: 小说章节文件
- **WHEN** managing novel chapter files
- **THEN** NovelContentService SHALL provide: getChapterContent, uploadChapterContent, deleteChapterContent

### Requirement: Novel Controller Module
The system SHALL provide complete novel controller modules for both client and admin APIs.

#### Scenario: 客户端小说接口
- **WHEN** client accesses novel features
- **THEN** app-api SHALL provide: novel.controller.ts, chapter.controller.ts, comment.controller.ts, novel.module.ts

#### Scenario: 管理端小说接口
- **WHEN** admin manages novel features
- **THEN** admin-api SHALL provide: novel.controller.ts, chapter.controller.ts, comment.controller.ts, content.controller.ts, novel.module.ts

### Requirement: DTO Standard
The system SHALL follow strict DTO standards for all services.

#### Scenario: DTO 复用
- **WHEN** creating DTOs
- **THEN** DTOs SHALL inherit from BaseDto
- **AND** DTOs SHALL use IntersectionType, OmitType, PartialType, PickType for composition
- **AND** Create DTOs SHALL use OMIT_BASE_FIELDS

#### Scenario: 自定义校验器
- **WHEN** validating DTO fields
- **THEN** DTOs SHALL use ValidateString, ValidateNumber, ValidateEnum, ValidateArray, ValidateBoolean, ValidateDate, ValidateJson, ValidateNested, ValidateBitmask, ValidateByRegex
- **AND** DTOs SHALL NOT use native @IsString(), @IsNumber() decorators

#### Scenario: 禁止冗余
- **WHEN** defining DTOs
- **THEN** DTOs SHALL NOT duplicate field validation rules
- **AND** DTOs SHALL NOT copy-paste same code across multiple DTOs

### Requirement: Seed Data Refactoring
The system SHALL refactor seed data to support both comic and novel work types.

#### Scenario: Work 基表种子
- **WHEN** seeding work data
- **THEN** seed files SHALL create Work records with proper type
- **AND** seed files SHALL create WorkComic/WorkNovel extension records

#### Scenario: 通用关系种子
- **WHEN** seeding relation data
- **THEN** seed files SHALL use workId for all relations

### Requirement: Data Migration
The system SHALL provide data migration scripts with rollback support.

#### Scenario: 数据迁移执行
- **WHEN** executing migration
- **THEN** migration SHALL create Work records from existing WorkComic data
- **AND** migration SHALL migrate all relation tables
- **AND** migration SHALL migrate chapter content to file storage
- **AND** migration SHALL support rollback

## MODIFIED Requirements

### Requirement: Comic Controller Refactoring
Comic controllers SHALL use generic services instead of comic-specific services.

#### Scenario: 漫画客户端接口
- **WHEN** client accesses comic features
- **THEN** comic.controller.ts SHALL use WorkService
- **AND** chapter.controller.ts SHALL use WorkChapterService
- **AND** comment.controller.ts SHALL use WorkCommentService

#### Scenario: 漫画管理端接口
- **WHEN** admin manages comic features
- **THEN** comic.controller.ts SHALL use WorkService
- **AND** chapter.controller.ts SHALL use WorkChapterService
- **AND** comment.controller.ts SHALL use WorkCommentService
- **AND** content.controller.ts SHALL use ComicContentService

## REMOVED Requirements

### Requirement: Comic-Specific Services
**Reason**: Replaced by generic services
**Migration**: Controllers will use WorkService, WorkChapterService, WorkCommentService
- ~~libs/content/src/comic/~~ (entire directory)

### Requirement: Comic-Specific Relation Tables
**Reason**: Replaced by generic relation tables
**Migration**: Data will be migrated to WorkAuthorRelation, WorkCategoryRelation, WorkTagRelation
- ~~WorkComicAuthor~~
- ~~WorkComicCategory~~
- ~~WorkComicTag~~

### Requirement: Comic-Specific Interaction Tables
**Reason**: Replaced by generic interaction tables
**Migration**: Data will be migrated to WorkFavorite, WorkLike
- ~~WorkComicFavorite~~
- ~~WorkComicLike~~

### Requirement: Comic-Specific Chapter Tables
**Reason**: Replaced by generic chapter table
**Migration**: Data will be migrated to WorkChapter
- ~~WorkComicChapter~~

### Requirement: Comic-Specific Chapter Interaction Tables
**Reason**: Replaced by generic chapter interaction tables
**Migration**: Data will be migrated to WorkChapterLike, WorkChapterPurchase, WorkChapterDownload
- ~~WorkComicChapterLike~~
- ~~WorkComicChapterPurchase~~
- ~~WorkComicChapterDownload~~

### Requirement: Comic-Specific Comment Tables
**Reason**: Replaced by unified comment table
**Migration**: Data will be migrated to WorkComment, WorkCommentReport
- ~~WorkComicChapterComment~~
- ~~WorkComicChapterCommentReport~~
