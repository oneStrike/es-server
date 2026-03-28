# 上传服务梳理与轻量优化方案

## 1. 背景与目标

本次排查范围聚焦当前项目的上传服务主链路，目标不是重构成“很漂亮但很重”的体系，而是确认：

- 当前实现是否存在明确的行为问题或维护风险
- 哪些点适合做低风险优化
- 哪些点虽然值得关注，但现在不宜直接动

本文会随着已落地改动持续更新，避免方案状态和代码现状脱节。

---

## 2. 当前上传链路梳理

### 2.1 核心入口

- 上传主服务：[libs/platform/src/modules/upload/upload.service.ts](D:/code/es/es-server/libs/platform/src/modules/upload/upload.service.ts)
- 上传模块注册：[libs/platform/src/modules/upload/upload.module.ts](D:/code/es/es-server/libs/platform/src/modules/upload/upload.module.ts)
- 本地存储 provider：[libs/platform/src/modules/upload/local-upload.provider.ts](D:/code/es/es-server/libs/platform/src/modules/upload/local-upload.provider.ts)
- 七牛 provider：[libs/platform/src/modules/upload/qiniu-upload.provider.ts](D:/code/es/es-server/libs/platform/src/modules/upload/qiniu-upload.provider.ts)
- Superbed provider：[libs/platform/src/modules/upload/superbed-upload.provider.ts](D:/code/es/es-server/libs/platform/src/modules/upload/superbed-upload.provider.ts)

### 2.2 上传初始化与静态资源暴露

- multipart / static 初始化：[libs/platform/src/bootstrap/multipart.ts](D:/code/es/es-server/libs/platform/src/bootstrap/multipart.ts)
- 上传配置：[libs/platform/src/config/upload.config.ts](D:/code/es/es-server/libs/platform/src/config/upload.config.ts)

### 2.3 主要调用方

- 后台通用上传接口：[apps/admin-api/src/modules/system/upload/upload.controller.ts](D:/code/es/es-server/apps/admin-api/src/modules/system/upload/upload.controller.ts)
- 小说章节内容上传：[libs/content/src/work/content/novel-content.service.ts](D:/code/es/es-server/libs/content/src/work/content/novel-content.service.ts)
- 漫画章节内容上传：[libs/content/src/work/content/comic-content.service.ts](D:/code/es/es-server/libs/content/src/work/content/comic-content.service.ts)
- 漫画压缩包导入后本地文件二次上传：[libs/content/src/work/content/comic-archive-import.service.ts](D:/code/es/es-server/libs/content/src/work/content/comic-archive-import.service.ts)

### 2.4 当前实现的优点

当前实现整体并不差，已有这些比较好的基础：

- 上传入口集中，provider 切换点清晰
- 有文件类型识别，不完全信任前端传入的 MIME
- 有临时目录落盘，避免直接把请求流耦合进 provider
- 本地 / 七牛 / Superbed 的职责边界比较清楚
- 压缩包导入复用了统一上传流程，而不是单独再造一套上传逻辑

结论：**不建议大改架构，也不建议把当前上传服务拆成很多小服务类。**

---

## 3. 排查后确认的几个真实问题

## 3.1 `scene` 默认值文档和运行时行为不一致

相关文件：

- [libs/platform/src/dto/upload.dto.ts](D:/code/es/es-server/libs/platform/src/dto/upload.dto.ts)
- [libs/platform/src/modules/upload/upload.service.ts](D:/code/es/es-server/libs/platform/src/modules/upload/upload.service.ts)

现状：

- DTO 文档里把 `scene` 标成了可选，默认值是 `shared`
- 但运行时 `upload.service.ts` 中 `extractScene(...)` 实际要求 multipart 里必须传 `scene`
- 如果没传，会直接报“未知的上传场景”

影响：

- 接口文档和真实行为不一致
- 前端或后续调用方容易踩坑
- 这类问题不是性能问题，但属于典型“隐性维护成本”

建议：

- 运行时和 DTO 语义对齐
- 没传 `scene` 时默认回落到 `shared`
- 如果显式传了非法值，再继续报错

风险评估：**低风险，建议直接改**

---

## 3.2 `uploadLocalFile(...)` 缺少统一文件大小兜底

相关文件：

- [libs/platform/src/modules/upload/upload.service.ts](D:/code/es/es-server/libs/platform/src/modules/upload/upload.service.ts)
- [libs/content/src/work/content/comic-archive-import.service.ts](D:/code/es/es-server/libs/content/src/work/content/comic-archive-import.service.ts)

现状：

- HTTP 上传链路依赖 Fastify multipart 的 `fileSize` 限制
- 但 `uploadLocalFile(...)` 走的是本地文件二次上传路径，不经过 multipart 限流
- 该方法目前会识别类型、拼路径、走 provider，但没有在 service 层补一层统一大小校验

影响：

- 压缩包导入解压后的单个文件，理论上可以绕过 HTTP 上传时的单文件大小约束
- provider 层会承担本不该承担的超大文件压力
- 这类问题通常不是立刻爆，但会在“导入大包”或后续复用 `uploadLocalFile(...)` 时埋雷

建议：

- 在 `upload.service.ts` 内增加统一的大小校验 helper
- `uploadFile(...)` 和 `uploadLocalFile(...)` 都走同一份大小判断

