# 漫画压缩包导入方案

## 1. 目标

本方案要解决的是管理端漫画章节内容上传的四个问题：

- 支持上传压缩包，并且先在服务端本地解压。
- 解压后的图片仍然复用现有上传配置，决定最终落本地、七牛或 Superbed。
- 压缩包支持按章节 ID 自动匹配，但不能靠“盲猜”直接覆盖数据，必须先做预解析。
- 需要先提供预解析接口，把匹配结果返回给前端，由用户确认后再执行正式导入。

本方案默认服务对象是 `admin-api` 的漫画章节内容管理，不改变读端返回契约，也不改 `work_chapter.content` 的现有存储语义。

## 2. 当前实现与约束

基于当前代码，已经确认的现状如下：

- 漫画章节内容当前存放在 `work_chapter.content`，格式是 JSON 字符串数组，元素是图片 URL/路径。
- 管理端当前只有“单图追加上传”，入口是 `admin/content/comic/chapter-content/upload`。
- 当前单图上传如果章节已经有内容，会把新图片追加到数组末尾，不会自动清空旧内容。
- 上传落点已经统一走 `UploadService`，并且会根据系统配置里的 `uploadConfig.provider` 决定走本地、七牛或 Superbed。
- 当前 `UploadService` 只能处理 `FastifyRequest` 里的上传流，不能把“本地已存在文件”继续走同一套 provider 流程。
- 当前全局上传限制默认是 `UPLOAD_MAX_FILE_SIZE=100MB`，对多章节漫画压缩包来说很可能偏小。
- 当前上传模块只有“写入”能力，没有 provider 统一删除能力，所以“覆盖导入”后旧资源的回收暂时不能作为首版强保证。

这意味着：压缩包导入不能直接套现有单图接口，必须补一条“本地预处理 + 本地文件再上传”的链路。

## 3. 推荐总方案

推荐采用“两阶段导入 + 异步任务执行”方案，而不是单接口直接导入。

### 3.1 阶段一：预解析

- 新增管理端接口：`POST admin/content/comic/chapter-content/archive/preview`
- 入参至少包含 `workId`，可选 `chapterId`。
- 这个接口就是预解析接口。
- 接口接收压缩包后，不直接写章节内容，也不直接上传到远端。
- 服务端先把压缩包落到本地临时目录，例如：`uploads/tmp/comic-archive-import/{taskId}/source.zip`
- 然后在本地解压到独立工作目录，例如：`uploads/tmp/comic-archive-import/{taskId}/extract`
- 扫描目录结构、提取图片文件、分组章节、执行章节 ID 匹配，产出预解析结果。
- 预解析结果持久化为“导入任务草稿”，并直接返回给前端确认。

### 3.2 阶段二：确认导入

- 新增管理端接口：`POST admin/content/comic/chapter-content/archive/confirm`
- 前端必须先调用预解析接口，拿到 `taskId` 和匹配结果。
- 用户在前端确认后，再调用确认接口。
- 前端带上 `taskId`，以及最终确认的章节映射结果。
- 接口只负责把任务状态改成 `pending`，不在请求线程里执行整包上传。

### 3.3 阶段三：后台导入

- 新增漫画导入 worker，采用仓库里已有的 `@nestjs/schedule` + Cron worker 模式。
- worker 拉取 `pending` 任务，逐章节处理：
  - 读取该章节对应的图片列表。
  - 按页序把本地图片上传到最终 provider。
  - 单章节全部成功后，再更新 `work_chapter.content`。
- 单章节导入完成前，不改数据库内容，避免写入半章数据。
- 多章节任务允许部分成功，任务最终状态区分为 `success`、`partial_failed`、`failed`。

### 3.4 阶段四：清理

- 成功、失败、过期任务的临时压缩包和解压目录都由定时清理任务删除。
- 预解析后未确认的草稿任务设置 TTL，例如 24 小时自动过期。

## 4. 为什么这是最佳方案

