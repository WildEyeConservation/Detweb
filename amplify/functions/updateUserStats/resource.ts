import { defineFunction } from "@aws-amplify/backend";

export const updateUserStats = defineFunction({
  name: "updateUserStats",
  runtime: 20,
});