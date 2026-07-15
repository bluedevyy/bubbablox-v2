# BubbaBlox — Setup, Rendering & Security Guide

This is a hands-on guide to standing up the stack from scratch, understanding how
avatar rendering (R6 **and** R15) actually works, and locking the deployment down.

> The stack targets **Windows** (the RCC binaries are Windows-only). Linux is not
> supported for the RCC/render pieces. Everything else (Postgres, Node, Go, Python)
> is cross-platform.

---

## 1. Architecture at a glance

| Component | Tech | Default port | Purpose |
|-----------|------|--------------|---------|
| `Roblox/Roblox.Website` | .NET 6 | `80` | Main web server + API (the site) |
| `renderer` | Node/TS | `3040` (HTTP), `3189` (WS) | Drives RCC to render thumbnails/headshots |
| RCC (`RCCService*`) | Windows exe | dynamic | Roblox engine that actually renders/hosts games |
| `AssetValidationServiceV2` | Go | `4300` | Validates uploaded place/model files |
| `AssetValidationServiceV2/Images.py` | Python | `3030` | Detects audio smuggled inside image uploads |
| `AssetProxy` | Node | `26831` (example) | Optional: proxies asset downloads from other sites |
| PostgreSQL | — | `5432` | Database |
| Redis (`redis-server.exe`) | — | `6379` | Cache / locks / sessions |

**Render data-flow (important):**

```
Website (.NET)  ──▶  Roblox.Rendering.CommandHandler
   │
   ├── R6  ──▶  renderer (Node, WebSocket :3189) ──▶ RCC ──▶ thumbnail.lua / headshot.lua
   │
   └── R15 ──▶  starts RCC 2020 directly over SOAP ──▶ RCC internal Avatar_R15_Action.lua
                (thumbnail only; the R15 *headshot* is rendered through the R6 path)
```

There are **two independent render mechanisms**. R6 goes through the Node
`renderer`. R15 thumbnails bypass the Node renderer and talk SOAP straight to a
**RCC 2020** instance using its built-in thumbnailer. Both must be configured for a
user base that uses both avatar types.

---

## 2. Prerequisites

Install and add to `PATH`:

- **Node.js 18.16.1** (renderer + panels)
- **PostgreSQL** (13+)
- **.NET 6.0 SDK**
- **Go 1.20+**
- **Python 3.12** (check "Add Python to PATH"), then:
  ```
  pip install fastapi aiohttp pydub uvicorn python-magic python-magic-bin==0.4.14 python-multipart cryptography
  ```
- **FFMPEG** (on `PATH`)
- **Redis** (bundled `redis-server.exe`, or your own)

Server requirements: Windows 10/11 or Windows Server, a domain that is **exactly 10
characters** (e.g. `bbblox.org`), reachable over both HTTP and HTTPS.

---

## 3. Database

1. Open an admin Command Prompt.
2. `cd` to your PostgreSQL `bin` folder.
3. Load the schema:
   ```
   psql --username=postgres --dbname=postgres < <path>\api\sql\schema.sql
   ```
   (Create the database named in your connection string first if needed.)

---

## 4. Configuration

### 4.1 `appsettings.json` (website)

In `Roblox/Roblox.Website`, copy `appsettings.example.json` → `appsettings.json` and set:

- **`Postgres`** — your connection string (host/db/user/password).
- **`Redis`** — `127.0.0.1:6379`.
- **`BaseUrl`** — your domain (e.g. `https://bbblox.org`).
- **`Directories.*`** — replace every `C:\Users\Admin\...` placeholder with your real
  paths (use `CTRL+H` in your editor; **double backslashes** `\\`).
- **`Render.BaseUrl`** — `ws://localhost:3189` (must match the renderer WS port).
- **`Render.Authorization`**, **`GameServerAuthorization`**, **`BotAuthorization`** —
  strong random strings that **match** the renderer's `config.json`.
- **`RccAuthorization`** — matches the `AccessKey` registry value (§7) and the RCC config.
- **`AssetValidation.BaseUrl`** — `http://localhost:4300`.
- **`Webhook`** / **`SignupWebhook`** — Discord webhooks (optional). `Webhook` is also
  injected into the game-server Lua for in-game logging.
