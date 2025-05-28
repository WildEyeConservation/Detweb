import { defineFunction } from "@aws-amplify/backend";

export const cleanupJobs = defineFunction({
  name: "cleanupJobs",
  schedule: "every 15m",
  timeoutSeconds: 450,
  entry: "./handler.ts",
});
