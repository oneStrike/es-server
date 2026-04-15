# 敏感词管理与等级成长模块审查结果清单

生成时间：2026-04-15

## 审查范围

- 敏感词管理主链路
  - `apps/admin-api/src/modules/forum/sensitive-word/*`
  - `libs/moderation/sensitive-word/src/*`
  - `db/schema/system/sensitive-word.ts`
  - `libs/forum/src/topic/forum-topic.service.ts`
  - `libs/interaction/src/comment/comment.service.ts`
  - `libs/config/src/system-config/*`
- 等级成长主链路
  - `apps/admin-api/src/modules/growth/*`
  - `apps/admin-api/src/modules/app-user/app-user-growth.service.ts`
  - `libs/growth/src/level-rule/*`
  - `libs/growth/src/experience/*`
  - `libs/growth/src/point/*`
  - `libs/growth/src/growth-ledger/*`
  - `libs/growth/src/growth-reward/*`
  - `libs/growth/src/event-definition/*`
  - `libs/growth/src/permission/permission.service.ts`
  - `libs/interaction/src/*/*-growth.service.ts`
  - `libs/content/src/permission/content-permission.service.ts`
  - `db/schema/app/user-level-rule.ts`
  - `db/schema/app/user-experience-rule.ts`
  - `db/schema/app/growth-ledger-record.ts`
  - `db/schema/app/growth-rule-usage-slot.ts`
  - `db/schema/app/growth-audit-log.ts`
  - `db/schema/forum/forum-section.ts`
  - `db/schema/work/work.ts`
  - `db/schema/work/work-chapter.ts`

## 审查维度

- 架构与分层：Controller / Service / DTO / Schema / 事件桥职责边界
- 接口契约：入参校验、配置项语义、返回结构、后台治理入口
- 业务正确性：敏感词检测、替换、统计、等级判定、奖励发放、升级同步
- 数据一致性：幂等键、事务边界、删除保护、配置与运行时约束一致性
- 安全与权限：后台人工补发治理、悬空权限配置、禁用/治理态影响
- 性能与可运维性：统计口径、缓存失效、限流槽位、测试覆盖

## 整体结论

- 模块分层整体可读性尚可，敏感词管理、成长账本、事件桥接、互动触发链路都已经拆成独立服务，控制器也基本保持薄层。
- 但当前实现存在 6 个需要优先处理的实质性问题，其中 3 个会直接导致“配置语义与运行结果不一致”，2 个会导致“权限/等级口径被删坏或算错”，1 个会导致后台人工补发治理失真。
- 另外，敏感词核心库与成长核心库（level-rule / point / experience / growth-ledger / growth-reward）几乎没有专门单测，现有测试主要覆盖评论、主题、内容权限以及 growth 下的 task/check-in 子域。

## 发现清单

### 1. [必须修复] 敏感词 `matchMode` 配置与运行态不一致，`REGEX` 永远不会生效，`FUZZY/REGEX` 词条还会被 `EXACT` 路径误命中

- 位置：
  - `libs/moderation/sensitive-word/src/sensitive-word-constant.ts:52-58`
  - `libs/moderation/sensitive-word/src/dto/sensitive-word.dto.ts:69-76`
  - `libs/moderation/sensitive-word/src/sensitive-word-detect.service.ts:65-77`
  - `libs/moderation/sensitive-word/src/sensitive-word-detect.service.ts:107-123`
- 问题说明：
  - 配置层明确支持 `1=EXACT / 2=FUZZY / 3=REGEX`。
  - 运行态初始化时，AC 自动机把所有启用词都塞进了 `wordList`，没有按词条自己的 `matchMode` 过滤。
  - 检测时又只根据请求体里的 `matchMode` 二选一地走 AC 或 BK-Tree，除 `FUZZY` 之外全部落到 AC 自动机。
  - 结果就是：
    - `REGEX` 词条根本没有正则匹配实现，只会退化成普通字符串精确匹配。
    - 标记为 `FUZZY` 的词条，在默认 `EXACT` 检测路径里也会被 AC 自动机命中，词条级匹配策略失真。
- 风险：
  - 审核策略和后台配置不一致。
  - 运营以为已经启用正则/模糊策略，线上实际不是那个语义。
  - 默认消费方（论坛主题、评论）拿到的命中结果与管理端配置不一致。
- 建议修复：
  - 明确“匹配模式”到底是“词条级策略”还是“请求级策略”，两者不能混用。
  - 若保留词条级 `matchMode`，初始化时至少要拆成 `EXACT / FUZZY / REGEX` 三套索引，消费时按词条能力汇总结果。
  - 若暂不支持 `REGEX`，应先从 DTO、枚举与后台配置里移除，避免假能力上线。

