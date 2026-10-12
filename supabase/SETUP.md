# Supabase Schema Setup

## Scope and Limitations

The repository contains Supabase migrations and an owner dashboard configured to use the project's public publishable key. Local SQL files do not prove that migrations were applied to the remote project; the remote database was not inspected as part of this change. Confirm the actual migration state before relying on a module.

The default dashboard uses Supabase Auth and the authenticated browser client. Owner authorization and row access must continue to be enforced by RLS; a service-role key must never be placed in browser code. The `?preview=1` dashboard is still isolated, synthetic, and read-only.

The dashboard supports owner reads and writes for repair requests, services, notification read state, work notes, and business settings. Customer-directory and activity entries are read-only. The customer portal supports authenticated repair intake and private repair photos after migrations `001` through `003` are applied. Migration `004` exposes only approved public business contact fields to the public website. Anonymous repair intake and showcase media upload are not supported.

## Migration Order

1. In the Supabase Dashboard, select the correct project and confirm you have a restorable backup or a new/empty database.
2. Run the read-only preflight queries below in the SQL Editor. Inspect any names that overlap the baseline migration. Migration `001` intentionally uses ordinary `CREATE` statements without `DROP` or broad `IF NOT EXISTS`; a conflicting object should stop application for review.
3. Review `migrations/001_initial_schema.sql` and confirm the project is a supported Supabase PostgreSQL version with the Supabase-managed `auth` schema and `anon`, `authenticated`, and `service_role` roles.
4. In SQL Editor, paste and run the complete `001_initial_schema.sql` once. It uses an explicit transaction. If it fails, do not remove statements or rerun blindly; inspect the reported object/state, restore if appropriate, then prepare a reviewed follow-up migration.
5. Apply `migrations/002_owner_customer_directory.sql` and confirm its owner view along with the baseline tables, RLS, policies, and helper functions using the verification checklist below.
6. Apply `migrations/003_customer_repair_booking.sql` after confirming `001` and `002` are installed. It configures the private repair-photo bucket and scoped customer/owner policies; database table RLS alone does not authorize Storage objects.
7. Apply `migrations/004_public_business_profile.sql` after confirming `001` is installed. It creates only the allowlisted public profile view; it does not write to owner-protected settings.
8. Provision the owner only after Auth user creation using the actual Auth UUID and the trusted SQL-editor procedure below.

## Exact ordered manual checklist

1. Confirm the correct Supabase project.
   - Verify the project name, project URL, and environment before running any migration or Auth setup.
   - If the database is not empty or has an existing schema with overlapping names, stop and review the objects before continuing.

2. Run migration preflight only.
   - Execute the read-only checks in the SQL Editor listed below.
   - Confirm the `auth` schema exists, the `public` and `app_private` schemas are as expected, and there are no conflicting object names.

3. Apply migrations in dependency order.
   - Run `supabase/migrations/001_initial_schema.sql` first.
   - Only after that is confirmed, run `supabase/migrations/002_owner_customer_directory.sql`. The owner dashboard's Customers section depends on `public.owner_customer_directory`.
   - Only after `001` and `002` are confirmed, run `supabase/migrations/003_customer_repair_booking.sql`. It configures private `repair-attachments` Storage access and enforces the customer photo limits.
   - Run `supabase/migrations/004_public_business_profile.sql` after `001`. This enables public profile synchronization without granting access to or writing to the owner-only settings table.
   - Do not run the SQL in a different order or with destructive resets.

4. Create or invite the owner Auth account.
   - Use the dashboard user management screen and the business-approved owner email.
   - Complete the required email verification or MFA steps before provisioning owner access.

5. Verify the actual Auth UUID and corresponding profile.
   - Copy the exact UUID from the created Auth user record.
   - Confirm the related row exists in `public.profiles` for that same UUID.
   - If the profile row is missing, stop and resolve the issue before granting access.

6. Provision the owner role safely.
   - Use the trusted SQL Editor or admin-only context only.
   - Insert the exact verified UUID into `public.user_roles` for the `'owner'` role.
   - Do not use client-side JavaScript or public RPCs for role assignment.

7. Configure the browser client with the real project values.
   - Edit `admin/js/supabase-config.js` and set the actual `projectUrl` and `publishableKey`.
   - Keep the value in the browser only as the public, non-secret Supabase publishable key.
   - Do not embed a service-role key or any secret value in browser code.
   - If the project is not configured yet, leave the values empty and keep the admin UI in setup-required mode.

