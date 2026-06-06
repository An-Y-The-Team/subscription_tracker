<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Package manager: use Bun

This project uses **Bun** as its package manager and script runner (`bun.lock` is the source of truth — there is no `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`). Always use Bun, never npm/yarn/pnpm:

- **Install deps**: `bun install` (never `npm install` — it would create a competing `package-lock.json`)
- **Add / remove a package**: `bun add <pkg>` / `bun add -d <pkg>` (dev) / `bun remove <pkg>`
- **Run scripts**: `bun run <script>` or the shorthand `bun dev`, `bun build`, `bun start`, `bun lint`, `bun test`
- **Run a one-off binary**: `bunx <pkg>` instead of `npx <pkg>`

Commit the updated `bun.lock` whenever dependencies change. Do not introduce another package manager's lockfile.
