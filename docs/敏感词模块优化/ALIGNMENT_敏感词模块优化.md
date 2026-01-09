# 敏感词模块优化 - 对齐文档

## 1. 项目上下文分析

### 1.1 技术栈

**核心框架:**
- **后端框架**: NestJS 11.1.9 + Fastify 5.6.2
- **数据库**: PostgreSQL (通过 Prisma ORM 7.2.0)
- **缓存**: Redis (通过 @keyv/redis 5.1.5)
- **语言**: TypeScript 5.9.3

**关键依赖:**
- `@nestjs/common` - NestJS核心模块
- `@prisma/client` - Prisma客户端
- `@prisma/adapter-pg` - PostgreSQL适配器
- `@nestjs/cache-manager` - 缓存管理
- `cache-manager` - 缓存抽象层
- `class-validator` - 数据验证
- `class-transformer` - 数据转换

### 1.2 项目架构模式

**模块化架构:**
```
es-server/
├── apps/
│   ├── admin-api/        # 管理端API
│   └── client-api/       # 客户端API
├── libs/
│   ├── base/             # 基础模块(数据库、工具等)
│   └── forum/            # 论坛业务模块
│       └── src/
│           └── sensitive-word/  # 敏感词模块
```

**代码模式:**
1. **服务继承**: 所有服务继承自 `BaseService`
2. **Prisma扩展**: 使用自定义扩展方法 (`findPagination`, `softDelete`, `exists` 等)
3. **DTO验证**: 使用装饰器进行数据验证 (`@ValidateString`, `@ValidateEnum` 等)
4. **事务处理**: 使用 `this.prisma.$transaction()` 处理复杂业务逻辑
5. **依赖注入**: 通过构造函数注入依赖服务

### 1.3 现有敏感词模块结构

**文件结构:**
```
sensitive-word/
├── dto/
│   └── sensitive-word.dto.ts          # 数据传输对象
├── sensitive-word-constant.ts         # 常量定义(级别、类型枚举)
├── sensitive-word.module.ts          # 模块定义
└── sensitive-word.service.ts         # 服务实现
```

**数据模型** (forum-sensitive-word.prisma):
```prisma
model ForumSensitiveWord {
  id          Int      @id @default(autoincrement())
  word        String   @unique @db.VarChar(100)
  replaceWord String?  @map("replace_word") @db.VarChar(100)
  isEnabled   Boolean  @default(true) @map("is_enabled")
  remark      String?  @db.VarChar(500)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  level       Int      @default(2) @db.SmallInt
  type        Int      @default(5) @db.SmallInt
  version     Int      @default(0)

  @@index([word])
  @@index([type])
  @@index([level])
  @@index([isEnabled])
  @@index([createdAt])
  @@map("forum_sensitive_word")
}
```

**敏感词级别** (SensitiveWordLevelEnum):
- `SEVERE = 1` - 严重
- `GENERAL = 2` - 一般
- `LIGHT = 3` - 轻微

**敏感词类型** (SensitiveWordTypeEnum):
- `POLITICS = 1` - 政治
- `PORN = 2` - 色情
- `VIOLENCE = 3` - 暴力
- `AD = 4` - 广告
- `OTHER = 5` - 其他

### 1.4 现有代码模式分析

**BaseService模式:**
```typescript
@Injectable()
export class SensitiveWordService extends BaseService {
  constructor() {
    super()
  }

  get sensitiveWord() {
    return this.prisma.forumSensitiveWord
  }
}
```

**Prisma扩展使用:**
```typescript
async getSensitiveWordPage(dto: QuerySensitiveWordDto) {
  return this.sensitiveWord.findPagination({
    where: {
      ...dto,
      word: {
        contains: dto.word,
      },
    },
  })
}
```

**事务处理模式:**
```typescript
return this.prisma.$transaction(async (tx) => {
  // 执行多个数据库操作
  const reply = await tx.forumReply.create({ data: updatePayload })
  await tx.forumTopic.update({ where: { id: topicId }, data: { replyCount: { increment: 1 } } })
  return reply
})
```

### 1.5 集成点分析

**主题创建流程** (forum-topic.service.ts):
- 当前状态: 无敏感词检测
- 需要集成点: `createForumTopic` 方法
- 检测字段: `title`, `content`