我推荐这个方案，而不是“上传 zip 后立刻同步导入”，原因很明确：

- 压缩包导入天然比单图上传更慢，放在 HTTP 请求里容易超时。
- 章节自动匹配存在歧义，必须先给出预解析结果，不能直接覆盖线上章节内容。
- 前端先拿到预解析结果再让用户确认，交互上也更符合批量导入场景。
- 解压和远端上传都依赖本地临时文件，任务化后更容易做失败重试和过期清理。
- 当前读端只认 `work_chapter.content`，两阶段方案可以完全兼容现有前台读取逻辑。

## 5. 压缩包格式约定

首版建议只支持 `zip`，不建议首版同时承诺 `rar`、`7z`、`tar.gz`。

原因：

- `zip` 是漫画内容包里最常见、最稳定的格式。
- Node 侧做 `zip` 解压可以用纯 JS 或稳定库完成，跨平台成本最低。
- `rar` / `7z` 往往依赖外部二进制或兼容性更差的库，首版会显著放大维护成本。

### 5.1 支持的目录结构

支持以下两种主流结构：

#### 结构 A：多章节包

```text
AttackOnTitan.zip
  ├─ 101/
  │   ├─ 001.jpg
  │   ├─ 002.jpg
  │   └─ 003.jpg
  ├─ 102/
  │   ├─ 001.jpg
  │   └─ 002.jpg
  └─ 103/
      ├─ 001.jpg
      └─ 002.jpg
```

规则：

- 只识别压缩包根目录下的一级目录。
- 一级目录名必须是章节 `id`。
- 每个一级目录视为一个章节候选组。
- 组内只读取当前目录下的图片文件，并按自然序排序。
- 如果章节目录下还存在子目录，则这些子目录直接忽略，不继续向下扫描。

#### 结构 B：单章节包

```text
chapter-12.zip
  ├─ 001.jpg
  ├─ 002.jpg
  └─ 003.jpg
```

规则：

- 根目录直接是图片时，视为单章节导入。
- 这种结构必须由调用方显式传 `chapterId`，不再根据压缩包名、标题或排序号猜测章节。

### 5.2 自动忽略项

以下内容在扫描时忽略：

- `__MACOSX`
- `.DS_Store`
- `Thumbs.db`
- 隐藏文件
- 非图片文件

### 5.3 页序规则

页序采用“自然排序”，例如：

- `1.jpg` < `2.jpg` < `10.jpg`
- `001.png` < `002.png` < `010.png`

如果存在更深层目录，则这些目录直接忽略，不继续查看深层内容。

## 6. 章节匹配规则

章节匹配只在当前 `workId` 下进行，不跨作品匹配。

### 6.1 单章节包规则

- 根目录直接是图片时，视为单章节包。
- 单章节包只认请求参数里的 `chapterId`。
- 如果未传 `chapterId`，预解析结果直接返回“缺少章节 ID，无法导入单章节压缩包”。
- 如果 `chapterId` 不属于当前 `workId`，则本次包内图片全部忽略。

### 6.2 多章节包规则

- 根目录存在一级目录时，按多章节包处理。
- 多章节包只认一级目录名里的 `chapterId`。
- 目录名必须能解析为正整数，否则该目录忽略。
- 解析出 `chapterId` 后，只校验这个章节是否存在且属于当前 `workId`。
- 匹配不上就忽略，不再尝试 `sortOrder`、`title`、`subtitle` 或模糊匹配。

示例：

- 目录 `101/` 且 `workId` 下存在章节 `101`：导入候选
- 目录 `001/` 解析为 `1`，但当前作品下没有章节 `1`：忽略
- 目录 `chapter-12/`：忽略
- 目录 `第12话/`：忽略

### 6.3 友好提示与忽略结果

预解析结果里需要把被忽略的项明确返回给前端，不能只给一个“失败”。

建议失败原因统一使用数字码，字段名继续使用 `reason`。

建议首版约定：

