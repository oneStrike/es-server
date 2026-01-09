# 敏感词模块优化 - 共识文档

## 1. 需求描述

### 1.1 项目背景

当前敏感词管理模块仅实现了基础的CRUD操作,缺乏核心的敏感词检测和过滤功能。该模块未与内容创建流程集成,无缓存机制,且数据模型存在不一致问题。基于社区最佳实践,需要对模块进行全面优化,以提升业务逻辑和代码实现质量。

### 1.2 核心需求

**功能需求:**
1. 实现高效的敏感词检测功能(基于AC自动机算法)
2. 支持精确匹配和模糊匹配(拼音、变形词)
3. 实现分级处理策略(严重级别标记待审核,其他级别标记敏感词触发)
4. 集成到主题和回复创建流程
5. 实现Redis缓存机制
6. 提供批量导入/导出功能
7. 实现详细的统计数据(按时间、类型、级别)
8. 在相关记录上标记敏感词命中信息(操作人、时间、类型、敏感词详情)

**非功能需求:**
1. 性能目标: < 100ms (1000个敏感词,1000字文本)
2. 并发能力: > 1000 QPS
3. 支持敏感词数量: 10,000+
4. 遵循现有代码模式和架构规范
5. 确保数据一致性和安全性

### 1.3 验收标准

**功能验收:**
- ✅ 敏感词检测功能正常工作,准确识别敏感词
- ✅ 支持精确匹配和模糊匹配,优先级正确
- ✅ 分级处理策略正确执行
- ✅ 主题和回复创建时自动进行敏感词检测
- ✅ 缓存机制正常工作,缓存失效策略正确
- ✅ 批量导入/导出功能正常
- ✅ 统计数据准确,支持按时间、类型、级别统计
- ✅ 相关记录正确标记敏感词命中信息

**性能验收:**
- ✅ 单次检测响应时间 < 100ms
- ✅ 并发检测能力 > 1000 QPS
- ✅ 支持10,000+敏感词

**代码质量验收:**
- ✅ 代码遵循现有项目规范
- ✅ 代码通过lint和typecheck
- ✅ 单元测试覆盖率 > 80%
- ✅ 集成测试通过

## 2. 技术实现方案

### 2.1 核心算法: AC自动机

**算法原理:**
- AC自动机(Aho-Corasick Automaton)是一种多模式字符串匹配算法
- 时间复杂度: O(n),其中n为文本长度
- 空间复杂度: O(m*n),其中m为敏感词数量,n为平均敏感词长度
- 支持中文敏感词检测

**实现方案:**
1. 构建Trie树:将所有敏感词构建成Trie树结构
2. 构建失败指针:为每个节点构建失败指针,用于匹配失败时的跳转
3. 匹配过程:遍历文本,利用失败指针快速跳转,避免重复匹配

**代码结构:**
```typescript
class ACAutomaton {
  private root: TrieNode
  
  build(words: string[]): void
  match(text: string): MatchResult[]
  clear(): void
}

interface MatchResult {
  word: string
  position: number
  level: number
  type: number
}
```

### 2.2 匹配模式策略

**精确匹配:**
- 完全匹配敏感词
- 最高优先级
- 使用AC自动机实现

**模糊匹配:**
- 支持拼音匹配
- 支持变形词匹配
- 相似度阈值: 0.8(可配置)
- 次优先级

**优先级:**
精确匹配 > 模糊匹配

### 2.3 分级处理策略

**严重级别(SEVERE = 1):**
- 标记为待审核
- 不允许发布
- 记录敏感词命中信息

**一般级别(GENERAL = 2):**
- 允许发布
- 标记触发了敏感词
- 记录敏感词命中信息

**轻微级别(LIGHT = 3):**
- 允许发布
- 标记触发了敏感词
- 记录敏感词命中信息

### 2.4 缓存机制

**多级缓存策略:**

**L1缓存(内存):**
- 存储AC自动机实例
- 应用启动时构建
- 敏感词更新时重建

**L2缓存(Redis):**
- 存储敏感词列表
- 缓存键: `sensitive_words:all`
- TTL: 1小时
- 敏感词更新时清除

**L3缓存(数据库):**
- 存储敏感词表
- 作为最终数据源

**缓存预热:**
- 应用启动时从数据库加载敏感词
- 构建AC自动机实例
- 写入Redis缓存

**缓存失效:**
- 敏感词创建/更新/删除时清除缓存
- 定期刷新(可选)

