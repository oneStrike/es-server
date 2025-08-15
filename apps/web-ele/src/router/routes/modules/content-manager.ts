import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'ContentManger',
    path: '/content-manager',
    meta: {
      title: '内容管理',
      order: 2,
      icon: 'majesticons:book-open-line',
    },
    children: [
      {
        name: 'ComicManager',
        path: '/content-manager/comic-manager',
        component: () =>
          import('#/views/content-manager/comic-manager/index.vue'),
        meta: {
          title: '漫画',
          icon: 'codex:dot-circle',
        },
      },
      {
        name: 'AuthorManager',
        path: '/content-manager/author-manager',
        component: () =>
          import('#/views/content-manager/author-manager/index.vue'),
        meta: {
          title: '作者管理',
          icon: 'codex:dot-circle',
        },
      },
      {
        name: 'CategoryManager',
        path: '/content-manager/category-manager',
        component: () =>
          import('#/views/content-manager/category-manager/index.vue'),
        meta: {
          title: '分类管理',
          icon: 'codex:dot-circle',
        },
      },
    ],
  },
];

export default routes;