**回复创建流程** (forum-reply.service.ts):
- 当前状态: 无敏感词检测
- 需要集成点: `createForumReply` 方法
- 检测字段: `content`

**管理端API** (admin-api):
- 当前状态: 已有基础CRUD接口
- 需要添加: 检测接口、批量导入/导出、统计接口

### 1.6 缓存模块分析

**现有缓存配置** (cache.module.ts):
- 使用 `@nestjs/cache-manager` 和 `cache-manager`
- Redis作为存储后端
- 支持TTL设置

**缓存策略模式:**
```typescript
@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get(key: string) {
    return this.cacheManager.get(key)
  }

  async set(key: string, value: any, ttl?: number) {
    return this.cacheManager.set(key, value, ttl)
  }
}
```

## 2. 需求理解确认

### 2.1 原始需求

用户要求对敏感词管理模块进行全面审查,包括:
1. **业务代码实现** - 评估业务逻辑和代码实现
2. **数据表结构** - 评估数据库设计
3. **基于社区最佳实践** - 提供优化建议
4. **预期效果对比** - 说明优化前后的差异

**评估维度:**
- **业务逻辑**: 敏感词识别准确性、更新机制、分级管理策略、集成效率
- **代码实现**: 算法复杂度、内存占用、并发处理能力、可扩展性、安全性

### 2.2 边界确认

**任务范围:**
- ✅ 审查现有敏感词模块代码和数据表结构
- ✅ 提供基于最佳实践的优化建议文档
- ✅ 分析与现有系统的集成方案
- ✅ 提供优化前后的预期效果对比
- ❌ 不立即修改代码(需用户确认后再执行)
- ❌ 不涉及其他模块的重构
- ❌ 不涉及数据库迁移(仅提供迁移建议)

**优化范围:**
- ✅ 核心检测功能实现(AC自动机)
- ✅ 缓存机制集成
- ✅ 内容创建流程集成
- ✅ 数据模型修复和优化
- ✅ 批量操作功能
- ✅ 统计和监控功能

### 2.3 需求理解

**当前问题识别:**

1. **核心功能缺失**
   - 没有敏感词检测/过滤功能
   - 没有替换功能实现
   - 没有命中率统计

2. **数据模型不一致**
   - Prisma模型缺少 `matchMode` 字段(迁移SQL中存在)
   - 缺少 `hitCount` 字段用于统计
   - 缺少 `lastHitAt` 字段用于追踪

3. **性能问题**
   - 无缓存机制,每次检测都查询数据库
   - 无批量检测优化
   - 无并发处理优化

4. **集成缺失**
   - 主题创建未集成敏感词检测
   - 回复创建未集成敏感词检测
   - 无实时检测API

5. **功能不完整**
   - 无批量导入/导出
   - 无统计报表
   - 无审计日志

**优化目标:**

1. **业务逻辑优化**
   - 实现高效的敏感词检测算法(AC自动机)
   - 支持多种匹配模式(精确、模糊、正则)
   - 实现智能替换功能
   - 支持分级处理策略

2. **性能优化**
   - 引入Redis缓存机制
   - 实现批量检测优化
   - 支持并发处理
   - 优化数据库查询

3. **集成优化**
   - 集成到内容创建流程
   - 提供实时检测API
   - 支持异步检测模式

4. **功能完善**
   - 批量导入/导出
   - 命中率统计
   - 审计日志
   - 性能监控

### 2.4 疑问澄清

**已确认事项:**

1. **技术栈确认**
   - ✅ 使用NestJS + Fastify框架
   - ✅ 使用Prisma ORM + PostgreSQL
   - ✅ 使用Redis缓存
   - ✅ 遵循现有代码模式(BaseService、DTO验证等)

2. **算法选择确认**
   - ✅ 使用AC自动机算法进行多模式匹配
   - ✅ 支持中文敏感词检测
   - ✅ 时间复杂度O(n),空间复杂度O(m*n)

3. **集成方式确认**
   - ✅ 在主题/回复创建时进行同步检测
   - ✅ 提供独立的检测API供其他模块调用
   - ✅ 支持异步检测模式(可选)

4. **缓存策略确认**
   - ✅ 使用Redis缓存敏感词列表
   - ✅ 缓存失效策略:敏感词更新时清除缓存
   - ✅ 缓存预热:应用启动时加载敏感词

