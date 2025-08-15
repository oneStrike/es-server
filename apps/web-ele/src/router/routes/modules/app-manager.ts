import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'AppManager',
    path: '/app-manager',
    meta: {
      title: 'APP管理',
      order: 2,
      icon: 'majesticons:device-mobile-line',
    },
    children: [
      {
        name: 'Notice',
        path: '/notice',
        component: () => import('#/views/app-manager/notice/notice.vue'),
        meta: {
          title: '通知公告',
          icon: 'codex:dot-circle',
        },
      },
      {
        name: 'PageManager',
        path: '/page-manager',
        component: () => import('#/views/app-manager/page-manager/index.vue'),
        meta: {
          title: '页面配置',
          icon: 'codex:dot-circle',
        },
      },
      {
        name: 'AppConfig',
        path: '/app-config',
        component: () => import('#/views/app-manager/app-config/index.vue'),
        meta: {
          title: '系统配置',
          icon: 'codex:dot-circle',
        },
      },
    ],
  },
];

export default routes;
