import { defineStorage } from "@aws-amplify/backend"
import { handleS3Upload } from "./handleS3Upload/resource"
import { processImages } from "../functions/processImages/resource"
import { runPointFinder } from "../functions/runPointFinder/resource"
import { runHeatmapper } from "../functions/runHeatmapper/resource"
import { monitorModelProgress } from "../functions/monitorModelProgress/resource"

export const outputBucket = defineStorage({
  name: "outputs",
  isDefault: true,
  access: allow => ({
    'slippymaps/*': [
      allow.resource(handleS3Upload).to(['write', 'list', 'get']),
      allow.authenticated.to(['read'])
    ],
    'heatmaps/*': [
      allow.resource(processImages).to(['write', 'list', 'delete']),
      allow.resource(runPointFinder).to(['read']),
      allow.resource(runHeatmapper).to(['read']),
      allow.resource(monitorModelProgress).to(['read']),
      allow.authenticated.to(['read'])
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
  access: allow => ({
    'images/*': [
      allow.resource(handleS3Upload).to(['get']),
      allow.resource(processImages).to(['read']),
      allow.resource(runHeatmapper).to(['read']),
      allow.authenticated.to(['read','write','delete'])
    ]
  }),
  triggers: {
    onUpload: handleS3Upload
  }
})