### 2.5 数据模型优化

**现有模型问题:**
- 缺少 `matchMode` 字段(迁移SQL中存在)
- 缺少 `hitCount` 字段用于统计
- 缺少 `lastHitAt` 字段用于追踪

**优化方案:**

**forum-sensitive-word.prisma:**
```prisma
model ForumSensitiveWord {
  id          Int      @id @default(autoincrement())
  word        String   @unique @db.VarChar(100)
  replaceWord String?  @map("replace_word") @db.VarChar(100)
  matchMode   Int      @default(1) @map("match_mode") @db.SmallInt
  isEnabled   Boolean  @default(true) @map("is_enabled")
  remark      String?  @db.VarChar(500)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  level       Int      @default(2) @db.SmallInt
  type        Int      @default(5) @db.SmallInt
  version     Int      @default(0)
  hitCount    Int      @default(0) @map("hit_count")
  lastHitAt   DateTime? @map("last_hit_at") @db.Timestamptz(6)

  @@index([word])
  @@index([type])
  @@index([level])
  @@index([isEnabled])
  @@index([createdAt])
  @@map("forum_sensitive_word")
}
```

**forum-topic.prisma:**
```prisma
model ForumTopic {
  // 现有字段...
  sensitiveWordHits Json? @map("sensitive_word_hits") @db.JsonB
  
  @@map("forum_topic")
}
```

**forum-reply.prisma:**
```prisma
model ForumReply {
  // 现有字段...
  sensitiveWordHits Json? @map("sensitive_word_hits") @db.JsonB
  
  @@map("forum_reply")
}
```

**敏感词命中信息结构:**
```typescript
interface SensitiveWordHit {
  operatorId: number
  operatorName: string
  operatedAt: string
  operationType: 'create' | 'update'
  hits: Array<{
    word: string
    level: number
    type: number
    position: number
  }>
}
```

### 2.6 集成方案

**主题创建集成:**
```typescript
async createForumTopic(dto: CreateForumTopicDto, userId: number) {
  // 1. 敏感词检测
  const detectionResult = await this.sensitiveWordService.detect({
    title: dto.title,
    content: dto.content
  })

  // 2. 根据检测结果决定处理策略
  if (detectionResult.hasSevere) {
    // 严重级别:标记为待审核
    dto.status = TopicStatus.PENDING_REVIEW
  }

  // 3. 创建主题
  const topic = await this.prisma.forumTopic.create({
    data: {
      ...dto,
      sensitiveWordHits: detectionResult.hits.length > 0 ? {
        operatorId: userId,
        operatorName: userName,
        operatedAt: new Date().toISOString(),
        operationType: 'create',
        hits: detectionResult.hits
      } : null
    }
  })

  // 4. 更新敏感词命中统计
  if (detectionResult.hits.length > 0) {
    await this.sensitiveWordService.updateHitCount(detectionResult.hits)
  }

  return topic
}
```

**回复创建集成:**
```typescript
async createForumReply(dto: CreateForumReplyDto, userId: number) {
  // 1. 敏感词检测
  const detectionResult = await this.sensitiveWordService.detect({
    content: dto.content
  })

  // 2. 根据检测结果决定处理策略
  if (detectionResult.hasSevere) {
    // 严重级别:标记为待审核
    dto.status = ReplyStatus.PENDING_REVIEW
  }

  // 3. 创建回复
  const reply = await this.prisma.forumReply.create({
    data: {
      ...dto,
      sensitiveWordHits: detectionResult.hits.length > 0 ? {
        operatorId: userId,
        operatorName: userName,
        operatedAt: new Date().toISOString(),
        operationType: 'create',
        hits: detectionResult.hits
      } : null
    }
  })

  // 4. 更新敏感词命中统计
  if (detectionResult.hits.length > 0) {
    await this.sensitiveWordService.updateHitCount(detectionResult.hits)
  }

  return reply
}
```

### 2.7 API设计

**敏感词检测API:**
```typescript
POST /api/sensitive-word/detect
Request: {
  text: string
  fields?: string[]
}
Response: {
  hasSensitive: boolean
  hasSevere: boolean
  hits: Array<{
    word: string
    level: number
    type: number
    position: number
  }>
}
```

**批量导入API:**
```typescript
POST /api/sensitive-word/import
Request: FormData {
  file: File
}
Response: {
  success: number
  failed: number
  errors: Array<{
    word: string
    error: string
  }>
}
```

