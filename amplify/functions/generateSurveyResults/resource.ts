import { defineFunction } from "@aws-amplify/backend";

export const generateSurveyResults = defineFunction({
  name: "generateSurveyResults",
  timeoutSeconds: 900,
  runtime: 20,
});