### 2. [必须修复] 自定义 `replaceWord` 长度与原词不一致时，替换结果会被截断或残留原文

- 位置：
  - `libs/moderation/sensitive-word/src/sensitive-word-detect.service.ts:209-229`
- 问题说明：
  - `replaceWords()` 先把原文拆成字符数组，再逐字符覆盖。
  - 覆盖循环固定按 `matched.word.length` 走，并且只在 `i < replacement.length` 时写入。
  - 这意味着：
    - `replaceWord` 比原词短时，后半段原文会残留。
    - `replaceWord` 比原词长时，超出的字符会直接被截断。
- 直接后果：
  - 后台看到“已配置替换词”，但实际替换文本可能仍然泄露部分敏感词。
  - 前台预览和真实审核替换结果不一致，容易误导运营。
- 建议修复：
  - 不要按字符位原地覆盖，改成基于区间拼接的新字符串构造。
  - 明确限制 `replaceWord` 必须与原词等长，或者支持变长替换并按区间重建文本。

### 3. [必须修复] 敏感词统计当前既没有真实采集，也没有正确时间口径

- 位置：
  - `libs/moderation/sensitive-word/src/sensitive-word-statistics.service.ts:121-170`
  - `libs/moderation/sensitive-word/src/sensitive-word-statistics.service.ts:281-312`
  - `libs/forum/src/topic/forum-topic.service.ts:490-523`
  - `libs/forum/src/topic/forum-topic.service.ts:1210-1240`
  - `libs/interaction/src/comment/comment.service.ts:827-860`
- 问题说明：
  - 统计服务提供了 `incrementHitCount(s)`，但实际消费方只做检测并写 `sensitiveWordHits`，没有任何地方调用统计增量方法。
  - 即使后面把增量接上，`todayHits / lastWeekHits / lastMonthHits` 当前也是错口径：
    - 代码是“按 `lastHitAt >= startDate` 过滤词条，然后把该词条的累计 `hitCount` 全部求和”。
    - 某个词 30 天累计命中 100 次，只要今天又命中 1 次，`todayHits` 就会把 100 全算进去。
- 风险：
  - 管理端统计面板长期显示 0，或者后续补接后出现明显高估。
  - 运营无法用这些数字判断词库效果与近期审核压力。
- 建议修复：
  - 先把命中采集真正接到主题/评论等消费链路。
  - 如果要做日/周/月统计，必须落明细日志或按天聚合，不能只靠“累计次数 + 最后命中时间”反推时间窗数据。

### 4. [必须修复] 等级规则里的 `loginDays` 只存不算，升级口径与后台配置不一致

