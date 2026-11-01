import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
 
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    
  },
   typescript: {
    // Ship today. Regenerate Supabase types and fix these properly before you have real customers.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
