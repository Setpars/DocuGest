import type { RouteRecordRaw } from 'vue-router'
import {
  PIECES_JURIDIQUES_COMING_SOON,
  PIECES_JURIDIQUES_COMING_SOON_HINT,
} from '@/constants/features'
import { PERMISSIONS } from '@/constants/permissions'

const Layout = () => import('@/layouts/index.vue')

/**
 * Navigation par entités métier (Firestore) :
 * Client → Dossier → (Paiement | Agenda | Affectation↔Avocat)
 *
 * Collections : clients, dossiers, paiements, agenda, avocats, affectations
 */
const gestionRoutes: RouteRecordRaw[] = [
  // —— Client ——
  {
    path: '/gestion/clients',
    component: Layout,
    meta: {
      title: 'Clients',
      icon: 'i-carbon:user-multiple',
      auth: PERMISSIONS.clients,
      sort: 60,
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
      {
        path: ':clientId',
        name: 'clientDetail',
        component: () => import('@/views/clients/detail.vue'),
        meta: {
          title: 'Fiche client',
          menu: false,
          breadcrumb: true,
          activeMenu: '/gestion/clients',
          auth: PERMISSIONS.clients,
        },
      },
    ],
  },
  // —— Dossier ——
  {
    path: '/gestion/dossiers',
    component: Layout,
    meta: {
      title: 'Dossiers',
      icon: 'i-carbon:folder',
      auth: PERMISSIONS.dossiers,
      expand: true,
      sort: 50,
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
    path: '/gestion/dossiers/client/:clientId',
    redirect: (to) => ({
      path: `/gestion/clients/${String(to.params.clientId ?? '')}`,
      query: to.query,
      hash: to.hash,
    }),
    meta: { menu: false, breadcrumb: false },
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
  // —— Agenda (lié à Dossier) ——
  {
    path: '/gestion/agenda',
    component: Layout,
    meta: {
      title: 'Agenda',
      icon: 'i-carbon:calendar',
      auth: PERMISSIONS.agenda,
      sort: 45,
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
  // —— Documents (hors entités UML principales) ——
  {
    path: '/gestion/note-honoraire',
    component: Layout,
    meta: {
      title: 'Note honoraire',
      icon: 'i-carbon:document',
      auth: PERMISSIONS.noteHonoraire,
      sort: 35,
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
  // —— Paiement (lié à Dossier) ——
  {
    path: '/gestion/paiement',
    component: Layout,
    meta: {
      title: 'Paiements',
      icon: 'i-carbon:wallet',
      auth: PERMISSIONS.paiements,
      sort: 40,
    },
    children: [
      {
        path: '',
        name: 'paiement',
        component: () => import('@/views/paiement/index.vue'),
        meta: {
          title: 'Gérer les paiements',
          icon: 'i-carbon:wallet',
          menu: false,
          breadcrumb: false,
          activeMenu: '/gestion/paiement',
          auth: PERMISSIONS.paiements,
        },
      },
    ],
  },
  // —— Avocat + Affectation ——
  {
    path: '/gestion/avocats',
    component: Layout,
    meta: {
      title: 'Avocats',
      icon: 'i-carbon:user-certification',
      auth: PERMISSIONS.avocats,
      expand: true,
      sort: 30,
    },
    children: [
      {
        path: '',
        name: 'avocats',
        component: () => import('@/views/avocat/index.vue'),
        meta: {
          title: 'Avocats et affectations',
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
      sort: 20,
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
      sort: 15,
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
      sort: 10,
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
      sort: 5,
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
