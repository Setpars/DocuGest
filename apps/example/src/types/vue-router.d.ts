import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Entrée de menu visible mais non cliquable (fonctionnalité à venir). */
    comingSoon?: boolean
    comingSoonHint?: string
  }
}
