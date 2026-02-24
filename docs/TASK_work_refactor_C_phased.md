# 方案C 分阶段执行计划

## 概述

将重构任务拆分为 **4 个独立阶段**，每个阶段可独立完成、独立验证、独立上线。

## 阶段划分

```
阶段1: 数据模型层新增（低风险）
   ↓
阶段2: 服务层新增（低风险，不影响现有功能）
   ↓
阶段3: Controller 切换（中风险，需要测试验证）
   ↓
阶段4: 数据迁移与清理（高风险，需要数据迁移）
```

---

## 阶段1: 数据模型层新增

**目标**: 新增通用化数据模型，不影响现有功能

**特点**:
- **仅新增** Prisma 模型文件
- 不删除/修改现有模型
- 不修改任何服务代码
- 可独立开发、独立验证

**任务清单**:

| 任务 | 说明 | 风险 |
|-----|-----|-----|
| 1.1 | 新增 Work 基表与 WorkTypeEnum | 低 |
| 1.2 | 新增 WorkNovel 扩展表 | 低 |
| 1.3 | 新增通用关系表（author/category/tag） | 低 |
| 1.4 | 新增通用互动表（favorite/like） | 低 |
| 1.5 | 新增 WorkChapter 通用章节表 | 低 |
| 1.6 | 新增章节互动表（like/purchase/download） | 低 |
| 1.7 | 新增 WorkComment 统一评论表 | 低 |
| 1.8 | 执行 Prisma 生成 | 低 |

**新增文件清单**:

```
prisma/models/work/
├── work.prisma                              # 新增
├── work-author-relation.prisma              # 新增
├── work-category-relation.prisma            # 新增
├── work-tag-relation.prisma                 # 新增
├── work-favorite.prisma                     # 新增
├── work-like.prisma                         # 新增
├── work-chapter.prisma                      # 新增
├── work-chapter-like.prisma                 # 新增
├── work-chapter-purchase.prisma             # 新增
├── work-chapter-download.prisma             # 新增
├── work-comment.prisma                      # 新增
├── work-comment-report.prisma               # 新增
└── novel/
    └── work-novel.prisma                    # 新增

libs/base/src/enum/
├── work-type.enum.ts                        # 新增
└── index.ts                                 # 修改（导出新枚举）
```

**交付物**:
- 新的数据模型可正常生成
- 现有功能完全不受影响

**验收标准**:
- `pnpm prisma:update` 执行成功
- `pnpm typecheck` 通过
- 现有漫画功能正常运行

---

## 阶段2: 服务层新增

**目标**: 新增通用服务层，不修改现有服务

**特点**:
- 新增代码，不删除/修改现有代码
- 新服务与旧服务并存
- 可独立开发、独立测试

**任务清单**:

| 任务 | 说明 | 风险 |
|-----|-----|-----|
| 2.1 | 新增 WorkService（通用作品服务） | 低 |
| 2.2 | 新增 WorkChapterService（通用章节服务） | 低 |
| 2.3 | 新增 WorkCommentService（通用评论服务） | 低 |
| 2.4 | 新增 ComicContentService（图片内容服务） | 低 |
| 2.5 | 新增 NovelContentService（小说内容服务） | 低 |
| 2.6 | 新增相关 Module 和 DTO | 低 |

**新增文件清单**:

```
libs/content/src/work/
├── index.ts                                 # 新增（入口文件）
├── core/
│   ├── index.ts                             # 新增
│   ├── work.service.ts                      # 新增
│   ├── work.module.ts                       # 新增
│   ├── work.constant.ts                     # 新增
│   └── dto/
│       └── work.dto.ts                      # 新增
├── chapter/
│   ├── index.ts                             # 新增
│   ├── work-chapter.service.ts              # 新增
│   ├── work-chapter.module.ts               # 新增
│   ├── work-chapter.constant.ts             # 新增
│   └── dto/
│       └── work-chapter.dto.ts              # 新增
├── comment/
│   ├── index.ts                             # 新增
│   ├── work-comment.service.ts              # 新增
│   ├── work-comment.module.ts               # 新增
│   ├── work-comment.constant.ts             # 新增
│   ├── work-comment.types.ts                # 新增
│   └── dto/
│       └── work-comment.dto.ts              # 新增
└── content/
    ├── index.ts                             # 新增
    ├── content.module.ts                    # 新增
    ├── comic-content.service.ts             # 新增
    ├── novel-content.service.ts             # 新增
    └── dto/
        └── content.dto.ts                   # 新增
```

