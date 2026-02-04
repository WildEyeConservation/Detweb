import { defineStorage } from "@aws-amplify/backend"
import { handleS3Upload } from "./handleS3Upload/resource"
import { processImages } from "../functions/processImages/resource"
import { runPointFinder } from "../functions/runPointFinder/resource"
import { runHeatmapper } from "../functions/runHeatmapper/resource"
import { monitorModelProgress } from "../functions/monitorModelProgress/resource"
import { launchAnnotationSet } from "../functions/launchAnnotationSet/resource"
import { launchFalseNegatives } from "../functions/launchFalseNegatives/resource"
import { processTilingBatch } from "../functions/processTilingBatch/resource"
import { monitorTilingTasks } from "../functions/monitorTilingTasks/resource"
import { cleanupJobs } from "../functions/cleanupJobs/resource"
import { findAndRequeueMissingLocations } from "../functions/findAndRequeueMissingLocations/resource"
import { reconcileFalseNegatives } from "../functions/reconcileFalseNegatives/resource"

export const outputBucket = defineStorage({
  name: "outputs",
  isDefault: true,
  access: allow => ({
    'slippymaps/*': [
      allow.resource(handleS3Upload).to(['write', 'list', 'get', 'delete']),
      allow.authenticated.to(['read'])
    ],
    'heatmaps/*': [
      allow.resource(processImages).to(['write', 'list', 'delete']),
      allow.resource(runPointFinder).to(['read']),
      allow.resource(runHeatmapper).to(['read']),
      allow.resource(monitorModelProgress).to(['read']),
      allow.authenticated.to(['read'])
    ],
    'launch-payloads/*': [
      allow.authenticated.to(['write']),
      allow.resource(launchAnnotationSet).to(['read', 'delete']),
      allow.resource(launchFalseNegatives).to(['read', 'delete'])
    ],
    // Tiling batch input files - location data to be created
    'tiling-batches/*': [
      allow.resource(launchAnnotationSet).to(['write']),
      allow.resource(launchFalseNegatives).to(['write']),
      allow.resource(processTilingBatch).to(['read', 'delete'])
    ],
    // Tiling batch output files - created location IDs
    'tiling-outputs/*': [
      allow.resource(processTilingBatch).to(['write']),
      allow.resource(monitorTilingTasks).to(['read', 'delete'])
    ],
    // Queue manifests for requeue detection
    'queue-manifests/*': [
      allow.authenticated.to(['write']),
      allow.resource(launchAnnotationSet).to(['write']),
      allow.resource(monitorTilingTasks).to(['write']),
      allow.resource(findAndRequeueMissingLocations).to(['read']),
      allow.resource(cleanupJobs).to(['delete'])
    ],
    // False negative pools for species labelling reconciliation
    'false-negative-pools/*': [
      allow.authenticated.to(['read', 'delete']),
      allow.resource(launchFalseNegatives).to(['read', 'write']),
      allow.resource(launchAnnotationSet).to(['delete']),
      allow.resource(reconcileFalseNegatives).to(['read', 'write'])
    ],
    // False negative history tracking
    'false-negative-history/*': [
      allow.authenticated.to(['read', 'delete']),
      allow.resource(launchFalseNegatives).to(['read', 'write']),
      allow.resource(launchAnnotationSet).to(['delete']),
      allow.resource(reconcileFalseNegatives).to(['read', 'write'])
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
      allow.authenticated.to(['read', 'write', 'delete'])
    ]
  }),
  triggers: {
    onUpload: handleS3Upload
  }
})