- `1001`：目录名不是有效章节 ID
- `1002`：章节不存在或不属于当前作品
- `1003`：检测到超过允许层级的目录
- `1004`：单章节压缩包缺少 `chapterId`
- `1005`：文件不是允许的图片类型

建议返回这类结构：

```json
{
  "ignoredItems": [
    {
      "path": "chapter-12",
      "reason": 1001,
      "message": "目录 chapter-12 不是有效的章节 ID，已忽略。多章节压缩包只支持使用章节 ID 作为一级目录名。"
    },
    {
      "path": "999",
      "reason": 1002,
      "message": "目录 999 对应的章节不存在，或不属于当前作品，已忽略。"
    },
    {
      "path": "101/raw",
      "reason": 1003,
      "message": "检测到超过允许层级的目录 101/raw，系统不会继续扫描更深层目录，已忽略。"
    }
  ]
}
```

前端展示上建议直接分三类汇总：

- 可导入章节数
- 已忽略目录数
- 主要忽略原因列表

这样管理员一眼就能知道：

- 哪些目录会被导入
- 哪些目录被忽略
- 为什么被忽略

### 6.4 预解析接口返回要求

预解析接口必须直接返回给前端一份可确认的数据结构，不能只返回“任务已创建”。

建议最少包含这些字段：

- `taskId`
- `workId`
- `mode`
- `requireConfirm`
- `summary`
- `matchedItems`
- `ignoredItems`

`matchedItems` 建议额外返回章节现有内容状态，至少包含：

- `hasExistingContent`
- `existingImageCount`
- `importMode`
- `warningMessage`

建议返回示例：

```json
{
  "taskId": "123",
  "workId": 88,
  "mode": "multi_chapter",
  "requireConfirm": true,
  "summary": {
    "matchedChapterCount": 2,
    "ignoredItemCount": 3,
    "imageCount": 45
  },
  "matchedItems": [
    {
      "path": "101",
      "chapterId": 101,
      "chapterTitle": "第101话",
      "imageCount": 23,
      "hasExistingContent": true,
      "existingImageCount": 18,
      "importMode": "replace",
      "message": "目录 101 已匹配到章节 101，可在确认后导入。",
      "warningMessage": "章节 101 当前已有 18 张图片。确认导入后会用压缩包内容整体覆盖，旧资源首版不会自动删除。"
    },
    {
      "path": "102",
      "chapterId": 102,
      "chapterTitle": "第102话",
      "imageCount": 22,
      "hasExistingContent": false,
      "existingImageCount": 0,
      "importMode": "replace",
      "message": "目录 102 已匹配到章节 102，可在确认后导入。",
      "warningMessage": ""
    }
  ],
  "ignoredItems": [
    {
      "path": "chapter-12",
      "reason": 1001,
      "message": "目录 chapter-12 不是有效的章节 ID，已忽略。多章节压缩包只支持使用章节 ID 作为一级目录名。"
    }
  ]
}
```

这份结果就是前端确认页的数据源。

前端确认前：

- 不执行正式导入
- 不写 `work_chapter.content`
- 不上传页面图片到最终 provider
- 必须把 `hasExistingContent = true` 的章节用明确覆盖提示展示给用户

前端确认后：

- 调用确认接口
- 后台再进入正式导入阶段

### 6.5 层级限制

- 多章节包只扫描到 `/{chapterId}/{image}` 这一层。
- 超过这个层级的目录一律忽略，不递归。
- 单章节包只扫描根目录下的图片文件。
- 根目录下的子目录如果不符合当前模式，也作为 ignored item 返回。

这样可以保证扫描边界固定，不会因为压缩包里嵌套过深而把无关目录误导入。

### 6.6 确认接口约束

确认接口不重新解析压缩包，只接受基于预解析结果的确认操作。

建议确认接口最少包含：

- `taskId`
- `confirmedChapterIds`

其中：

- `confirmedChapterIds` 只包含用户最终确认要导入的章节
- 对于 `hasExistingContent = true` 的章节，前端只有在用户明确确认后才应放进这个列表

