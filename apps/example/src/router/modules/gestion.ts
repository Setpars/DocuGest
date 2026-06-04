import type { RouteRecordRaw } from 'vue-router'
import {
  PIECES_JURIDIQUES_COMING_SOON,
  PIECES_JURIDIQUES_COMING_SOON_HINT,
} from '@/constants/features'
import { PERMISSIONS } from '@/constants/permissions'

const Layout = () => import('@/layouts/index.vue')

/**
 * Routes métier — accès contrôlé par rôle via meta.auth
 * Secrétaire : clients, dossiers, agenda, notes honoraires
 * Doyen : avocats, tableaux de bord BI, utilisateurs, audit
 * Finances : paiements
 */
const gestionRoutes: RouteRecordRaw[] = [
  {
    path: '/gestion/clients',
    component: Layout,
    meta: {
      title: 'Clients',
      icon: 'i-carbon:user-multiple',
      auth: PERMISSIONS.clients,
      sort: 45,
    },
    children: [
      {
        path: '',
        name: 'Clients',
        component: () => import('@/views/clients/index.vue'),
        meta: {
          title: 'Clients',
          menu: false,
          breadcrumb: false,
          activeMenu: '/gestion/clients',
          auth: PERMISSIONS.clients,
        },
      },
    ],
  },
  {
    path: '/gestion/dossiers',
    component: Layout,
    meta: {
      title: 'Dossiers',
      icon: 'i-carbon:folder',
      auth: PERMISSIONS.dossiers,
      expand: true,
      sort: 40,
    },
    children: [
      {
        path: '',
        name: 'dossiers',
        component: () => import('@/views/dossiers/index.vue'),
        meta: {
          title: 'Tous les dossiers',
          icon: 'i-carbon:folder',
          auth: PERMISSIONS.dossiers,
          sort: 30,
        },
      },
      {
        path: 'en-cours',
        name: 'enCours',
        component: () => import('@/views/dossiers/enCours.vue'),
        meta: {
          title: 'Dossiers en cours',
          icon: 'i-carbon:in-progress',
          auth: PERMISSIONS.dossiers,
          sort: 20,
        },
      },
      {
        path: 'pieces-juridiques',
        name: 'piecesJuridiques',
        component: () => import('@/views/pieces-juridiques/index.vue'),
        meta: {
          title: 'Pièces juridiques',
          icon: 'i-carbon:document-add',
          auth: PERMISSIONS.piecesJuridiques,
          sort: 10,
          comingSoon: PIECES_JURIDIQUES_COMING_SOON,
          comingSoonHint: PIECES_JURIDIQUES_COMING_SOON_HINT,
        },
      },
      {
        path: 'client/:clientId',
        name: 'clientDetail',
        component: () => import('@/views/clients/detail.vue'),
        meta: {
          title: 'Fiche client',
          menu: false,
          breadcrumb: true,
          activeMenu: '/gestion/dossiers',
          auth: PERMISSIONS.dossiers,
        },
      },
      {
        path: ':dossierId/fiche',
        name: 'dossierFiche',
        component: () => import('@/views/dossiers/fiche.vue'),
        meta: {
          title: 'Fiche de consultation',
          menu: false,
          breadcrumb: true,
          activeMenu: '/gestion/dossiers',
          auth: PERMISSIONS.dossiers,
        },
      },
    ],
  },
  {
    path: '/gestion/pieces-juridiques',
    redirect: (to) => ({
      path: '/gestion/dossiers/pieces-juridiques',
      query: to.query,
      hash: to.hash,
    }),
    meta: {
      title: 'Pièces juridiques',
      menu: false,
      breadcrumb: false,
    },
  },
  {
    path: '/gestion/agenda',
    component: Layout,
    meta: {
      title: 'Agenda',
      icon: 'i-carbon:calendar',
      auth: PERMISSIONS.agenda,
      sort: 30,
    },
    children: [
      {
        path: '',
        name: 'agenda',
        component: () => import('@/views/agenda/index.vue'),
        meta: {
          title: 'Agenda',
          menu: false,
          breadcrumb: false,
          activeMenu: '/gestion/agenda',
          auth: PERMISSIONS.agenda,
        },
      },
    ],
  },
  {
    path: '/gestion/note-honoraire',
    component: Layout,
    meta: {
      title: 'Note honoraire',
      icon: 'i-carbon:document',
      auth: PERMISSIONS.noteHonoraire,
      sort: 20,
    },
    children: [
      {
        path: '',
        name: 'noteHonoraire',
        component: () => import('@/views/note-honoraire/index.vue'),
        meta: {
          title: 'Note honoraire',
          menu: false,
          breadcrumb: false,
          activeMenu: '/gestion/note-honoraire',
          auth: PERMISSIONS.noteHonoraire,
        },
      },
    ],
  },
  {
    path: '/gestion/paiement',
    component: Layout,
    meta: {
      title: 'Paiements',
      icon: 'i-carbon:wallet',
      auth: PERMISSIONS.paiements,
      expand: true,
    },
    children: [
      {
        path: '',
        name: 'paiement',
        component: () => import('@/views/paiement/index.vue'),
        meta: {
          title: 'Gérer les paiements',
          icon: 'i-carbon:wallet',
          auth: PERMISSIONS.paiements,
          sort: 10,
        },
      },
    ],
  },
  {
    path: '/gestion/avocats',
    component: Layout,
    meta: {
      title: 'Avocats',
      icon: 'i-carbon:user-certification',
      auth: PERMISSIONS.avocats,
      expand: true,
    },
    children: [
      {
        path: '',
        name: 'avocats',
        component: () => import('@/views/avocat/index.vue'),
        meta: {
          title: 'Gestion des avocats',
          icon: 'i-carbon:user-certification',
          auth: PERMISSIONS.avocats,
          sort: 20,
        },
      },
      {
        path: 'dossier/:dossierId',
        name: 'doyenDossierDetail',
        component: () => import('@/views/dossiers/fiche.vue'),
        meta: {
          title: 'Fiche de consultation',
          menu: false,
          breadcrumb: true,
          activeMenu: '/gestion/avocats',
          auth: PERMISSIONS.avocats,
        },
      },
      {
        path: ':avocatId/historique',
        name: 'avocatHistorique',
        component: () => import('@/views/avocat/historique.vue'),
        meta: {
          title: 'Historique dossiers',
          menu: false,
          breadcrumb: true,
          activeMenu: '/gestion/avocats',
          auth: PERMISSIONS.avocats,
        },
      },
    ],
  },
  {
    path: '/gestion/tableau-de-bord',
    component: Layout,
    meta: {
      title: 'Tableau de bord',
      icon: 'i-carbon:chart-multitype',
      auth: PERMISSIONS.rapportsBi,
    },
    children: [
      {
        path: '',
        name: 'tableauDeBord',
        component: () => import('@/views/rapports/bi.vue'),
        meta: {
          title: 'Tableau de bord',
          menu: false,
          breadcrumb: false,
          activeMenu: '/gestion/tableau-de-bord',
          auth: PERMISSIONS.rapportsBi,
        },
      },
    ],
  },
  {
    path: '/gestion/rapports',
    component: Layout,
    meta: {
      title: 'Rapport synthétique',
      icon: 'i-carbon:report',
      auth: PERMISSIONS.rapports,
    },
    children: [
      {
        path: '',
        name: 'rapports',
        component: () => import('@/views/rapports/index.vue'),
        meta: {
          title: 'Rapport synthétique',
          menu: false,
          breadcrumb: false,
          activeMenu: '/gestion/rapports',
          auth: PERMISSIONS.rapports,
        },
      },
    ],
  },
  {
    path: '/gestion/utilisateurs',
    component: Layout,
    meta: {
      title: 'Utilisateurs',
      icon: 'i-carbon:user-admin',
      auth: PERMISSIONS.utilisateurs,
    },
    children: [
      {
        path: '',
        name: 'utilisateurs',
        component: () => import('@/views/admin/utilisateurs/index.vue'),
        meta: {
          title: 'Utilisateurs',
          menu: false,
          breadcrumb: false,
          activeMenu: '/gestion/utilisateurs',
          auth: PERMISSIONS.utilisateurs,
        },
      },
    ],
  },
  {
    path: '/gestion/audit',
    component: Layout,
    meta: {
      title: 'Journal d’audit',
      icon: 'i-carbon:activity',
      auth: PERMISSIONS.audit,
    },
    children: [
      {
        path: '',
        name: 'audit',
        component: () => import('@/views/admin/audit/index.vue'),
        meta: {
          title: 'Journal d’audit',
          menu: false,
          breadcrumb: false,
          activeMenu: '/gestion/audit',
          auth: PERMISSIONS.audit,
        },
      },
    ],
  },
]

export default gestionRoutes
