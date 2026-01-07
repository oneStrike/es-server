# CONSENSUS - 论坛板块扁平化改造

## 需求描述

### 核心需求
将论坛板块功能从两级层级结构改造为扁平化+分组结构：

1. **去掉层级**：删除板块的层级关系，只支持一级板块
2. **增加板块分组**：引入板块分组功能，用于组织和管理板块
3. **支持排序**：板块和分组都支持排序功能
4. **不需要权限**：分组不需要权限控制
5. **允许板块不分组**：板块可以不属于任何分组（groupId 为 null）
6. **需要迁移**：需要将现有的层级数据迁移到新的分组结构

### 业务场景
- 管理员可以创建分组，用于组织相关板块
- 管理员可以创建板块，并选择是否归属到某个分组
- 用户可以查看按分组组织的板块列表
- 管理员可以调整板块和分组的排序
- 管理员可以将板块在不同分组之间移动

### 非功能需求
- 查询性能不低于改造前
- 数据库索引合理
- 避免N+1查询问题
- 保持API接口兼容性

## 验收标准

### 功能验收标准

#### 1. 板块分组功能
- ✅ 可以创建板块分组
- ✅ 可以更新板块分组信息
- ✅ 可以删除板块分组（删除时关联板块的 groupId 设置为 null）
- ✅ 可以查询板块分组列表
- ✅ 可以查询单个板块分组详情

#### 2. 板块功能
- ✅ 可以创建板块，并选择是否归属到某个分组
- ✅ 可以更新板块信息，包括修改所属分组
- ✅ 可以删除板块
- ✅ 可以查询板块列表（支持按分组查询）
- ✅ 可以查询单个板块详情
- ✅ 板块可以不属于任何分组（groupId 为 null）

#### 3. 排序功能
- ✅ 分组支持排序（sortOrder 字段）
- ✅ 板块支持排序（sortOrder 字段）
- ✅ 板块在分组内排序

#### 4. 数据迁移
- ✅ 现有的主板块（level=0）成功转换为分组
- ✅ 现有的子板块（level=1）成功转换为该分组下的板块
- ✅ 保留原有的排序权重
- ✅ 保留原有的统计数据（topicCount、replyCount）
- ✅ 保留原有的板块信息（name、description、icon 等）

#### 5. 查询功能
- ✅ 可以查询所有分组及其关联的板块
- ✅ 可以查询未分组的板块
- ✅ 可以查询某个分组下的板块
- ✅ 查询结果按排序权重排序

### 性能验收标准
- ✅ 查询性能不低于改造前
- ✅ 数据库索引合理（groupId、sortOrder、isEnabled）
- ✅ 避免N+1查询问题（使用 include 或 select 优化）
- ✅ 查询响应时间 < 500ms（单次查询）

### 代码质量验收标准
- ✅ 代码符合项目规范（ESLint 检查通过）
- ✅ TypeScript 类型检查通过（tsc --noEmit）
- ✅ 遵循 NestJS 最佳实践
- ✅ 使用装饰器进行验证和文档
- ✅ 代码注释清晰（中文）

### 数据完整性验收标准
- ✅ 数据迁移后，所有板块数据完整
- ✅ 数据迁移后，所有统计数据准确
- ✅ 数据迁移后，所有关联关系正确
- ✅ 数据迁移后，数据库约束正确

## 技术实现方案

### 数据模型设计

#### ForumSectionGroup（板块分组表）
```prisma
model ForumSectionGroup {
  id          Int            @id @default(autoincrement())
  name        String         @db.VarChar(50)
  description String?        @db.VarChar(200)
  sortOrder   Int            @default(0) @map("sort_order")
  isEnabled   Boolean        @default(true) @map("is_enabled")
  icon        String?        @db.VarChar(255)
  createdAt   DateTime       @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime       @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt   DateTime?      @map("deleted_at") @db.Timestamptz(6)
  
  sections    ForumSection[]
  
  @@index([sortOrder])
  @@index([isEnabled])
  @@index([deletedAt])
  @@map("forum_section_group")
}
```

