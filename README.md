<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## 🔧 工程化配置

本项目已配置完整的工程化开发流程：

### Git 提交规范

- 使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范
- 配置了 `commitlint` 验证提交消息格式
- 支持交互式提交：`pnpm run commit`

### 代码质量保证

- **ESLint**: 代码静态分析和质量检查
  - TypeScript 支持和类型检查
  - NestJS 最佳实践规则
  - 与 Prettier 协同工作
  - 自动修复功能
- **Prettier**: 代码格式化工具
- **lint-staged**: 提交前自动检查暂存文件
- **husky**: Git 钩子管理

### 快速开始

```bash
# 使用交互式提交（推荐）
pnpm run commit

# 或直接提交（需符合规范）
git commit -m "feat: 添加新功能"
```

📚 详细说明请查看：

- [开发工作流程指南](./DEVELOPMENT.md)
- [提交规范说明](./COMMIT_CONVENTION.md)
- [ESLint 配置说明](./ESLINT_CONFIG.md)

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## 🧠 Redis 缓存接入

本项目已通过 NestJS 的 CacheModule 集成 Redis 缓存（使用 Keyv 适配器）。默认以全局缓存方式启用，TTL 为 5 分钟。

- 环境变量：
  - `REDIS_HOST` 默认 `localhost`
  - `REDIS_PORT` 默认 `6379`
  - `REDIS_PASSWORD` 默认空字符串

- 使用方式：在服务中注入 `CACHE_MANAGER` 即可：

```ts
import type { Cache } from 'cache-manager'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject } from '@nestjs/common'

export class DemoService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async demo() {
    await this.cache.set('key', { foo: 'bar' }, 60_000)
    return this.cache.get('key')
  }
}
```

说明：Redis 连接字符串将根据上述环境变量动态生成，例如 `redis://:PASSWORD@HOST:PORT`。所有缓存键统一前缀为 `Akaiito` 命名空间。

## 💚 Terminus 健康检查

项目提供以下健康检查端点（受全局前缀 `api` 影响）：

- `GET /api/health`：存活检查（liveness）。返回进程内存指标，并附带 `uptime` 与 `environment` 元信息。
- `GET /api/ready`：就绪检查（readiness）。检查数据库（`SELECT 1`）与缓存（内存与 Redis）的可用性。

`GET /api/health` 示例响应（成功）：

```json
{
  "status": "ok",
  "info": {
    "memory_heap": { "status": "up", "heapUsed": 12345678 },
    "memory_rss": { "status": "up", "rss": 23456789 }
  },
  "meta": {
    "uptime": 123.45,
    "environment": "development"
  }
}
```

### 部署与监控集成

- Kubernetes Probe 建议：

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /api/ready
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
```

- 关闭期间优雅退出：已启用应用 `Shutdown Hooks`，并配置 Terminus `gracefulShutdownTimeoutMs: 1000`，有助于在编排器下实现零停机切换。

- 监控系统：当前健康检查返回以 `status`、`info`、`meta` 为主，可直接供 Prometheus/Grafana 或外部探针采集状态。
