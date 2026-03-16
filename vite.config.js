import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dir = dirname(__filename)
const buildTime = Date.now()

// Schrijf public/version.json bij elke build zodat de app de deploy-tijd kan ophalen
function versionPlugin() {
  return {
    name: 'version-json',
    buildStart() {
      const out = resolve(__dir, 'public/version.json')
      fs.writeFileSync(out, JSON.stringify({ t: buildTime }))
    }
  }
}

export default defineConfig({
  plugins: [react(), versionPlugin()],
  define: {
    __BUILD_TIME__: buildTime,
  },
  server: {
    port: 3000,
  },
})