#### ForumSection（板块表 - 修改后）
```prisma
model ForumSection {
  id                Int              @id @default(autoincrement())
  name              String           @db.VarChar(50)
  groupId           Int?             @map("group_id")
  icon              String?          @db.VarChar(255)
  sortOrder         Int              @default(0) @map("sort_order")
  isEnabled         Boolean          @default(true) @map("is_enabled")
  topicReviewPolicy Int              @default(1) @map("topic_review_policy")
  userLevelRuleId   Int?             @map("user_level_rule_id")
  topicCount        Int              @default(0) @map("topic_count")
  replyCount        Int              @default(0) @map("reply_count")
  lastPostAt        DateTime?        @map("last_post_at") @db.Timestamptz(6)
  lastTopicId       Int?             @map("last_topic_id")
  description       String?          @db.VarChar(500)
  remark            String?          @db.VarChar(500)
  createdAt         DateTime         @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime         @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt         DateTime?        @map("deleted_at") @db.Timestamptz(6)
  
  group             ForumSectionGroup? @relation(fields: [groupId], references: [id])
  moderatorSections ForumModeratorSection[]
  lastTopic         ForumTopic?             @relation("LastTopic", fields: [lastTopicId], references: [id])
  userLevelRule     ForumLevelRule?         @relation(fields: [userLevelRuleId], references: [id])
  topics            ForumTopic[]
  
  @@index([sortOrder])
  @@index([isEnabled])
  @@index([topicCount])
  @@index([lastPostAt])
  @@index([createdAt])
  @@index([deletedAt])
  @@index([groupId])
  @@map("forum_section")
}
```

### 数据迁移方案

#### 迁移策略
1. **创建新表**：创建 `forum_section_group` 表
2. **迁移主板块到分组**：将 `level=0` 的板块数据迁移到 `forum_section_group` 表
3. **更新子板块**：将 `level=1` 的板块的 `groupId` 设置为对应的分组ID
4. **删除层级字段**：删除 `parentId`、`level`、`path`、`inheritPermission` 字段
5. **删除自关联**：删除 `parent` 和 `children` 关联

#### 迁移SQL
```sql
-- 1. 创建板块分组表
CREATE TABLE "forum_section_group" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER DEFAULT 0,
    "is_enabled" BOOLEAN DEFAULT true,
    "icon" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) DEFAULT NOW(),
    "deleted_at" TIMESTAMPTZ(6)
);

-- 创建索引
CREATE INDEX "forum_section_group_sort_order_idx" ON "forum_section_group"("sort_order");
CREATE INDEX "forum_section_group_is_enabled_idx" ON "forum_section_group"("is_enabled");
CREATE INDEX "forum_section_group_deleted_at_idx" ON "forum_section_group"("deleted_at");

-- 2. 迁移主板块到分组
INSERT INTO "forum_section_group" ("name", "description", "sort_order", "is_enabled", "icon", "created_at", "updated_at")
SELECT 
    "name",
    "description",
    "sort_order",
    "is_enabled",
    "icon",
    "created_at",
    "updated_at"
FROM "forum_section"
WHERE "level" = 0 AND "deleted_at" IS NULL;

-- 3. 更新子板块的 groupId
UPDATE "forum_section"
SET "group_id" = (
    SELECT "id" 
    FROM "forum_section_group" 
    WHERE "name" = (
        SELECT "name" 
        FROM "forum_section" AS parent 
        WHERE parent."id" = "forum_section"."parent_id"
    )
)
WHERE "level" = 1 AND "deleted_at" IS NULL;

-- 4. 删除层级字段
ALTER TABLE "forum_section" DROP COLUMN "parent_id";
ALTER TABLE "forum_section" DROP COLUMN "level";
ALTER TABLE "forum_section" DROP COLUMN "path";
ALTER TABLE "forum_section" DROP COLUMN "inherit_permission";

-- 5. 添加 groupId 索引
CREATE INDEX "forum_section_group_id_idx" ON "forum_section"("group_id");
```

### API接口设计

#### 板块分组接口
- `POST /api/forum-section-group` - 创建分组
- `PUT /api/forum-section-group/:id` - 更新分组
- `DELETE /api/forum-section-group/:id` - 删除分组
- `GET /api/forum-section-group` - 查询分组列表
- `GET /api/forum-section-group/:id` - 查询分组详情

#### 板块接口
- `POST /api/forum-section` - 创建板块
- `PUT /api/forum-section/:id` - 更新板块
- `DELETE /api/forum-section/:id` - 删除板块
- `GET /api/forum-section` - 查询板块列表（支持按分组查询）
- `GET /api/forum-section/:id` - 查询板块详情

