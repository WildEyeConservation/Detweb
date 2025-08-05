import { defineFunction, secret } from "@aws-amplify/backend";

export const getJwtSecret = defineFunction({
  name: "getJwtSecret",
  timeoutSeconds: 5,
  runtime: 20,
  environment: {
    JWT_SECRET: secret('JWT_SECRET'),
  },
});
