# Application access

All signed-in people must be active Slack members of the configured workspace. The current `users.system_role` value determines access. Roles are read from the database per request, never trusted from a session or supplied by a profile update.

| Role     | Attendance and colleagues | Employee stats | Message review and AI costs | Change other people's roles |
| -------- | ------------------------- | -------------- | --------------------------- | --------------------------- |
| Admin    | Yes                       | Yes            | Yes                         | Yes                         |
| Manager  | Yes                       | Yes            | No                          | No                          |
| Employee | Yes                       | No             | No                          | No                          |

For example, changing an employee to manager adds the overview and individual statistics without exposing message review or role management. Changing a manager to admin adds all remaining features. Admins still edit their own attendance through the normal attendance controls; the role does not add an interface for impersonating colleagues.

## Managing roles

Open **More → Roles** (`/admin/roles`), search by name or email, and select **Admin**, **Manager**, or **Employee**. Only active mapped members of the configured workspace are listed or eligible for changes. Admins cannot change their own role, preventing accidental self-lockout. Another admin can change their role. Role changes serialize and recheck the acting admin inside the transaction, so simultaneous demotions cannot remove both acting admins.

The user table has row-level security with no public access policies. App requests use the privileged server database role, so direct Supabase Data API calls cannot change roles. The server protects both the role list and mutation, as well as each restricted page and data service. A removed permission takes effect on the next request. Restricted pages return not found. Unauthenticated users are sent to sign in.

Samuel Tobias Roland Uyet is the initial admin, matched by verified Slack team `T02HKL21R` and user `U05NP1NF3QB`. This identity initializes the role only at migration or first account linking/creation. Later sign-ins and directory syncs preserve the stored role, including a demotion. A name or email match alone cannot confer admin access.

The local sandbox uses Anna Attendee as its initial admin. New other sandbox profiles are employees. Seed operations preserve changes to existing roles.

## Migration

Apply `db/0048_application_roles.sql` before deploying this code. It replaces the old enum with `ADMIN`, `MANAGER`, `EMPLOYEE`, defaults new accounts to employee, assigns the verified initial identity admin, converts existing stats grants to manager, and makes all other accounts employees. Legacy `ADMIN` values do not confer admin access unless they match that verified identity. Legacy reviewer flags do not promote anyone.

The historical `employee_stats_access` table and `can_review_messages` column remain to avoid erasing the previous grant records, but no longer grant access. The old review-permission script has been removed. Organisation roles remain job-title metadata.

For a database with the Drizzle migration journal, use the normal migration runner against the intended database. For an existing unjournaled database, inspect its schema and apply only the missing migrations in a transaction, including `0047` before `0048` if the stats access table is absent. Do not replay the entire historical migration chain. Fresh disposable databases use the current schema through the existing setup scripts.

For an existing local sandbox, initialize Anna's role to `ADMIN` once after migrating. Do not run a recurring update that would undo later role changes.
