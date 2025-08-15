import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'SystemManager',
    path: '/system-manager',
    meta: {
      title: '系统管理',
      order: 4,
      icon: 'majesticons:cog-line',
    },
    children: [
      {
        name: 'Profile',
        path: '/profile',
        component: () => import('#/views/system-manager/profile/index.vue'),
        meta: {
          title: '个人中心',
          icon: 'codex:dot-circle',
        },
      },

      {
        name: 'DataDictionary',
        path: '/data-dictionary',
        component: () =>
          import('#/views/system-manager/data-dictionary/index.vue'),
        meta: {
          title: '数据字典',
          icon: 'codex:dot-circle',
        },
      },
      {
        name: 'LogManager',
        path: '/log-manager',
        meta: {
          title: '日志管理',
          icon: 'majesticons:list-box-line',
        },
        children: [
          {
            name: 'LoginLog',
            path: '/log-manager/login-log',
            component: () =>
              import('#/views/system-manager/log-manager/login-log/index.vue'),
            meta: {
              title: '登录日志',
              icon: 'codex:dot-circle',
            },
          },
          {
            name: 'OperationLog',
            path: '/log-manager/operation-log',
            component: () =>
              import(
                '#/views/system-manager/log-manager/operation-log/index.vue'
              ),
            meta: {
              title: '操作日志',
              icon: 'codex:dot-circle',
            },
          },
        ],
      },

      {
        name: 'UserManager',
        path: '/user-manager',
        component: () =>
          import('#/views/system-manager/user-manager/index.vue'),
        meta: {
          title: '用户管理',
          icon: 'codex:dot-circle',
        },
      },
      {
        name: 'ServerStatus',
        path: '/server-status',
        component: () =>
          import('#/views/system-manager/server-status/index.vue'),
        meta: {
          title: '系统状态',
          icon: 'codex:dot-circle',
        },
      },
    ],
  },
];

export default routes;
