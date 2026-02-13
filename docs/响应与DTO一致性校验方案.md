## 目标
为接口响应增加运行时一致性校验，确保实际响应数据与声明的 DTO 结构一致，提升接口质量与问题定位效率。

## 现状与问题
- 已有统一响应结构：全局 TransformInterceptor 将响应包装为 { code, data, message }
- 控制器通过 ApiDoc/ApiPageDoc 声明响应 DTO，但仅用于文档展示
- 请求侧有全局 ValidationPipe，响应侧缺少一致性校验机制

## 方案概述
通过“响应校验拦截器 + 响应 DTO 元数据”的方式，在运行时对 data 进行 DTO 校验。

核心思路：
- 在 ApiDoc/ApiPageDoc 内写入自定义响应元数据
- 全局拦截器读取元数据并对响应 data 进行校验
- 校验失败时抛出异常，交由现有异常过滤器统一处理
 - 通过开关控制是否启用（仅在开发环境启用）

## 关键设计
### 1. 响应 DTO 元数据
- 在 ApiDoc/ApiPageDoc 中同步写入响应 DTO 元数据
- 元数据内容包括：
  - model：DTO 类型
  - isArray：是否为数组响应
  - isPage：是否为分页响应

### 2. ResponseValidationInterceptor
- 读取自定义元数据
- 对响应数据进行转换与校验：
  - 单对象：plainToInstance + validate
  - 数组：对每个元素进行校验
  - 分页：校验 pageIndex/pageSize/total 基本类型，list 按 DTO 校验
- 校验失败抛出 BadRequestException，触发统一异常响应

### 3. 开关控制
在 BaseModuleOptions 中新增：
- enableGlobalResponseValidationInterceptor

在 BaseModule 中按开关注册：
- APP_INTERCEPTOR -> ResponseValidationInterceptor

建议默认关闭，仅在开发环境开启。

## 兼容性与注意事项
- DTO 中未声明的字段会被视为不一致，需要明确 DTO 边界
- 深层嵌套结构需要使用 ValidateNested 等装饰器显式声明
- 对性能敏感场景建议关闭或仅在关键接口启用

## 实施步骤
1. 增加响应 DTO 元数据常量与读取工具
2. 改造 ApiDoc/ApiPageDoc 写入元数据
3. 实现 ResponseValidationInterceptor
4. 在 BaseModuleOptions 与 BaseModule 注册拦截器
5. 在部分模块进行验证性测试

## 验收标准
- 任意声明了响应 DTO 的接口，返回字段缺失或类型不符时可被拦截
- 不影响已有响应结构与错误响应格式
- 可通过配置开关控制启停
