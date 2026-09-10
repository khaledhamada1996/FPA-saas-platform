# Import & Mapping Specification

## 1. Purpose

Define a safe, repeatable pipeline for bringing Excel/CSV data into the governed FP&A financial model.

## 2. Import Lifecycle

`Upload → File Validation → Schema Detection → Column Mapping → Data Validation → Preview → Import → Reconciliation → Publish`

An import is not considered authoritative until validation and publish succeed.

## 3. Supported MVP Inputs

- CSV
- XLSX

The MVP should support a documented canonical template and flexible column mapping for common source formats.

## 4. Required Financial Fields

A normalized financial transaction/fact import should be able to provide, directly or through mapping:

- date or financial period
- account/source category
- amount
- currency where required
- at least one stable source identity/reference where available

Dimensions such as branch, department, cost center, region, product, and project are optional according to the configured organization model.

## 5. File Validation

Before parsing business rows, validate:

- file type and extension
- file size limits
- workbook/sheet readability
- expected headers
- row count limits
- malformed values
- unsafe or unsupported content

Files must be stored separately from normalized financial facts.

## 6. Column Mapping

Mapping must support:

- source column → target field
- source account/category → governed account/category
- source dimension value → governed dimension value
- reusable mapping rules
- mapping versioning

A mapping version must be immutable after it has been used for a published import. Changes create a new mapping version.

## 7. Validation Rules

Validation should identify errors and warnings separately.

Examples of errors:

- missing required period/date
- invalid amount
- unknown account with no mapping
- invalid dimension reference
- invalid currency
- impossible period

Examples of warnings:

- unmapped optional dimension
- unusual value
- missing non-required source field

Errors block publish. Warnings may be accepted by an authorized user and must remain visible in the import result.

## 8. Duplicate / Idempotency Strategy

The same source data must not create duplicate financial facts when an import is retried.

The implementation should use a deterministic import identity and, where available, source-row identity. The design must distinguish:

- same file uploaded again
- same source rows appearing in a different file
- legitimate repeated business transactions

The system must never deduplicate solely by amount/date/account because legitimate transactions may share those values.

## 9. Preview

Before import, users must see:

- row count
- mapped/unmapped fields
- validation errors
- warnings
- sample normalized rows
- expected financial totals where calculable

## 10. Import and Transaction Boundary

Import processing must be atomic at the publish stage for a logical import. A failed publish must not leave a partially published financial dataset.

Large files may be processed asynchronously, but the final publish operation must have a clear success/failure state.

## 11. Reconciliation Summary

After normalization/import, display at minimum:

- source row count
- accepted rows
- rejected rows
- total source amount where meaningful
- total normalized amount
- difference/reconciliation status
- warnings and errors

Material differences must prevent publish unless explicitly overridden by an authorized user with an audit record.

## 12. Rollback

Published imports must be reversible through a controlled operation that identifies the affected import and facts. Ordinary users must not delete individual published facts without governance controls.

Rollback must create an audit event and preserve the original source evidence.

## 13. Mapping Hierarchy

Mapping should support the following precedence where applicable:

1. Exact source mapping rule.
2. Explicit organization mapping.
3. Controlled category mapping.
4. Unmapped state requiring user resolution.

The system must not silently guess a financially material account classification.

## 14. Import Status

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

## 15. Security

Uploaded files must be treated as untrusted input. The application should validate file types, enforce size limits, restrict executable content, scan where infrastructure supports it, and use secure object storage access.

## 16. Source Traceability

Every published normalized fact must retain enough metadata to answer:

- Which import created this fact?
- Which source row created it?
- Which mapping version was used?
- When was it published?
- Who published it?

## 17. MVP Boundary

MVP supports robust Excel/CSV ingestion and reusable basic mapping. Complex connector-specific transformations, scheduled integrations, and advanced ETL orchestration are deferred to later phases.