8. Validate customer and owner access paths.
    - Sign in as the provisioned owner and verify the dashboard loads only after authorization succeeds.
    - Test a customer-authenticated session and confirm it can only access its own records.
    - Confirm a non-owner customer cannot read admin-only data or internal notes.
    - Confirm the owner can read admin-only tables and manage the supported records through the dashboard. The dashboard does not currently use Realtime.
    - As a customer, submit a repair with up to five JPEG, PNG, WebP, or HEIC photos (at most 5 MiB each). Confirm the owner sees the booking and can view its photos in repair details.
    - Confirm an anonymous user cannot read the private repair bucket and a customer cannot read another customer's booking or photos.

### Read-only preflight queries

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema IN ('public', 'app_private')
ORDER BY table_schema, table_name;

SELECT n.nspname AS schema_name, t.typname AS type_name
FROM pg_type AS t
JOIN pg_namespace AS n ON n.oid = t.typnamespace
WHERE n.nspname IN ('public', 'app_private')
ORDER BY n.nspname, t.typname;

SELECT schema_name
FROM information_schema.schemata
WHERE schema_name = 'app_private';

SELECT namespace.nspname AS schema_name,
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = p.pronamespace
WHERE namespace.nspname = 'app_private'
ORDER BY p.proname;

SELECT event_object_schema, event_object_table, trigger_name
FROM information_schema.triggers
WHERE event_object_schema IN ('auth', 'public')
ORDER BY event_object_schema, event_object_table, trigger_name;

SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY schemaname, tablename;

SELECT id, name, public
FROM storage.buckets
ORDER BY id;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;
```

The workspace inspection found no existing SQL/configuration or `.git` directory, but that says nothing about the remote database. If any migration object name already exists remotely, stop and reconcile it explicitly. Do not use a destructive reset to resolve conflicts.

## Schema and Access Summary

`001_initial_schema.sql` creates `profiles`, `user_roles`, `repair_services`, `repair_requests`, `repair_status_history`, `repair_internal_notes`, `repair_attachments`, `repair_posts`, `post_media`, `post_reactions`, `comments`, `notifications`, `business_settings`, and `admin_activity_logs`. Every created public table has RLS enabled. It also creates safe public showcase views and owner-only showcase views. The `app_private` helper schema must not be added to the Supabase Data API exposed schemas.

The `admin` enum value is reserved for a future reviewed design; **the current `is_owner()` helper grants administrative policies only to a row whose role is `owner`**. Do not insert `admin` rows and assume they grant access. Role rows have no authenticated INSERT/UPDATE/DELETE grants or customer policies. There is no public role-grant RPC.

`service_role` is explicitly granted table/type privileges for trusted server operations and bypasses RLS. It is not a customer/owner browser role. Keep its key only in a trusted server/Edge Function secret store; never bundle it into HTML, JavaScript, public Vercel variables, or source control. This phase does not add a service-role caller.

Internal repair notes are in `repair_internal_notes`, not a column on customer-readable `repair_requests`. Status history contains only customer-visible messages; trusted triggers append it when a repair is created or its status changes. Customers may update their own submitted requests only while status is `submitted`; a trigger rejects customer changes to references, status, priority, assignment, timestamps, or staff-authored customer-visible notes. There is no request DELETE grant; use the cancelled status instead.

The profiles trigger creates a profile for new Auth users and backfills existing `auth.users` into the newly created profile table without overwriting conflicts. It does **not** assign roles. Profile email is a private snapshot created from Auth; email changes should be managed through Supabase Auth and synchronized deliberately in a future integration.

`business_settings` is a singleton (`id = 1`) containing `business_name`, `public_phone`, `public_email`, `public_address`, `business_hours`, `notification_preferences`, `updated_by`, and timestamps. It is owner-only. Migration `004_public_business_profile.sql` creates a public view restricted to the business name, public contact details, and business hours; it does not expose notification preferences or owner identifiers, and does not seed or modify settings. If the singleton row does not yet exist, save Business Profile once from the verified owner dashboard to create it. The website uses the allowlisted view to update its Contact section and branding. The service catalog's public `is_active` concept maps to `repair_services.status = 'active'`.

Public showcase clients should query `public_showcase_posts`, `public_showcase_media`, and `public_approved_comments`; these safe-column views omit author/profile IDs, moderator IDs, and private object paths. Owner dashboard reads should use `owner_showcase_posts`, `owner_showcase_media`, `owner_comments`, and `owner_repair_status_history`. Their view predicates check the provisioned owner role. Do not grant direct base-table SELECT to anonymous users; the migration revokes it and relies on these bounded views. Customer-authenticated direct comment and repair-history reads are column-limited; RLS still permits only published approved comments plus that customer's own comments/history.

## First Owner Provisioning

No email address, owner account, or user ID is assumed.

1. Create or invite the designated owner in Supabase Dashboard → Authentication → Users. Use the business-approved owner email and complete any required email confirmation/MFA setup.
2. Copy the exact UUID shown for that Auth user. Verify that the trigger-created profile exists:

```sql
SELECT id, email, display_name
FROM public.profiles
WHERE id = '<ACTUAL_AUTH_USER_UUID>'::uuid;
```

3. In the Supabase SQL Editor (a trusted administrative context), provision only that verified UUID. Replace the placeholder with the actual UUID; do not run this with an arbitrary signup/user ID:

`assigned_by` remains `NULL` for this SQL Editor action because the SQL Editor session is not an Auth user assignment event; do not falsely record the owner as their own assigner.

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<ACTUAL_AUTH_USER_UUID>'::uuid, 'owner'::public.app_role);
```

