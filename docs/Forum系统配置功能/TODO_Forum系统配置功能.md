# Forum模块系统配置功能 - 待办事宜

## 1. 待办事项

### 1.1 代码实现(13个任务,预估66小时)

#### 第一阶段: 基础设施建设
- [ ] 任务1: 创建数据库模型(2小时)
  - 创建 `libs/base/src/database/prisma-client/models/ForumConfig.ts`
  - 创建 `libs/base/src/database/prisma-client/models/ForumConfigHistory.ts`
  - 创建 `libs/base/src/database/prisma-client/models/ForumConfigGroup.ts`

- [ ] 任务2: 实现配置分组功能(4小时)
  - 创建 `libs/forum/src/config/dto/forum-config-group.dto.ts`
  - 创建 `libs/forum/src/config/forum-config-group.service.ts`
  - 创建 `libs/forum/src/config/forum-config-group.module.ts`

- [ ] 任务3: 实现配置验证器(6小时)
  - 创建 `libs/forum/src/config/forum-config.validator.ts`
  - 创建 `libs/forum/src/config/forum-config.constant.ts`

#### 第二阶段: 核心功能实现
- [ ] 任务4: 实现配置管理基础功能(8小时)
  - 创建 `libs/forum/src/config/dto/forum-config.dto.ts`
  - 创建 `libs/forum/src/config/forum-config.service.ts`
  - 创建 `libs/forum/src/config/forum-config.module.ts`

- [ ] 任务5: 实现配置缓存功能(4小时)
  - 更新 `libs/forum/src/config/forum-config.service.ts`

- [ ] 任务6: 实现配置历史功能(6小时)
  - 创建 `libs/forum/src/config/dto/forum-config-history.dto.ts`
  - 创建 `libs/forum/src/config/forum-config-history.service.ts`
  - 更新 `libs/forum/src/config/forum-config.service.ts`

#### 第三阶段: 高级功能实现
- [ ] 任务7: 实现配置导入导出功能(6小时)
  - 更新 `libs/forum/src/config/forum-config.service.ts`

- [ ] 任务8: 实现配置回滚功能(4小时)
  - 更新 `libs/forum/src/config/forum-config.service.ts`
  - 更新 `libs/forum/src/config/forum-config-history.service.ts`

#### 第四阶段: 接口和权限
- [ ] 任务9: 实现API接口(6小时)
  - 创建 `libs/forum/src/config/forum-config.controller.ts`
  - 创建 `libs/forum/src/config/forum-config-group.controller.ts`
  - 创建 `libs/forum/src/config/forum-config-history.controller.ts`

- [ ] 任务10: 实现权限控制(4小时)
  - 更新 `libs/forum/src/config/forum-config.controller.ts`
  - 更新 `libs/forum/src/config/forum-config-group.controller.ts`
  - 更新 `libs/forum/src/config/forum-config-history.controller.ts`
  - 更新 `libs/forum/src/config/forum-config.constant.ts`

#### 第五阶段: 测试和集成
- [ ] 任务11: 编写单元测试(8小时)
  - 创建 `libs/forum/src/config/__tests__/forum-config.service.spec.ts`
  - 创建 `libs/forum/src/config/__tests__/forum-config-group.service.spec.ts`
  - 创建 `libs/forum/src/config/__tests__/forum-config-history.service.spec.ts`
  - 创建 `libs/forum/src/config/__tests__/forum-config.validator.spec.ts`

- [ ] 任务12: 编写集成测试(6小时)
  - 创建 `apps/admin-api/test/forum-config.e2e-spec.ts`
  - 创建 `apps/client-api/test/forum-config.e2e-spec.ts`

- [ ] 任务13: 集成到Forum模块(2小时)
  - 更新 `apps/admin-api/src/modules/forum-management/forum-management.module.ts`
  - 更新 `apps/client-api/src/modules/forum/forum.module.ts`
  - 更新 `libs/forum/src/index.ts`

### 1.2 数据库迁移

- [ ] 创建数据库迁移脚本
  - 执行Prisma迁移命令: `npx prisma migrate dev --name add_forum_config_tables`
  - 验证数据库表创建成功

- [ ] 初始化配置分组数据
  - 基础设置分组
  - 用户设置分组
  - 内容设置分组
  - 积分设置分组
  - 审核设置分组

- [ ] 初始化配置项数据
  - 论坛名称配置
  - 论坛描述配置
  - 论坛开关配置
  - 用户注册开关配置
  - 发帖限制配置
  - 回复限制配置
  - 审核策略配置
  - 其他核心配置项

### 1.3 环境配置

- [ ] 配置Redis连接
  - 确认Redis服务已启动
  - 配置Redis连接参数
  - 验证Redis连接正常

- [ ] 配置缓存TTL
  - 配置缓存过期时间(默认1小时)
  - 配置缓存刷新策略

- [ ] 配置历史数据保留策略
  - 配置历史数据保留天数(默认90天)
  - 配置历史数据清理任务

### 1.4 权限配置

- [ ] 创建配置管理权限
  - 配置查看权限
  - 配置编辑权限
  - 配置删除权限
  - 配置导入导出权限
  - 配置回滚权限

- [ ] 分配权限给管理员角色
  - 超级管理员: 所有权限
  - 普通管理员: 查看、编辑权限
  - 板块管理员: 查看、编辑板块级配置

## 2. 缺少的配置

### 2.1 缺少的环境变量

