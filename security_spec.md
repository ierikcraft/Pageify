# Security Spec - Pageify Studio

## 1. Data Invariants
- An Order cannot exist without a valid owner (`clientId`), which must match the authenticated `request.auth.uid`.
- Users cannot modify administrative fields like `progressStatus` or `paymentStatus` unless they are the admin (`erikripoll2012@gmail.com`).
- Once an order reaches `progressStatus == 'finalizado'` (terminal state), no further updates are allowed unless by an admin.
- Messages can only be added to an Order if:
  1. The user is authenticated.
  2. The user is the owner of the order (`clientId == auth.uid`) OR the user is the admin.
  3. The order `progressStatus` is NOT `finalizado` (since "the chat closes" on complete).
- Timestamp integrity: `createdAt` and `updatedAt` are secured via `request.time`.

## 2. The "Dirty Dozen" Malicious Payloads
1. **Identity Spoofing**: Client creates an order where `clientId` is `victim_123` instead of their own UID. (Should fail)
2. **State Shortcutting**: Client creates an order with `progressStatus = 'finalizado'` to skip payment/verification. (Should fail)
3. **Privilege Escalation**: Client updates their own order's `price` directly to `0`. (Should fail)
4. **Admin Impersonation**: Client marks their order as `paymentStatus = 'pagado'`. (Should fail)
5. **Locked State Mutation**: Client attempts to modify descriptions of an order that has `progressStatus = 'finalizado'`. (Should fail)
6. **Chat Hijacking (Unrelated Client)**: Client B attempts to send a message to Client A's order (`/orders/orderA/messages/msg1`). (Should fail)
7. **Chat Posting in Locked Order**: Client attempts to post a message to`/orders/orderA/messages/msg1` when `orders/orderA.progressStatus` is `'finalizado'`. (Should fail)
8. **Owner Mutation**: Client attempts to update order and change `clientId` to someone else. (Should fail)
9. **Resource Poisoning (Junk Order ID)**: Client creates an order with a massive string as ID (e.g., > 128 chars). (Should fail)
10. **Resource Poisoning (Huge Message)**: Client posts a chat message text of 1MB in size. (Should fail)
11. **Negative Price injection**: Client creates/updates an order with `price = -50`. (Should fail)
12. **Tampered Temporal Data**: Client provides a custom past timestamp for `createdAt` during creation instead of `request.time`. (Should fail)

## 3. The Test Runner Spec
(Verified theoretically and implemented as rules_version = '2')
All payloads return `PERMISSION_DENIED`.
