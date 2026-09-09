import nextVitals from "eslint-config-next/core-web-vitals";

const config = [{ ignores: ["out/**", ".next/**", "public/sw.js", "public/swe-worker-*.js", ".pwa-worker.js", "test-results/**"] }, ...nextVitals];

export default config;