**交付物**:
- 新的服务层代码完成
- 现有功能完全不受影响

**验收标准**:
- `pnpm typecheck` 通过
- `pnpm lint` 通过
- 新服务可正常注入使用
- 现有漫画功能正常运行

---

## 阶段3: Controller 切换

**目标**: Controller 层切换到新服务，删除旧服务

**特点**:
- 修改 Controller 调用新服务
- 删除旧服务代码
- 需要完整功能测试

**任务清单**:

| 任务 | 说明 | 风险 |
|-----|-----|-----|
| 3.1 | 漫画 Controller 切换到 WorkService | 中 |
| 3.2 | 漫画章节 Controller 切换到 WorkChapterService | 中 |
| 3.3 | 漫画评论 Controller 切换到 WorkCommentService | 中 |
| 3.4 | 漫画内容 Controller 切换到 ComicContentService | 中 |
| 3.5 | 新增小说 Controller（完整模块） | 低 |
| 3.6 | 删除旧 comic 服务层代码 | 中 |

**修改文件清单**:

```
apps/app-api/src/modules/comic/
├── comic.controller.ts                      # 修改
├── chapter.controller.ts                    # 修改
├── comment.controller.ts                    # 修改
└── comic.module.ts                          # 修改

apps/admin-api/src/modules/content-management/comic/
├── comic.controller.ts                      # 修改
├── chapter.controller.ts                    # 修改
├── comment.controller.ts                    # 修改
├── content.controller.ts                    # 修改
└── comic.module.ts                          # 修改
```

**新增文件清单**:

```
apps/app-api/src/modules/novel/
├── index.ts                                 # 新增
├── novel.controller.ts                      # 新增
├── chapter.controller.ts                    # 新增
├── comment.controller.ts                    # 新增
└── novel.module.ts                          # 新增

apps/admin-api/src/modules/content-management/novel/
├── index.ts                                 # 新增
├── novel.controller.ts                      # 新增
├── chapter.controller.ts                    # 新增
├── comment.controller.ts                    # 新增
├── content.controller.ts                    # 新增
└── novel.module.ts                          # 新增
```

**删除文件清单**:

```
libs/content/src/comic/                      # 删除整个目录
├── index.ts
├── core/
│   ├── index.ts
│   ├── comic.service.ts
│   ├── comic.module.ts
│   ├── comic.constant.ts
│   └── dto/
│       └── comic.dto.ts
├── chapter/
│   ├── index.ts
│   ├── comic-chapter.service.ts
│   ├── comic-chapter.module.ts
│   ├── comic-chapter.constant.ts
│   └── dto/
│       └── comic-chapter.dto.ts
├── chapter-comment/
│   ├── index.ts
│   ├── comic-chapter-comment.service.ts
│   ├── comic-chapter-comment.module.ts
│   ├── comic-chapter-comment.constant.ts
│   ├── comic-chapter-comment.types.ts
│   └── dto/
│       └── comic-chapter-comment.dto.ts
└── chapter-content/
    ├── index.ts
    ├── chapter-content.service.ts
    ├── chapter-content.module.ts
    └── dto/
        └── chapter-content.dto.ts
```

**交付物**:
- 漫画功能使用新服务
- 小说功能可用
- 旧代码已清理

**验收标准**:
- 漫画所有接口功能正常
- 小说所有接口功能正常
- `pnpm typecheck` 通过
- `pnpm lint` 通过

---

## 阶段4: 数据迁移与清理

**目标**: 迁移现有数据到新表结构，删除旧表，改造种子文件

