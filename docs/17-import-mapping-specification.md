# Import & Mapping Specification

## 1. Purpose

Define a safe, repeatable pipeline for bringing Excel/CSV data into the governed FP&A financial model.

## 2. Import Lifecycle

`Select Input Type → Upload → File Validation → Schema Detection → Column Mapping → Data Validation → Preview → Import → Reconciliation → Publish`

An import is not considered authoritative until validation and publish succeed.

## 3. Input Types and Dataset Contracts

The import area must identify what the user is importing before accepting a file. Different datasets must never be treated as interchangeable merely because they arrive as Excel/CSV.

### 3.1 Actual journal transactions — MVP active path

Purpose: load historical/current actual financial movements that will ultimately become governed `Actuals`.

Minimum source fields:

- date or financial period
- journal/transaction reference
- description
- source account code
- source account name
- debit
- credit

Optional organization dimensions where configured:

- legal entity
- branch
- department
- cost center
- region
- product
- project

The import validator must ensure each journal is balanced before the import can proceed.

### 3.2 Trial balance — planned input path

Purpose: provide period-end account balances when detailed journal transactions are unavailable or intentionally not supplied.

Expected source fields:

- financial period/date
- account code
- account name
- debit balance and/or credit balance, according to the selected source convention
- currency when applicable

The system must explicitly identify that a trial balance import is an opening/period balance source and must not be processed through the journal-transaction contract.

### 3.3 Chart of accounts — planned input path

Purpose: establish or extend the organization's source account structure before financial mapping.

Expected source fields:

- account code
- account name
- account type/category
- statement classification where available
- parent account where available
- active/inactive status where available

This dataset maps source accounts to the governed FP&A account model and is not itself an Actuals import.

### 3.4 Master data and dimensions — planned input path

Purpose: load controlled dimension members used to segment actuals and planning data.

Supported dimension families include:

- legal entities
- branches
- departments
- cost centers
- regions
- products
- projects

Each dimension import must validate organization ownership and stable source identifiers before values become selectable in financial imports.

### 3.5 Budget / Forecast / Planning data — planned input path

Purpose: load planning values and assumptions without mixing them with actual financial facts.

The contract must identify at minimum:

- planning version/type
- financial period
- account or planning metric
- amount/value
- applicable dimensions
- source/reference where available

Budget, forecast, scenario assumptions, and actuals must remain distinguishable throughout the data model and user interface.

## 4. Supported MVP Inputs

- CSV
- XLSX

The MVP should support a documented canonical template and flexible column mapping for common source formats. The active MVP upload implementation currently uses the journal-transaction contract defined in section 3.1.

## 5. Required Financial Fields

A normalized financial transaction/fact import should be able to provide, directly or through mapping:

- date or financial period
- account/source category
- amount
- currency where required
- at least one stable source identity/reference where available

Dimensions such as branch, department, cost center, region, product, and project are optional according to the configured organization model.

## 6. File Validation

Before parsing business rows, validate:

- file type and extension
- file size limits
- workbook/sheet readability
- expected headers for the selected input type
- row count limits
- malformed values
- unsafe or unsupported content

Files must be stored separately from normalized financial facts.

## 7. Column Mapping

Mapping must support:

- source column → target field
- source account/category → governed account/category
- source dimension value → governed dimension value
- reusable mapping rules
- mapping versioning

A mapping version must be immutable after it has been used for a published import. Changes create a new mapping version.

## 8. Validation Rules

Validation should identify errors and warnings separately.

Examples of errors:

- missing required period/date
- invalid amount
- unknown account with no mapping
- invalid dimension reference
- invalid currency
- impossible period
- dataset-specific schema mismatch
- unbalanced journal where the selected input type is journal transactions

Examples of warnings:

- unmapped optional dimension
- unusual value
- missing non-required source field

Errors block publish. Warnings may be accepted by an authorized user and must remain visible in the import result.

## 9. Duplicate / Idempotency Strategy

The same source data must not create duplicate financial facts when an import is retried.

The implementation should use a deterministic import identity and, where available, source-row identity. The design must distinguish:

- same file uploaded again
- same source rows appearing in a different file
- legitimate repeated business transactions

The system must never deduplicate solely by amount/date/account because legitimate transactions may share those values.

## 10. Preview

Before import, users must see:

- selected input type
- row count
- mapped/unmapped fields
- validation errors
- warnings
- sample normalized rows
- expected financial totals where calculable

## 11. Import and Transaction Boundary

Import processing must be atomic at the publish stage for a logical import. A failed publish must not leave a partially published financial dataset.

Large files may be processed asynchronously, but the final publish operation must have a clear success/failure state.

## 12. Reconciliation Summary

After normalization/import, display at minimum:

- source row count
- accepted rows
- rejected rows
- total source amount where meaningful
- total normalized amount
- difference/reconciliation status
- warnings and errors

Material differences must prevent publish unless explicitly overridden by an authorized user with an audit record.

## 13. Rollback

Published imports must be reversible through a controlled operation that identifies the affected import and facts. Ordinary users must not delete individual published facts without governance controls.

The MVP rollback operation is `public.rollback_actuals_import(p_import_id uuid, p_reason text)`. It requires an authenticated user with the organization `reject` permission and accepts only imports currently in `published` status. The operation locks the import and its published batch, removes only authoritative `actual` facts whose `source_import_id` matches the selected import and organization, marks the publish batch as `rejected`, changes the import status to `rolled_back`, and records an audit event containing the rollback reason and deleted-fact count. Source import rows/evidence are preserved. The operation is transactional so a failure does not leave a partial rollback. The RPC is exposed only to the `authenticated` role and runs as `SECURITY DEFINER` with an empty `search_path`.

Rollback must create an audit event and preserve the original source evidence.

## 14. Mapping Hierarchy

Mapping should support the following precedence where applicable:

1. Exact source mapping rule.
2. Explicit organization mapping.
3. Controlled category mapping.
4. Unmapped state requiring user resolution.

The system must not silently guess a financially material account classification.

## 15. Import Status

Recommended statuses:

- uploaded
- validating
- mapping_required
- ready_for_review
- importing
- imported
- published
- failed
- rolled_back

## 16. Security

Uploaded files must be treated as untrusted input. The application should validate file types, enforce size limits, restrict executable content, scan where infrastructure supports it, and use secure object storage access.

## 17. Source Traceability

Every published normalized fact must retain enough metadata to answer:

- Which import created this fact?
- Which source row created it?
- Which mapping version was used?
- When was it published?
- Who published it?

## 18. MVP Boundary

MVP supports robust Excel/CSV ingestion and reusable basic mapping. Complex connector-specific transformations, scheduled integrations, and advanced ETL orchestration are deferred to later phases.
