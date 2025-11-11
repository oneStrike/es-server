# Upload Service 重构说明

## 概述

本次重构将原有的 `upload.service.ts` 文件按照职责分离原则拆分为多个专门的服务文件，提升了代码的可读性和可维护性，同时保持了所有原有逻辑不变。

## 文件结构

```
src/common/services/upload/
├── README.md                    # 本文档
├── upload.module.ts             # 模块配置文件
├── upload.service.ts            # 主服务（协调各子服务）
├── upload-validator.service.ts  # 文件验证服务
├── upload-stream.service.ts     # 文件流处理服务
├── upload-signature.service.ts  # 文件签名验证服务
└── upload-path.service.ts       # 文件路径处理服务
```

## 服务职责说明

### 1. UploadService (主服务)

- **职责**: 协调各子服务，完成文件上传的核心业务流程
- **主要方法**:
  - `getUploadConfig()`: 获取上传配置缓存
  - `uploadMultipleFiles()`: 并行处理多文件上传

### 2. UploadValidatorService (文件验证服务)

- **职责**: 负责文件类型、大小等基础验证
- **主要功能**:
  - MIME 类型映射管理
  - 文件类型/扩展名验证
  - 文件大小检查

### 3. UploadStreamService (文件流处理服务)

- **职责**: 处理文件读写流、临时文件管理
- **主要功能**:
  - 创建文件处理流
  - 临时文件管理
  - 文件重命名和写入

### 4. UploadSignatureService (文件签名验证服务)

- **职责**: 通过魔数验证文件真实性，防止伪造 Content-Type
- **主要功能**:
  - 文件头部魔数检测
  - 文件类型真实性验证
  - 创建签名检测流

### 5. UploadPathService (文件路径处理服务)

- **职责**: 处理文件路径、命名和目录结构
- **主要功能**:
  - 场景字符串规范化
  - 文件名清洗和生成
  - 目录结构创建

### 6. UploadModule (模块配置)

- **职责**: 统一管理所有上传相关服务的依赖注入

## 重构优势

### 1. 可读性提升

- **单一职责**: 每个服务专注于特定功能职责
- **命名清晰**: 文件名和服务名直观表达功能
- **代码精简**: 每个文件代码量适中，便于理解和维护

### 2. 可维护性增强

- **松耦合**: 各服务相对独立，便于单独修改和测试
- **易扩展**: 新功能可以独立添加，不影响其他服务
- **问题定位**: 出现问题时能快速定位到具体服务

### 3. 性能优化

- **并行处理**: 保持了原有的并行文件处理能力
- **流式处理**: 维持了高效的文件流处理机制
- **缓存机制**: 保留了配置缓存优化

### 4. 安全性保持

- **魔数验证**: 完全保留文件签名验证功能
- **类型检查**: 维持严格的文件类型和大小验证
- **路径安全**: 保持文件名清洗和路径验证

## 兼容性说明

- **API 保持不变**: 所有对外接口保持完全一致
- **依赖关系**: 更新了相关的 import 语句和模块配置
- **功能等价**: 行为与重构前完全等价

## 使用方式

```typescript
// 控制器中使用方式不变
import { UploadService } from '@/common/services/upload/upload.service'

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  // 方法调用保持不变
  async uploadFiles(req: FastifyRequest, scene: string) {
    return this.uploadService.uploadMultipleFiles(req, scene)
  }
}
```

## 注意事项

1. **部署前测试**: 建议在生产环境部署前进行充分测试
2. **监控日志**: 关注重构后的日志输出，确保功能正常
3. **性能对比**: 可以对比重构前后的性能指标
4. **备份原文件**: 如需回滚，请保留原文件备份

## 后续优化建议

1. **单元测试**: 为各个服务添加独立的单元测试
2. **错误处理**: 可以进一步细化各服务的错误处理机制
3. **配置优化**: 将验证规则配置化，便于动态调整
4. **监控指标**: 添加文件上传的监控和统计功能
