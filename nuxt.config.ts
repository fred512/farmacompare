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
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    pharmadbApiKey: process.env.PHARMADB_API_KEY || '',

    // Chaves públicas (expostas ao client)
    public: {
      appName: 'FarmaCompare',
      defaultRadius: 3000, // 3km
    }
  },

  app: {
    head: {
      title: 'FarmaCompare',
      meta: [
        { name: 'description', content: 'Compare preços de remédios nas farmácias mais próximas de você' },
        { name: 'theme-color', content: '#1a7a4a' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.json' },
      ]
    }
  },

  nitro: {
    // Habilita cache nas rotas de API
    routeRules: {
      '/api/farmacias-proximas': { cache: { maxAge: 300 } }, // 5 min
    }
  },

  compatibilityDate: '2024-11-01',
})
