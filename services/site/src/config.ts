/**
 * Application-wide constants and configuration
 */
export const config = {
  consoleMarketingEnabled: import.meta.env.VITE_CONSOLE_MARKETING_ENABLED === "true",

  // Base URL
  baseUrl: "https://codeshod.ai",

  // GitHub
  github: {
    repoUrl: "https://github.com/reddata997327/codeshod",
    starsFormatted: {
      compact: "220K",
      full: "220,000",
    },
  },

  // Social links
  social: {
    twitter: "https://x.com/codeshod",
    discord: "https://discord.gg/codeshod",
  },

  // Static stats (used on landing page)
  stats: {
    contributors: "1,000+",
    contributorsCompact: "1K+",
    commits: "20,000",
    monthlyUsers: "22M",
  },
} as const
