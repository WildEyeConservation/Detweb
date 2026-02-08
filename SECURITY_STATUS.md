# Custom Authorizer Security Status

Current state of the organization-level data isolation system described in `CUSTOM_AUTHORIZER_PLAN.md`.

---

## What Is Implemented

### 1. Custom Lambda Authorizer (`amplify/data/custom-authorizer.ts`)

Fully implemented per the plan. Handles all four authorization strategies:

| Strategy | Operations | Logic | Status |
|----------|-----------|-------|--------|
| Sysadmin bypass | All | `cognito:groups` contains `sysadmin` → allow (TTL 300s) | Done |
| Strict filter (Strategy 1) | `list`, custom index queries | Requires `filter: { organizationId: { eq: "..." } }` as the ONLY filter key | Done |
| Fetch and verify (Strategy 2) | `get`, `update`, `delete` | Fetches the record from DynamoDB, reads `organizationId` from it, checks membership | Done |
| Input validation (Strategy 3) | `create` | Reads `organizationId` from `variables.input`, checks membership | Done |

Additional features:
- Dynamic table name resolution via `${modelName}-${apiId}-NONE`
- Composite key support for 13 models with non-standard primary keys
- Whitelisted operations (17) for Lambda-backed custom mutations/queries
- Whitelisted models: `Organization`
- JWT verification via `aws-jwt-verify` (Cognito access token)
- User pool ID resolved via SSM parameter at cold start (cached)

### 2. Schema Auth Lockdown (`amplify/data/resource.ts`)

All model and operation authorization rules have been tightened:

| Resource Type | Auth Rule | Effect |
|--------------|-----------|--------|
| 35 standard models | `allow.authenticated().to(['listen']), allow.custom()` | CRUD requires custom authorizer; subscriptions use userPool |
| Annotation, Observation | `allow.authenticated().to(['listen']), allow.owner().to(['listen']), allow.custom()` | Same as above; owner bypass also limited to subscriptions |
| UserStats | `allow.authenticated().to(['listen']), allow.publicApiKey(), allow.custom()` | Lambda functions can still write via API key |
| 17 custom mutations/queries | `allow.custom()` only | Must go through custom authorizer |
| `publish` mutation | `allow.publicApiKey(), allow.custom()` | Lambdas use API key; users use custom authorizer |
| `receive` subscription | `allow.authenticated()` (unchanged) | Subscriptions are not locked down yet |
| Schema-level Lambda access | `allow.resource(...)` for 18 functions (unchanged) | Lambda functions bypass authorizer via IAM |

**Before**: Any authenticated user could bypass the authorizer by sending a direct GraphQL query with `authMode: 'userPool'` from the browser console.

**After**: `userPool` auth only permits `listen` (subscriptions). All CRUD operations must go through the custom Lambda authorizer (`authMode: 'lambda'`).

### 3. Client-Side Enforcement (`src/limitedClient.ts`)

Already in place (no changes needed):
- All CRUD/list methods inject `authMode: 'lambda'` + Cognito access token
- Subscriptions (`onCreate`, `onUpdate`, `onDelete`) still use `userPool` auth (not wrapped)
- p-limit concurrency (15) + exponential backoff retry

### 4. Infrastructure (`amplify/backend.ts`)

- User pool ID passed to the authorizer Lambda via SSM parameter (avoids circular CDK dependency)
- Lambda has DynamoDB `GetItem`/`Query` + SSM `GetParameter` permissions (wildcard ARNs)

---

## What Is NOT Yet Working / Remaining Issues

### CRITICAL: Most Models Lack `organizationId` Field

**This is the single biggest gap.** The custom authorizer requires every non-whitelisted model to have an `organizationId` field on the DynamoDB record. Currently:

**Models WITH `organizationId`** (4 models):
- Project, TestPreset, OrganizationMembership, OrganizationInvite

**Models WITHOUT `organizationId`** (34+ models):
- All other models (Category, Image, ImageFile, Annotation, Location, Queue, etc.)

**Impact**: For any model without `organizationId`:
- **`get`/`update`/`delete`**: The authorizer fetches the record, reads `record.organizationId`, finds `null`, and **denies the request**
- **`create`**: The authorizer reads `variables.input.organizationId`, finds it missing, and **denies the request**
- **`list`/custom index queries**: The authorizer requires `filter: { organizationId: { eq: "..." } }` as the sole filter key, which these models cannot satisfy

**Options to fix** (pick one):

1. **Add `organizationId` to all models** — cleanest long-term solution but requires schema migration + backfilling existing data + updating all create operations to include the field
2. **Modify the authorizer to resolve `organizationId` via parent lookup** — for models with `projectId`, fetch the Project record to get `organizationId`. Adds one DynamoDB read per request but avoids schema changes. Models without `projectId` (e.g., `LocationSetMembership`, `ImageSetMembership`, `TestResultCategoryCount`, `TilingBatch`, `ClientLog`) would need special handling
3. **Whitelist models** — add models to `WHITELISTED_MODELS` in the authorizer to skip org checks. Quick fix but reduces security coverage

