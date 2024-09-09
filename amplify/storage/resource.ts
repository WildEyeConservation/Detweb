import { defineStorage } from "@aws-amplify/backend"

export const storage = defineStorage({
  name: "opensearch-backup-bucket-amplify-gen-2",
  access: allow => ({
    'public/*': [
      allow.guest.to(['list', 'write', 'get'])
    ]
  })
})