风险评估：**低风险，建议直接改**

---

## 3.3 路径段校验还不够稳，`"." / ".."` 目前理论上可穿透

相关文件：

- [libs/platform/src/modules/upload/upload.service.ts](D:/code/es/es-server/libs/platform/src/modules/upload/upload.service.ts)

现状：

- 路径段目前使用 `PATH_SEGMENT_REGEX = /^[\\w.-]+$/`
- 这个规则能挡住斜杠，但挡不住 `"."` 和 `".."` 这种特殊段
- 当前项目内的调用方基本是内部固定值，短期内不一定触发

影响：

- 当前风险更偏“未来误用风险”，不是线上已知必现 bug
- 但上传服务属于底层公共能力，这种约束最好在底层兜住

建议：

- 在保留现有命名兼容性的前提下，额外拒绝 `"."` 和 `".."` 段
- 不建议把规则收得过死，比如禁止普通的 `-`、`_`、数字目录名，这会徒增调用约束

风险评估：**低风险，建议直接改**

---

## 3.4 上传返回 DTO 已收口到单一实现

相关文件：

- [libs/platform/src/dto/upload.dto.ts](D:/code/es/es-server/libs/platform/src/dto/upload.dto.ts)
- [libs/platform/src/modules/upload/dto/upload.dto.ts](D:/code/es/es-server/libs/platform/src/modules/upload/dto/upload.dto.ts)
- [apps/admin-api/src/modules/system/upload/upload.controller.ts](D:/code/es/es-server/apps/admin-api/src/modules/system/upload/upload.controller.ts)
- [apps/admin-api/src/modules/content/novel/novel-content.controller.ts](D:/code/es/es-server/apps/admin-api/src/modules/content/novel/novel-content.controller.ts)
- [apps/admin-api/src/modules/content/comic/chapter-content/chapter-content.controller.ts](D:/code/es/es-server/apps/admin-api/src/modules/content/comic/chapter-content/chapter-content.controller.ts)

现状：

- 实际 DTO 定义已经收口到 `libs/platform/src/modules/upload/dto/upload.dto.ts`
- `libs/platform/src/dto/upload.dto.ts` 仅保留 re-export，用于兼容既有导入路径
- 上传相关控制器已统一改为使用 `UploadResponseDto`

影响：

- 后续调整字段时只需要维护一份定义
- 上传模块的公共契约入口更清晰
- 保留旧导出路径的同时，没有继续扩散重复 class

建议：

- 后续继续沿用 `UploadResponseDto`，不要再恢复 `FileUploadResponseDto` 这类并行命名
- 如果再新增上传相关 DTO，优先放在上传模块下，再通过平台层做兼容导出

风险评估：**已完成**

---

## 3.5 SVG 上传存在安全与兼容性的取舍，先确认再动

相关文件：

- [libs/platform/src/config/upload.config.ts](D:/code/es/es-server/libs/platform/src/config/upload.config.ts)
- [libs/platform/src/bootstrap/multipart.ts](D:/code/es/es-server/libs/platform/src/bootstrap/multipart.ts)

现状：

- 当前允许上传 `svg`
- 本地静态服务仅对文档和压缩包强制 `attachment`
- 如果未来把用户上传的 SVG 直接以同源地址展示，需要额外留意脚本执行与 XSS 风险

影响：

- 这是一个真实的安全关注点
- 但是否立即修改，要看前端有没有把上传 SVG 当普通图片展示的依赖

建议：

- 本次先不直接改
- 等你确认是否允许前端继续展示用户上传 SVG，再决定：
  - 方案 A：禁止上传 SVG
  - 方案 B：本地静态服务对 SVG 强制下载
  - 方案 C：保留现状，但补充明确的使用边界

风险评估：**中风险，但不建议未经确认直接改**

---

## 4. 建议的实施方案

## 4.1 第一阶段：建议直接落地的轻量优化

这些项收益明确、影响面可控，且不会把系统改得更重：

1. 对齐 `scene` 默认值
2. 给 `uploadLocalFile(...)` 补统一大小校验
3. 收紧路径段校验，拦截 `"."` 和 `".."`
4. 为上传服务补针对性的单测，覆盖上述行为

预期收益：

- 减少调用方踩坑
- 提升底层安全兜底
- 避免压缩包导入路径形成“旁路规则”
- 后续维护时更容易确认行为边界

---

## 4.2 第二阶段：可选优化，不建议默认一起做

如果你确认希望顺手再做一点整理，可以考虑：

1. 在上传服务里补少量结构化日志，至少记录 provider / scene / objectKey / fileSize
2. 评估是否需要旧文件清理策略

说明：

- 第 1 项偏排障能力优化
- 第 2 项会牵涉业务语义，不能草率做

尤其是“旧文件清理”这一项，**不建议现在直接自动删除旧资源**，因为：

- 漫画章节替换、小说章节重传是否允许保留旧资源，当前没有明确策略
- 一旦误删，很难补救

---

## 4.3 明确不建议本次做的事

为了避免“过度优化导致难维护”，以下内容本次不建议动：

1. 不拆成过多 service / validator / path-manager / stream-manager 小类
2. 不引入异步消息队列或上传任务中心
3. 不为了抽象而把 provider 再做一层复杂工厂体系
4. 不引入对象存储元数据表
