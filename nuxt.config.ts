import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  future: { compatibilityVersion: 4 },

  modules: ["shadcn-nuxt", "@nuxt/fonts", "@nuxt/icon", "@vueuse/motion/nuxt", "@vite-pwa/nuxt"],

  pwa: {
    registerType: "autoUpdate",
    manifest: {
      name: "Fynex",
      short_name: "Fynex",
      description: "Simple investing, diversified returns. Pick a portfolio and start earning.",
      theme_color: "#0d1117",
      background_color: "#0d1117",
      display: "standalone",
      orientation: "portrait",
      start_url: "/app",
      icons: [
        { src: "/logo.png", sizes: "400x400", type: "image/png", purpose: "any" },
        { src: "/icon.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
        { src: "/icon.png", sizes: "1024x1024", type: "image/png", purpose: "maskable" },
      ],
    },
    workbox: {
      navigateFallback: "/",
      globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: true,
      type: "module",
      suppressWarnings: true,
    },
  },

  shadcn: {
    prefix: "",
    componentDir: "./app/components/ui",
  },

  fonts: {
    families: [
      {
        name: "Space Grotesk",
        provider: "google",
        weights: [400, 500, 600, 700],
      },
    ],
  },

  css: ["~/assets/css/main.css"],

  vite: {
    plugins: [tailwindcss() as any],
  },

  app: {
    head: {
      title: "Fynex",
      meta: [
        { name: "description", content: "Simple investing, diversified returns. Pick a portfolio and start earning." },
        { name: "theme-color", content: "#0d1117" },
      ],
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "icon", type: "image/png", sizes: "512x512", href: "/logo.png" },
        { rel: "apple-touch-icon", href: "/logo.png" },
      ],
    },
  },

  runtimeConfig: {
    supabaseUrl: "",
    supabaseKey: "",
    ensoApiKey: "",
    public: {
      privyAppId: "",
      privyClientId: "",
      walletconnectProjectId: "",
      moonpayApiKey: "",
    },
  },

  devtools: { enabled: false },
});