**Redis配置:**
```env
# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

**缓存配置:**
```env
# 缓存配置
CACHE_TTL=3600
CACHE_MAX=1000
```

**配置历史配置:**
```env
# 配置历史配置
CONFIG_HISTORY_RETENTION_DAYS=90
CONFIG_HISTORY_CLEANUP_ENABLED=true
```

### 2.2 缺少的数据库表

**需要创建的表:**
1. forum_config - 配置表
2. forum_config_history - 配置历史表
3. forum_config_group - 配置分组表

### 2.3 缺少的初始化数据

**配置分组数据:**
- 基础设置(BASIC)
- 用户设置(USER)
- 内容设置(CONTENT)
- 积分设置(POINT)
- 审核设置(AUDIT)

**配置项数据:**
- forum.name - 论坛名称
- forum.description - 论坛描述
- forum.enabled - 论坛开关
- user.registration.enabled - 用户注册开关
- content.post.enabled - 发帖开关
- content.reply.enabled - 回复开关
- content.audit.enabled - 审核开关
- point.enabled - 积分开关
- 其他核心配置项

## 3. 操作指引

### 3.1 开始实现

**步骤1: 创建数据库模型**
```bash
# 1. 在libs/base/src/database/prisma-client/models/目录下创建三个模型文件
# 2. 参考DESIGN文档中的数据库设计
# 3. 执行数据库迁移
npx prisma migrate dev --name add_forum_config_tables
```

**步骤2: 实现配置分组功能**
```bash
# 1. 创建DTO文件
# 2. 创建Service文件
# 3. 创建Module文件
# 4. 参考现有Service的实现方式
```

**步骤3: 实现配置验证器**
```bash
# 1. 创建验证器文件
# 2. 创建常量文件
# 3. 实现各种验证逻辑
```

**步骤4: 实现配置管理基础功能**
```bash
# 1. 创建DTO文件
# 2. 创建Service文件
# 3. 创建Module文件
# 4. 实现CRUD功能
```

**步骤5-13: 按照TASK文档依次实现**
```bash
# 参考TASK文档中的任务拆分
# 按照任务依赖关系依次实现
# 每个任务完成后进行验证
```

### 3.2 测试验证

**单元测试:**
```bash
# 运行单元测试
npm test libs/forum/src/config/__tests__/

# 查看测试覆盖率
npm run test:cov
```

**集成测试:**
```bash
# 运行集成测试
npm test apps/admin-api/test/forum-config.e2e-spec.ts
npm test apps/client-api/test/forum-config.e2e-spec.ts
```

**手动测试:**
```bash
# 启动管理端API
npm run start:dev admin-api

# 启动客户端API
npm run start:dev client-api

# 使用Postman或curl测试API接口
```

### 3.3 部署上线

**数据库部署:**
```bash
# 1. 在生产环境执行数据库迁移
npx prisma migrate deploy

# 2. 初始化配置分组数据
# 3. 初始化配置项数据
```

**环境配置:**
```bash
# 1. 配置生产环境的环境变量
# 2. 配置Redis连接
# 3. 配置缓存策略
# 4. 配置历史数据保留策略
```

**权限配置:**
```bash
# 1. 创建配置管理权限
# 2. 分配权限给管理员角色
# 3. 验证权限控制正常
```

## 4. 注意事项

### 4.1 开发注意事项

1. **代码规范**: 遵循现有代码规范,使用BaseService、DTO验证等
2. **命名规范**: 类名使用PascalCase,方法名使用camelCase,常量使用UPPER_SNAKE_CASE
3. **注释规范**: 公共方法必须添加注释,复杂逻辑必须添加注释
4. **错误处理**: 所有异常情况必须处理,错误信息必须友好
5. **日志记录**: 所有关键操作必须记录日志

### 4.2 测试注意事项

1. **单元测试**: 测试覆盖率必须 > 80%
2. **集成测试**: 所有API接口必须有测试
3. **边界测试**: 所有边界条件必须有测试
4. **异常测试**: 所有异常情况必须有测试

### 4.3 部署注意事项

1. **数据库迁移**: 生产环境部署前必须先在测试环境验证
2. **环境配置**: 生产环境的环境变量必须正确配置
3. **权限配置**: 生产环境的权限必须严格控制
4. **监控告警**: 生产环境必须配置监控告警

## 5. 参考文档

- [ALIGNMENT_Forum系统配置功能.md](file:///e:/Code/es/es-server/docs/Forum系统配置功能/ALIGNMENT_Forum系统配置功能.md) - 需求对齐与规范定义
- [CONSENSUS_Forum系统配置功能.md](file:///e:/Code/es/es-server/docs/Forum系统配置功能/CONSENSUS_Forum系统配置功能.md) - 最终需求确认
- [DESIGN_Forum系统配置功能.md](file:///e:/Code/es/es-server/docs/Forum系统配置功能/DESIGN_Forum系统配置功能.md) - 系统架构设计
- [TASK_Forum系统配置功能.md](file:///e:/Code/es/es-server/docs/Forum系统配置功能/TASK_Forum系统配置功能.md) - 任务拆分与依赖关系
- [FINAL_Forum系统配置功能.md](file:///e:/Code/es/es-server/docs/Forum系统配置功能/FINAL_Forum系统配置功能.md) - 项目总结报告

---

**文档版本**: v1.0
**创建时间**: 2026-01-10
**最后更新**: 2026-01-10
**更新内容**: 初始版本
