# Security Specification: Vanguard-Shield Core Admin Firewall

This document defines the security boundaries, data invariants, and adversarial "Dirty Dozen" payloads used to audit the Firestore ruleset under a Zero-Trust, Attribute-Based Access Control (ABAC) architecture.

## 1. Data Invariants

1. **Access Codes**: Unique, maximum-use authorization tokens. Once an access code's current uses reach `maxUses` (if not null) or its `expiresAt` timestamp has elapsed into the past, it must cannot be utilized for active browser verification.
2. **Team Accounts**: Every `WebTeamAccount` corresponds to specific authorized entities. No self-appointed upgrades to roles (`role: "ADMIN"`) or rights are permissible.
3. **Blacklisted Servers**: All `BlacklistedServer` records represent forbidden guild scopes. Bots scan and enforce separation under a real-time event-driven loop.
4. **Active Threats**: Every `ActiveThreat` record represents a critical, ongoing security incident. Once manually acknowledged and signed off by an administrator, the threat state must be securely scrubbed or set to resolved, preventing any stale or replay warning alarms in the notification hub.
5. **System Audits**: All `liveLogs` must have `timestamp = request.time` and are strictly append-only.

---

## 2. The "Dirty Dozen" Adversarial Payloads

Below are twelve payloads structured to violate the rules of Identity, Integrity, State, and Memory limits. All must return `PERMISSION_DENIED` under the rules.

### Target: `/accessCodes`
1. **The ID Poisoning Attack**: Creation of a code using a non-alphanumeric, giant 2KB ID.
   ```json
   { "id": "!!!$$$___VERY_LONG_ID_OR_INJECTION_HEX_0x41414141...", "code": "ROB-1337-2026", "uses": 0, "createdAt": "2026-05-23T15:20:00Z" }
   ```
2. **The Temporal Fraud Attack**: Self-asserted creation of a code with a past/future `createdAt` date mismatching the server time.
   ```json
   { "id": "bl_123", "code": "TEMP-EXP", "uses": 0, "createdAt": "1999-01-01T00:00:00Z" }
   ```
3. **The Shadow Key Attack**: Inserting unrequested database schema markers (`"ghostField": true`).
   ```json
   { "id": "auth_99", "code": "SNEAKY-CODE-2026", "uses": 0, "createdAt": "request.time", "ghostField": true }
   ```

### Target: `/webTeamAccounts`
4. **The Privilege Escalation Attack**: Attempt by a Supporter to modify their own permission flags array to full access.
   ```json
   { "username": "Supporter01", "role": "ADMIN", "permissions": ["FLAG_FULL_ACCESS"], "createdAt": "2026-05-23T15:20:00Z" }
   ```
5. **The Unauthenticated Account Creation**: An unauthenticated guest attempting to insert a new root-level team user.
   ```json
   { "username": "GuestAttacker", "role": "ADMIN", "permissions": ["FLAG_FULL_ACCESS"], "createdAt": "request.time" }
   ```

### Target: `/serverLayouts`
6. **The Denial-of-Wallet Bloat Attack**: Flooding categories or role permission keys with long payloads.
   ```json
   { "id": "1234567890", "name": "A".repeat(10000), "categories": [], "roles": [] }
   ```

### Target: `/blacklistedServers`
7. **The Arbitrary Whitelist Overthrow**: Removing a server ID from the blacklist by an unauthorized user.
   ```json
   // Unauthorized DELETE or update attempt to "/blacklistedServers/123456789012345678"
   ```

### Target: `/activeThreats`
8. **The Threat Spoof Wrecker**: Creating or triggering spoofed active threat alerts to create false remediation events.
   ```json
   { "id": "th_fake", "serverId": "9999999999", "serverName": "Core Node", "type": "CHANNEL_DELETIONS_EXCEEDED", "severity": "CRITICAL", "attacker": "none", "description": "Fake warning", "actionsTaken": [], "timestamp": "request.time", "active": true }
   ```
9. **The State Lock Bypass**: Modifying actions taken or severity of an active threat by anonymous accounts.
   ```json
   // Patch update to existing threat altering severity to safe or tampering logs.
   ```

### Target: `/liveLogs`
10. **The Log Sabotage Attempt**: Overwriting historical audit records or deleting system logs to erase compromise signatures.
    ```json
    // Delete of critical info log document ID "l1"
    ```
11. **The Log Tampering Injection**: Modifying the bot source or severity levels of established logs.
    ```json
    { "id": "l1", "timestamp": "2026-05-23T15:00:00Z", "bot": "SYSTEM", "level": "INFO", "message": "Attacker was never here" }
    ```

### Target: `/configs`
12. **The Config Deconstruction**: Disrupting NightShark Anti-Nuke configurations to bypass automated protective demotion hooks.
    ```json
    { "welcome": {}, "tickets": {}, "automod": {}, "antinuke": { "enabled": false }, "economy": {}, "autoMessages": [] }
    ```

---

## 3. Threat Matrix & Access Verification Rules

| Collection | Create Rule | Read Rule | Update Rule | Delete Rule |
| :--- | :--- | :--- | :--- | :--- |
| `/accessCodes` | Admin Only | Signed-In | Admin Only | Admin Only |
| `/webTeamAccounts`| Admin Only | Signed-In | Admin Only | Admin Only |
| `/configs` | Admin Only | Signed-In | Admin Only | Admin Only |
| `/serverLayouts` | Signed-In | Signed-In | Signed-In | Admin Only |
| `/liveLogs` | Signed-In | Signed-In | Forbidden | Forbidden |
| `/blacklistedServers`| Admin Only | Signed-In | Admin Only | Admin Only |
| `/activeThreats` | Signed-In | Signed-In | Signed-In | Admin Only |

Admins are those authenticated users registered in `/databases/$(database)/documents/admins/$(request.auth.uid)`.
Because of local backend proxy interactions from our dashboard, the web application acts as a secure intermediary.
All rules will verify standard request properties such as:
- `request.auth != null`
- Document matching of `isValidId()` and structural helpers for type limits and server timestamps.
