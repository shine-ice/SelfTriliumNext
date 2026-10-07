import { defineConfig } from "vitest/config";

export default defineConfig({
    root: __dirname,
    test: {
        name: "desktop",
        environment: "node",
        include: ["spec/**/*.spec.ts"],
        exclude: ["spec/build-checks/**"]
    }
});
