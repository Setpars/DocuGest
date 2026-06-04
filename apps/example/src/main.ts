// 加载 iconify 图标
import { downloadAndInstall } from '@/iconify'
import icons from '@/iconify/index.json'
// 自定义指令
import directive from '@/utils/directive'

import App from './App.vue'
import { initFirebase } from '@/firebase'
import router from './router'
import pinia from './store'
import uiProvider from './ui/provider'
import '@/utils/storage'

import '@/utils/baidu'

// UnoCSS
import 'virtual:uno.css'
// 全局样式
import '@/assets/styles/globals.css'

const app = createApp(App)
app.use(pinia)

async function bootstrap() {
  await initFirebase()

  const appOfflineStore = useAppOfflineStore(pinia)
  appOfflineStore.initNetworkListeners()

  const appAccountStore = useAppAccountStore(pinia)
  await appAccountStore.initAuth()

  app.use(router)
  app.use(uiProvider)
  directive(app)
  if (icons.isOfflineUse) {
    for (const info of icons.collections) {
      downloadAndInstall(info)
    }
  }
  app.mount('#app')
}

bootstrap()
