import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const buildTime = Date.now()

// Schrijf public/version.json bij elke build zodat de app de deploy-tijd kan ophalen
function versionPlugin() {
  return {
    name: 'version-json',
    buildStart() {
      const out = path.resolve(__dirname, 'public/version.json')
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
