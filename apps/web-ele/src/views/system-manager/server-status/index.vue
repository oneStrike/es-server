<script setup lang="ts">
/**
 * 系统状态页（静态数据演示）
 * - 仅在当前页面实现：不依赖外部组件库，不修改其他文件
 * - 现代化 UI：卡片、进度环、迷你折线图、状态徽章
 * - 响应式布局：栅格随断点自适应
 * - 暗黑模式：Tailwind dark: 样式
 * - 可访问性：语义化结构、aria 标签、sr-only 文案
 */

import { Page } from '@vben/common-ui';

type Disk = {
  mount: string;
  name: string;
  total: number; // bytes
  used: number; // bytes
};

type ServiceStatus = 'degraded' | 'down' | 'up';
type Service = {
  latencyMs: number;
  name: string;
  status: ServiceStatus;
};

type AlertSeverity = 'critical' | 'info' | 'warning';
type Alert = {
  detail: string;
  id: number;
  severity: AlertSeverity;
  time: string; // 已格式化时间
  title: string;
};

/* -------------------------
   1) 静态演示数据
   ------------------------- */
const system = {
  hostname: 'prod-api-01',
  os: 'Ubuntu 22.04 LTS',
  kernel: 'Linux 5.15.0-113-generic',
  ip: '10.21.34.56',
  // 以秒计的 Uptime，展示时转可读字符串
  uptimeSec: 9 * 24 * 3600 + 3 * 3600 + 28 * 60 + 17, // 9天 3小时 28分 17秒
  loadAvg: [1.23, 1.37, 1.42] as [number, number, number],
};

const cpu = {
  usage: 68, // 当前 CPU 使用率（%）
  // 历史数据（0-100），用于 Sparkline；保持数据量适中以兼顾性能与观感
  history: [
    45, 52, 49, 63, 58, 62, 70, 68, 65, 71, 69, 66, 73, 77, 74, 72, 70, 67, 64,
    62, 60, 58, 61, 65,
  ],
};

const memory = {
  total: 32 * 1024 ** 3, // 32GB
  used: 21.3 * 1024 ** 3, // 21.3GB
  history: [
    58, 59, 60, 61, 63, 64, 66, 67, 68, 68, 69, 69, 70, 71, 71, 72, 73, 73, 74,
    74, 75, 75, 76, 76,
  ],
};

const disks: Disk[] = [
  {
    name: 'nvme0n1p1',
    mount: '/',
    total: 512 * 1024 ** 3,
    used: 382 * 1024 ** 3,
  },
  {
    name: 'nvme0n1p2',
    mount: '/data',
    total: 1024 * 1024 ** 3,
    used: 610 * 1024 ** 3,
  },
  {
    name: 'sda1',
    mount: '/backup',
    total: 2048 * 1024 ** 3,
    used: 840 * 1024 ** 3,
  },
];

const services: Service[] = [
  { name: 'Auth', status: 'up', latencyMs: 23 },
  { name: 'Gateway', status: 'degraded', latencyMs: 142 },
  { name: 'Billing', status: 'up', latencyMs: 35 },
  { name: 'Search', status: 'down', latencyMs: 0 },
  { name: 'Notification', status: 'up', latencyMs: 48 },
  { name: 'CDN', status: 'up', latencyMs: 17 },
];

const alerts: Alert[] = [
  {
    id: 1,
    severity: 'critical',
    title: 'Search 服务不可用',
    detail: '健康检查失败（连续 5 次）',
    time: '今天 14:32',
  },
  {
    id: 2,
    severity: 'warning',
    title: '磁盘使用率偏高',
    detail: '/data 分区已使用 60%',
    time: '今天 13:20',
  },
  {
    id: 3,
    severity: 'info',
    title: '系统维护窗口即将开始',
    detail: '今晚 23:00 - 23:30',
    time: '今天 09:00',
  },
];

/* -------------------------
   2) 计算属性与工具方法
   ------------------------- */

