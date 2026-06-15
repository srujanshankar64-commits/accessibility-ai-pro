// @lovable.dev/vite-tanstack-config already includes the following - do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//      componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//   error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    tanstackStart: {
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      // nitro/vite builds from this
      server: { entry: "server" },
    },
    vite: {
      define: {
        'process.env.DODO_PAYMENTS_API_KEY': JSON.stringify(env.DODO_PAYMENTS_API_KEY),
        'process.env.VITE_LOVABLE_API_KEY': JSON.stringify(env.VITE_LOVABLE_API_KEY),
        'process.env.LOVABLE_API_KEY': JSON.stringify(env.LOVABLE_API_KEY),
        'process.env.GOOGLE_GEMINI_API_KEY': JSON.stringify(env.GOOGLE_GEMINI_API_KEY),
        'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
        'process.env.SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY),
        'import.meta.env.GOOGLE_GEMINI_API_KEY': JSON.stringify(env.GOOGLE_GEMINI_API_KEY),
        'import.meta.env.VITE_GOOGLE_GEMINI_API_KEY': JSON.stringify(env.GOOGLE_GEMINI_API_KEY),
      },
    },
  };
});
