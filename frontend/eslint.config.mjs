import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "next.config.js", "tailwind.config.js", "postcss.config.js", "next-sitemap.config.js", ".prettierrc.js"]),
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
])
