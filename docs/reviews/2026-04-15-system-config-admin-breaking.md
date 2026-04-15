# Admin 前端破坏性更新清单

## 说明

- 本文只列系统配置模块中 Admin 前端会直接感知的合同变化。
- 本轮按破坏性更新执行：不提供兼容层，不接受旧的“无版本直接保存”写法。

## 1. 系统配置保存必须携带快照 ID

- 影响接口：
  - `GET admin/system/config`
  - `POST admin/system/update`
- 变更行为：
  - `GET admin/system/config` 返回的配置快照现在必须作为编辑基线使用
  - `POST admin/system/update` 请求体必须携带当前快照 `id`
- 前端必须调整：
  - 配置页进入编辑态后，保存时必须把当前接口返回的 `id` 一并提交
  - 不允许继续沿用旧的“只传配置块、不传 id”写法

## 2. 保存冲突语义变更

- 影响接口：
  - `POST admin/system/update`
- 新行为：
  - 若提交时携带的 `id` 已不是数据库最新快照，后端直接拒绝保存
  - 固定错误文案：`系统配置已更新，请刷新后重试`
- 前端必须调整：
  - 收到该错误时，提示用户刷新配置并重新编辑
  - 不要自动重试旧请求，也不要继续用旧表单状态覆盖新快照

## 3. 上传 provider 改为保存前强校验

- 影响接口：
  - `POST admin/system/update`
- 新行为：
  - `provider=local`：直接通过
  - `provider=qiniu`：必须同时提供 `accessKey`、`secretKey`、`bucket`、`domain`
  - `provider=superbed`：必须提供 `token`
- 前端必须调整：
  - 切换上传 provider 时，表单校验与保存逻辑要同步要求对应必填字段
  - 后端现在会在保存阶段直接拒绝不完整配置，不能再假定“保存成功、运行时报错”

## 4. 不变项

- 系统配置读取接口路径不变
- 顶层配置块名称不变：
  - `aliyunConfig`
  - `siteConfig`
  - `maintenanceConfig`
  - `contentReviewPolicy`
  - `uploadConfig`
- 敏感字段继续允许回传掩码值表示“保留原值”