### 查询优化策略

#### 避免N+1查询
```typescript
// 查询分组及其关联的板块
const groups = await prisma.forumSectionGroup.findMany({
  where: { deletedAt: null },
  include: {
    sections: {
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    },
  },
  orderBy: { sortOrder: 'asc' },
})
```

#### 索引优化
- `forum_section_group.sort_order` - 分组排序查询
- `forum_section_group.is_enabled` - 启用状态查询
- `forum_section_group.deleted_at` - 软删除查询
- `forum_section.group_id` - 按分组查询板块
- `forum_section.sort_order` - 板块排序查询
- `forum_section.is_enabled` - 启用状态查询

## 技术约束

### 技术栈约束
- **框架**: NestJS 11.x
- **语言**: TypeScript 5.x
- **数据库**: PostgreSQL
- **ORM**: Prisma 7.x
- **验证**: class-validator
- **API文档**: Swagger

### 代码规范约束
- 使用 Conventional Commits 提交规范
- ESLint + Prettier 代码质量检查
- TypeScript 严格类型检查
- 遵循 NestJS 最佳实践
- 使用装饰器进行验证和文档
- 代码注释使用中文

### 性能约束
- 查询性能不低于改造前
- 需要添加适当的索引
- 避免N+1查询问题
- 单次查询响应时间 < 500ms

### 兼容性约束
- 保持API接口兼容性
- 保持数据完整性
- 保持现有功能不受影响

## 任务边界限制

### 包含的任务
- ✅ 创建 `ForumSectionGroup` Prisma 模型
- ✅ 修改 `ForumSection` Prisma 模型
- ✅ 创建板块分组相关的 DTO
- ✅ 修改板块相关的 DTO
- ✅ 创建板块分组 Service
- ✅ 修改板块 Service
- ✅ 创建板块分组 Controller
- ✅ 修改板块 Controller
- ✅ 创建数据迁移脚本
- ✅ 更新 seed 数据
- ✅ 运行迁移和验证

### 不包含的任务
- ❌ 前端界面适配
- ❌ 其他模块的板块相关功能修改（如权限、审核等）
- ❌ 性能优化（除非必要）
- ❌ 单元测试（除非核心功能）

## 集成方案

### 与现有系统集成
- 复用现有的 RepositoryService
- 复用现有的验证装饰器
- 复用现有的分页逻辑
- 复用现有的软删除逻辑
- 复用现有的审计日志

### 数据一致性保证
- 使用数据库事务保证数据一致性
- 使用外键约束保证关联关系
- 使用软删除保证数据可追溯
- 使用索引保证查询性能

### 错误处理
- 使用 BadRequestException 处理业务异常
- 使用 NotFoundException 处理资源不存在
- 使用 ConflictException 处理数据冲突
- 使用统一的异常过滤器

## 不确定性确认

### 已确认的问题
1. ✅ 分组排序：全局排序
2. ✅ 板块排序：在分组内排序
3. ✅ 数据迁移策略：主板块转换为分组，子板块转换为板块
4. ✅ 权限处理：删除 inheritPermission 字段
5. ✅ 板块移动：支持通过修改 groupId 字段实现
6. ✅ 分组删除：将板块的 groupId 设置为 null
7. ✅ 板块查询：支持按分组查询板块
8. ✅ 允许板块不分组：groupId 为可选（nullable）

### 无遗留问题
所有不确定性已解决，可以进入下一阶段。

## 风险评估

### 技术风险
- **数据迁移风险**：现有数据可能无法完美映射到新结构
  - 缓解措施：创建详细的迁移脚本，并在测试环境验证

- **性能风险**：新的查询结构可能影响性能
  - 缓解措施：添加适当的索引，优化查询逻辑

- **兼容性风险**：现有API可能需要调整
  - 缓解措施：保持API接口不变，只修改内部实现

### 业务风险
- **用户体验风险**：前端界面可能需要调整
  - 缓解措施：保持API接口不变，前端可以逐步适配

## 下一步行动

1. 创建 DESIGN 文档，设计新架构
2. 创建 TASK 文档，拆分子任务
3. 执行实施
4. 验收测试
5. 生成 FINAL 文档
