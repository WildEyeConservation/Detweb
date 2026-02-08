# Custom Authorization Architecture Plan

This document outlines the final architectural decision for implementing a custom Lambda Authorizer in the Detweb application. This solution secures data access in a multi-tenant environment by enforcing strict organization-level isolation.

## Reference Documentation

For detailed implementation guidance, see the official AWS Amplify documentation:
**[Custom Data Access Patterns](https://docs.amplify.aws/react/build-a-backend/data/customize-authz/custom-data-access-patterns/)**

## 1. Client-Side Usage (`limitedClient.ts`)

No changes are required to the internal logic of `limitedClient.ts`. The security relies on **how** the client is used. The authorizer expects specific patterns in the GraphQL arguments, and any deviation will result in a "Deny".

### The "Strict Filter" Rule
For all `list` queries, the client **must** strictly filter by `organizationId`. 

```typescript
// ✅ ALLOWED
await limitedClient.models.Project.list({
  filter: {
    organizationId: {
      eq: 'org-123'
    }
  }
});

// ❌ DENIED (Missing separation)
await limitedClient.models.Project.list({}); 

// ❌ DENIED (Complex logic designed to bypass checks)
await limitedClient.models.Project.list({
  filter: {
    or: [{ organizationId: { eq: 'A' } }, { organizationId: { eq: 'B' } }]
  }
});
```

---

## 2. Infrastructure Configuration - Dynamic Table Name Resolution

Instead of injecting table names as environment variables, we leverage the Lambda event's `requestContext` to dynamically calculate table names at runtime.

**Key Information:**
The Lambda Authorizer event contains `requestContext.apiId`, which is part of the AppSync API identifier. Amplify generates DynamoDB table names following a predictable naming convention:

```
<ModelName>-<apiId>-NONE
```

**Example:**
```typescript
// Given:
// - Model: "OrganizationMembership"
// - apiId: "ghqsamuonbfsdl5uprukwrrega"

// Resulting table name:
"OrganizationMembership-ghqsamuonbfsdl5uprukwrrega-NONE"
```

**Implementation:**
```typescript
// Extract apiId from the Lambda event
const apiId = event.requestContext.apiId;

// Calculate table name on-the-fly
function getTableName(modelName: string, apiId: string): string {
  return `${modelName}-${apiId}-NONE`;
}

// Usage examples:
const membershipTable = getTableName('OrganizationMembership', apiId);
const projectTable = getTableName('Project', apiId);
const cameraTable = getTableName('Camera', apiId);
```

**Benefits:**
- **No environment variable management:** Eliminates the need to inject table names in `amplify/backend.ts`
- **Automatic scaling:** New models automatically work without configuration changes
- **Simpler deployment:** Fewer configuration dependencies between resources
- **Consistent naming:** Leverages Amplify's built-in table naming convention

**Required Permissions:**
The Lambda function still requires DynamoDB permissions for all tables:
- `dynamodb:GetItem` - For fetching individual records (get/update/delete operations)
- `dynamodb:Query` - For organization membership validation

---

## 3. The Lambda Authorizer Logic

The Authorizer function acts as a centralized security gate. It classifies the incoming GraphQL query and applies the appropriate verification strategy.

### Step A: Token Verification & User Identity
1.  **Extract Token:** The Lambda Authorizer receives an event object containing the `authorizationToken` field. This token is extracted from the incoming request.
2.  **Verify & Decode:** Verify the JWT signature (using Cognito JWKS keys) and decode the payload to ensure the token is valid and not expired.
3.  **Identify User:** Extract the user's unique ID from the `sub` claim in the decoded token payload. This `sub` value represents the Cognito user ID and will be used to verify organization membership.
4.  **Extract API ID:** Extract the `apiId` from `event.requestContext.apiId`. This is needed for dynamic table name calculation throughout the authorization flow.

**Important:** The JWT token does NOT contain the user's organization ID. The organization context comes from the GraphQL request itself and must be extracted in Step B.

### Step B: Request Parsing & Organization ID Extraction
Before we can validate membership, we must parse the GraphQL request to understand what operation is being performed and extract the target organization ID.

We use a Regex pattern to extract the **Action** (get, list, create, update, delete) and the **Model** (Project, Camera, etc.) from the query string.

```typescript
// Regex Logic
const rootFieldRegex = /{\s*([a-zA-Z0-9_]+)[\s({]/; 
// Matches: "updateCamera"
const patternRegex = /^(get|update|delete|list|create)(.+)$/;
// Extracts: Action="update", Model="Camera"
```

**Extract Organization ID based on operation type:**
- **`list` queries:** Extract from `event.variables.filter.organizationId.eq`
- **`create` mutations:** Extract from `event.variables.input.organizationId`
- **`get`/`update`/`delete` operations:** Must fetch the record from DynamoDB first to get its `organizationId` (see Strategy 2 below)
- **Unknown/Custom operations:** If the operation doesn't match `get`, `list`, `create`, `update`, or `delete`, assume it's a custom index query (like `annotationsByAnnotationSetId`). Attempt to extract from `event.variables.filter.organizationId.eq` using the same method as standard `list` queries. If this fails or the filter doesn't match the strict pattern, **immediately deny the request**.

**Critical Notes:** 
- For `get`, `update`, and `delete` operations, we cannot trust the client to provide the organization ID. We must fetch the actual record first to determine which organization it belongs to, then validate membership before allowing the operation.
- For any operation that doesn't match the five standard patterns, we treat it as a list-like query. If it doesn't provide organization filtering in the expected format, it's rejected to prevent data leakage.

### Step C: Organization Membership Check (The Gatekeeper)
Once we have both the user ID (from JWT in Step A) and the organization ID (extracted in Step B), we validate membership.

*   **Action:** Perform a DynamoDB query on the `OrganizationMembership` table using the composite key.
*   **Query Parameters:**
    *   **Partition Key (organizationId):** Extracted from the GraphQL request in Step B
    *   **Sort Key (userId):** The `sub` value from the verified JWT token payload (Step A)
*   **Logic:**
    *   If the query returns a record -> **User is a Member** of the organization. Proceed to request validation.
    *   If the query returns no record -> **User is NOT a Member**. Return an IAM "Deny" policy immediately to block access.

**Implementation Note:** This membership check acts as the primary gate. Without a valid membership record matching both the target organization and the authenticated user, no further authorization logic is executed.

### Step D: Strategy Routing

**Operation Classification Security Principle:**
The Authorizer classifies every incoming request into one of five categories: `get`, `list`, `create`, `update`, or `delete`. 

- If the operation matches one of these five standard patterns, the appropriate strategy is applied.
- If the operation does NOT match any of these five patterns, it is assumed to be a **custom index/list query** (e.g., `annotationsByAnnotationSetId`, `projectsByOrgId`, etc.).
- Custom queries are treated as list-like operations and MUST provide organization filtering via `event.variables.filter.organizationId.eq` following the exact same strict pattern as standard `list` queries.
- **If a custom query cannot be validated using the list strategy (missing filter, wrong filter structure, or unable to extract organizationId), it is immediately denied.**

This "deny by default" approach ensures that any new query types added to the schema cannot bypass organization isolation unless they explicitly follow the established filtering pattern.

Once the action is identified, the Authorizer executes one of the following security strategies:

#### Strategy 1: "Strict Filter Validation" (For `list` and Custom Index Queries)
This strategy applies to standard `list` queries as well as custom index queries (e.g., `annotationsByAnnotationSetId`). These custom queries function exactly like standard `list` queries and accept a `filter` argument.

*   **Logic:** 
    1. Check if `event.variables.filter` exists.
    2. Ensure `organizationId` is the **only** top-level key.
    3. Ensure `eq` is the **only** condition key.
    4. Verify the value matches the User's Organization ID (via membership check in Step C).
*   **Outcome:** If the pattern matches perfectly, the query is allowed. The database will only return records for that specific org.
*   **Fallback for Unknown Operations:** If a query does not match the standard `get`, `create`, `update`, or `delete` actions, it is assumed to be a **custom list/index query pattern**. The Authorizer attempts to extract `organizationId` using the same method as standard `list` queries (from `event.variables.filter.organizationId.eq`). If this extraction fails or the filter does not follow the strict pattern, the query is **immediately denied** as potentially malicious.

#### Strategy 2: "Fetch and Verify" (For `get`, `update`, `delete`)
These operations target a specific record by ID. We cannot rely on client input for security here (IDOR risk).
*   **Logic:**
    1. Extract the `id` from arguments (or `input.id`).
    2. Calculate the table name dynamically: `${modelName}-${event.requestContext.apiId}-NONE`
    3. **Fetch the actual record** from DynamoDB using `GetItem`.
    4. Extract `record.organizationId` from the fetched record.
    5. **Perform membership check** (Step C): Query `OrganizationMembership` table with `organizationId` (from record) and `userId` (from JWT).
    6. If membership check passes, allow the operation. If not, deny.
*   **Why:** This ensures that even if a user guesses a valid ID for another organization, they cannot read or modify it. The record's actual `organizationId` is the source of truth, not any client-provided value.

#### Strategy 3: "Input Validation" (For `create`)
Creation is the only time the record doesn't exist yet. The user provides the `organizationId` they want to create the record in.
*   **Logic:**
    1. Extract `organizationId` from `event.variables.input.organizationId`.
    2. **Perform membership check** (Step C): Query `OrganizationMembership` table with `organizationId` (from input) and `userId` (from JWT).
    3. If membership check passes, allow the creation. If not, deny.
*   **Why:** This prevents users from creating records in organizations they don't belong to. The user must be a verified member of the target organization before they can create any resources within it.

---

## 4. Security Summary

| GraphQL Operation | Vulnerability Risk | Mitigation Strategy | Mechanism |
| ----------------- | ------------------ | ------------------- | --------- |
| **List (Query)** | Data Leak (Scanning) | **Strict Filter Check** | Reject queries that don't explicitly filter by `organizationId`. Extract org ID from filter, verify user membership. |
| **Get (Query)** | IDOR | **Fetch-Verify** | Fetch record from DB to get its `organizationId`, verify user is member of that org before allowing access. |
| **Update/Delete** | IDOR / Unauthorized Mutation | **Fetch-Verify** | Fetch record from DB to get its `organizationId`, verify user is member of that org before allowing mutation. |
| **Create** | Spoofing (Creating data in other Orgs) | **Input Validation** | Extract `organizationId` from input payload, verify user is member of that org before allowing creation. |

## 5. Data Model Requirements

To support this architecture, the following changes must be made to `amplify/data/resource.ts`:

*   **Mandatory Organization ID:** Every model in the schema must have an `organizationId` field.
*   **Required Field:** This field must be marked as **required** (`a.id().required()`) to prevent any records from being created without an owner organization.

## 6. Scope Note
This plan is strictly focused on the **backend implementation**. No UI changes or frontend refactoring are required or included in this scope.

## 7. Next Steps

### Implementation Checklist

1.  **Set up JWT Verification (Step A)**
    *   Install `aws-jwt-verify` library in the Lambda function dependencies
    *   Configure the JWT verifier with your Cognito User Pool ID and region
    *   Extract `authorizationToken` from the Lambda event object
    *   Verify the token and decode the payload to extract `payload.sub` (the user ID)
    *   Extract `apiId` from `event.requestContext.apiId` for dynamic table name calculation
    *   **Remember:** The JWT does NOT contain organization ID - that comes from the request

2.  **Add GraphQL Query Parsing (Step B)**
    *   Implement Regex parsing to extract the operation action (`get`, `list`, `create`, `update`, `delete`) and model name
    *   Handle both standard operations and custom index queries (e.g., `annotationsByAnnotationSetId`)
    *   **Critical:** This must happen BEFORE membership validation since we need to know where to extract the org ID from

3.  **Extract Organization ID (Step B continued)**
    *   Based on the parsed operation type, extract `organizationId` from the appropriate location:
        *   **`list` queries:** From `event.variables.filter.organizationId.eq`
        *   **`create` mutations:** From `event.variables.input.organizationId`
        *   **`get`/`update`/`delete` operations:** Fetch the record from DynamoDB first using the record ID, then extract `organizationId` from the fetched record
        *   **Unknown operations (not matching the above):** Assume it's a custom index query pattern. Attempt to extract from `event.variables.filter.organizationId.eq` using the same method as `list` queries. If extraction fails or the filter doesn't follow the strict pattern (only `organizationId.eq` at top level), **reject the request immediately**.

4.  **Implement Organization Membership Validation (Step C)**
    *   Create a DynamoDB client in the Lambda function
    *   Perform a DynamoDB query on the `OrganizationMembership` table:
        *   Use `organizationId` (extracted in Step 3) as the partition key
        *   Use `userId` from `payload.sub` (extracted in Step 1) as the sort key
    *   If no record is returned, immediately return an IAM "Deny" policy
    *   If a record exists, the user is a verified member - proceed with the request

5.  **Implement Security Strategies (Step D)**
    *   **Strict Filter Validation:** For `list` queries and custom index queries, validate that the filter contains ONLY `organizationId.eq` at the top level
    *   **Fetch and Verify:** For `get`, `update`, `delete` operations, the record fetch in Step 3 serves dual purpose - it provides the org ID AND confirms the record exists
    *   **Input Validation:** For `create` operations, the org ID from input is used directly for membership check in Step 4

6.  **Implement Dynamic Table Name Resolution**
    *   Extract `apiId` from `event.requestContext.apiId` at the start of the Lambda function
    *   Create a helper function: `getTableName(modelName: string, apiId: string) => ${modelName}-${apiId}-NONE`
    *   Use this function to calculate table names on-the-fly for:
        *   `OrganizationMembership` table (for membership checks)
        *   Any model table when fetching records in Strategy 2 (get/update/delete operations)
    *   No environment variables needed - table names are calculated dynamically

7.  **Configure Lambda Permissions**
    *   Grant the Lambda function necessary DynamoDB permissions for all tables:
        *   `dynamodb:GetItem` - For fetching individual records
        *   `dynamodb:Query` - For organization membership validation
    *   Use wildcard permissions or specify table ARN patterns to cover all Amplify-generated tables