如果前端不传任何可导入章节：

- 接口直接返回友好错误
- 不进入后台导入流程

如果 `taskId` 已过期、已确认或已开始处理：

- 接口直接返回对应状态提示
- 不允许重复提交

## 7. 存储设计

### 7.1 本地工作目录

压缩包和解压结果永远先落本地工作目录，不直接上传压缩包到远端。

推荐目录：

```text
uploads/tmp/comic-archive-import/{taskId}/
  ├─ source.zip
  ├─ extract/
  └─ preview.json
```

这一步与最终上传 provider 无关，目的是保证：

- 可以先解压、扫描、匹配
- 可以做预解析确认
- 可以在失败后清理临时文件

### 7.2 最终图片落点

最终图片仍复用当前系统 `uploadConfig.provider`：

- `local`：落本地静态目录
- `qiniu`：上传到七牛
- `superbed`：上传到 Superbed

也就是说：

- 压缩包源文件只在本地临时目录存在
- 解压后的页面图片，才根据上传配置决定最终落点

### 7.3 最终对象路径建议

建议最终图片路径按“章节 + 导入批次 + 页码”组织：

```text
comic/{workId}/chapter/{chapterId}/{batchId}/001.jpg
comic/{workId}/chapter/{chapterId}/{batchId}/002.jpg
```

这样比继续直接用随机 UUID 更适合整章导入，原因是：

- 同一批次图片可追踪
- 页序天然可读
- 后续如果补清理策略，也更容易按批次处理

注意：

- `batchId` 建议保留，避免同一章节重复导入时复用旧 URL，导致 CDN 缓存脏读。

## 8. 数据库与任务模型

当前实现已经把任务元数据统一到数据库表 `work_comic_archive_import_task`，而不是继续落本地 `task.json`。

当前字段：

- `id`
- `taskId`
- `workId`
- `mode`
- `status`
- `archiveName`
- `archivePath`
- `extractPath`
- `requireConfirm`
- `summary`
- `matchedItems`
- `ignoredItems`
- `resultItems`
- `confirmedChapterIds`
- `startedAt`
- `finishedAt`
- `expiresAt`
- `lastError`
- `createdAt`
- `updatedAt`

状态：

- `draft`
- `pending`
- `processing`
- `success`
- `partial_failed`
- `failed`
- `expired`
- `cancelled`

当前实现的价值：

- 预解析结果有持久化载体
- 后台 worker 有稳定任务源
- 前端可以轮询任务状态和失败明细
- 多实例场景下可以通过数据库状态做任务领取，不再依赖某一台机器上的 `task.json`

注意：

- 压缩包源文件和解压目录仍然保留在本地临时目录 `uploads/tmp/comic-archive-import/{taskId}/`
- 数据库只负责持久化任务元数据、匹配结果和导入结果
- worker 先从数据库领取 `pending` 任务，再根据 `taskId` 找到对应本地目录执行导入

其中状态流转建议固定为：

- 调用预解析接口后创建 `draft`
- 用户确认后改为 `pending`
- worker 消费时改为 `processing`
- 完成后进入 `success` / `partial_failed` / `failed`

## 9. 服务拆分建议

推荐的代码拆分如下：

### 9.1 `apps/admin-api`

新增控制器动作：

- `archive/preview`
- `archive/confirm`
- `archive/detail`
- 可选 `archive/cancel`

其中：

- `archive/preview` 负责预解析压缩包，并把匹配结果返回给前端确认
- `archive/confirm` 只接受基于预解析结果确认后的任务，不负责重新扫描压缩包

### 9.2 `libs/content/src/work/content`

新增服务：

- `ComicArchiveImportService`
- `ComicArchiveMatchService`
- `ComicArchiveImportWorker`

新增类型文件：

- `comic-archive-import.type.ts`

### 9.3 `libs/platform/src/modules/upload`