**批量导出API:**
```typescript
GET /api/sensitive-word/export
Query: {
  type?: number
  level?: number
  format?: 'excel' | 'csv'
}
Response: File
```

**统计API:**
```typescript
GET /api/sensitive-word/statistics
Query: {
  startDate?: string
  endDate?: string
  type?: number
  level?: number
}
Response: {
  totalHits: number
  byType: Record<number, number>
  byLevel: Record<number, number>
  byDate: Record<string, number>
  topWords: Array<{
    word: string
    hitCount: number
  }>
}
```

## 3. 技术约束

### 3.1 技术栈约束

- **框架**: NestJS 11.1.9 + Fastify 5.6.2
- **数据库**: PostgreSQL (通过 Prisma ORM 7.2.0)
- **缓存**: Redis (通过 @keyv/redis 5.1.5)
- **语言**: TypeScript 5.9.3

### 3.2 代码规范约束

- 继承 `BaseService` 作为服务基类
- 使用装饰器进行DTO验证
- 使用Prisma扩展方法
- 使用事务处理复杂操作
- 使用依赖注入管理服务依赖
- 遵循现有的代码风格和命名规范

### 3.3 性能约束

- 单次检测响应时间 < 100ms
- 并发检测能力 > 1000 QPS
- 支持敏感词数量: 10,000+
- 内存占用: < 500MB (包含AC自动机实例)

### 3.4 安全约束

- 敏感词管理需要管理员权限
- 敏感词检测API需要认证
- 统计数据访问需要权限控制
- API密钥等敏感信息使用.env文件管理

### 3.5 数据一致性约束

- 敏感词更新时必须清除缓存
- 敏感词命中统计必须准确
- 主题和回复的敏感词标记必须与检测结果一致

## 4. 任务边界

### 4.1 包含范围

✅ **核心功能:**
- 实现AC自动机算法
- 实现敏感词检测功能
- 实现精确匹配和模糊匹配
- 实现分级处理策略
- 实现缓存机制
- 实现批量导入/导出
- 实现统计数据功能
- 集成到主题和回复创建流程

✅ **数据模型优化:**
- 修复 `matchMode` 字段缺失问题
- 添加 `hitCount` 字段
- 添加 `lastHitAt` 字段
- 添加 `sensitiveWordHits` 字段到主题和回复表

✅ **API开发:**
- 敏感词检测API
- 批量导入API
- 批量导出API
- 统计API

✅ **测试:**
- 单元测试
- 集成测试
- 性能测试

✅ **文档:**
- API文档
- 使用文档

### 4.2 不包含范围

❌ **其他模块重构:**
- 不涉及其他模块的重构
- 不涉及数据库迁移(仅提供迁移建议)

❌ **高级功能:**
- 不支持正则匹配
- 不支持敏感词分组
- 不支持敏感词版本管理(使用现有version字段)

❌ **前端开发:**
- 不涉及前端界面开发
- 不涉及前端集成

❌ **部署运维:**
- 不涉及部署配置
- 不涉及运维监控

## 5. 验收标准

### 5.1 功能验收

**敏感词检测:**
- [ ] 能够准确检测敏感词
- [ ] 支持精确匹配
- [ ] 支持模糊匹配(拼音、变形词)
- [ ] 优先级正确(精确匹配 > 模糊匹配)
- [ ] 返回正确的匹配结果

**分级处理:**
- [ ] 严重级别正确标记为待审核
- [ ] 一般级别正确标记敏感词触发
- [ ] 轻微级别正确标记敏感词触发
- [ ] 所有级别正确记录敏感词命中信息

**缓存机制:**
- [ ] 应用启动时正确构建AC自动机
- [ ] 敏感词更新时正确清除缓存
- [ ] 缓存命中率高(> 90%)

**集成功能:**
- [ ] 主题创建时正确进行敏感词检测
- [ ] 回复创建时正确进行敏感词检测
- [ ] 相关记录正确标记敏感词命中信息

**批量操作:**
- [ ] 批量导入功能正常
- [ ] 批量导出功能正常
- [ ] 支持Excel和CSV格式

**统计功能:**
- [ ] 统计数据准确
- [ ] 支持按时间统计
- [ ] 支持按类型统计
- [ ] 支持按级别统计
- [ ] 支持导出统计报表

### 5.2 性能验收

**响应时间:**
- [ ] 单次检测响应时间 < 100ms (1000个敏感词,1000字文本)
- [ ] 批量检测响应时间 < 500ms (10个文本)

