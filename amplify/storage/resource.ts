import { defineStorage } from "@aws-amplify/backend"
import { handleS3Upload } from "./handleS3Upload/resource"

export const outputBucket = defineStorage({
  name: "outputs",
  access: allow => ({
    'slippymaps/*': [
      allow.resource(handleS3Upload).to(['write','list','get'])
    ]
  })
})

// export const storageOS = defineStorage({
//   name: "opensearch-backup-bucket-amplify-gen-2",
//   access: allow => ({
//     'public/*': [
//       allow.guest.to(['list', 'write', 'get'])
//     ]
//   })
// })

export const inputBucket = defineStorage({
  name: "inputs",
  isDefault: true,
  access: allow => ({
    'images/*': [
      allow.resource(handleS3Upload).to(['get'])
    ]
  }),
  triggers: {
    onUpload: handleS3Upload
  }
})

