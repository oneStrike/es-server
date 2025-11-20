# CONSENSUS - Health Service 重构共识文档
## 明确的需求描述
将两个独立的健康检查指示器（CacheHealthIndicator 和 DatabaseHealthIndicator）合并成一个统一的 HealthService，简化模块结构并提高代码组织性。

## 验收标准
1. ✅ 创建新的 `health.service.ts` 文件
2. ✅ 包含所有原有健康检查功能
3. ✅ 保持现有 API 接口不变
4. ✅ 更新模块导入配置
5. ✅ 确保所有测试通过
6. ✅ 代码编译无错误

## 技术实现方案

### 服务结构设计
```typescript
@Injectable()
export class HealthService {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly prismaService: PrismaService,
  ) {}

  // 原有 DatabaseHealthIndicator 的方法
  async ping(key = 'database')
  
  // 原有 CacheHealthIndicator 的方法  
  async checkMemory(key = 'cache_memory')
  async checkRedis(key = 'cache_redis')
}
```

### 技术约束
1. 使用 TypeScript 和 NestJS 装饰器
2. 保持现有的依赖注入模式
3. 遵循项目的代码风格和命名规范
4. 使用现有的错误处理策略

### 集成方案
1. 在 `HealthModule` 中注册新的 `HealthService`
2. 更新 `HealthController` 的依赖注入
3. 移除旧的健康检查指示器文件
4. 保持与 `@nestjs/terminus` 的兼容性

## 任务边界限制
**包含:**
- 合并两个健康检查指示器的功能
- 创建新的 `health.service.ts` 文件
- 更新模块配置
- 验证功能完整性

**不包含:**
- 修改健康检查的业务逻辑
- 重构其他健康检查指示器
- 改变现有的 API 响应格式
- 优化性能或添加新功能

## 确认所有不确定性已解决
✅ 服务结构已确定：单一服务类包含所有方法  
✅ 方法签名保持不变：确保向后兼容  
✅ 依赖关系已确认：使用现有的注入模式  
✅ 错误处理策略：保持现有实现  
✅ 测试策略：验证现有功能不受影响  

## 项目特性规范对齐
✅ 符合 NestJS 模块化架构  
✅ 遵循依赖注入模式  
✅ 保持代码可读性和维护性  
✅ 与现有项目风格一致  
