# ALIGNMENT_论坛经验系统优化

## 一、项目背景

### 1.1 项目概述
本项目是基于 NestJS + Prisma + PostgreSQL 的论坛系统，当前用户等级系统存在设计缺陷：等级与积分直接绑定，导致用户消费积分后可能降级，不符合论坛系统的常规设计模式。

### 1.2 现有系统分析

#### 当前数据模型
- **ForumProfile 表**：
  - `points`: 论坛积分（可增可减）
  - `levelId`: 等级ID
  - 其他统计字段：topicCount, replyCount, likeCount, favoriteCount

- **ForumLevelRule 表**：
  - `requiredPoints`: 所需积分（用于等级升级判断）
  - 权限配置：dailyTopicLimit, dailyReplyLimit, postInterval, maxFileSize 等

- **ForumPointRule 表**：
  - 规则类型：发表主题、发表回复、主题被点赞、回复被点赞、主题被收藏、每日签到
  - 积分变化：points（正数为获得，负数为扣除）
  - 每日上限：dailyLimit

- **ForumPointRecord 表**：
  - 记录积分变化历史
  - 包含：beforePoints, afterPoints, remark

#### 当前等级升级逻辑
```typescript
// LevelRuleService.updateUserLevelByPoints()
// 直接根据用户的 points 字段匹配等级规则
const newLevelRule = await this.forumLevelRule.findFirst({
  where: {
    isEnabled: true,
    requiredPoints: { lte: profile.points },
  },
  orderBy: { requiredPoints: 'desc' },
})
```

### 1.3 核心问题

1. **概念混淆**：积分（可消费）与等级（只增不减）绑定
2. **用户体验差**：用户消费积分后等级可能下降
3. **不符合行业最佳实践**：主流论坛系统通常分离积分和经验
4. **扩展性差**：无法灵活配置不同行为的积分和经验奖励

## 二、原始需求

### 2.1 用户提出的问题
"用户等级是和积分绑定的，这是不是不太合适？通常是不是应该和经验绑定，然后可以指定经验规则？"

### 2.2 需求理解
- 将用户等级从基于积分改为基于经验值
- 积分保持可消费特性，用于经济系统
- 经验值只增不减，用于等级计算
- 需要配置经验获取规则

## 三、边界确认

### 3.1 任务范围
**包含：**
- 设计并实现经验值系统（数据库模型、服务层、API层）
- 修改等级升级逻辑，从基于积分改为基于经验
- 创建经验规则配置功能
- 创建经验记录功能
- 数据迁移方案（现有用户数据迁移）
- 更新相关文档

**不包含：**
- 修改积分系统的现有功能（积分规则、积分记录等）
- 修改等级权限系统（保持现有权限配置不变）
- 前端界面调整（仅提供后端API）

### 3.2 技术约束
- 使用 NestJS 框架
- 使用 Prisma ORM
- 数据库：PostgreSQL
- 遵循现有代码规范和架构模式
- 保持向后兼容性

## 四、需求理解

### 4.1 对现有项目的理解

#### 4.1.1 项目架构
- **Monorepo 结构**：使用 pnpm workspace
- **模块化设计**：
  - `libs/forum`: 论坛核心业务逻辑
  - `libs/base`: 基础服务和工具
  - `apps/admin-api`: 管理端API
  - `apps/client-api`: 客户端API

#### 4.1.2 现有模块结构
```
libs/forum/src/
├── level-rule/          # 等级规则模块
│   ├── level-rule.service.ts
│   ├── level-rule.controller.ts
│   └── dto/level-rule.dto.ts
├── point/               # 积分模块
│   ├── point.service.ts
│   ├── point.controller.ts
│   ├── dto/
│   └── point.constant.ts
└── user/                # 用户模块
    └── user.service.ts
```

#### 4.1.3 代码规范
- 使用 TypeScript
- 使用 class-validator 进行参数验证
- 使用 Swagger 生成 API 文档
- 使用装饰器模式（@ValidateNumber, @ValidateString 等）
- DTO 继承模式（BaseDto, CreateDto, UpdateDto, QueryDto）

