## 说明
- 本清单用于描述实现“响应与DTO一致性校验”所需的计划改动
- 当前仅生成改动清单，不包含代码实现

## 新增文件
- libs/base/src/interceptors/response-validation.interceptor.ts
  - 新增全局响应校验拦截器
  - 读取响应DTO元数据，对 data 做校验
- libs/base/src/decorators/response-dto.constants.ts
  - 定义响应DTO元数据 Key 与辅助类型
  - 供 ApiDoc/ApiPageDoc 与拦截器共享

## 修改文件
- libs/base/src/decorators/api-doc.decorator.ts
  - 在 ApiDoc/ApiPageDoc 写入响应DTO元数据
  - 支持单体、数组、分页三类响应结构
- libs/base/src/decorators/api-doc.types.ts
  - 增加分页标识等扩展选项
  - 保持向后兼容
- libs/base/src/decorators/index.ts
  - 导出新增的响应DTO元数据常量
- libs/base/src/interceptors/index.ts
  - 导出 response-validation.interceptor
- libs/base/src/base.module.types.ts
  - 增加 enableGlobalResponseValidationInterceptor 开关
- libs/base/src/base.module.ts
  - 根据开关注册响应校验拦截器
  - 仅在开发环境启用

## 可选调整（视实现细节）
- libs/base/src/interceptors/transform.types.ts
  - 如需扩展响应包装类型可补充类型定义
