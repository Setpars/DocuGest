import { setSettings } from '@fantastic-admin/settings'

export default setSettings({
  app: {
    routeBaseOn: 'frontend',
    home: {
      title: 'Accueil',
      enable: false,
    },
    account: {
      auth: true,
    },
    dynamicTitle: true,
    copyright: {
      enable: true,
      dates: '2026',
      company: 'Enesra-mindset',
    },
  },
  menu: {
    mainMenuClickMode: 'smart',
    subMenuCollapse: true,
    subMenuCollapseButton: true,
    hotkeys: true,
  },
  topbar: {
    tabbar: true,
    toolbar: true,
    mode: 'fixed',
  },
  tabbar: {
    icon: true,
    hotkeys: true,
  },
  theme: {
    colorScheme: '',
  },
  toolbar: {
    fullscreen: true,
    pageReload: true,
    colorScheme: true,
  },
})
