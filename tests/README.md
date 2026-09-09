# Tests

The application test suite lives here, with paths mirroring the code it tests:

```text
tests/
  src/
    features/   Feature tests, grouped by feature
    shared/     Shared helpers, data, and routing tests
  amplify/
    functions/  Backend function tests
    shared/     Backend helper tests
    storage/    Image upload tests
```

For example, `src/shared/api/pagination.ts` is covered by
`tests/src/shared/api/pagination.test.ts`. Import the implementation directly;
keep test fixtures and test-only helpers within the corresponding test folder.

Run `npm test` from the repository root. Both `*.test.ts` and `*.test.mjs` are
discovered recursively. TypeScript tests are included in `npm run typecheck`,
and lint checks cover the test directory.

The backend uses CommonJS, so backend tests use Node's `createRequire` with a
TypeScript module type to load its exports across the package boundary. Storage
`.mjs` tests import ES modules directly.

Container projects keep their tests in a dedicated `tests/` directory within
each project, alongside `src/` or `code/`. Run their suites from the repository root:

```sh
npm test --prefix containerImages/jollyResults
python -m unittest discover -s containerImages/stormflyDetector/tests
python -m unittest discover -s containerImages/owlDDetector/tests
```

The Python suites require their worker test dependencies to be installed locally.
