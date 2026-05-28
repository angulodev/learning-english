// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
	site: "https://example.com",
	output: "server",
	integrations: [react(), tailwind()],
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),
});
