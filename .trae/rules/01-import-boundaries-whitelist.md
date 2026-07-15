# 导入边界白名单附录

本文件是 [导入边界规范](./01-import-boundaries.md) 的白名单附录，只承载允许入口列表。

- 它不是独立规则文件。
- 白名单解释、禁止项和导入原则仍以 [01-import-boundaries.md](./01-import-boundaries.md) 为准。

## `libs/platform` 允许入口

- 顶层目录入口：
  - `@libs/platform/bootstrap`
  - `@libs/platform/config`
  - `@libs/platform/constant`
  - `@libs/platform/decorators`
  - `@libs/platform/dto`
  - `@libs/platform/exceptions`
  - `@libs/platform/filters`
  - `@libs/platform/types`
  - `@libs/platform/utils`
- `modules` 具体子模块入口：
  - `@libs/platform/modules/auth/auth-cron.service`
  - `@libs/platform/modules/auth/auth.guard`
  - `@libs/platform/modules/auth/auth.module`
  - `@libs/platform/modules/auth/auth.service`
  - `@libs/platform/modules/auth/auth.strategy`
  - `@libs/platform/modules/auth/base-token-storage.service`
  - `@libs/platform/modules/auth/login-guard.service`
  - `@libs/platform/modules/auth/dto`
  - `@libs/platform/modules/auth/helpers`
  - `@libs/platform/modules/auth/types`
  - `@libs/platform/modules/captcha/captcha.service`
  - `@libs/platform/modules/captcha/captcha.module`
  - `@libs/platform/modules/captcha/dto`
  - `@libs/platform/modules/crypto/aes.service`
  - `@libs/platform/modules/crypto/crypto.module`
  - `@libs/platform/modules/crypto/rsa.service`
  - `@libs/platform/modules/crypto/scrypt.service`
  - `@libs/platform/modules/geo/dto`
  - `@libs/platform/modules/geo/geo.module`
  - `@libs/platform/modules/geo/geo.service`
  - `@libs/platform/modules/geo/geo.type`
  - `@libs/platform/modules/logger/logger.module`
  - `@libs/platform/modules/logger/logger.service`
  - `@libs/platform/modules/logger/logger.type`
  - `@libs/platform/modules/sms/dto`
  - `@libs/platform/modules/sms/sms.constant`
  - `@libs/platform/modules/sms/sms.module`
  - `@libs/platform/modules/sms/sms.service`
  - `@libs/platform/modules/sms/sms.type`
  - `@libs/platform/modules/upload/dto`
  - `@libs/platform/modules/upload/upload.constant`
  - `@libs/platform/modules/upload/upload.module`
  - `@libs/platform/modules/upload/upload.service`
  - `@libs/platform/modules/upload/upload.type`

## `db` 允许入口

- `@db/core`
- `@db/schema`
