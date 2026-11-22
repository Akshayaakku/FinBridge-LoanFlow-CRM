# FinBridge CRM Security Specification

## 1. Core Data Invariants
1. Every document write requires an authenticated, email-verified user (`request.auth != null && request.auth.token.email_verified == true`).
2. Document IDs on single-document reads/writes must match `^[a-zA-Z0-9_-]{1,128}$`.
3. Staff users cannot escalate their own `role` to `admin` in `/users/{userId}` or modify `/employees`, `/banks`, `/loan_schemes`, or `/settings`.
4. Staff users may only read (`get`/`list`) leads, call logs, follow-ups, customer documents, document files, loan applications, and status history assigned to their own `uid` or `email`.
5. Staff users may only update allowed operational fields (`status`, `remarks`, `updatedAt`) on leads assigned to them, and cannot reassign leads (`assignedEmployeeId`, `assignedEmployeeEmail`, `assignedEmployeeUid`).
6. Document verification fields (`verifiedByUid`, `verifiedByName`, `verifiedAt`) and terminal loan statuses (`Approved`, `Rejected`, `Disbursed`, `Closed`) are controlled exclusively by Admin.
7. Server timestamps (`request.time`) are enforced on `createdAt` and `updatedAt` across all collections.
8. Every string field has strict `.size()` upper bounds, and all collections validate exact key sets via `hasAll` and `hasOnly` on creation and `affectedKeys().hasOnly(...)` on update.

## 2. Adversarial Test Payloads ("Dirty Dozen")
1. Unauthenticated read on `/leads/lead_001` -> `PERMISSION_DENIED`.
2. Unverified email (`email_verified: false`) attempting write to `/leads/lead_001` -> `PERMISSION_DENIED`.
3. Staff user attempting self-role escalation (`role: "admin"`) in `/users/{uid}` -> `PERMISSION_DENIED`.
4. Staff user reading a lead assigned to another employee -> `PERMISSION_DENIED`.
5. Staff user attempting shadow update (`isVerified: true` or `assignedEmployeeEmail`) on an assigned lead -> `PERMISSION_DENIED`.
6. Staff user attempting to create or edit `/employees/emp_001` -> `PERMISSION_DENIED`.
7. Staff user attempting to approve or reject a KYC document in `/customer_documents/doc_001` -> `PERMISSION_DENIED`.
8. Staff user attempting to mark a loan application as `Disbursed` in `/loan_applications/app_001` -> `PERMISSION_DENIED`.
9. Oversized document ID (`> 128` chars) on `/leads/{oversizedId}` -> `PERMISSION_DENIED`.
10. Oversized `remarks` payload (`> 2000` chars) on `/call_logs/call_001` -> `PERMISSION_DENIED`.
11. Client-forged `createdAt` timestamp not equal to `request.time` -> `PERMISSION_DENIED`.
12. Unfiltered `list` query on `/leads` by a Staff user without matching `assignedEmployeeEmail`/`assignedEmployeeUid` -> `PERMISSION_DENIED`.
