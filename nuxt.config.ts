import packageJson from './package.json'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Chaves privadas (só server-side)
    googlePlacesApiKey: '',

    // Chaves públicas (expostas ao client)
    public: {
      appName: 'FarmaCompare',
      appVersion: String(packageJson.appVersion),
      defaultRadius: 3000, // 3km
    }
  },

  app: {
    head: {
      title: 'FarmaCompare',
      meta: [
        { name: 'description', content: 'Compare preços de remédios nas farmácias mais próximas de você' },
        { name: 'theme-color', content: '#880e4f' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
      script: [
        {
          innerHTML: "(()=>{try{const t=localStorage.getItem('fc_tema');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}})()",
          tagPosition: 'head',
        },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.json' },
      ]
    }
  },

  nitro: { preset: 'node-server' },

  compatibilityDate: '2024-11-01',
})
