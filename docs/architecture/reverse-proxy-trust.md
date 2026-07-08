# Reverse Proxy Trust

## Context

Production traffic enters the server at `81.69.43.198`, then reaches the API
services through the edge Nginx/1Panel reverse proxy. The API services currently
also join the external Docker network `1panel-network`.

Forwarded request metadata is security-sensitive. Fastify reads trusted proxy
metadata only when `trustProxy` is enabled. Application code must not parse raw
`X-Forwarded-*`, `X-Real-IP`, or `Forwarded` headers directly.

## Decision

Use exactly one proxy-trust mode when real client attribution is required:

- `TRUSTED_PROXY_IPS=<ip-or-cidr>` is the preferred mode while API services stay
  on the shared `1panel-network`.
- `TRUST_PROXY_HOPS=1` is allowed only after arbitrary peers on
  `1panel-network` cannot directly reach API service ports.
- If neither trusted proxy identity nor network isolation can be proven, leave
  both unset and run fail-closed with Fastify `trustProxy: false`.

Do not configure both modes. `TRUST_PROXY_HOPS=0` is treated as unset.

## Measuring `TRUSTED_PROXY_IPS`

Measure the proxy peer before enabling trust:

1. Keep `TRUSTED_PROXY_IPS` and `TRUST_PROXY_HOPS` unset.
2. Add a temporary diagnostic probe or log that records:
   - `req.socket.remoteAddress`
   - `req.ip`
3. Call the API through the real edge route.
4. Use the observed `req.socket.remoteAddress` as the only allowlist candidate.
5. Remove the diagnostic probe or log before delivery.

Do not use `81.69.43.198` as the trusted proxy identity merely because it is the
public server address. Trust the peer address observed by the API process.

## Edge Nginx Rules

The edge reverse proxy configuration is external operational config. The repo's
`deploy/files-nginx.conf` is only for the files service and does not configure
the API edge proxy.

For the current one-edge topology, Nginx should overwrite or clear forwarded
metadata:

```nginx
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Port $server_port;
proxy_set_header Forwarded "";
```

Fastify's trusted proxy parsing directly consumes the `X-Forwarded-For`,
`X-Forwarded-Host`, and `X-Forwarded-Proto` family for IP, host, and protocol
metadata. Normalizing `X-Real-IP`, `Forwarded`, and `X-Forwarded-Port` is part
of the edge defense baseline so future middleware or business code cannot
accidentally consume client-supplied variants.

Do not use `$proxy_add_x_forwarded_for` in this topology unless a CDN, load
balancer, or multi-proxy chain has been explicitly reviewed.

## Network Boundary

Binding host ports to `127.0.0.1` closes direct public access through the host
port, but it does not prevent another container on `1panel-network` from calling
`admin-server:8080` or `app-server:8081`.

Before using `TRUST_PROXY_HOPS=1`, prove one of these:

- API services are removed from the shared external network and attached only to
  an edge-only internal network with the edge proxy.
- A network policy or container firewall blocks non-edge containers from API
  service ports.
- Direct access attempts from a non-edge container on `1panel-network` fail.

If this proof is not available, use `TRUSTED_PROXY_IPS`.

## Same-Network Spoof Check

Run from the production or staging host before enabling proxy trust:

```sh
docker run --rm --network 1panel-network curlimages/curl:latest \
  -sS -H 'X-Forwarded-For: 203.0.113.250' \
  -H 'X-Real-IP: 203.0.113.251' \
  -H 'X-Forwarded-Host: attacker.example' \
  -H 'X-Forwarded-Proto: https' \
  -H 'Forwarded: for=203.0.113.252;proto=https;host=attacker.example' \
  http://admin-server:8080/health

docker run --rm --network 1panel-network curlimages/curl:latest \
  -sS -H 'X-Forwarded-For: 203.0.113.250' \
  -H 'X-Real-IP: 203.0.113.251' \
  -H 'X-Forwarded-Host: attacker.example' \
  -H 'X-Forwarded-Proto: https' \
  -H 'Forwarded: for=203.0.113.252;proto=https;host=attacker.example' \
  http://app-server:8081/health
```

If service aliases are unavailable from the external test container, retry with
container names:

```text
http://es-admin-server:8080/health
http://es-app-server:8081/health
```

If those also fail, resolve container IPs with `docker inspect` and run the same
forged-header check against the resolved IPs.

The health endpoints prove reachability only. Pair this check with a temporary
probe, logs, or database evidence showing that `203.0.113.250`,
`203.0.113.251`, and `203.0.113.252` are not recorded as the effective client
IP from an untrusted peer.

## Deployment Checklist

- Public firewall/security group exposes only 80/443.
- Direct public API access is closed:
  - `curl --connect-timeout 3 http://81.69.43.198:8080/health`
  - `curl --connect-timeout 3 http://81.69.43.198:8081/health`
- Production `.env` sets exactly one proxy-trust mode when real client
  attribution is required.
- Edge Nginx overwrites or clears forwarded headers as shown above.
- Same-network spoof check passes under `TRUSTED_PROXY_IPS`, or same-network
  direct access fails before `TRUST_PROXY_HOPS=1` is used.
- Edge-path spoof check confirms forged headers do not change the recorded
  effective IP in audit logs, auth/session records, SMS contexts, or a temporary
  removed-before-delivery diagnostic probe.

Any CDN, load balancer, ingress, or Docker network change requires a fresh
proxy-trust review before deployment.