### Subscriptions Not Protected

Subscriptions (`onCreate`, `onUpdate`, `onDelete`) use `userPool` auth and are not validated by the custom authorizer:
- `allow.authenticated().to(['listen'])` permits any authenticated user to subscribe
- A user could subscribe to changes on models they don't have org access to
- The `receive` subscription (AppSync pub/sub) also uses `allow.authenticated()` only

**To fix**: Modify `limitedClient.ts` to wrap subscription methods with `authMode: 'lambda'` and update the custom authorizer to handle subscription events (or add `allow.custom()` to the `receive` subscription and update the `receive.js` handler).

### Circular Dependency (Deployment Blocker)

The `customAuthorizer` in `defineBackend` creates a cross-stack dependency chain. The SSM parameter approach has been implemented to break the `function → auth` link.

### Whitelisted Operations Have No Org Check

The 17 whitelisted operations (Lambda-backed mutations/queries) are allowed through the authorizer without any organization membership validation:

```
addUserToGroup, removeUserFromGroup, createGroup, listUsers, listGroupsForUser,
processImages, runScoutbot, runMadDetector, runHeatmapper, runImageRegistration,
deleteProjectInFull, generateSurveyResults, launchAnnotationSet, launchFalseNegatives,
getJwtSecret, updateProjectMemberships, getImageCounts, publish
```

These are trusted because they have their own Lambda handlers. However, the Lambda handlers themselves do not necessarily enforce org-level isolation — a user could potentially invoke `deleteProjectInFull` on a project from a different organization if the Lambda handler doesn't check membership.

### Legacy `gqlClient` Code Paths

Some files use a raw `gqlClient.graphql()` pattern instead of `limitedClient`:
- `src/useTesting.tsx` — subscriptions only (safe, uses userPool)
- `src/useQueuesByProject.tsx` — raw mutations
- `src/DeleteImageSet.tsx` — raw mutations

These calls may use the default API key auth mode and would not go through the custom authorizer. They should be migrated to `limitedClient`.

### `OrganizationRegistration` and `ClientLog` Have No Org Context

These models have no `organizationId` and no `projectId`:
- `OrganizationRegistration` — has `organizationName`, `requestedBy`, `status`
- `ClientLog` — has `userId` only

They cannot be validated against an organization. Need to decide: whitelist them or add `organizationId`.

---

## Security Model Summary

```
User Request
    │
    ▼
┌─────────────────────────────────┐
│  AppSync API                     │
│  Default auth: apiKey            │
│  Available: userPool, lambda,    │
│            apiKey, iam           │
└─────────────┬───────────────────┘
              │
    ┌─────────┼──────────┐
    │         │          │
    ▼         ▼          ▼
 lambda    userPool    resource(iam)
 auth      auth        auth
    │         │          │
    ▼         │          ▼
 Custom       │       Lambda functions
 Authorizer   │       (18 functions)
    │         │       bypass authorizer
    ▼         ▼
 CRUD ops   Subscriptions only
 (locked)   (.to(['listen']))
```

### What Is Locked Down
- All CRUD operations on all models (via `allow.custom()`)
- All custom mutations/queries (via `allow.custom()`)
- Direct `userPool` auth bypass for CRUD (blocked by `.to(['listen'])`)

### What Is NOT Locked Down
- Subscriptions (any authenticated user can listen)
- Lambda function data access (IAM auth, bypasses authorizer)
- Whitelisted operations (no org check in authorizer)
- Models without `organizationId` (authorizer will deny — functional issue, not security hole)

---

## Files Modified in This Change

| File | Changes |
|------|---------|
| `amplify/data/resource.ts` | Auth rules on all models and operations tightened |
| `amplify/data/custom-authorizer.ts` | SSM-based user pool ID resolution (was direct env var) |
| `amplify/backend.ts` | SSM parameter for user pool ID; `envName` moved earlier |

---

## Recommended Next Steps (Priority Order)

1. **Deploy and test** — Run `npx ampx sandbox` to verify the circular dependency is resolved
2. **Decide on `organizationId` strategy** — Add to all models (Option 1) or add parent lookup to authorizer (Option 2) — this must be done before the authorizer can protect most of the data
3. **Test the authorizer end-to-end** — Verify CRUD operations work through the app; verify a direct `userPool` query from the console is denied
4. **Audit whitelisted Lambda handlers** — Ensure each one checks org membership internally
5. **Lock down subscriptions** — Wrap subscription methods in `limitedClient.ts` with lambda auth
6. **Migrate legacy `gqlClient` usage** to `limitedClient`
7. **Handle edge-case models** — Whitelist or add org context to `OrganizationRegistration`, `ClientLog`