扩展 `UploadService`，补一条“从本地文件上传”的能力，例如：

- `uploadLocalFile(...)`

这个方法要复用现有 provider 选择逻辑，而不是重新写一套七牛/Superbed/本地分发逻辑。

## 10. 数据写入策略

首版建议只支持 `replace` 模式，不建议一开始就做 `append`。

原因：

- 压缩包导入通常语义就是“整章重建”
- `append` 容易序一和当前已有页序冲突
- `replace` 更适合和批次目录、整章页起工作

单章节写入策略：

1. 先上传该章节全部图片
2. 生成新的图片 URL 数组
3. 再更新 `work_chapter.content`

如果章节当前已经有内容：

- 预解析阶段就返回 `hasExistingContent = true`
- 前端确认页必须提示“本次导入会覆盖现有章节内容”
- 用户确认后，正式导入阶段使用新的图片数组整体替换旧的 `work_chapter.content`
- 旧图片资源首版不自动删除，只做数据库内容替换

如果章节内任何一张图片失败：

- 该章节不更新数据库
- 任务记录失败明细

如果整包里有多个章节：

- 已成功章节保留成功结果
- 失败章节保留失败记录
- 任务最终状态可为 `partial_failed`

这是因为远端对象存储上传本身无法与数据库事务做真正的全局原子提交。

## 11. 安全与稳定性要求

解压阶段必须加这些保护：

- 拒绝绝对路径和 `..` 路径，防止 Zip Slip
- 限制最大文件数
- 限制最大解压后总大小
- 限制单章节最大图片数
- 限制任务可导入的最大章节数
- 只允许图片文件进入最终导入队列

此外还建议补两个独立限制：

- `COMIC_ARCHIVE_MAX_FILE_SIZE`
- `COMIC_ARCHIVE_MAX_UNCOMPRESSED_SIZE`

不要直接把漫画压缩包完全绑定到通用上传的 `100MB` 默认值上。

## 12. 首版明确不做的事

为了把第一版做稳，建议暂时不做这些内容：

- 不支持 `rar` / `7z` / `tar.gz` 自动导入
- 不支持导入后自动删除旧远端资源
- 不支持一包同时导入到多个作品
- 不支持小说章节压缩包复用这套能力
- 不支持“纯模糊匹配后自动覆盖”这种高风险策略

## 13. 实施顺序建议

建议按下面顺序落地：

1. 扩展 `UploadService`，支持本地文件二次上传
2. 增加 zip 预解析与本地解压扫描
3. 增加章节 ID 匹配、预解析结果返回结构和草稿持久化
4. 增加确认接口和后台 worker
5. 增加任务详情、清理任务、失败重试

## 14. 方案结论

最终推荐方案是：

- 首版只支持 `zip`
- 压缩包始终先落本地临时目录并解压
- 解压后的页面图片再按现有 `uploadConfig.provider` 决定最终去向
- 必须先提供预解析接口，把匹配结果返回给前端用户确认
- 采用“预解析 -> 确认 -> 后台导入 -> 清理”的两阶段任务化流程
- 多章节包只按一级目录名里的 `chapterId` 匹配，匹配不上直接忽略并返回友好提示
- 超过允许层级的目录直接忽略，不继续扫描深层目录
- 保持 `work_chapter.content` 现有结构不变，避免读端联动改造

这是在当前仓库实现基础上，风险最低、可扩展性最好、也最不容易把章节内容误覆盖的一条路线。

## 15. 已发现的现状冲突

本轮只做方案，没有改代码，但已经看到一个与上传配置相关的存量不一致点：

- `db/seed/modules/system/domain.ts` 里的 `uploadConfig` seed 结构仍是旧口径，和当前 `libs/config/src/system-config/system-config.constant.ts` / DTO 的上传配置结构不一致。

后续真正实施压缩包导入时，应以当前运行中的 `ConfigReader.getUploadConfig()` 与系统配置 DTO 为准，不应继续参考旧 seed 结构扩散实现。
