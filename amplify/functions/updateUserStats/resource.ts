import { defineFunction } from "@aws-amplify/backend";

export const updateUserStats = defineFunction({
  name: "updateUserStats",
  runtime: 20,
  timeoutSeconds: 60,
  environment: {
    STATS_RECEIPT_TABLE: "",
  },
});
