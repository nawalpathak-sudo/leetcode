import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow existing .jsx files during incremental migration
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

  // Skip ESLint during builds
  eslint: { ignoreDuringBuilds: true },

  // Vercel crons are configured in vercel.json (unchanged)
  // API routes work identically in dev and prod

  images: {
    // For future Supabase Storage images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ifkkhwumimawacqaujop.supabase.co',
      },
    ],
  },
}

export default nextConfig