- **`OwnerUserId`** — your admin account id.

### 4.2 `renderer/config.json`

Copy `renderer/config.example.json` → `renderer/config.json`:

```jsonc
{
  "rcc": "C:\\path\\to\\RCCService",          // folder containing the R6 RCC exe
  "rccexe": "RCCService.exe",
  "authorization": "<matches Render.Authorization in appsettings>",
  "baseUrl": "https://your.domain",
  "rccPort": 64989,
  "port": 3040,                                 // HTTP (upload callback)
  "websiteBotAuth": "<matches BotAuthorization>",
  "thumbnailWebsocketPort": 3189,               // WS the website connects to
  "webhook": "YourWebhook"
}
```

> `authorization` here **must equal** `Render.Authorization` in `appsettings.json`, or
> the website's WebSocket handshake is rejected and **no R6 renders happen**.

### 4.3 `AssetProxy/.env` (optional)

Copy `.env.example` → `.env`. Keep `useAuthorization=true` and set a strong
`AuthorizationKey`. Never expose this proxy publicly without auth.

### 4.4 Image validator webhook (optional)

`Images.py` reads its Discord webhook from the **`AUDIO_WEBHOOK_URL`** environment
variable (it is no longer hardcoded). Leave it unset to disable the notification —
validation still works. To enable:
```
set AUDIO_WEBHOOK_URL=https://discord.com/api/webhooks/....
```

---

## 5. Hex-patching the 10-char domain

The RCC/Client binaries hardcode a 10-character domain. With **HxD**:

1. Open `RCCService.exe` and your `Client.exe`.
2. `CTRL+R` → search for `bbblox.org` → replace with your **10-char** domain.
3. Update the domain in `AppSettings.xml` for both client and RCC.

---

## 6. RSA keys

1. `cd Roblox/Roblox.Website/RSA`
2. `python Generate.py` → produces `PrivateKey.pem` / `PublicKey2016.pub` and the 2020 pair.
3. **2016/2018 RCC:** in HxD search `BGIAA`, replace with your `PublicKey2016.pub` contents.
4. **2020 RCC:** search `MIIBI`, replace **every** instance with your 2020 public key.

---

## 7. Registry keys

Under `HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\ROBLOX Corporation\Roblox`:

- String **`AccessKey`** = your `RccAuthorization`.
- String **`SettingsKey`** = any custom string.
- Rename the JSON in `Roblox/Roblox.Libraries/Json` to `RCCService[YourSettingsKey].json`.

---

## 8. Launch

From the repo root: `runall.bat`. It starts the front-end, RCC, renderer, asset
validation, the website, and redis. Then:

1. Visit `http://localhost` and register (the first account becomes user id **1**,
   the owner — matching `OwnerUserId` in `appsettings.json`).

> **System accounts are now created automatically.** On every startup the website
> ensures the built-in accounts exist:
> - **ID 2500** → `UGC`
> - **ID 12** → `BadDecisions`
>
> Both are created with a nullified (empty) password, so nobody can log into them.
> The seeding is idempotent — existing accounts are left untouched, so upgrading a
> server that already has these accounts is safe. To add more system accounts, edit
> `UsersService.SystemUsers` in `Roblox/Roblox.Services/Users/Users.cs`. You no longer
> need to create them by hand in `/admin`.

---

## 9. Rendering: making R6 and R15 both work

### How avatar type is chosen
The website reads the user's stored avatar type (`user_avatar_type.r15`) and branches:

- **R6** → `RedrawAvatar` → Node renderer → `thumbnail.lua` / `headshot.lua`.
- **R15** → `RedrawAvatarR15` → `RequestPlayerThumbnailR15` (RCC 2020 SOAP,
  `Avatar_R15_Action`) for the thumbnail; the headshot uses the R6 Node path.

A user's type is stored via `UpdateAvatarType(userId, 2)` (`2 = R15`, `1 = R6`).