4. Verify the exact assignment from the SQL Editor:

```sql
SELECT user_id, role, assigned_at, assigned_by
FROM public.user_roles
WHERE user_id = '<ACTUAL_AUTH_USER_UUID>'::uuid;
```

Do not grant owner in user metadata, from client JavaScript, from a public RPC, or to the first person who signs up. SQL Editor/service-role access is privileged; protect it with project access controls and MFA. To revoke ownership, remove the exact trusted role row from an administrative context and verify that the account loses access.

## Storage Setup

Run `migrations/003_customer_repair_booking.sql` after preflight and after migrations `001` and `002`. It configures `repair-attachments` as a private bucket, accepts JPEG, PNG, WebP, and HEIC up to 5 MiB each, and installs policies for a customer to upload/read only photos attached to that customer's requests. A database trigger enforces five photos per customer repair request. The owner can read attachments through short-lived signed URLs in repair details. The migration deliberately does not grant object access to `anon`.

The migration updates the bucket's visibility, file size limit, and MIME allow-list if that bucket already exists. Before running it, review existing bucket contents/settings and `storage.objects` policies; the migration creates named policies and will stop on a naming conflict. Do not make the bucket public or add broad authenticated object access.

`showcase-media` remains private and is not configured for uploads. For public showcase display, a future trusted Edge Function/server endpoint must verify that the parent post is `published`, then issue a short-lived signed URL. Never expose a service-role key in the browser.

## Realtime Setup

The migration safely checks whether the `supabase_realtime` publication exists and whether each table is already a member before adding it. It requests publication for:

- `repair_requests`
- `repair_services`
- `notifications`
- `admin_activity_logs`

`profiles`, `repair_status_history`, `repair_internal_notes`, `repair_attachments`, `repair_posts`, `post_media`, `post_reactions`, `comments`, `user_roles`, and `business_settings` are intentionally not added. In particular, avoid mixed-private full-row logical events for published rows: use safe views/polling or a separately reviewed broadcast design for showcase updates. RLS remains mandatory for Realtime; publication membership does not grant data access. Verify private rows are filtered for each subscribed JWT. If the publication did not exist, enable Supabase Realtime and add only the selected tables after reviewing the publication state. Do not add private tables indiscriminately.

`business_settings` is also omitted: configuration can be reloaded on demand and does not need a live feed.

## RLS Allowed/Denied Review

Policies are permissive within a command, so owner and self-row policies OR together. Trigger guards and grants provide additional field-level controls where row-level policies alone cannot distinguish columns.

