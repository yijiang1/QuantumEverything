import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The site is fully static (GitHub Pages). A relative base lets the same build
// work at https://<user>.github.io/<repo>/ or any other path.
export default defineConfig({
  plugins: [react()],
  base: './',
})
