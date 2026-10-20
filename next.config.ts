import type { NextConfig } from "next";

// Sem regra de loader: os shaders são módulos TypeScript, então Turbopack e
// webpack se comportam igual.
const nextConfig: NextConfig = {};

export default nextConfig;
