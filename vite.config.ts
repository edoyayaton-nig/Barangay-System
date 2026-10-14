import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


import fs from 'fs'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

// Automatically sync compiled production bundles to Laravel's public directory
// so Laravel serves the frontend and backend in a unified single runtime environment
function syncLaravelPublic() {
  return {
    name: 'sync-laravel-public',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist')
      const publicDir = path.resolve(__dirname, 'public')
      const distAssets = path.join(distDir, 'assets')
      const publicAssets = path.join(publicDir, 'assets')
      const distIndex = path.join(distDir, 'index.html')
      const publicIndex = path.join(publicDir, 'index.html')

      if (!fs.existsSync(publicAssets)) {
        fs.mkdirSync(publicAssets, { recursive: true })
      }

      if (fs.existsSync(distAssets)) {
        for (const file of fs.readdirSync(distAssets)) {
          fs.copyFileSync(path.join(distAssets, file), path.join(publicAssets, file))
        }
      }

      if (fs.existsSync(distIndex)) {
        fs.copyFileSync(distIndex, publicIndex)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    syncLaravelPublic(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
