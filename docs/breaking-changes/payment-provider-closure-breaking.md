# Payment Provider Closure Breaking Change

## Scope

This rollout hard-cuts the payment module from client/admin-submitted payment facts to provider-native order creation, provider-native asynchronous notification verification, internal idempotent settlement, and admin reconciliation/exception repair.

Included:

- `es-server` app-api payment contract.
- `es-server` admin-api payment contract.
- `es-server` payment schema, DTO, migration, comments, provider adapter, service, and tests.
- `es-admin/apps/web-ele` payment config, payment order, exception repair, reconciliation, and generated API usage.

Out of scope:

- App client page implementation. The server app-api contract changes are still breaking and app clients must adapt before real payment rollout.
- Provider refund execution. Refund remains fail closed and read-only/reconciliation-only in this run.

## Removed Contract

`POST app/payment/notification/create` is removed as a payment confirmation and settlement route.

The old route must not have a compatibility handler. Old app clients receive the framework default 404 after deployment. No client-supplied payload may move a payment order to `PAID` or trigger wallet/VIP settlement.

## New Provider Notification Contract

Provider callbacks use a public but service-verified route:

```http
POST app/payment/provider/:channel/notify
```

Rules:

- The route is reachable without app user authentication.
- The controller passes raw provider request data, headers, query, and body to the payment service.
- The service verifies native provider signatures before parsing payment facts.
- Verification uses the immutable provider config/credential version captured on the order at create time.
- Invalid signature, amount mismatch, missing order, unsupported channel/scene, and state conflict fail closed.
- Provider ACK format is channel-specific and must only be returned after verification and processing are complete or idempotently accepted.

## New App Status Contract

App clients read payment state instead of confirming payment success:

```http
GET app/payment/order/status?orderNo=<orderNo>
```

Request:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `orderNo` | string | yes | Internal payment order number. The service validates ownership against the current app user. |

Response fields are stable. Unavailable values are explicit `null`, not omitted:

| Field | Type |
| --- | --- |
| `orderNo` | string |
| `status` | number |
| `orderType` | number |
| `channel` | number |
| `scene` | number |
| `payableAmount` | number |
| `paidAmount` | number \| null |
| `currency` | string |
| `expireAt` | string \| null |
| `paidAt` | string \| null |
| `closedAt` | string \| null |
| `clientPayPayload` | object \| null |

`clientPayPayload` is the non-secret provider client launch payload returned by order creation and readable from status while the order is payable. It is shaped by `channel`, `scene`, and platform. It must not include private keys, API v3 keys, certificates, raw provider config ids, raw credential refs, or internal version refs.

Expected payload shape:

```ts
type ClientPayPayload =
  | {
      channel: 'alipay'
      scene: 'h5' | 'app'
      orderString?: string
      payUrl?: string
    }
  | {
      channel: 'wechat'
      scene: 'h5' | 'app' | 'jsapi'
      prepayId?: string
      mwebUrl?: string
      appId?: string
      partnerId?: string
      packageValue?: string
      nonceStr?: string
      timestamp?: string
      sign?: string
      signType?: 'RSA' | 'HMAC-SHA256'
    }
```

Exact fields are produced by the provider adapter for the requested channel/scene/platform. Unsupported combinations throw a business error and do not return placeholder payloads such as `PROVIDER_SIGN_REQUIRED` or `prepay_id=${orderNo}`.

## Admin Contract Changes

Provider config:

- `configVersion` is no longer an admin input.
- Raw refs and JSON text inputs are removed from normal create/update/search/bulk edit flows.
- Provider account, credential, and certificate fields use selector APIs and masked details.
- Updating a provider config creates or selects a new immutable version for new orders; existing orders keep their captured version.

Payment order:

- Order search supports operator-friendly filters: order number, user selector, provider trade number, channel, scene, order type, status, provider config, created time range, and paid time range.
- Ordinary manual confirm is removed.
- Exception repair replaces manual confirm and requires reason, evidence, admin user context, audit logging, and provider query/notify failure evidence where applicable.

Reconciliation:

- Admin exposes read-only reconciliation records and stop indicators.
- Query performance must be backed by indexes or `EXPLAIN` evidence before release.

Refund:

- No clickable refund execution button is exposed.
- Any residual server refund write path returns `OPERATION_NOT_ALLOWED` or equivalent business error and records `payment_refund_blocked`.
- No provider refund call, refund notification state advancement, asset reversal, or VIP reversal is implemented in this run.

## App Rollout Dependency

Real payment rollout is blocked until app clients:

- Stop calling `POST app/payment/notification/create`.
- Use provider SDK/browser launch data from `clientPayPayload`.
- Poll or read `GET app/payment/order/status`.
- Treat provider return pages as UX hints only, not payment facts.
- Handle nullable status fields and provider-specific launch payload shapes.

Before app adaptation is released, real provider configs must remain disabled or limited to a non-production/sandbox environment.

## Release Gates

Server:

```bash
pnpm db:comments:check
pnpm type-check
pnpm test -- --runInBand --runTestsByPath <payment-related-specs>
```

Admin:

```bash
pnpm -F @vben/web-ele run att
pnpm -F @vben/web-ele run typecheck
```

Migration/reconcile:

- `db/migration/<timestamp>_payment_provider_closure_breaking/reconcile.sql` must be run in staging/pre-prod.
- Any stop indicator greater than `0` blocks release. Waivers are not allowed.
- `pending_order_without_version_count` must be `0` before release; migration must not silently close or rewrite historical orders to bypass this gate.
- Migration README or verification record must include admin order/reconcile index-hit or `EXPLAIN` evidence.

Admin smoke:

- Payment config form/search has no raw `configVersion`, credential ref, key ref, or JSON textarea for operators.
- Payment order filters send server-backed fields.
- Exception repair uses the project confirmation pattern and requires reason/evidence.
- Refund execution control is absent or disabled as a special-project status.
