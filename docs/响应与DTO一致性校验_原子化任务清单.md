## 任务1：定义响应DTO元数据契约
- 输入：现有 ApiDoc/ApiPageDoc 使用方式
- 输出：响应DTO元数据 Key、类型定义
- 约束：不破坏现有装饰器调用方式
- 验收：装饰器可写入并读取元数据

## 任务2：改造 ApiDoc/ApiPageDoc 写入元数据
- 输入：ApiDoc/ApiPageDoc 当前实现
- 输出：运行时可读取的响应DTO元数据
- 约束：文档渲染逻辑不变
- 验收：单体/数组/分页标识正确写入

## 任务3：实现响应校验拦截器
- 输入：响应DTO元数据、TransformInterceptor 响应结构
- 输出：ResponseValidationInterceptor
- 约束：校验失败抛出统一异常
- 验收：字段缺失/类型不符可被拦截

## 任务4：接入 BaseModule 开关
- 输入：BaseModuleOptions、BaseModule 注册逻辑
- 输出：enableGlobalResponseValidationInterceptor 开关与注册
- 约束：仅在开发环境开启
- 验收：开关开启后拦截器生效

## 任务5：验证性测试
- 输入：具备 DTO 响应声明的接口
- 输出：校验通过与失败的对照结果
- 约束：不修改业务逻辑
- 验收：不一致响应触发错误，一致响应正常
