import { faker } from '@faker-js/faker'
import { defineFakeRoute } from 'vite-plugin-fake-server/client'

export default defineFakeRoute([
  {
    url: '/fake/app/route/list',
    method: 'get',
    response: () => {
      return {
        error: '',
        status: 1,
        data: [
          {
            meta: {
              title: 'Gestion',
              icon: 'i-carbon:application',
            },
            children: [
              {
                path: '/gestion/dossiers',
                component: 'Layout',
                name: 'dossiers',
                meta: {
                  title: 'Dossiers',
                  icon: 'i-carbon:folder',
                  auth: 'gestion.dossiers',
                },
                children: [
                  {
                    path: '',
                    name: 'dossiersList',
                    component: 'dossiers/index.vue',
                    meta: {
                      title: 'Tous les dossiers',
                      auth: 'gestion.dossiers',
                    },
                  },
                ],
              },
            ],
          },
        ],
      }
    },
  },
  {
    url: '/fake/app/account/login',
    method: 'post',
    response: ({ body }) => {
      return {
        error: '',
        status: 1,
        data: {
          account: body.account,
          token: `${body.account}:${faker.internet.jwt()}`,
          avatar: `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${body.account}`,
        },
      }
    },
  },
  {
    url: '/fake/app/account/permission',
    method: 'get',
    response: ({ headers }) => {
      let permissions: string[] = []
      if (headers.token?.indexOf('admin') === 0) {
        permissions = [
          'pages.general:browse',
          'pages.form:browse',
          'pages.list:browse',
          'pages.shop:browse',
        ]
      }
      else if (headers.token?.indexOf('test') === 0) {
        permissions = [
          'pages.general:browse',
        ]
      }
      return {
        error: '',
        status: 1,
        data: {
          permissions,
        },
      }
    },
  },
  {
    url: '/fake/app/account/password/edit',
    method: 'post',
    response: () => {
      return {
        error: '',
        status: 1,
        data: {
          isSuccess: true,
        },
      }
    },
  },
])
