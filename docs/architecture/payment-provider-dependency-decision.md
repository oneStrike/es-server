# Payment Provider Dependency Decision

Status: accepted for the payment provider closure implementation.

Scope: `es-server` payment provider order, notify verification, query, and refund fail-closed contracts. This decision must be revisited before enabling any production refund execution path.

## Decision

- Alipay: use the official `alipay-sdk` package for OpenAPI calls and RSA2 notification verification.
- WeChat Pay: do not add a third-party Node payment SDK in this round. Implement the minimal API v3 signing, HTTP request, notification signature verification, platform certificate or public key lookup, and AES-256-GCM resource decrypt logic with Node `crypto`, using the official WeChat Pay API v3 protocol as the source of truth.
- Aggregation payment SDKs or gateway packages are rejected for this round.
- Refund execution remains fail closed. No dependency choice in this document authorizes provider refund creation or refund notification state advancement.

## Evidence

| Provider | Candidate | Version checked | License | Source | Decision |
| --- | --- | --- | --- | --- | --- |
| Alipay | `alipay-sdk` | `4.14.0` | MIT | `git+ssh://git@github.com/alipay/alipay-sdk-nodejs-all.git`; package description: Alipay OpenAPI SDK for Node.js | Adopt for Alipay OpenAPI/order/notify verification work. |
| WeChat Pay | `wechatpay-node-v3` | `2.2.1` | MIT | `git+https://github.com/klover2/wechatpay-node-v3-ts.git` | Reject for production dependency in this round because it is not confirmed as an official WeChat Pay SDK. |
| WeChat Pay | `wechatpay-axios-plugin` | `0.9.6` | MIT | `git+https://github.com/TheNorthMemory/wechatpay-axios-plugin.git` | Reject for production dependency in this round because it is a broad third-party integration surface and not needed for minimal API v3 closure. |

Evidence command run on 2026-06-07:

```bash
npm view alipay-sdk version license repository.url description --json
npm view wechatpay-node-v3 version license repository.url description --json
npm view wechatpay-axios-plugin version license repository.url description --json
```

Official source review:

- Alipay has an official Node SDK package and upstream repository for OpenAPI.
- WeChat Pay official API v3 documentation defines request signing, notification signature verification, platform certificate/public key handling, and encrypted notification resource decrypt. A clearly official Node SDK was not found during this dependency gate.

## Rationale

Alipay has a provider-owned Node SDK, so adopting it reduces hand-written protocol code and keeps RSA2/OpenAPI behavior close to upstream. The implementation must still isolate provider calls behind `PaymentProviderAdapter` and must not leak private keys, certificates, API v3 keys, or internal config refs into app/admin responses.

WeChat Pay requires strong verification discipline, but adding an unofficial SDK would expand the trusted surface without removing the need to understand API v3 signing, certificate/public-key rotation, and AES-GCM decrypt semantics. A minimal in-house adapter keeps the production dependency boundary small and makes fixture-based verification explicit.

Aggregation providers are rejected because the approved RALPLAN option is a hard native provider boundary, not a gateway replacement. Aggregators would add settlement, callback, fee, reconciliation, and operational semantics that were not reviewed in this plan.

## Implementation Constraints

- Add `alipay-sdk` only in `es-server` after adapter implementation reaches the Alipay OpenAPI integration step.
- Do not add `wechatpay-node-v3`, `wechatpay-axios-plugin`, or any aggregation payment package in this round.
- WeChat signing and notification verification must be covered by fixtures that contain no secrets.
- Provider adapter methods must fail closed for unsupported channel, scene, platform, missing credential, invalid signature, amount mismatch, and unsupported refund execution.
- `createProviderRefund` and refund notification parsing must throw `BusinessException(OPERATION_NOT_ALLOWED)` or an equivalent explicit business error until a separate refund closure plan is approved.

## Revisit Conditions

Reopen this decision only if one of the following is true:

- WeChat Pay publishes or clearly endorses an official Node SDK.
- Security review requires replacing the minimal WeChat signing implementation with a vetted package.
- Refund execution becomes an approved scoped project with its own provider protocol, settlement, asset reversal, and reconciliation acceptance criteria.
- A payment gateway or funds-center program replaces the native provider boundary approved for this run.
