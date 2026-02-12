# ApiDoc 内联 Model 重构任务执行清单

## 文件处理顺序建议

1. d:\code\es\es-server\libs\user\src\growth-overview\dto\growth-overview.dto.ts
2. d:\code\es\es-server\libs\user\src\growth-overview\index.ts
3. d:\code\es\es-server\libs\user\src\index.ts
4. d:\code\es\es-server\apps\admin-api\src\modules\user-growth\overview\overview.controller.ts
5. d:\code\es\es-server\apps\app-api\src\modules\user\user.controller.ts

## 每个文件预期修改工作量

1. d:\code\es\es-server\libs\user\src\growth-overview\dto\growth-overview.dto.ts | 新增 DTO | 中
2. d:\code\es\es-server\libs\user\src\growth-overview\index.ts | 新增导出 | 低
3. d:\code\es\es-server\libs\user\src\index.ts | 增加导出 | 低
4. d:\code\es\es-server\apps\admin-api\src\modules\user-growth\overview\overview.controller.ts | 替换 ApiDoc model | 低
5. d:\code\es\es-server\apps\app-api\src\modules\user\user.controller.ts | 替换 ApiDoc model | 低

## 关键验证点

1. DTO 字段完整性：DTO 字段、类型、示例值、描述与原内联模型一致
2. DTO 复用性：优先复用已有 DTO，不重复定义同结构
3. ApiDoc 替换正确性：非基础类型内联 model 已替换为 DTO 引用
4. Swagger 文档正确性：Swagger UI 能展示 DTO 结构且无缺失字段
