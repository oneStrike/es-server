# SVG 上传放行方案

## 1. 目标

本方案的目标不是“禁止 SVG”，而是：

- 明确保留 SVG 上传能力
- 控制 SVG 作为不可信主动内容带来的安全风险
- 尽量采用轻量、可维护的方式落地

结论先写在前面：

- **允许上传 SVG**
- **不把用户上传 SVG 当成完全可信图片资源**
- **重点治理访问与渲染策略，而不是把上传链路改复杂**

---

## 2. 当前现状

相关代码：

- [upload config](D:/code/es/es-server/libs/platform/src/config/upload.config.ts)
- [multipart bootstrap](D:/code/es/es-server/libs/platform/src/bootstrap/multipart.ts)
- [upload service](D:/code/es/es-server/libs/platform/src/modules/upload/upload.service.ts)

当前系统实际上已经允许上传 SVG：

- `upload.config.ts` 的 `allowExtensions.image` 里包含 `svg`
- `mime.lookup('svg')` 也会进入允许的 MIME 集合
- `upload.service.ts` 对 SVG 的识别主要依赖扩展名和 MIME fallback

所以这次真正要确认的不是“能不能传”，而是：

- SVG 上传后是否允许直接访问
- 是否允许直接在前端展示
- 不同 provider 下如何保证响应头策略一致

---

## 3. 风险判断

SVG 和普通位图不一样，它本质上是 XML 文本，具备更强表达能力。

如果把用户上传 SVG 当成普通静态图片资源对待，主要风险在这里：

1. SVG 可能包含脚本、事件属性、外部引用、`foreignObject` 等主动内容。
2. 即使上传链路本身没问题，浏览器访问 SVG 时的上下文不同，风险也不同。
3. 当前本地静态文件服务只对文档和压缩包加了 `attachment`，没有单独处理 SVG。
4. 如果未来切到七牛或 Superbed，Fastify 本地静态头部策略不会自动继承到远端资源。

这意味着：

- **风险核心在“如何返回 SVG”**
- **不是简单把 `svg` 从白名单里删掉或留着就能彻底解决**

---

## 4. 推荐方案

## 4.1 推荐原则

建议采用下面这条原则：

- 上传层：继续允许 SVG
- 存储层：继续按现有图片分类处理，不额外引入复杂元数据表
- 访问层：把 SVG 当成“不可信静态资源”处理
- 前端层：允许展示，但限制使用方式

这是当前最平衡的方案：

- 不会破坏 SVG 上传能力
- 不需要立即上重型 sanitizer
- 能把真正的风险收敛在渲染边界

---

## 4.2 Phase 1：本地 provider 已落地的轻量方案

### A. 后端继续允许上传 SVG

这部分当前已经满足：

- `upload.config.ts` 继续保留 `svg`
- 上传服务现有校验链路不额外封禁 `svg`

后续如需再补强，建议增加两类测试：

1. `.svg` 扩展名文件可以通过上传校验
2. `.svg` 的返回结果与其他图片保持一致的上传响应结构

### B. 本地静态服务为 SVG 单独加安全响应头

目标：

- 允许浏览器展示 SVG
- 但尽量降低脚本执行、嗅探和上下文滥用风险

这部分已经落地到 [multipart bootstrap](D:/code/es/es-server/libs/platform/src/bootstrap/multipart.ts)：

