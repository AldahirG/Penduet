// Copies the generated design tokens from replica/design into the web app.
// Source of truth: replica/design/tokens*.json. Run `pnpm tokens` after editing them.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const from = (f) => resolve(root, 'replica/design', f)
const to = (f) => resolve(root, 'apps/web', f)

mkdirSync(to('src/styles'), { recursive: true })
copyFileSync(from('tokens.css'), to('src/styles/tokens.css'))
copyFileSync(from('tailwind.config.ts'), to('tailwind.config.ts'))
console.log('synced tokens.css and tailwind.config.ts into apps/web')