| Table / view                     | Anonymous visitor                                                                                                               | Customer A / B                                                                                                                                                                     | Provisioned owner                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                       | No access                                                                                                                       | Select/update own profile display name and phone only; cross-customer rows and email/status changes denied                                                                         | Select/update profiles. Role assignment remains unavailable through the client API.                                                                             |
| `user_roles`                     | No access                                                                                                                       | No access, including own role; insert/update/delete denied                                                                                                                         | Select roles only. Role changes require trusted SQL administration.                                                                                             |
| `repair_services`                | Select active services only                                                                                                     | Select active services only; writes denied                                                                                                                                         | Select all and insert/update/delete through authenticated owner session                                                                                         |
| `repair_requests`                | No access                                                                                                                       | Select own; insert own with server-forced initial state; revise own submitted/uninspected fields only; cross-customer access, status/priority/assignment edits, and deletes denied | Select/insert/update all. Delete is not granted; use cancelled status.                                                                                          |
| `repair_status_history`          | No access                                                                                                                       | Select only own request history and customer-facing columns; `changed_by` is hidden. Direct insert/update/delete denied.                                                           | Read all audit columns through `owner_repair_status_history`; rows are trigger-written and client append/update/delete is not granted.                          |
| `repair_internal_notes`          | No access                                                                                                                       | No access                                                                                                                                                                          | Select/insert/update/delete.                                                                                                                                    |
| `repair_attachments` metadata    | No access                                                                                                                       | Select/insert only for own requests; update/delete denied                                                                                                                          | Select/insert/update/delete. Storage objects need their separate policies.                                                                                      |
| `repair_posts` / showcase views  | Base table SELECT denied to anon; `public_showcase_posts` exposes safe published fields only                                    | Safe public view; owner-only `owner_showcase_posts` exposes full rows; base writes owner-only by RLS                                                                               | Read full rows through owner view; insert/update/delete base rows through owner policy/grants.                                                                  |
| `post_media` metadata / views    | Base table SELECT denied to anon; `public_showcase_media` omits bucket and object path                                          | Safe public view; owner-only `owner_showcase_media` exposes full rows; base writes owner-only by RLS                                                                               | Read full metadata through owner view; insert/update/delete base rows through owner policy/grants. File bytes remain private in Storage.                        |
| `post_reactions`                 | Table denied; aggregate view only                                                                                               | Select/insert/delete own reactions only while the related post is published; cross-user rows and updates denied                                                                    | Owner policy can select/insert/delete reactions regardless of post status; reaction rows are not updated.                                                       |
| `published_post_reaction_counts` | Select counts for published posts; no actor IDs                                                                                 | Same aggregate only                                                                                                                                                                | Same aggregate plus underlying table access under owner policy.                                                                                                 |
| `comments` / views               | Base table SELECT denied to anon; `public_approved_comments` exposes approved published comments without profile/moderation IDs | Read safe public comments and own limited columns; submit pending on published posts; edit own pending body only; moderation-state changes and cross-user access denied            | Read full rows through `owner_comments`; insert/update including moderation through owner policy/grants; direct deletes are not granted, use moderation states. |
| `notifications`                  | No access                                                                                                                       | Select own recipient notifications and update own `read_at` only; cross-recipient access and content edits denied                                                                  | Select/insert/update. Delete is not granted.                                                                                                                    |
| `business_settings`              | No access                                                                                                                       | No access                                                                                                                                                                          | Select/insert/update the singleton settings record. Delete is not granted.                                                                                      |
| `admin_activity_logs`            | No access                                                                                                                       | No access; direct insert/update/delete denied                                                                                                                                      | Select only; logs are trigger/backend-written and direct client mutations are denied.                                                                           |
| `app_private.is_owner()`         | Execute denied                                                                                                                  | Authenticated may execute the boolean helper; it reveals only whether their own Auth UUID has the trusted owner row                                                                | Same helper. The schema is not to be exposed through PostgREST.                                                                                                 |

The `admin` enum value does not receive owner access. The policy helper checks only `role = 'owner'`. Do not add an `admin`-role policy without separate approval and a security review.

## Security Verification Checklist

Perform these tests in a non-production project with two distinct customer Auth users (A and B), an anonymous session, and the manually provisioned owner. Use the Supabase client/Data API and Storage API, not only SQL Editor; SQL Editor typically bypasses RLS.

### Customer A