5. **匹配模式策略确认** (用户决策)
   - ✅ 按照社区最佳实践进行处理
   - ✅ 支持精确匹配(核心功能)
   - ✅ 支持模糊匹配(拼音、变形词)
   - ✅ 优先级:精确匹配 > 模糊匹配
   - ✅ 模糊匹配相似度阈值:0.8(可配置)

6. **处理策略确认** (用户决策)
   - ✅ 严重级别(SEVERE):标记为待审核
   - ✅ 一般级别(GENERAL):给相关记录做好标记,是否触发了敏感词
   - ✅ 轻微级别(LIGHT):给相关记录做好标记,是否触发了敏感词
   - ✅ 所有级别都需要记录敏感词命中情况

7. **性能要求确认** (用户决策)
   - ✅ 暂时不用考虑特殊性能要求
   - ✅ 常规的性能优化即可
   - ✅ 目标: < 100ms (1000个敏感词,1000字文本)
   - ✅ 目标: > 1000 QPS (并发检测)
   - ✅ 支持: 10,000+ 敏感词

8. **统计需求确认** (用户决策)
   - ✅ 需要详细的统计数据
   - ✅ 按时间统计(日、周、月)
   - ✅ 按类型统计(政治、色情、暴力、广告、其他)
   - ✅ 按级别统计(严重、一般、轻微)
   - ✅ 统计数据保留周期:90天
   - ✅ 支持导出统计报表

9. **审计需求确认** (用户决策)
   - ✅ 不需要独立的审计记录表
   - ✅ 需要给相关记录标记谁在什么时候操作了什么
   - ✅ 通过在相关记录上添加标记字段实现
   - ✅ 标记包括:操作人、操作时间、操作类型、敏感词信息

10. **其他决策确认** (基于最佳实践)
    - ✅ 暂不支持敏感词分组(可通过类型字段实现)
    - ✅ 使用现有的 `version` 字段进行版本管理
    - ✅ 支持敏感词导入/导出(Excel/CSV格式)

## 4. 用户决策总结

基于用户的确认,最终决策如下:

### 4.1 匹配模式策略
- **决策**: 按照社区最佳实践进行处理
- **实现**:
  - 支持精确匹配(核心功能,最高优先级)
  - 支持模糊匹配(拼音、变形词,次优先级)
  - 模糊匹配相似度阈值:0.8(可配置)
  - 优先级:精确匹配 > 模糊匹配

### 4.2 处理策略
- **决策**: 按级别处理,严重级别标记为待审核,其余级别做好标记
- **实现**:
  - 严重级别(SEVERE):标记为待审核,不允许发布
  - 一般级别(GENERAL):允许发布,但标记触发了敏感词
  - 轻微级别(LIGHT):允许发布,但标记触发了敏感词
  - 所有级别都需要记录敏感词命中情况

### 4.3 性能要求
- **决策**: 暂时不用考虑特殊性能要求,常规优化即可
- **实现**:
  - 目标响应时间: < 100ms (1000个敏感词,1000字文本)
  - 目标并发能力: > 1000 QPS
  - 支持敏感词数量: 10,000+
  - 使用AC自动机算法 + Redis缓存

### 4.4 统计需求
- **决策**: 需要详细的统计数据
- **实现**:
  - 按时间统计(日、周、月)
  - 按类型统计(政治、色情、暴力、广告、其他)
  - 按级别统计(严重、一般、轻微)
  - 统计数据保留周期:90天
  - 支持导出统计报表

### 4.5 审计需求
- **决策**: 不需要独立的审计记录表,但需要给相关记录做好标记
- **实现**:
  - 在相关记录(主题、回复)上添加标记字段
  - 标记包括:操作人、操作时间、操作类型、敏感词信息
  - 通过JSON字段存储敏感词命中详情

## 5. 下一步计划

基于用户确认的决策,我将:

1. ✅ 更新ALIGNMENT文档,记录用户的决策
2. 生成CONSENSUS文档,明确最终需求
3. 创建DESIGN文档,设计系统架构
4. 创建TASK文档,拆分子任务
5. 等待用户的审批后开始实施

---

**文档版本**: v2.0
**创建时间**: 2026-01-09
**最后更新**: 2026-01-09
**更新内容**: 记录用户决策,移除待确认事项