### 4.2 行业最佳实践研究

#### 4.2.1 主流论坛系统设计模式

根据行业调研，主流论坛系统（如 Discuz!、Discourse、CSDN 等）普遍采用以下设计：

**积分系统：**
- 可消费的虚拟货币
- 用于兑换奖励、购买特权等
- 可以通过多种方式获得和消费
- 记录详细的交易历史

**经验系统：**
- 只增不减的累积值
- 用于等级计算和用户成长
- 反映用户对社区的贡献度
- 通常基于用户行为获得（发帖、回复、被点赞等）

**等级系统：**
- 基于经验值计算
- 与权限系统绑定
- 提供视觉标识（徽章、颜色等）
- 具有激励作用

#### 4.2.2 经验获取规则设计原则

1. **正向激励**：奖励积极行为（发帖、回复、帮助他人）
2. **质量导向**：高质量内容获得更多经验（被点赞、被收藏）
3. **防刷机制**：设置每日上限、防作弊
4. **渐进式增长**：经验获取难度随等级提升
5. **多样化来源**：不同行为给予不同经验值

#### 4.2.3 典型经验规则示例

| 行为 | 经验值 | 每日上限 | 说明 |
|------|--------|----------|------|
| 每日签到 | 5 | 1次 | 活跃度奖励 |
| 发表主题 | 20 | 10次 | 内容贡献 |
| 发表回复 | 10 | 50次 | 互动参与 |
| 主题被点赞 | 5 | 无限制 | 质量认可 |
| 回复被点赞 | 3 | 无限制 | 质量认可 |
| 主题被收藏 | 10 | 无限制 | 高质量内容 |
| 连续签到 | 额外奖励 | - | 激励持续活跃 |

### 4.3 技术方案理解

#### 4.3.1 数据库设计
需要新增以下表：
- `ForumExperienceRule`: 经验规则表
- `ForumExperienceRecord`: 经验记录表
- 修改 `ForumProfile` 表，添加 `experience` 字段
- 修改 `ForumLevelRule` 表，将 `requiredPoints` 改为 `requiredExperience`

#### 4.3.2 服务层设计
需要新增以下服务：
- `ExperienceService`: 经验服务（增加经验、经验规则管理、经验记录查询）
- 修改 `LevelRuleService`: 等级升级逻辑改为基于经验

#### 4.3.3 API 层设计
需要新增以下接口：
- 管理端：经验规则 CRUD、经验记录查询、用户经验统计
- 客户端：用户经验信息查询

## 五、疑问澄清

### 5.1 需要确认的问题

#### 5.1.1 数据迁移策略
**问题**：现有用户的积分如何转换为经验值？

**选项 A**：将现有积分直接转换为经验值
- 优点：简单直接，用户等级不会变化
- 缺点：可能不合理（积分可能已被消费）

**选项 B**：根据历史积分记录重新计算经验值
- 优点：更准确反映用户贡献
- 缺点：计算复杂，可能影响性能

**选项 C**：重新初始化所有用户的经验值为 0
- 优点：最公平，从零开始
- 缺点：用户等级会重置，可能引起不满

**建议**：采用选项 A，将当前积分作为初始经验值，保持用户等级不变。

#### 5.1.2 经验规则与积分规则的关系
**问题**：经验规则是否需要与积分规则保持一致？

**选项 A**：完全独立配置
- 优点：灵活性高，可以分别优化
- 缺点：配置复杂度增加

**选项 B**：经验规则与积分规则一一对应
- 优点：配置简单，易于理解
- 缺点：灵活性受限

**建议**：采用选项 A，经验规则和积分规则独立配置，但提供默认值参考积分规则。

#### 5.1.3 等级计算方式
**问题**：等级计算是否需要考虑其他因素？

**选项 A**：仅基于经验值
- 优点：简单清晰
- 缺点：单一维度