- `Content-Type: image/svg+xml; charset=utf-8`
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox`

说明：

- 这里**不推荐**直接给 SVG 强制 `attachment`
- 因为你的目标已经明确是“允许上传 SVG”，大概率也需要保留它的浏览器可预览能力
- 用 CSP + `nosniff` 比“直接禁预览”更符合本次目标

并已补充单测：

- [multipart spec](D:/code/es/es-server/libs/platform/src/bootstrap/multipart.spec.ts)

### C. 前端只按“图片资源”方式使用 SVG

建议把使用边界写清楚：

- 允许：`<img src="...">`
- 允许：CSS `background-image`
- 不允许：`iframe`
- 不允许：`object`
- 不允许：`embed`
- 不允许：把 SVG 文件内容读出来后直接内联进 DOM

这条虽然是前端约束，但建议同步写进接口或资源使用说明里。

### D. 明确 provider 兼容策略

这是本方案里最需要审查的一点。

当前上传支持：

- local
- qiniu
- superbed

而 SVG 的响应头控制能力取决于 provider：

#### local

可由当前 Nest + Fastify 直接控制返回头，最容易落地。

#### qiniu / superbed

如果文件最终直接走对象存储或图床域名访问：

- Fastify 的本地 `setHeaders(...)` 不会生效
- 安全头是否能落下，取决于远端平台能力和配置方式

所以推荐策略是：

1. **如果当前生产主要用 local provider**
   当前实现已经可以直接使用。
2. **如果当前生产会用 qiniu / superbed**
   先确认远端是否能稳定为 `.svg` 返回指定安全头。
3. **如果远端头部不可控**
   不建议让前端直接使用远端 SVG 原始 URL。
   这时更稳的方式是增加一个后端代理读取出口，由服务端统一补安全头。

这个代理出口只需要对 SVG 使用，不需要把所有上传资源都改成代理模式。

---

## 4.3 Phase 2：按需再考虑的增强方案

如果后面业务对 SVG 的使用更重，比如：

- 大量用户自定义图标
- 需要在更多前端场景直接使用
- 对安全要求更高

再考虑加一层 SVG 清洗。

可选增强方向：

1. 上传时做 SVG sanitizer，移除脚本、事件属性、危险标签和外部引用
2. 落库存储时记录“是否原始 SVG / 是否清洗过”
3. 对 SVG 生成位图预览图，前端默认展示 raster preview

这类增强方案不是不能做，而是：

- 成本更高
- 兼容性更复杂
- 很容易演变成“过度治理”

所以不建议在第一版就上。

---

## 5. 明确不建议的做法

这几种做法我不建议直接采用：

1. 允许上传 SVG，但完全不加任何访问层限制。
2. 因为有风险就直接把 SVG 全部强制下载。
3. 为了处理 SVG，把整个上传系统重构成新架构。
4. 在没有明确业务需求前，先引入重量级 SVG 清洗流水线。

原因：

- 第 1 种风险太直接
- 第 2 种会和“允许上传 SVG 并使用它”这个目标冲突
- 第 3、4 种会明显提高维护成本

---

## 6. 推荐落地顺序

建议按下面顺序推进：

1. 先确认生产上实际使用的 upload provider
2. 如果主用 local，先在 Fastify static 上补 SVG 专属安全头
3. 补 SVG 上传与头部策略相关测试
4. 前端侧确认不使用 `iframe/object/embed` 渲染用户上传 SVG
5. 若后面要接 qiniu / superbed，再评估是配远端响应头还是加 SVG 代理出口

---

## 7. 我建议你审查的决策点

请重点审这 3 个点：

1. 是否接受“允许 SVG 预览，但加 CSP + nosniff，而不是强制下载”
2. 是否接受“远端 provider 头部不可控时，SVG 单独走后端代理出口”
3. 是否接受“第一版先不上 sanitizer，只先做轻量访问层治理”

---

## 8. 当前状态与我的建议结论

当前已完成：

1. 保留 SVG 上传
2. local provider 为 SVG 增加专属安全头
3. 补充本地静态头部策略单测

当前仍待确认：

1. 前端是否严格只按图片方式使用 SVG
2. qiniu / superbed 场景是否具备可控的 SVG 响应头策略
3. 是否需要为远端 provider 增加 SVG 代理出口

如果你要一个当前最稳、又不至于过度设计的方案，我建议继续按这版推进：

1. 保留 SVG 上传
2. local provider 继续沿用当前专属安全头
3. 前端只按图片方式使用 SVG
4. qiniu / superbed 只有在头部策略可控时才直接暴露原始 SVG URL
5. sanitizer 暂不进入第一阶段

这套方案的优点是：

- 保留业务能力
- 改动面可控
- 维护成本不高
- 后续还能平滑升级到更强的 SVG 处理策略