**特点**:
- 需要数据迁移脚本
- 需要回滚方案
- 需要在维护窗口执行
- 删除旧 Prisma 模型文件
- 改造种子文件适配新表结构

**任务清单**:

| 任务 | 说明 | 风险 |
|-----|-----|-----|
| 4.1 | 改造 WorkComic 为扩展表 | 高 |
| 4.2 | 删除旧 Prisma 模型文件 | 高 |
| 4.3 | 改造种子文件 | 中 |
| 4.4 | 编写数据迁移脚本 | 高 |
| 4.5 | 编写数据验证脚本 | 中 |
| 4.6 | 编写回滚脚本 | 高 |
| 4.7 | 执行迁移与验证 | 高 |

**修改文件清单**:

```
prisma/models/work/comic/
└── work-comic.prisma                        # 修改（改为扩展表）

prisma/models/app/
└── app-user.prisma                          # 修改（关联字段改为通用 Work 关联）

prisma/models/work/author/
└── work-author.prisma                       # 修改（关联字段改为通用关系）

prisma/models/work/
├── work-category.prisma                     # 修改（关联字段改为通用关系）
└── work-tag.prisma                          # 修改（关联字段改为通用关系）

prisma/models/app/
└── user-level-rule.prisma                   # 修改（章节关联改为通用关系）

prisma/seed/modules/work/
├── comic.ts                                  # 修改（改为 Work + WorkComic）
├── comic-author.ts                           # 修改（改为 WorkAuthorRelation）
├── comic-category.ts                         # 修改（改为 WorkCategoryRelation）
├── comic-tag.ts                              # 修改（改为 WorkTagRelation）
├── comic-chapter.ts                          # 修改（改为 WorkChapter）
└── index.ts                                  # 修改（导出新函数）
```

**AppUser 模型关联字段改造**:

```
原字段                              →  新字段
─────────────────────────────────────────────────────
comicFavorites: WorkComicFavorite[] → workFavorites: WorkFavorite[]
comicLikes: WorkComicLike[]         → workLikes: WorkLike[]
comicChapterLikes: WorkComicChapterLike[] → chapterLikes: WorkChapterLike[]
comicChapterPurchases: WorkComicChapterPurchase[] → chapterPurchases: WorkChapterPurchase[]
comicChapterDownloads: WorkComicChapterDownload[] → chapterDownloads: WorkChapterDownload[]
comicChapterComments: WorkComicChapterComment[] → workComments: WorkComment[]
comicChapterCommentReports → commentReports: WorkCommentReport[]
handledComicChapterCommentReports → handledCommentReports: WorkCommentReport[]
```

**基础模型关联字段改造**:

```
模型          原字段                          →  新字段
─────────────────────────────────────────────────────────────
WorkAuthor    comicAuthors: WorkComicAuthor[] → authorRelations: WorkAuthorRelation[]
WorkCategory  workComicCategories: WorkComicCategory[] → categoryRelations: WorkCategoryRelation[]
WorkTag       comicTags: WorkComicTag[]       → tagRelations: WorkTagRelation[]
UserLevelRule comicChaptersAsDownloadLevel: WorkComicChapter[] → chaptersAsDownloadLevel: WorkChapter[]
UserLevelRule comicChaptersAsReadLevel: WorkComicChapter[] → chaptersAsReadLevel: WorkChapter[]
```

**删除文件清单**:

```
prisma/models/work/comic/
├── work-comic-author.prisma                 # 删除
├── work-comic-category.prisma               # 删除
├── work-comic-tag.prisma                    # 删除
├── work-comic-favorite.prisma               # 删除
├── work-comic-like.prisma                   # 删除
├── work-comic-chapter.prisma                # 删除
├── work-comic-chapter-like.prisma           # 删除
├── work-comic-chapter-purchase.prisma       # 删除
├── work-comic-chapter-download.prisma       # 删除
├── work-comic-chapter-comment.prisma        # 删除
└── work-comic-chapter-comment-report.prisma # 删除
```

**新增文件清单**:

