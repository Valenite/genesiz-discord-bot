# 🛡️ GENESIZ 2026 — Custom Discord Verification & Server Lock Bot

This custom Discord Bot enforces **100% mandatory website registration** before participants can access your Discord server channels.

---

## ⚡ How It Works

1. **Server Lockdown**:
   - New users who join your Discord server see **ONLY** a single `#verify-here` channel. All main channels, event categories, announcements, and voice nodes are hidden by default.

2. **Verification Gate**:
   - The user clicks **🔐 Verify Operative Code** button in `#verify-here` (or types `/verify <code>`).
   - A Discord popup modal asks for their website Operative Code (e.g., `GSZ-2026-A4F9`).

3. **Validation & Role Assignment**:
   - The bot checks the code in your database.
   - Upon verification:
     - Assigns the `@Participant` role (which unlocks all server channels!).
     - Automatically updates their Discord nickname on the server to `[Team Name] Username`.
     - Displays a confirmation embed showing their accredited events & squad name.

4. **Multi-Member Team Sync**:
   - When other squad members enter the same Operative Code (`GSZ-2026-A4F9`), they get verified, granted the `@Participant` role, and their nickname is updated with the same `[Team Name]` prefix!

---

## 🚀 Quick Setup Instructions

### Step 1: Discord Bot Token & Application Setup
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** -> Name it `GENESIZ Verification Bot`.
3. Go to **Bot** tab -> Click **Reset Token** -> Copy your Bot Token.
4. Enable Privileged Gateway Intents:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
5. Go to **OAuth2 -> URL Generator**:
   - Select scopes: `bot`, `applications.commands`
   - Select permissions: `Manage Roles`, `Manage Nicknames`, `Send Messages`, `Embed Links`, `Use Slash Commands`
   - Copy the generated URL and open it in your browser to invite the bot to your Discord server.

### Step 2: Configure Environment Variables
1. In `genesiz-discord-bot`, rename `.env.example` to `.env`.
2. Fill in your details:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_discord_bot_client_id
   GUILD_ID=your_discord_server_id
   PARTICIPANT_ROLE_NAME=Participant
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

### Step 3: Server Lockdown & Channel Permissions
In your Discord Server Settings:
1. Create a role named **`Participant`** (or matches `PARTICIPANT_ROLE_NAME`).
2. Move the **`GENESIZ Verification Bot`** role above the `Participant` role in **Server Settings -> Roles** (so it has permission to assign roles and change nicknames!).
3. Set `@everyone` Permissions:
   - Hide all channels from `@everyone` (View Channel = ❌ OFF).
   - Create a channel `#verify-here`:
     - `@everyone`: View Channel = ✅ ON, Send Messages = ❌ OFF (Read & Click button only).
4. Set `@Participant` Permissions:
   - Grant `@Participant` role access to all main channels (View Channel = ✅ ON).

### Step 4: Launch Bot & Deploy Verification Panel
1. Install dependencies:
   ```bash
   npm install
   ```
2. Deploy slash commands:
   ```bash
   npm run deploy-commands
   ```
3. Start the bot:
   ```bash
   npm start
   ```
4. In your `#verify-here` channel on Discord, type `/setup-verify` as an Admin.
5. The bot will post the interactive **🔐 Verify Operative Code** panel with the verification button!

---

## 🗄️ Supabase Table Setup (Free 2-minute setup)
Create a table in your Supabase project named `registrations` with SQL editor:
```sql
CREATE TABLE registrations (
  id TEXT PRIMARY KEY,
  leader_name TEXT,
  leader_email TEXT,
  team_password TEXT,
  team_name TEXT,
  institution TEXT,
  discord_tag TEXT,
  selected_events JSONB,
  selected_event_names JSONB,
  members JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `genesiz-web/.env` so the website automatically syncs every registration instantly!
