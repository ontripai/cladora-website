# CLADORA Dynamic Workspace Composition v1.0

**Status:** Architecture contract  
**Date:** 2026-09-15  
**Scope:** Documentation only

## Objective

Allow CLADORA to configure a villa, condominium, developer portfolio, mall, warehouse, township or industrial estate from the same secure platform primitives. Scope, objects, modules and entitlements are dynamic; authorization remains deterministic and fail closed.

## Canonical object model

| Object | Purpose | Examples |
| --- | --- | --- |
| `ObjectTypeDefinition` | versioned schema and hierarchy rules | building, zone, apartment, shop, warehouse bay, amenity |
| `WorkspaceObject` | tenant-bound instance in the property graph | Block A, Shop 12, Gym, Loading Dock 3 |
| `ModuleDefinition` | platform-owned capability package | accounting, maintenance, access, amenities |
| `WorkspaceModule` | module activation and configuration | maintenance enabled for Site A |
| `EntitlementDefinition` | platform-owned commercial/technical right | module enabled, maximum sites, booking feature |
| `WorkspaceEntitlement` | effective workspace allowance or limit | amenities enabled until contract end |
| `PermissionDefinition` | immutable platform capability code | `maintenance.assign`, `amenity.manage` |
| `WorkspaceRole` | workspace-local permission bundle | Mall Operations Supervisor |
| `RolePermissionGrant` | constrained permission and conditions | manage maintenance in Zone West |
| `PrincipalAssignment` | user/group to role and scope | user X as supervisor for Zone West |
| `ApprovalPolicy` | high-risk control | AAL2 plus independent reviewer |

Platform definitions and workspace instances are deliberately separated. Workspace managers compose from approved definitions; they do not create executable code, SQL schemas or unrestricted permission identifiers.

## Dynamic creation flow

1. Select a property profile or start from the minimal workspace template.
2. Create registered workspace objects and parent-child relationships.
3. Enable modules permitted by the workspace contract.
4. Resolve module dependencies and reject incompatible combinations.
5. Materialize effective entitlements and limits.
6. Create or adapt workspace-local roles from allowed permissions.
7. Assign users/groups to roles at tenant, site, building, zone, space or object scope.
8. Activate only after validation, required approvals and audit evidence.

Every step supports draft, validation, activation, suspension and archival. Activation is idempotent and transactional.

## Administrator authority

An authorized workspace administrator may:

- create and organize registered object instances;
- configure enabled modules within contract entitlements;
- create local role names and descriptions;
- select delegable permissions available to that workspace;
- restrict grants by scope, time, condition or object relationship;
- assign, suspend and revoke user/group roles;
- inspect effective access and its explanation.

An authorized workspace administrator may not:

- create new platform permission codes;
- enable an unlicensed or prohibited module;
- grant access outside the administrator's delegable scope;
- bypass AAL2 or independent approval;
- convert lifestyle membership into property or security authority;
- alter immutable audit evidence;
- assign platform-internal roles;
- weaken tenant isolation or data-retention controls.

## Effective-access calculation

Access is granted only when all mandatory factors pass:

| Factor | Required evidence |
| --- | --- |
| Principal | authenticated active user/service identity |
| Workspace | active tenant-bound workspace |
| Module | active, compatible workspace module |
| Entitlement | valid allowance and unused/acceptable limit |
| Role | active workspace role containing the permission |
| Assignment | active user/group assignment |
| Scope | requested object is within assigned context |
| Relationship | ownership, occupancy, employment or mandate when required |
| Assurance | required AAL/MFA satisfied |
| Approval | independent approval present for controlled commands |

The effective result is deny unless every required factor is proven. The API returns a bounded explanation code so administrators can understand a denial without exposing sensitive policy internals.

## Module contract

Every module definition declares:

- supported property profiles and object types;
- required dependencies;
- incompatible modules or configurations;
- capability and permission codes;
- entitlement keys and quantitative limits;
- configuration JSON schema and version;
- lifecycle and data-retention rules;
- required assurance and approval policies;
- RO/EN/FA vocabulary keys;
- audit event contract;
- migration and rollback/forward-repair policy.

## Role model

CLADORA uses constrained RBAC plus contextual attributes:

- RBAC provides reusable role bundles.
- Object scope limits where the role applies.
- Relationship and conditions limit when/how it applies.
- Entitlements limit what the workspace may activate.
- AAL2 and approval policy protect high-risk commands.

Default templates may include Association Administrator, Property Manager, Owner, Resident, Facility Manager, Retail Operator, Warehouse Operator, Security Officer and Auditor. Workspace administrators can rename or create local roles, but effective permissions always map to immutable platform capability codes.

## Dynamic UI

Navigation, dashboard cards, forms and vocabulary are generated from the effective module and permission projection returned by the trusted server. The UI may hide unavailable capabilities for clarity, but server/database enforcement remains authoritative.

Examples:

- `unit` displays as apartment for residential, shop for retail, suite for office or bay for logistics;
- a villa workspace may omit governance and shared billing;
- a mall may enable retail operators, loading access and commercial allocation;
- a developer portfolio may enable cross-workspace benefit administration without cross-tenant record access.

## Required acceptance tests

- workspace admin creates a permitted local role and assigns it within scope;
- an assignment works only for its active time and object scope;
- unentitled modules and permissions are rejected with zero partial writes;
- administrator cannot grant more authority than they can delegate;
- platform-reserved permissions cannot be added to local roles;
- cross-tenant object IDs fail closed;
- module dependency and incompatibility checks are deterministic;
- entitlement expiry immediately removes effective capability;
- AAL1 cannot perform AAL2-required administration;
- concurrent activation or assignment produces one idempotent result;
- every accepted/rejected high-risk configuration change emits bounded audit evidence;
- RO/EN/FA render the same effective capability without client-side authorization drift.

## Implementation boundary

This contract does not authorize a migration, remote apply, customer data change or production activation. The first implementation package is `CLADORA-WORKSPACE-TAXONOMY-001`, followed by a separately approved dynamic-composition package with the next canonical migration and test numbers.

