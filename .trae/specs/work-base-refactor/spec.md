# Work 基表与通用关系重构规范

## Why
当前漫画作品数据模型存在字段冗余，关系表和互动表仅针对漫画设计，无法支持后续小说扩展。需要建立 Work 基表架构，将公共字段上移，关系表与互动表通用化，为小说扩展打基础。

## What Changes
- 新增 Work 基表，包含所有作品公共字段
- 改造漫画主表为类型扩展表
- 新增小说扩展表（空壳或最小字段）
- 通用化作者/分类/标签关系表
- 通用化收藏/点赞关系表
- 通用化章节表
- 通用化章节互动表（点赞/购买/下载）
- 统一评论表设计（作品评论 + 章节评论）
- 同步调整现有漫画服务与接口
- 数据迁移方案设计
- **BREAKING**: 数据库结构变更，需要迁移脚本

## Impact
- Affected specs: 作品模块、章节模块、评论模块、用户互动模块
- Affected code:
  - `prisma/models/work/` - 所有 Prisma 模型
  - `libs/content/src/comic/` - 漫画服务层
  - `libs/base/src/enum/` - 基础枚举
  - `apps/app-api/src/modules/comic/` - 客户端接口
  - `apps/admin-api/src/modules/content-management/comic/` - 管理端接口
  - `prisma/seed/modules/work/` - 种子数据

## ADDED Requirements

### Requirement: Work 基表模型
The system SHALL provide a Work base table that contains common fields for all work types (comic/novel).

#### Scenario: Work 基表创建
- **WHEN** creating a new work (comic or novel)
- **THEN** the Work table SHALL contain: name, alias, cover, description, language, region, ageRating, serialStatus, publisher, originalSource, copyright, disclaimer, isPublished, isRecommended, isHot, isNew, popularity, rating, recommendWeight, viewCount, favoriteCount, likeCount, ratingCount, publishAt, lastUpdated, remark, createdAt, updatedAt, deletedAt
- **AND** Work.type SHALL identify work type (comic/novel)
- **AND** Work SHALL NOT duplicate fields with extension tables

### Requirement: Work Type Enum
The system SHALL provide WorkTypeEnum in base enum package.

#### Scenario: 枚举导出
- **WHEN** importing from `@libs/base/enum`
- **THEN** WorkTypeEnum SHALL be available with values: COMIC, NOVEL

### Requirement: WorkComic Extension Table
The system SHALL transform WorkComic to an extension table with one-to-one relation to Work.

#### Scenario: 漫画扩展表关联
- **WHEN** querying comic data
- **THEN** WorkComic SHALL have workId foreign key linking to Work
- **AND** WorkComic SHALL NOT contain fields already in Work (serialStatus, publisher, originalSource, copyright, disclaimer)
- **AND** WorkComic SHALL preserve comic-specific indexes

### Requirement: WorkNovel Extension Table
The system SHALL provide a minimal WorkNovel extension table for future expansion.

#### Scenario: 小说扩展表预留
- **WHEN** creating novel extension table
- **THEN** WorkNovel SHALL have workId foreign key linking to Work
- **AND** WorkNovel SHALL contain only workId and timestamps

### Requirement: Generic Author/Category/Tag Relation Tables
The system SHALL provide generic relation tables for author, category, and tag associations.

#### Scenario: 作者关系通用化
- **WHEN** associating work with author
- **THEN** WorkAuthorRelation SHALL use workId as primary association
- **AND** WorkAuthorRelation SHALL have sortOrder field
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
- **THEN** WorkFavorite SHALL use workId and appUserId as core fields
- **AND** WorkFavorite SHALL have unique constraint on (workId, appUserId)

#### Scenario: 点赞关系通用化
- **WHEN** user likes a work
- **THEN** WorkLike SHALL use workId and appUserId as core fields
- **AND** WorkLike SHALL have unique constraint on (workId, appUserId)

### Requirement: Generic Chapter Table
The system SHALL provide a generic chapter table for both comic and novel.

#### Scenario: 通用章节创建
- **WHEN** creating a chapter
- **THEN** WorkChapter SHALL use workId as primary association
- **AND** WorkChapter SHALL have workType field to distinguish work type
- **AND** WorkChapter SHALL contain: title, subtitle, description, sortOrder, isPublished, isPreview, canComment, publishAt, viewCount, likeCount, commentCount, purchaseCount, readRule, downloadRule, readPoints, downloadPoints, requiredReadLevelId, requiredDownloadLevelId
- **AND** comic chapters SHALL have contents (JSON for image URLs)
- **AND** novel chapters SHALL have content (text content, for future expansion)

### Requirement: Generic Chapter Interaction Tables
The system SHALL provide generic chapter interaction tables (like, purchase, download).

#### Scenario: 章节点赞通用化
- **WHEN** user likes a chapter
- **THEN** WorkChapterLike SHALL use workId + chapterId + appUserId as core fields
- **AND** WorkChapterLike SHALL have workType field

#### Scenario: 章节购买通用化
- **WHEN** user purchases a chapter
- **THEN** WorkChapterPurchase SHALL use workId + chapterId + appUserId as core fields
- **AND** WorkChapterPurchase SHALL have workType field

#### Scenario: 章节下载通用化
- **WHEN** user downloads a chapter
- **THEN** WorkChapterDownload SHALL use workId + chapterId + appUserId as core fields
- **AND** WorkChapterDownload SHALL have workType field

### Requirement: Unified Comment Table
The system SHALL provide a unified comment table for both work comments and chapter comments.

#### Scenario: 作品评论
- **WHEN** user comments on a work
- **THEN** WorkComment SHALL have workId (required), workType (required), chapterId (null)
- **AND** chapterId IS NULL indicates work comment

#### Scenario: 章节评论
- **WHEN** user comments on a chapter
- **THEN** WorkComment SHALL have workId (required), workType (required), chapterId (required)
- **AND** chapterId NOT NULL indicates chapter comment

#### Scenario: 评论审核与举报
- **WHEN** comment needs review or report
- **THEN** WorkComment SHALL support audit workflow (auditStatus, auditReason, auditAt, auditById, auditRole)
- **AND** WorkCommentReport SHALL support report handling

### Requirement: Comic Service Refactoring
The system SHALL refactor comic services to work with Work + WorkComic structure.

#### Scenario: 漫画创建
- **WHEN** creating a comic
- **THEN** service SHALL create Work first, then create WorkComic in transaction
- **AND** service SHALL maintain original DTO interface

#### Scenario: 漫画更新
- **WHEN** updating a comic
- **THEN** service SHALL update common fields in Work
- **AND** service SHALL update comic-specific fields in WorkComic

#### Scenario: 漫画查询
- **WHEN** querying comic list or detail
- **THEN** service SHALL join Work + WorkComic
- **AND** service SHALL return combined result

### Requirement: Data Migration
The system SHALL provide data migration scripts with rollback support.

#### Scenario: 数据迁移执行
- **WHEN** executing migration
- **THEN** migration SHALL create Work records from existing WorkComic data
- **AND** migration SHALL migrate all relation tables
- **AND** migration SHALL support rollback

## MODIFIED Requirements

### Requirement: Enum Naming Convention
All enum types SHALL be renamed from Comic* to Work* pattern.
- ComicSerialStatusEnum -> WorkSerialStatusEnum
- ComicChapterCommentAuditStatusEnum -> WorkCommentAuditStatusEnum
- etc.

### Requirement: DTO Field Updates
All DTOs SHALL be updated to match new data structure.
- comicId -> workId where applicable
- Add workType field where needed

## REMOVED Requirements

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