- 位置：
  - `db/schema/app/user-level-rule.ts:36-38`
  - `libs/growth/src/level-rule/dto/level-rule.dto.ts:52-57`
  - `libs/growth/src/level-rule/level-rule.service.ts:267-283`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts:972-986`
- 问题说明：
  - 等级规则明确有 `loginDays` 字段，种子数据也配置了 7 天、30 天这类门槛。
  - 但升级判定、经验反查当前等级、账本结算后的等级同步，全部只看 `requiredExperience`，没有任何地方读取或校验 `loginDays`。
- 风险：
  - 后台配置了登录天数门槛，实际线上完全不生效。
  - 用户会在经验达标后直接升级，破坏成长体系规则可信度。
- 建议修复：
  - 明确等级升级的正式条件集合，是“仅经验值”还是“经验值 + 登录天数”。
  - 若 `loginDays` 是有效业务字段，就要把它纳入升级判定、下一级展示和后台校验。
  - 若业务已不再使用 `loginDays`，应从 schema / DTO / 管理端文案中整体下线，避免伪配置项继续误导。

### 5. [必须修复] 删除等级规则只检查 `app_user.levelId`，没有拦截论坛板块和内容阅读权限的引用

- 位置：
  - `libs/growth/src/level-rule/level-rule.service.ts:157-186`
  - `db/schema/forum/forum-section.ts:20-22`
  - `db/schema/work/work.ts:115-118`
  - `db/schema/work/work-chapter.ts:74-77`
  - `libs/growth/src/permission/permission.service.ts:109-127`
- 问题说明：
  - 当前删除前只检查有没有用户挂在该等级上。
  - 但同一个等级规则还会被论坛板块发帖门槛、作品阅读等级、章节阅读等级引用。
  - 一旦删除成功，这些配置不会同步清理，运行时再校验权限就只能读到“等级不存在”。
- 风险：
  - 板块发帖权限、作品/章节阅读权限被删成悬空配置。
  - 线上出现“用户等级足够但访问时报等级不存在/权限异常”的错误。
- 建议修复：
  - 删除前至少补齐对 `forum_section.userLevelRuleId`、`work.requiredViewLevelId`、`work_chapter.requiredViewLevelId` 的引用检查。
  - 更稳妥的做法是：先禁止硬删除，改成“禁用 + 迁移引用”流程。

### 6. [必须修复] 积分/经验规则允许配置超过 2000 的限额，但运行态会直接抛 500

- 位置：
  - `libs/growth/src/point/dto/point-rule.dto.ts:33-49`
  - `libs/growth/src/experience/dto/experience-rule.dto.ts:33-49`
  - `libs/growth/src/point/point-rule.service.ts:149-154`
  - `libs/growth/src/experience/experience.service.ts:468-473`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts:40`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts:584-587`
- 问题说明：
  - 规则配置层对 `dailyLimit / totalLimit` 只要求“非负整数”，没有上限。
  - 账本层却写死了 `maxSlotReserveLimit = 2000`，超过这个值会直接 `throw Error`。
  - 也就是说后台完全可以把规则保存成 `5000`，但线上第一次结算就会炸成 500。
- 风险：
  - 配置可保存、运行不可执行，属于典型的“配置与运行时约束失配”。
  - 一旦生产上有人改了高限额规则，相关成长事件会全部异常。
- 建议修复：
  - 在 DTO / Service 写入层同步加上 `<= 2000` 的显式校验。
  - 或者把槽位算法改成可支持更高上限的实现，不要把运行时限制藏在内部常量里。

### 7. [建议修改] 后台“直接发经验”接口绕过了手工补发治理，且会把合法重复操作静默幂等掉

- 位置：
  - `apps/admin-api/src/modules/growth/experience/experience.controller.ts:75-85`
  - `libs/growth/src/experience/dto/experience-record.dto.ts:144-165`
  - `libs/growth/src/experience/experience.service.ts:203-212`
  - 对照实现：
    - `libs/user/src/dto/admin-app-user.dto.ts:29-37`
    - `apps/admin-api/src/modules/app-user/app-user-growth.service.ts:207-223`
- 问题说明：
  - `admin/growth/experience-rules/grant` 直接接收 `AddUserExperienceDto`，没有 `operationKey`，也没有走 `ensureSuperAdmin()` 的人工补发入口。
  - 服务层默认 bizKey 只由 `userId + ruleType + targetType + targetId + remark + source` 组成。
  - 结果是同一个后台操作员对同一用户、同一规则、同一备注连续补发两次时，第二次会被静默当成同一次请求。
- 风险：
  - 后台人工补发行为缺少稳定操作键，不利于排障和审计。
  - 合法的重复补发会被错误吞掉，运营误以为已经到账。
- 建议修复：
  - 若该接口需要保留，建议改成复用 `app-user` 模块那套 `operationKey + superAdmin` 手工操作入口。
  - 至少要给当前接口补 `operationKey`，并把“幂等重试”和“新的一次补发”区分开。

## 测试覆盖评估

- 已验证：
  - `pnpm test -- --runInBand --runTestsByPath libs/interaction/src/comment/comment.service.spec.ts libs/forum/src/topic/forum-topic.service.spec.ts libs/content/src/permission/content-permission.service.spec.ts`
    - 结果：通过（3 个 test suites，19 个 tests）
  - `pnpm type-check`
    - 结果：通过
- 明显缺口：
  - `libs/moderation/sensitive-word/src` 下没有针对检测器、替换逻辑、统计逻辑的专门单测。
  - `libs/growth/src/level-rule`、`libs/growth/src/point`、`libs/growth/src/experience`、`libs/growth/src/growth-ledger`、`libs/growth/src/growth-reward` 基本没有专门单测。
  - 缺少“等级删除引用保护”“loginDays 生效”“限额 > 2000 拒绝写入”“后台直接发经验幂等治理”这些高风险分支测试。

## 建议的整改优先级

- P0：
  - 修复敏感词 `matchMode` 语义失真问题。
  - 修复敏感词替换逻辑对变长 `replaceWord` 的错误处理。
  - 修复等级规则 `loginDays` 配置不生效问题。
  - 修复等级规则删除未检查外部引用的问题。
- P1：
  - 修复敏感词统计链路“未采集 + 错口径”的双重问题。
  - 让积分/经验规则写入层与 `maxSlotReserveLimit` 对齐。
  - 收敛后台“直接发经验”接口到统一人工补发治理入口。
- P2：
  - 为 sensitive-word / level-rule / growth-ledger / growth-reward 补充专门单测。
  - 评估敏感词缓存维度缓存是否仍有保留必要，避免无调用的缓存分支继续漂移。

## 备注

- 本次仅做代码审查与本地结果清单生成，没有修改业务实现。
- 审查重点放在“敏感词管理”和“等级成长主链路”，task / check-in 子域未作为本次主审对象展开重审。