```
scripts/migrations/
├── work-base-backfill.ts                    # 新增（数据迁移脚本）
├── work-base-verify.ts                      # 新增（数据验证脚本）
└── work-base-rollback.ts                    # 新增（回滚脚本）
```

**交付物**:
- 数据迁移完成
- 数据验证通过
- 回滚方案就绪
- 旧模型文件已删除

**验收标准**:
- 所有数据迁移正确
- 所有接口功能正常
- 回滚脚本可正常执行
- `pnpm prisma:update` 执行成功
- `pnpm typecheck` 通过

---

## 执行建议

### 推荐执行顺序

```
Week 1: 阶段1（数据模型层新增）
   - 可随时执行，无风险

Week 2: 阶段2（服务层新增）
   - 可随时执行，无风险
   - 建议完成后进行代码审查

Week 3: 阶段3（Controller 切换）
   - 需要完整测试
   - 建议在测试环境验证后再上线

Week 4: 阶段4（数据迁移与清理）
   - 需要维护窗口
   - 需要数据备份
   - 建议先在测试环境演练
```

### 可并行执行

- 阶段1 和 阶段2 可以并行开发
- 阶段3 需要等待阶段1、2完成
- 阶段4 需要等待阶段3完成并验证通过

### 回滚策略

| 阶段 | 回滚方式 |
|-----|---------|
| 阶段1 | 删除新增的 Prisma 模型文件 |
| 阶段2 | 删除新增的服务代码 |
| 阶段3 | Git 回滚到阶段2完成状态 |
| 阶段4 | 执行回滚脚本 |

---

## 任务对照表

| 原任务 | 分阶段任务 | 说明 |
|-------|-----------|-----|
| T01 Work基表与枚举 | 1.1 | ✅ 已覆盖 |
| T02 漫画扩展表改造 | 4.1 | ✅ 已覆盖 |
| T03 小说扩展表 | 1.2 | ✅ 已覆盖 |
| T04 通用关系表 | 1.3 + 4.2删除 | ✅ 已覆盖 |
| T05 通用互动表 | 1.4 + 4.2删除 | ✅ 已覆盖 |
| T06 通用章节表 | 1.5 + 4.2删除 | ✅ 已覆盖 |
| T07 Prisma生成 | 1.8 | ✅ 已覆盖 |
| T08 通用作品服务 | 2.1 | ✅ 已覆盖 |
| T09 通用章节服务 | 2.2 | ✅ 已覆盖 |
| T10 通用评论服务 | 2.3 | ✅ 已覆盖 |
| T11 内容处理服务 | 2.4, 2.5, 2.6 | ✅ 已覆盖 |
| T12 漫画Controller重构 | 3.1, 3.2, 3.3, 3.4 | ✅ 已覆盖 |
| T13 小说Controller新增 | 3.5 | ✅ 已覆盖 |
| T14 章节互动表 | 1.6 + 4.2删除 | ✅ 已覆盖 |
| T15 统一评论表 | 1.7 + 4.2删除 | ✅ 已覆盖 |
| T16 删除旧服务 | 3.6 | ✅ 已覆盖 |
| T17 数据迁移 | 4.4, 4.5, 4.7 | ✅ 已覆盖 |
| T18 测试验证 | 各阶段验收标准 | ✅ 已覆盖 |
| **种子文件改造** | 4.3 | ✅ 已覆盖（新增）|
| **AppUser关联字段改造** | 4.1 | ✅ 已覆盖（新增）|
| **基础模型关联字段改造** | 4.1 | ✅ 已覆盖（新增）|

---

## 总结

| 阶段 | 工作量 | 风险 | 可独立交付 |
|-----|-------|-----|-----------|
| 阶段1 | 1-2天 | 低 | ✅ 是 |
| 阶段2 | 3-5天 | 低 | ✅ 是 |
| 阶段3 | 2-3天 | 中 | ✅ 是 |
| 阶段4 | 2-3天 | 高 | ✅ 是 |

**总工作量**: 约 8-13 天

**建议**: 先完成阶段1-3，阶段4 可根据实际情况决定是否执行（如果不需要迁移旧数据，可以跳过）