### Checklist for R6 to work
- `renderer` is running and its `authorization` matches `appsettings.Render.Authorization`.
- `renderer/config.json → rcc` points at the folder with your R6 `RCCService.exe`.
- The website log shows `express listening on port 3040` and a WS connection, not
  `bad auth`.
- **Verify:** register a user, open **My/Avatar**, change a hat/color. A
  `<hash>_thumbnail.png` and `<hash>_headshot.png` should appear in your
  `Directories.Thumbnails` folder.

### Checklist for R15 to work
- **RCC 2020** is installed and `Directories.RccService2020Path` points at the folder
  containing its `RCCService.exe` (R15 uses `Roblox.Configuration.RccService2020Path`,
  **not** the renderer's `rcc`).
- The 2020 RCC has the internal thumbnail scripts (it ships
  `internalscripts/thumbnails/Avatar_R15_Action.lua`).
- `/v1.1/avatar-fetch?placeId=0&userId=<id>` returns valid character-appearance JSON
  for the user (open it in a browser while logged in).
- Switch a test account to R15 (avatar-type toggle in the site, or set
  `user_avatar_type.r15 = true`), then redraw the avatar.
- **Verify:** the same two PNG files are produced. If the render fails, the website
  console now prints the **real** error (`R15 background render failed: <message>`);
  previously this line was mis-formatted and printed `0` with no detail, which made
  R15 look silently broken.

### Common R15/R6 pitfalls
- **R15 renders nothing, no error:** you were almost certainly hitting the logging bug
  fixed here — re-check the console for the actual message now.
- **`RCC 2020 path not configured`:** set `Directories.RccService2020Path`.
- **Thumbnail is R6 for an R15 user:** expected for the **headshot** (by design); the
  full-body **thumbnail** should be R15.
- **Everything times out:** the render timeout is 30 s; check RCC actually started and
  that ports aren't blocked by a firewall.

---

## 10. Security hardening (do this before going live)

**Rotate the leaked secrets (already removed from source, but they were committed):**
- The Discord webhook in `Images.py` and the one in `Games/internalscripts/GameServer.lua`
  were hardcoded and are now in git history. **Delete/regenerate both webhooks in Discord.**
- Rotate any `.ROBLOSECURITY` cookie you ever placed in `AssetProxy`.

**Secrets & config:**
- Use long, random values for `Render.Authorization`, `GameServerAuthorization`,
  `BotAuthorization`, `RccAuthorization`, `IPSalt`, `Jwt.Sessions`, and `DiscordKey`.
- Never commit `appsettings.json`, `renderer/config.json`, or `.env` (all gitignored).

**Network exposure:**
- Bind internal services to **localhost** and firewall them off from the internet:
  renderer (`3040`/`3189`), asset validation (`4300`), `Images.py` (`3030`), Redis
  (`6379`), Postgres (`5432`). Only the website (`80`/`443`) should be public.
- `Images.py` binds `0.0.0.0:3030` — put it behind the firewall or change the bind.
- Redis has no auth by default — keep it loopback-only or set `requirepass`.

**Application:**
- The renderer's `/api/public-method` is an authenticated reflective RPC. It is now
  guarded against `constructor`/`__proto__`/`Object.prototype` access, but still keep
  the `renderer` port private.
- The `AssetProxy` now rejects non-numeric asset ids (path-traversal fix); keep
  `useAuthorization=true`.
- Admin "reset password" sets the target account's password to **`changeme`**. Tell the
  user and force a change on next login; don't leave accounts on the default.
- Serve the site over HTTPS and set a real `CorsMiddlewareUrl` (your site link, no
  scheme, no trailing slash).

---

## 11. Ports reference

| Service | Port | Expose publicly? |
|---------|------|------------------|
| Website | 80 / 443 | ✅ yes |
| Renderer HTTP | 3040 | ❌ no |
| Renderer WS | 3189 | ❌ no |
| Asset validation (Go) | 4300 | ❌ no |
| Image validator (Python) | 3030 | ❌ no |
| AssetProxy | 26831 | ❌ (only if needed, with auth) |
| Redis | 6379 | ❌ no |
| Postgres | 5432 | ❌ no |
