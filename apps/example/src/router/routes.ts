import type { RouteRecordMainRaw } from '@fantastic-admin/types'
import type { RouteRecordRaw } from 'vue-router'

import pinia from '@/store'

import gestionRoutes from '../router/modules/gestion.ts'



const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login.vue'),
    meta: {
      title: 'Connexion',
    },
  },
  {
    path: '/:all(.*)*',
    name: 'notFound',
    component: () => import('@/views/[...all].vue'),
    meta: {
      title: 'Page non trouvée',
    },
  },
]

const systemRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/index.vue'),
    meta: {
      breadcrumb: false,
    },
    children: [
      {
        path: '',
        component: () => import('@/views/index.vue'),
        meta: {
          title: useAppSettingsStore(pinia).settings.app.home.title,
          icon: 'i-ant-design:home-twotone',
          breadcrumb: false,
        },
      },
      {
        path: 'reload',
        name: 'reload',
        component: () => import('@/views/reload.vue'),
        meta: {
          title: 'Chargement en cours…',
          breadcrumb: false,
        },
      },
    ],
  },
]

const asyncRoutes: RouteRecordMainRaw[] = [
  {
    meta: {
      title: 'Gestion',
      icon: 'i-carbon:application',
    },
    children: gestionRoutes,
  },
]

export {
  asyncRoutes,
  constantRoutes,
  systemRoutes,
}