/** 将字节转为可读字符串 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let num = bytes;
  while (num >= 1024 && i < units.length - 1) {
    num /= 1024;
    i++;
  }
  return `${num.toFixed(num >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** 将秒转为“X天 X小时 X分” */
function formatUptime(sec: number): string {
  const days = Math.floor(sec / 86_400);
  const hours = Math.floor((sec % 86_400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  return `${days}天 ${hours}小时 ${minutes}分`;
}

/** 基于百分比返回颜色（绿/黄/红） */
function pctColorClass(pct: number): string {
  if (pct < 60) return 'text-emerald-500';
  if (pct < 85) return 'text-amber-500';
  return 'text-rose-500';
}

/** 服务状态颜色 */
function statusColor(status: ServiceStatus): string {
  switch (status) {
    case 'degraded': {
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20';
    }
    case 'down': {
      return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20';
    }
    case 'up': {
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20';
    }
  }
}

/** 告警等级颜色 */
function severityColor(sev: AlertSeverity): string {
  switch (sev) {
    case 'critical': {
      return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20';
    }
    case 'info': {
      return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20';
    }
    case 'warning': {
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20';
    }
  }
}

/** 磁盘整体使用率 */
const diskTotal = computed(() => disks.reduce((acc, d) => acc + d.total, 0));
const diskUsed = computed(() => disks.reduce((acc, d) => acc + d.used, 0));
const diskPct = computed(() =>
  Math.round((diskUsed.value / Math.max(diskTotal.value, 1)) * 100),
);

/** 内存使用率 */
const memPct = computed(() => Math.round((memory.used / memory.total) * 100));

/** 更新时间（演示：页面加载时的本地时间） */
const lastUpdated = new Date().toLocaleString();

/**
 * 进度环相关计算
 * - 使用 SVG 环形轨迹，strokeDasharray + strokeDashoffset 控制显示百分比
 */
function ringProps(pct: number, size = 92, stroke = 10) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c;
  const offset = c * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  return { size, stroke, r, c, dash, offset };
}
</script>

<template>
  <Page>
    <main
      class="min-h-[calc(100vh-var(--header-height,0px))] space-y-6 bg-white p-4 sm:p-6 lg:p-8 dark:bg-neutral-950"
      aria-label="系统状态页面"
    >
      <!-- 顶部标题区 -->
      <header class="flex items-start justify-between gap-3">
        <div>
          <h1
            class="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
          >
            系统状态
          </h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">
            静态演示数据 · 最后更新于
            <time :datetime="lastUpdated">{{ lastUpdated }}</time>
          </p>
        </div>

        <!-- 操作区（静态 UI，仅展示） -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            disabled
            class="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
            aria-disabled="true"
          >
            <!-- 刷新图标 -->
            <svg
              class="size-4"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M21 12a9 9 0 1 1-3.96-7.5M21 4v6h-6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            刷新
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white transition hover:opacity-95 dark:bg-neutral-100 dark:text-neutral-900"
          >
            <!-- 下载图标 -->
            <svg
              class="size-4"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            导出
          </button>
        </div>
      </header>

      <!-- 核心 KPI 区：4 张卡片 -->
      <section
        aria-labelledby="kpi"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4"
      >
        <!-- CPU 使用率 -->
        <article
          class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
          role="status"
          aria-label="CPU 使用率"
        >
          <div class="flex items-center justify-between">
            <h2
              id="kpi"
              class="text-sm font-medium text-neutral-600 dark:text-neutral-400"
            >
              CPU 使用率
            </h2>
            <span
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
              :class="`${pctColorClass(cpu.usage).replace(
                'text-',
                'bg-',
              )} ${pctColorClass(cpu.usage).replace('text', 'text')}/10`"
            >
              <!-- 活动图标 -->
              <svg
                class="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M22 12h-4l-3 9L9 3l-3 9H2"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
              实时
            </span>
          </div>

          <div class="mt-4 flex items-center gap-4">
            <!-- 进度环（CPU） -->
            <div class="relative">
              <svg
                :width="ringProps(cpu.usage).size"
                :height="ringProps(cpu.usage).size"
                viewBox="0 0 92 92"
                aria-hidden="true"
                class="block"
              >
                <!-- 背景轨道 -->
                <circle
                  cx="46"
                  cy="46"
                  :r="ringProps(cpu.usage).r"
                  class="text-neutral-200 dark:text-neutral-800"
                  stroke="currentColor"
                  :stroke-width="ringProps(cpu.usage).stroke"
                  fill="none"
                />
                <!-- 前景进度 -->
                <g transform="rotate(-90 46 46)">
                  <circle
                    cx="46"
                    cy="46"
                    :r="ringProps(cpu.usage).r"
                    :stroke-dasharray="ringProps(cpu.usage).dash"
                    :stroke-dashoffset="ringProps(cpu.usage).offset"
                    :class="pctColorClass(cpu.usage)"
                    stroke="currentColor"
                    stroke-linecap="round"
                    :stroke-width="ringProps(cpu.usage).stroke"
                    fill="none"
                  />
                </g>
              </svg>
              <!-- 中间百分比 -->
              <div class="absolute inset-0 grid place-items-center">
                <div class="text-center">
                  <div
                    class="text-xl font-semibold text-neutral-900 dark:text-neutral-100"
                  >
                    {{ cpu.usage }}%
                  </div>
                  <div
                    class="text-[11px] text-neutral-500 dark:text-neutral-400"
                  >
                    当前
                  </div>
                </div>
              </div>
            </div>

            <!-- 负载均值 -->
            <div class="flex-1">
              <div class="text-sm text-neutral-500 dark:text-neutral-400">
                负载均值 (1/5/15 分钟)
              </div>
              <div
                class="mt-1 text-lg font-medium text-neutral-900 dark:text-neutral-100"
              >
                {{ system.loadAvg.join(' / ') }}
              </div>
            </div>
          </div>
        </article>

        <!-- 内存使用率 -->
        <article
          class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
          role="status"
          aria-label="内存使用率"
        >
          <div class="flex items-center justify-between">
            <h2
              class="text-sm font-medium text-neutral-600 dark:text-neutral-400"
            >
              内存使用率
            </h2>
          </div>
          <div class="mt-4 flex items-center gap-4">
            <!-- 进度环（内存） -->
            <div class="relative">
              <svg
                :width="ringProps(memPct).size"
                :height="ringProps(memPct).size"
                viewBox="0 0 92 92"
                aria-hidden="true"
                class="block"
              >
                <circle
                  cx="46"
                  cy="46"
                  :r="ringProps(memPct).r"
                  class="text-neutral-200 dark:text-neutral-800"
                  stroke="currentColor"
                  :stroke-width="ringProps(memPct).stroke"
                  fill="none"
                />
                <g transform="rotate(-90 46 46)">
                  <circle
                    cx="46"
                    cy="46"
                    :r="ringProps(memPct).r"
                    :stroke-dasharray="ringProps(memPct).dash"
                    :stroke-dashoffset="ringProps(memPct).offset"
                    :class="pctColorClass(memPct)"
                    stroke="currentColor"
                    stroke-linecap="round"
                    :stroke-width="ringProps(memPct).stroke"
                    fill="none"
                  />
                </g>
              </svg>
              <div class="absolute inset-0 grid place-items-center">
                <div class="text-center">
                  <div
                    class="text-xl font-semibold text-neutral-900 dark:text-neutral-100"
                  >
                    {{ memPct }}%
                  </div>
                  <div
                    class="text-[11px] text-neutral-500 dark:text-neutral-400"
                  >
                    {{ formatBytes(memory.used) }} /
                    {{ formatBytes(memory.total) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 提示 -->
            <div class="flex-1">
              <div class="text-sm text-neutral-500 dark:text-neutral-400">
                已用 / 总计
              </div>
              <div
                class="mt-1 text-lg font-medium text-neutral-900 dark:text-neutral-100"
              >
                {{ formatBytes(memory.used) }} / {{ formatBytes(memory.total) }}
              </div>
            </div>
          </div>
        </article>

        <!-- 磁盘占用 -->
        <article
          class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
          role="status"
          aria-label="磁盘使用率"
        >
          <div class="flex items-center justify-between">
            <h2
              class="text-sm font-medium text-neutral-600 dark:text-neutral-400"
            >
              磁盘使用率
            </h2>
          </div>
          <div class="mt-4">
            <div class="flex items-end justify-between">
              <div
                class="text-2xl font-semibold text-neutral-900 dark:text-neutral-100"
              >
                {{ diskPct }}%
              </div>
              <div class="text-xs text-neutral-500 dark:text-neutral-400">
                {{ formatBytes(diskUsed) }} / {{ formatBytes(diskTotal) }}
              </div>
            </div>
            <!-- 进度条 -->
            <div
              class="mt-3 h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
              role="progressbar"
              :aria-valuenow="diskPct"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="h-full rounded-full transition-all"
                :class="pctColorClass(diskPct).replace('text-', 'bg-')"
                :style="{ width: `${diskPct}%` }"
              ></div>
            </div>
          </div>
        </article>

        <!-- 运行时间 -->
        <article
          class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
          aria-label="运行时间"
        >
          <div class="flex items-center justify-between">
            <h2
              class="text-sm font-medium text-neutral-600 dark:text-neutral-400"
            >
              运行时间
            </h2>
            <span class="text-xs text-neutral-500 dark:text-neutral-400">
              Host: {{ system.hostname }}
            </span>
          </div>
          <div class="mt-4">
            <div
              class="text-2xl font-semibold text-neutral-900 dark:text-neutral-100"
            >
              {{ formatUptime(system.uptimeSec) }}
            </div>
            <div class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              最近更新：{{ lastUpdated }}
            </div>
          </div>
        </article>
      </section>

      <!-- 存储与服务 -->
      <section class="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <!-- 磁盘列表 -->
        <article
          class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
        >
          <div class="flex items-center justify-between">
            <h3
              class="text-sm font-medium text-neutral-600 dark:text-neutral-400"
            >
              磁盘分区
            </h3>
            <span class="text-xs text-neutral-500 dark:text-neutral-400">
              共 {{ disks.length }} 个
            </span>
          </div>
          <ul class="mt-4 space-y-4">
            <li
              v-for="d in disks"
              :key="d.name"
              class="rounded-xl border border-neutral-100 p-4 dark:border-neutral-900"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <!-- 硬盘图标 -->
                    <svg
                      class="size-4 text-neutral-500 dark:text-neutral-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 17V7a2 2 0 0 1 2-2h10l6 6v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"
                        stroke="currentColor"
                        stroke-width="2"
                      />
                    </svg>
                    <div
                      class="truncate font-medium text-neutral-900 dark:text-neutral-100"
                    >
                      {{ d.name }}
                    </div>
                    <div class="text-xs text-neutral-500 dark:text-neutral-400">
                      挂载于 {{ d.mount }}
                    </div>
                  </div>
                </div>
                <div class="text-sm text-neutral-500 dark:text-neutral-400">
                  {{ formatBytes(d.used) }} / {{ formatBytes(d.total) }}
                </div>
              </div>
              <!-- 进度条 -->
              <div
                class="mt-3 h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
              >
                <div
                  class="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all"
                  :style="{
                    width: `${Math.round((d.used / Math.max(d.total, 1)) * 100)}%`,
                  }"
                  aria-hidden="true"
                ></div>
              </div>
            </li>
          </ul>
        </article>

        <!-- 服务状态 -->
        <article
          class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
        >
          <div class="flex items-center justify-between">
            <h3
              class="text-sm font-medium text-neutral-600 dark:text-neutral-400"
            >
              服务状态
            </h3>
            <div class="text-xs text-neutral-500 dark:text-neutral-400">
              正常 {{ services.filter((s) => s.status === 'up').length }} · 降级
              {{ services.filter((s) => s.status === 'degraded').length }} ·
              故障
              {{ services.filter((s) => s.status === 'down').length }}
            </div>
          </div>
          <ul class="mt-4 divide-y divide-neutral-100 dark:divide-neutral-900">
            <li
              v-for="s in services"
              :key="s.name"
              class="py-3 first:pt-0 last:pb-0"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="flex min-w-0 items-center gap-2">
                  <!-- 状态图标 -->
                  <div
                    class="size-2.5 rounded-full"
                    :class="{
                      'bg-emerald-500': s.status === 'up',
                      'bg-amber-500': s.status === 'degraded',
                      'bg-rose-500': s.status === 'down',
                    }"
                    aria-hidden="true"
                  ></div>
                  <div
                    class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100"
                  >
                    {{ s.name }}
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-xs text-neutral-500 dark:text-neutral-400">
                    {{ s.status === 'down' ? '—' : `${s.latencyMs} ms` }}
                  </span>
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="statusColor(s.status)"
                  >
                    {{
                      s.status === 'up'
                        ? '正常'
                        : s.status === 'degraded'
                          ? '降级'
                          : '故障'
                    }}
                  </span>
                </div>
              </div>
            </li>
          </ul>
        </article>
      </section>

      <!-- 告警与系统信息 -->
      <section class="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <!-- 告警列表 -->
        <article
          class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
        >
          <div class="flex items-center justify-between">
            <h3
              class="text-sm font-medium text-neutral-600 dark:text-neutral-400"
            >
              告警
            </h3>
            <span class="text-xs text-neutral-500 dark:text-neutral-400">
              近 24h
            </span>
          </div>
          <ul class="mt-4 space-y-3">
            <li
              v-for="a in alerts"
              :key="a.id"
              class="flex items-start gap-3 rounded-xl border border-neutral-100 p-4 dark:border-neutral-900"
            >
              <!-- 等级徽章 -->
              <span
                class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium"
                :class="severityColor(a.severity)"
              >
                {{
                  a.severity === 'critical'
                    ? '严重'
                    : a.severity === 'warning'
                      ? '警告'
                      : '通知'
                }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-3">
                  <div
                    class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100"
                  >
                    {{ a.title }}
                  </div>
                  <time class="text-xs text-neutral-500 dark:text-neutral-400">
                    {{ a.time }}
                  </time>
                </div>
                <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                  {{ a.detail }}
                </p>
              </div>
            </li>
          </ul>
        </article>

        <!-- 系统元信息 -->
        <article
          class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
        >
          <h3
            class="text-sm font-medium text-neutral-600 dark:text-neutral-400"
          >
            系统信息
          </h3>
          <dl class="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt class="text-xs text-neutral-500 dark:text-neutral-400">
                主机名
              </dt>
              <dd
                class="text-sm font-medium text-neutral-900 dark:text-neutral-100"
              >
                {{ system.hostname }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-neutral-500 dark:text-neutral-400">
                操作系统
              </dt>
              <dd
                class="text-sm font-medium text-neutral-900 dark:text-neutral-100"
              >
                {{ system.os }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-neutral-500 dark:text-neutral-400">
                内核版本
              </dt>
              <dd
                class="text-sm font-medium text-neutral-900 dark:text-neutral-100"
              >
                {{ system.kernel }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-neutral-500 dark:text-neutral-400">
                IP 地址
              </dt>
              <dd
                class="text-sm font-medium text-neutral-900 dark:text-neutral-100"
              >
                {{ system.ip }}
              </dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-xs text-neutral-500 dark:text-neutral-400">
                运行时间
              </dt>
              <dd
                class="text-sm font-medium text-neutral-900 dark:text-neutral-100"
              >
                {{ formatUptime(system.uptimeSec) }}
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <!-- 页脚提示 -->
      <p class="text-xs text-neutral-400 dark:text-neutral-500">
        提示：本页面为静态数据演示，用于展示布局与视觉风格。功能按钮仅作样式展示。
      </p>
    </main>
  </Page>
</template>

<style scoped>
/* 细节微动效与可读性增强 */
article {
  transition:
    box-shadow 200ms ease,
    transform 200ms ease,
    border-color 200ms ease;
}

article:hover {
  box-shadow: 0 6px 18px rgb(0 0 0 / 6%);
}
</style>