- [ ] Read and update A's profile display name/phone.
- [ ] Confirm A cannot select B's profile, change email/account status, insert a `user_roles` row, or call an owner-grant path.
- [ ] Insert a repair request with `customer_id = A`; verify status is `submitted`, priority is `normal`, the reference is generated, and an initial customer-visible history event exists.
- [ ] Confirm A cannot set another customer ID, reference, status, priority, assignee, timestamps, or customer-visible staff note during create/update.
- [ ] Update allowed fields on A's request while `submitted`; attempt the same after changing status to `inspecting` as owner and confirm the customer update is rejected.
- [ ] Confirm A cannot read B's request/history/attachment metadata or any internal note.
- [ ] Confirm A cannot insert status history, admin logs, notifications for another user, or moderation decisions.
- [ ] Confirm A can read own customer-visible status history but cannot select the `changed_by` actor column or another customer's history.
- [ ] Submit a comment on a published post; verify it is `pending`, then verify A cannot approve/reject it or change moderation metadata.
- [ ] Add/remove A's own reaction on a published post; confirm duplicate reaction constraints and cross-user attempts fail.
- [ ] After an owner unpublishes that post, confirm A can no longer select or delete the reaction through the customer policies; confirm the owner can still review/manage it through the owner policy.
- [ ] Read/update only A's notification `read_at` if one is provisioned.
- [ ] Upload/read an attachment only under A's own request path; test B's request UUID and forged path are denied by Storage policies.

### Customer B

- [ ] Repeat A's tests as B and verify B sees only B-owned profiles, repairs, status history, attachments, comments, reactions, and notifications.
- [ ] Specifically verify B cannot read or mutate A's records even if B knows their UUIDs/reference numbers or guesses object paths.

### Anonymous visitor

- [ ] Read active services; verify inactive/draft services are absent.
- [ ] Read published posts/media metadata and approved comments only; verify draft posts, unpublished media metadata, pending/rejected comments, customer contact data, requests, histories, and notifications are not readable.
- [ ] Verify public views omit post authors, comment profile/moderator IDs, and Storage bucket/object paths; direct base-table SELECT is denied.
- [ ] Read aggregate reactions only; direct `post_reactions` access is denied.
- [ ] Verify all inserts/updates/deletes on application tables are denied.
- [ ] Confirm both private Storage buckets reject anonymous object reads and uploads.

### Provisioned owner

- [ ] Confirm only the manually provisioned Auth UUID satisfies the owner helper and can access owner policies.
- [ ] Verify an owner status update creates exactly one history row and an activity log with the correct prior/new states and actor.
- [ ] Verify the owner can read the full history audit record through `owner_repair_status_history`; ordinary customers receive only customer-facing columns.
- [ ] Verify owners can review internal notes and private attachments; ensure those fields are absent from customer/status APIs.
- [ ] Verify service/post publication controls, moderation writes, notifications, and activity logs use expected policies.
- [ ] Verify the owner retains reaction select/delete access after a post is unpublished, while customers do not.
- [ ] Verify only the owner can read/update `business_settings`, and the authenticated client cannot delete the singleton row.
- [ ] Verify anonymous and authenticated users can read only the approved columns in `public_business_profile`, and cannot read `business_settings`.
- [ ] Confirm an account with an `admin` enum role but no `owner` role does not get owner access.
- [ ] Confirm customer uploads are private, per-request photo limits are enforced, and owner signed URLs work.

## Remaining Limitations

- No SQL was run and no remote project state was inspected in this workspace session. Review preflight output before applying the migration.
- The repair booking migration has not been run against the remote Supabase project from this workspace. Review preflight output and verify its policies in the target project before enabling live customer uploads.
- Migration `004_public_business_profile.sql` must be applied in the target Supabase project before public business profile synchronization can be verified there.
- No Edge Function for public signed showcase URLs exists. Published post media remains private until that trusted service is built.
- The public inquiry form is not connected; customer-created repair requests require a signed-in customer. Anonymous repair intake needs a separately reviewed rate-limited Edge Function, not an anon INSERT policy.
- Realtime membership does not create subscriptions or prove that a UI subscription is safe; test per-user event filtering.
- Only repair status transitions currently produce automatic activity-log rows. Future trusted service/post/comment/notification/settings handlers must append redacted audit events before those writes are enabled.
- A service-role database request without the signed-in user's JWT has no `auth.uid()` actor; future Edge Functions must preserve/record the verified owner actor explicitly when using privileged server operations.
- Showcase row-level events are deliberately excluded from Realtime because logical events can include private base-row columns; use safe public views and a reviewed event strategy if live showcase updates become necessary.
- Do not deploy an admin client that uses the service-role key. Use the authenticated user's JWT and the RLS policies above.