**并发能力:**
- [ ] 并发检测能力 > 1000 QPS
- [ ] 系统稳定,无内存泄漏

**资源占用:**
- [ ] 内存占用 < 500MB (包含AC自动机实例)
- [ ] CPU占用合理(< 50%)

### 5.3 代码质量验收

**代码规范:**
- [ ] 代码通过lint检查
- [ ] 代码通过typecheck检查
- [ ] 代码遵循现有项目规范
- [ ] 代码注释清晰完整

**测试覆盖:**
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试通过
- [ ] 性能测试通过

**文档完整性:**
- [ ] API文档完整
- [ ] 使用文档完整
- [ ] 代码注释完整

### 5.4 安全验收

**权限控制:**
- [ ] 敏感词管理需要管理员权限
- [ ] 敏感词检测API需要认证
- [ ] 统计数据访问需要权限控制

**数据安全:**
- [ ] 敏感信息不泄露
- [ ] API密钥使用.env文件管理
- [ ] 不提交敏感信息到git

## 6. 风险评估

### 6.1 技术风险

**风险1: AC自动机实现复杂**
- 影响: 中等
- 概率: 低
- 缓解措施: 参考成熟的开源实现,充分测试

**风险2: 缓存一致性问题**
- 影响: 高
- 概率: 中
- 缓解措施: 严格的缓存失效策略,充分测试

**风险3: 性能不达标**
- 影响: 高
- 概率: 低
- 缓解措施: 性能测试,优化算法,使用缓存

### 6.2 业务风险

**风险1: 敏感词漏检**
- 影响: 高
- 概率: 低
- 缓解措施: 充分测试,定期更新敏感词库

**风险2: 误检率高**
- 影响: 中
- 概率: 中
- 缓解措施: 优化匹配算法,调整相似度阈值

### 6.3 项目风险

**风险1: 开发周期延长**
- 影响: 中
- 概率: 低
- 缓解措施: 合理规划任务,及时沟通

**风险2: 与现有系统集成困难**
- 影响: 中
- 概率: 低
- 缓解措施: 深入理解现有架构,充分测试

## 7. 项目计划

### 7.1 开发阶段

**阶段1: 数据模型优化**
- 修复Prisma模型
- 创建数据库迁移
- 执行数据库迁移

**阶段2: 核心功能开发**
- 实现AC自动机算法
- 实现敏感词检测功能
- 实现精确匹配和模糊匹配
- 实现分级处理策略

**阶段3: 缓存机制开发**
- 实现多级缓存策略
- 实现缓存预热
- 实现缓存失效

**阶段4: 集成开发**
- 集成到主题创建流程
- 集成到回复创建流程
- 实现敏感词命中统计

**阶段5: API开发**
- 实现敏感词检测API
- 实现批量导入API
- 实现批量导出API
- 实现统计API

**阶段6: 测试**
- 单元测试
- 集成测试
- 性能测试

**阶段7: 文档**
- API文档
- 使用文档

### 7.2 里程碑

**里程碑1: 数据模型优化完成**
- 时间: 第1周
- 交付物: 数据库迁移脚本

**里程碑2: 核心功能开发完成**
- 时间: 第2-3周
- 交付物: 核心功能代码

**里程碑3: 集成开发完成**
- 时间: 第4周
- 交付物: 集成功能代码

**里程碑4: API开发完成**
- 时间: 第5周
- 交付物: API代码

**里程碑5: 测试完成**
- 时间: 第6周
- 交付物: 测试报告

**里程碑6: 文档完成**
- 时间: 第7周
- 交付物: 完整文档

## 8. 最终确认

### 8.1 需求确认

✅ 所有需求已明确,无歧义
✅ 验收标准具体可测试
✅ 技术方案与现有架构对齐
✅ 所有关键假设已确认

### 8.2 技术方案确认

✅ AC自动机算法适合本项目
✅ 多级缓存策略合理
✅ 分级处理策略符合业务需求
✅ 集成方案可行

### 8.3 项目计划确认

✅ 任务边界清晰
✅ 里程碑明确
✅ 风险可控
✅ 资源充足

### 8.4 验收标准确认

✅ 功能验收标准完整
✅ 性能验收标准明确
✅ 代码质量验收标准具体
✅ 安全验收标准严格

---

**文档版本**: v1.0
**创建时间**: 2026-01-09
**最后更新**: 2026-01-09
**状态**: 已确认
