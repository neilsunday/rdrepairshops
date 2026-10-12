# Admin Data Contracts

This document describes the live owner dashboard and the Supabase records it consumes. `admin/js/preview-data.js` remains an explicitly synthetic fixture source for `?preview=1`; the default dashboard uses Supabase Auth, the owner-only RLS policies, and the production adapter in `admin/js/data-adapter.js`.

## Adapter Boundary

The UI consumes collections by stable module key and normalizes them to records shaped below. Both adapters return `{ mode, records, total, page, pageSize }`; the production adapter additionally reads overview metrics and business settings. Supported owner operations are repair request create/update, append-only internal notes, service create/update, notification read state, and settings save. Repair showcase posts and comments remain part of the database contract for public-site compatibility, but are no longer managed from the admin dashboard. Customer directory and activity log entries are read-only. Do not put service-role credentials in browser code. Every query and mutation must be authorized by Supabase Auth and RLS; client-side visibility is not authorization.

The dashboard deliberately has no direct customer deletion, role assignment, Storage upload, or anonymous public repair intake. Those require reviewed data-retention, authorization, and private Storage flows beyond this UI contract. Do not show a success state until the backend confirms the operation. UI states include loading, empty, error, filtered no-results, validation error, and operation success. Preview mode remains read-only.

## Relationships and Fields

### Profiles and roles

- `profiles`: `id` references `auth.users.id`; `display_name`, `email` (where needed), `phone`, `created_at`, `updated_at`, and `account_status`.
- `user_roles`: `user_id` references `auth.users.id`; `role`, `assigned_at`, `assigned_by`. Role assignment must be trusted/admin-only and customers must not edit it.
- A repair request may link `customer_id` to a profile. Public inquiries without an account may have a nullable profile reference and separately captured contact details.

### Repair requests

- `id`, human-readable `reference_number`, nullable `customer_id`, customer name/email/phone snapshot, `device_type`, `brand`, `model`, `reported_issue`, nullable `service_id`, `status`, `priority`, `submitted_at`, `updated_at`, nullable `assigned_technician_id`, `internal_notes`, `customer_visible_notes`.
- Status values: `submitted`, `inspecting`, `awaiting_approval`, `approved`, `in_progress`, `ready_for_pickup`, `completed`, `cancelled`.
- Priority values: `low`, `normal`, `high`, `urgent`.
- Keep customer-contact snapshots on a request so historical records remain understandable if a profile changes. Contact fields are private.

### Repair status history

- `id`, `repair_request_id` references repair request, `from_status`, `to_status`, `customer_message`, `internal_note`, `changed_by`, `created_at`.
- Customer-facing status history must never include internal notes. New status history records should be append-only and created with the trusted status update.

### Repair attachments

- `id`, `repair_request_id`, private storage `object_path`, `uploaded_by`, `content_type`, `byte_size`, optional `alt_text`, `created_at`.
- Repair attachments and object metadata are private to authorized owner/backend access; never treat a public bucket URL as access control.

### Customers

- `id` references `profiles.id` when an account exists; otherwise a separately managed inquiry/customer record can use nullable `profile_id`.
- `display_name`, private `email`/`phone`, `created_at`, `updated_at`, `account_status`, and derived repair count.
- Repairs relate by `customer_id`; customer profile and contact information must not be public. Define deletion/retention behavior before production.

### Services

- `id`, stable `slug`, `name`, `category`, `description`, `is_active`, `sort_order`, `created_at`, `updated_at`.
- The source catalog is the public Services section in the main website and includes 50 catalog entries. The source data contains service names, descriptions, and categories; it does not include price values, so the normalized SQL schema and the seed do not invent or store prices.
- Public landing page reads only active public fields. Owner-only writes. Repair requests may reference `service_id` while preserving a service-name snapshot if needed.

### Repair showcase posts and media

- `repair_posts`: `id`, `author_id`, `title`, `caption`, optional `service_id`, `status` (`draft`, `published`, `archived`), `published_at`, `created_at`, `updated_at`.
- `post_media`: `id`, `post_id`, private storage `object_path`, `sort_order`, `alt_text`, `created_at`.
- Public readers may see published posts and their published media only. Draft/archived posts and uploads remain private to the owner.

### Comments and moderation

- `comments`: `id`, `post_id`, nullable `profile_id`, public display name or moderated author details, `body`, `status` (`pending`, `approved`, `rejected`, `hidden`), `moderated_by`, `moderated_at`, `created_at`, `updated_at`.
- Public access may read approved comments on published posts. Public submissions require validation and abuse controls. Moderation changes are owner-only and should append activity records.

### Reactions

- `reactions`: `id`, `post_id`, nullable authenticated `profile_id` or privacy-reviewed anonymous token, reaction type, `created_at`.
- Define duplicate/rate-limit rules before enabling public reactions. Aggregate counts may be public; actor identifiers are not.

### Notifications

- `id`, `recipient_user_id`, `type`, `title`, `body`, optional related entity type/id, `read_at`, `created_at`.
- Notifications are private to the recipient. The initial owner UI lists owner notifications only.

### Administrative activity logs

- `id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, redacted `metadata`, `created_at`.
- Append through trusted operations, not arbitrary browser writes. Owner-readable; no client update/delete. Never include passwords, secrets, full attachment contents, or unnecessary personal data.

## Access Summary

- Public: active service display fields, published post fields/media, approved comments, and reviewed aggregate reaction counts.
- Private: customer profiles/contact details, repair requests/history, internal notes, repair attachments, pending/rejected comments, notifications, and admin logs.
- Owner-only: all admin module reads and writes, with RLS checks against the trusted owner role. Customers must never be able to assign themselves an admin role.
