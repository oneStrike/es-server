# Membership Monetization Destructive Update

## Scope

- API:
  - `app/monetization/*`
  - `admin/monetization/*`
  - content permission and chapter purchase related app APIs
- Domain: 内容阅读权限、虚拟币章节购买、VIP 订阅、支付 provider、广告激励、券包与用户资产
- Change type: 破坏性更新，无兼容层

## Contract Changes

### Content permission

`viewRule=2` 的业务语义从“会员等级可见”切换为“VIP 可见”。

下线旧语义：

- 用户成长等级不再授予内容阅读权限。
- 积分和等级不再参与章节购买折扣或阅读放行。
- `user_purchase_record` 不再作为阅读放行、已购列表和购买计数的事实源。

新语义：

- 有效 `user_membership_subscription` 可读取 VIP 内容。
- `user_content_entitlement(grantSource=购买,status=有效)` 是购买阅读、已购列表和购买计数的事实源。
- 广告、阅读券、后台补偿和 VIP 试用可以授予阅读权益，但不计入已购买。

### Purchase and assets

新章节购买只消耗虚拟币余额。

下线旧入口：

- 新购买请求不再接受历史积分支付语义。
- 历史积分购买只作为旧支付方式快照保留。

新写入链路必须在同一事务内完成：

- 虚拟币扣减
- `user_purchase_record` 审计记录
- `user_content_entitlement` 购买权益
- 章节购买计数更新

### Monetization provider configuration

支付和广告 provider 配置改为 admin 可配置的部署内确定性选择。

新增或重定义的关键契约：

- 支付 provider 支持渠道、场景、平台、环境、应用键、provider app / merchant 标识、配置版本和密钥版本引用。
- 微信 APIv3 key 的物理列名固定为 `api_v3_key_ref`。
- 敏感密钥、证书和 SSV key 不以明文入库、日志或响应返回。
- 支付订单和广告奖励必须快照配置 ID、配置版本、密钥版本引用、客户端上下文和 provider payload。
- App 支付结果只返回 `orderNo`、`orderType`、`status`、`subscriptionMode`、`payableAmount`、`clientPayPayload`；`providerConfigId`、`providerConfigVersion`、`credentialVersionRef`、`configSnapshot`、`clientContext`、`notifyPayload` 等内部字段不再作为 App contract 暴露。

### VIP, coupon, and ad reward

VIP 不再复用成长等级。

新事实源：

- VIP 套餐由 `membership_plan` 和套餐权益关联表描述。
- VIP 有效期由 `user_membership_subscription` 描述。
- 自动续费协议由独立协议事实表描述。
- 券定义、券实例和券核销记录分别描述券配置、用户券包和核销事实。
- 广告激励只写广告奖励记录和临时权益，不写购买记录。
- 阅读券核销按 `grantSource=阅读券 + sourceId=redemptionId` 保证权益事实唯一；VIP 试用卡按 `sourceType=VIP 试用卡 + sourceId=redemptionId` 保证订阅事实唯一，重复 `bizKey` 只返回既有核销记录，不重复发放权益。

VIP 协议配置改为直接关联 `app_agreement`。

下线旧字段：

- `membership_plan.agreement_codes`
- `membership_page_config.service_agreement_code`
- `membership_page_config.privacy_agreement_code`
- `membership_page_config.renewal_agreement_code`

新语义：

- VIP 模块不再规定协议类型和协议 code。
- `membership_page_config_agreement` 保存订阅页与 `app_agreement.id` 的多对多关联。
- admin 选择几个已发布协议，app 订阅页就展示几个协议。
- 下单和自动续费签约事实快照冻结协议 `id/title/version/isForce/publishedAt`。
- `membership_plan.benefit_snapshot` 下线；套餐展示从 `membership_plan_benefit` 关联的权益定义与配置生成，不再维护手填展示快照。

## Data Handling

历史数据只通过数据库 migration SQL 处理，不使用 TS、Node 或 Python 一次性迁移脚本。

本次 migration 负责：

- 创建会员、支付、广告、券和内容权益相关表。
- 将历史成功购买刷写为永久购买权益。
- 将历史积分支付方式转换为旧支付方式快照值。
- 创建 `membership_page_config_agreement`，先将会员订阅页和套餐上的历史协议 code 回填为 `app_agreement` 关联，再删除 VIP 协议旧 code 字段。
- 为阅读券权益和 VIP 试用订阅补 source 唯一索引；上线前必须确认历史重复 source 已清理。
- 删除 `membership_plan.benefit_snapshot`，避免套餐权益展示与真实权益配置双写。
- 提供只读 `reconcile.sql` 对账历史购买、权益、重复、孤儿目标、支付方式转换数量、协议 code 回填缺失和重复 source；任一 stop 状态必须先修数据再发布。

## Compatibility

不提供旧等级阅读、积分购买或购买记录直读权限的兼容层。

客户端和 admin 需要同步使用新的 DTO / OpenAPI contract：

- VIP、超级 VIP、套餐展示、权益包、会员说明和自动续费提示由后端返回。
- VIP 协议由 admin 选择 `app_agreement` 后随订阅页返回，不再使用固定协议 code 字段。
- VIP 套餐不再返回 `benefitSnapshot`；admin 必须通过结构化套餐权益配置维护真实权益事实。
- App 支付接口消费者必须改用新的支付结果白名单字段；旧的 provider 配置快照、凭据引用、通知 payload 和客户端上下文字段没有兼容期。
- 章节详情、已购列表和购买计数以权益事实为准。
- 新支付和广告链路依赖 provider 配置，不再依赖代码内硬编码。

回滚只能回到服务端和数据库同一版本快照；本次不提供旧字段双读、旧 code fallback 或旧支付响应字段兼容层。

## Verification

发布前必须完成：

- `pnpm db:comments:check`
- `pnpm exec eslint "{src,apps,libs,test}/**/*.ts"`
- `pnpm type-check`
- membership monetization 相关 service specs
- `db/migration/20260506193000_membership_monetization_destructive_update/reconcile.sql` 对账输出核验
- `db/migration/20260508020000_vip_agreement_app_agreement_breaking/reconcile.sql` 对账输出为 `ok`