**选项 B**：综合经验值 + 其他指标（如发帖数、回复数）
- 优点：更全面
- 缺点：计算复杂

**建议**：采用选项 A，仅基于经验值计算等级，保持简单清晰。

#### 5.1.4 经验值是否需要上限
**问题**：经验值是否需要设置上限？

**选项 A**：无上限
- 优点：持续激励
- 缺点：数值可能过大

**选项 B**：设置上限（如最高等级所需经验）
- 优点：数值可控
- 缺点：失去激励作用

**建议**：采用选项 A，无上限，但可以设置最高等级。

#### 5.1.5 是否需要经验衰减机制
**问题**：是否需要经验值随时间衰减？

**选项 A**：不衰减
- 优点：简单，用户友好
- 缺点：可能失去活跃度激励

**选项 B**：定期衰减（如每月衰减一定比例）
- 优点：激励持续活跃
- 缺点：用户可能不满

**建议**：采用选项 A，不衰减，保持用户友好。

## 六、决策记录

### 6.1 已确认的决策

1. **采用方案一**：分离积分和经验系统
2. **经验值特性**：只增不减
3. **等级计算**：基于经验值，不基于积分
4. **数据迁移**：将现有积分作为初始经验值
5. **规则配置**：经验规则与积分规则独立配置
6. **经验上限**：无上限
7. **经验衰减**：不衰减

### 6.2 待确认的决策

（待用户确认上述 5.1 节中的建议方案）

## 七、验收标准

### 7.1 功能验收标准
- [ ] ForumProfile 表新增 experience 字段
- [ ] ForumLevelRule 表的 requiredPoints 改为 requiredExperience
- [ ] 新增 ForumExperienceRule 表
- [ ] 新增 ForumExperienceRecord 表
- [ ] ExperienceService 实现完整功能
- [ ] LevelRuleService 的等级升级逻辑改为基于经验
- [ ] 管理端 API 提供经验规则 CRUD
- [ ] 管理端 API 提供经验记录查询
- [ ] 客户端 API 提供用户经验信息查询
- [ ] 数据迁移脚本完成并测试通过
- [ ] 所有测试通过
- [ ] 代码符合项目规范

### 7.2 性能验收标准
- [ ] 经验增加操作响应时间 < 100ms
- [ ] 等级升级检查操作响应时间 < 100ms
- [ ] 经验记录查询响应时间 < 200ms
- [ ] 数据库索引优化合理

### 7.3 兼容性验收标准
- [ ] 现有积分系统功能不受影响
- [ ] 现有等级权限系统功能不受影响
- [ ] API 向后兼容（不删除现有接口）
- [ ] 数据迁移后用户等级保持不变

## 八、风险评估

### 8.1 技术风险
- **风险**：数据迁移可能导致数据不一致
- **应对**：编写详细的迁移脚本，进行充分测试

### 8.2 业务风险
- **风险**：用户对经验系统不理解
- **应对**：提供清晰的文档和说明

### 8.3 性能风险
- **风险**：经验记录表数据量大，影响查询性能
- **应对**：合理设计索引，考虑分表策略

## 九、参考资料

### 9.1 现有代码
- [ForumProfile 模型](e:\Code\es\es-server\prisma\models\forum\forum-profile.prisma)
- [ForumLevelRule 模型](e:\Code\es\es-server\prisma\models\forum\forum-level-rule.prisma)
- [ForumPointRule 模型](e:\Code\es\es-server\prisma\models\forum\forum-point-rule.prisma)
- [ForumPointRecord 模型](e:\Code\es\es-server\prisma\models\forum\forum-point-record.prisma)
- [LevelRuleService](e:\Code\es\es-server\libs\forum\src\level-rule\level-rule.service.ts)
- [PointService](e:\Code\es\es-server\libs\forum\src\point\point.service.ts)

### 9.2 行业参考
- CSDN 论坛积分等级制度
- Discourse 论坛系统
- Discuz! 论坛系统
