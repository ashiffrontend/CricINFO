# Security Specification - Gully Cricket Scorer

## Data Invariants
1. A user document at `/users/{userId}` can only be created or modified by the authenticated user whose `request.auth.uid == userId` or by the super admin (`mohdashif.dev@gmail.com`).
2. Matches at `/matches/{matchId}` must belong to `request.auth.uid` upon creation, and can be read publicly (to enable live sharing) or updated/deleted only by their owner or an admin.
3. Teams and Players can be read by any authenticated user; creation/updates must be by their creator or admin.
4. Admin logs and login logs can only be viewed by administrators.

## The Dirty Dozen Payloads & Defenses
1. Spoofed User UID: Attacker tries writing to `/users/another-uid` -> Blocked by `request.auth.uid == userId`.
2. Missing required fields in match -> Blocked by schema validation.
3. Unauthenticated match deletion -> Blocked by auth check.
4. Regular user accessing `/admin_logs` -> Blocked by admin verification.
5. Setting arbitrary admin flag in user document -> Blocked by role immutability.
6. Overwrite another user's match score -> Blocked by `resource.data.userId == request.auth.uid`.
7. Non-admin deleting another user's account -> Blocked by admin check.
8. Unverified email write attempt -> Verified by `request.auth.token.email_verified == true`.
9. Document ID path injection -> Guarded by `isValidId(docId)`.
10. Massive payload Denial-of-Wallet attack -> Guarded by string `.size()` constraints.
11. Unauthenticated reading of login logs -> Blocked.
12. Status shortcut on completed matches without admin permission -> Blocked.
