import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events
} from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

// Minimal HTTP server for Render / Cloud hosting ($0/month)
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('🤖 GENESIZ 2026 Verification Bot is active and optimized for high concurrency!');
}).listen(port, () => {
  console.log(`🌐 Web Service HTTP listener running on port ${port}`);
});

const EVENT_ROLE_MAP = {
  'valorant': 'valorant',
  'bedwarz': 'minecraft',
  'minecraft': 'minecraft',
  'webx': 'web developer',
  'web': 'web developer',
  'web-dev': 'web developer',
  'appforge': 'app developer',
  'app': 'app developer',
  'app-dev': 'app developer',
  'brainbyte': 'quiz',
  'quiz': 'quiz',
  'algoarena': 'programming',
  'programming': 'programming',
  'coding': 'programming',
  'surprise': 'surprise',
  'cipherquest': 'cryptic hunt',
  'cryptic': 'cryptic hunt'
};

const ALL_EVENT_ROLES = [
  'valorant',
  'minecraft',
  'web developer',
  'app developer',
  'quiz',
  'programming',
  'surprise',
  'cryptic hunt'
];

// Initialize Discord Client with minimal required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// Initialize Supabase Client
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// In-Memory Registration TTL Cache (60 second TTL to prevent Supabase database spam)
const regCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

// In-Memory Role Cache (name.toLowerCase() -> Role)
const roleCache = new Map();

// Fallback JSON reader
function getRegistrationFromLocalJSON(code) {
  try {
    const jsonPath = path.resolve('../genesiz-web/public/registrations.json');
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return data.find(r => r.id.toLowerCase() === code.toLowerCase());
    }
  } catch (err) {
    console.error('Local JSON check error:', err);
  }
  return null;
}

// Cached & High-Performance Supabase Registration Finder
async function findRegistration(codeClean) {
  const upperCode = codeClean.trim().toUpperCase();

  // Check TTL cache first
  const cached = regCache.get(upperCode);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  let result = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .ilike('id', upperCode)
        .maybeSingle();

      if (error) {
        console.error('Supabase lookup error:', error.message);
      }

      if (data) {
        result = {
          id: data.id,
          teamName: data.team_name || data.teamName,
          selectedEvents: data.selected_events || data.selectedEvents || [],
          selectedEventNames: data.selected_event_names || data.selectedEventNames || [],
          leaderName: data.leader_name || data.leaderName,
          leaderEmail: data.leader_email || data.leaderEmail
        };
      }
    } catch (err) {
      console.error('Supabase query exception:', err.message);
    }
  }

  if (!result) {
    const localRec = getRegistrationFromLocalJSON(upperCode);
    if (localRec) {
      result = {
        id: localRec.id,
        teamName: localRec.teamName,
        selectedEvents: localRec.selectedEvents || [],
        selectedEventNames: localRec.selectedEventNames || [],
        leaderName: localRec.leaderName,
        leaderEmail: localRec.leaderEmail
      };
    }
  }

  if (result) {
    regCache.set(upperCode, { data: result, timestamp: Date.now() });
  }

  return result;
}

// Pre-Cache Guild Roles on Bot Startup
async function ensureGuildRolesCached(guild) {
  try {
    const fetchedRoles = await guild.roles.fetch();
    fetchedRoles.forEach(role => {
      roleCache.set(role.name.trim().toLowerCase(), role);
    });

    const mainRoleName = (process.env.PARTICIPANT_ROLE_NAME || 'Participant').trim().toLowerCase();
    if (!roleCache.has(mainRoleName)) {
      try {
        const newRole = await guild.roles.create({
          name: process.env.PARTICIPANT_ROLE_NAME || 'Participant',
          color: 0x00F0FF,
          reason: 'GENESIZ Automatic Verification Role'
        });
        roleCache.set(mainRoleName, newRole);
      } catch (e) {
        console.error('Failed to create participant role:', e.message);
      }
    }

    for (const eventRoleName of ALL_EVENT_ROLES) {
      if (!roleCache.has(eventRoleName.toLowerCase())) {
        try {
          const newRole = await guild.roles.create({
            name: eventRoleName,
            color: 0x9900FF,
            reason: `GENESIZ Event Role for ${eventRoleName}`
          });
          roleCache.set(eventRoleName.toLowerCase(), newRole);
        } catch (e) {
          console.error(`Failed to create event role ${eventRoleName}:`, e.message);
        }
      }
    }
    console.log(`✅ Cached ${roleCache.size} guild roles for instant verification`);
  } catch (err) {
    console.error('Failed to pre-cache guild roles:', err.message);
  }
}

// Helper: Calculate Target Roles from Registration
function getTargetRoleNames(registration) {
  const targetRoleNames = new Set();
  const selectedEvents = registration.selectedEvents || [];
  const selectedEventNames = registration.selectedEventNames || [];

  selectedEvents.forEach(id => {
    const mapped = EVENT_ROLE_MAP[id.toLowerCase()];
    if (mapped) targetRoleNames.add(mapped);
  });

  selectedEventNames.forEach(name => {
    const nameLower = name.toLowerCase();
    for (const [key, mapped] of Object.entries(EVENT_ROLE_MAP)) {
      if (nameLower.includes(key)) {
        targetRoleNames.add(mapped);
      }
    }
  });

  return targetRoleNames;
}

// In-Memory Mapping for Dynamic Background Syncing: User ID -> Operative Code
const userCodeMap = new Map();

// Optimized Bulk Role Syncing (1-2 API calls max per user instead of 10+)
async function syncMemberRoles(guild, member, registration) {
  const targetRoleNames = getTargetRoleNames(registration);
  const mainRoleName = (process.env.PARTICIPANT_ROLE_NAME || 'Participant').trim().toLowerCase();

  targetRoleNames.add(mainRoleName);

  const rolesToAdd = [];
  const rolesToRemove = [];
  const addedRoles = [];
  const removedRoles = [];

  for (const eventRoleName of ALL_EVENT_ROLES) {
    const roleKey = eventRoleName.toLowerCase();
    const roleObj = roleCache.get(roleKey) || guild.roles.cache.find(r => r.name.trim().toLowerCase() === roleKey);
    if (!roleObj) continue;

    const shouldHaveRole = targetRoleNames.has(roleKey);

    if (shouldHaveRole) {
      if (!member.roles.cache.has(roleObj.id)) {
        rolesToAdd.push(roleObj);
        addedRoles.push(eventRoleName);
      }
    } else {
      if (member.roles.cache.has(roleObj.id)) {
        rolesToRemove.push(roleObj);
        removedRoles.push(eventRoleName);
      }
    }
  }

  // Ensure Participant main role is assigned
  const participantRoleObj = roleCache.get(mainRoleName) || guild.roles.cache.find(r => r.name.trim().toLowerCase() === mainRoleName);
  if (participantRoleObj && !member.roles.cache.has(participantRoleObj.id) && !rolesToAdd.includes(participantRoleObj)) {
    rolesToAdd.push(participantRoleObj);
  }

  // BATCH ROLE ADDITIONS (Single Discord REST call)
  if (rolesToAdd.length > 0) {
    await member.roles.add(rolesToAdd).catch(err => console.error(`Error adding roles for ${member.user.tag}:`, err.message));
  }

  // BATCH ROLE REMOVALS (Single Discord REST call)
  if (rolesToRemove.length > 0) {
    await member.roles.remove(rolesToRemove).catch(err => console.error(`Error removing roles for ${member.user.tag}:`, err.message));
  }

  // Set/Update Nickname asynchronously without blocking role response
  const teamName = registration.teamName;
  const currentUsername = member.user.username;
  let newNickname = `[${teamName}] ${currentUsername}`;
  if (newNickname.length > 32) newNickname = newNickname.substring(0, 31);

  if (member.id !== guild.ownerId && member.nickname !== newNickname) {
    member.setNickname(newNickname).catch(() => {});
  }

  return { targetRoleNames: Array.from(targetRoleNames), addedRoles, removedRoles };
}

// High-Concurrency Interactive Verification Handler
async function handleVerification(interaction, rawCode) {
  const codeClean = rawCode.trim().toUpperCase();

  // Instant deferral within 100ms to guarantee Discord interaction never times out
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }

  const registration = await findRegistration(codeClean);

  if (!registration) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF4444)
      .setTitle('❌ Verification Failed')
      .setDescription(
        `No registration found matching operative code \`${codeClean}\`.\n\n` +
        `⚠️ **DONT HAVE AN OPERATIVE CODE YET?**\n` +
        `You must first register on the official **GENESIZ Website** to receive your code!\n\n` +
        `1️⃣ Register your squad or solo entry on the website.\n` +
        `2️⃣ Copy the Operative Code given at the end (e.g. \`GSZ-2026-A4F9\`).\n` +
        `3️⃣ Click **Verify Operative Code** button again and paste your code!`
      )
      .setFooter({ text: 'GENESIZ 2026 Verification System' });

    return interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
  }

  const guild = interaction.guild;
  const member = interaction.member;

  // Store user-code association for background auto-syncing
  userCodeMap.set(member.id, codeClean);

  // Execute Batch Role Sync
  const { targetRoleNames, addedRoles, removedRoles } = await syncMemberRoles(guild, member, registration);

  const mainRoleName = process.env.PARTICIPANT_ROLE_NAME || 'Participant';

  // Build Embed Response
  const successEmbed = new EmbedBuilder()
    .setColor(0x00FF88)
    .setTitle('✅ Operative Roles Synchronized!')
    .setDescription(`Welcome to **GENESIZ 2026**, Operative **${member.user.username}**!\nYour Discord roles are now 100% synced with your website registration.`)
    .addFields(
      { name: '🆔 Operative Code', value: `\`${registration.id}\``, inline: true },
      { name: '🛡️ Team Squad Name', value: `**${registration.teamName}**`, inline: true },
      { 
        name: '🎟️ Active Event Roles', 
        value: targetRoleNames.length > 0 ? targetRoleNames.map(r => `\`@${r}\``).join(', ') : `\`@${mainRoleName}\``, 
        inline: false 
      }
    )
    .setFooter({ text: 'GENESIZ 2026 • High-Capacity Verification Active' })
    .setTimestamp();

  if (addedRoles.length > 0) {
    successEmbed.addFields({ name: '➕ Roles Added', value: addedRoles.map(r => `\`+@${r}\``).join(', '), inline: true });
  }

  if (removedRoles.length > 0) {
    successEmbed.addFields({ name: '➖ Roles Removed', value: removedRoles.map(r => `\`-@${r}\``).join(', '), inline: true });
  }

  return interaction.editReply({ embeds: [successEmbed] }).catch(() => {});
}

// Optimized Background Task: Periodic Auto-Sync Every 10 Minutes with Concurrency Rate Limits
async function runBackgroundAutoSync() {
  if (!supabase) return;

  try {
    const guildId = process.env.GUILD_ID;
    if (!guildId) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    await ensureGuildRolesCached(guild);

    const entries = Array.from(userCodeMap.entries());
    for (const [userId, code] of entries) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) continue;

        const registration = await findRegistration(code);
        if (registration) {
          await syncMemberRoles(guild, member, registration);
        }
        // Small delay to prevent API bursts
        await new Promise(r => setTimeout(r, 250));
      } catch {
        // Ignore individual sync failures
      }
    }
  } catch (err) {
    console.error('Background sync error:', err.message);
  }
}

// Event: Ready
client.once(Events.ClientReady, async c => {
  console.log(`🤖 GENESIZ Verification Bot active as ${c.user.tag}`);
  console.log('⚡ High-Concurrency & Bulk Role Sync Engine Initialized!');

  const guildId = process.env.GUILD_ID;
  if (guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      await ensureGuildRolesCached(guild);
    }
  }

  // Run background auto-sync safely every 10 minutes
  setInterval(runBackgroundAutoSync, 10 * 60 * 1000);
});

// Event: Interaction Create
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'verify') {
        const code = interaction.options.getString('code');
        await handleVerification(interaction, code);
      } else if (interaction.commandName === 'setup-verify') {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('open_verify_modal')
            .setLabel('🔐 Verify / Sync Operative Roles')
            .setStyle(ButtonStyle.Success)
        );

        const panelEmbed = new EmbedBuilder()
          .setColor(0x00F0FF)
          .setTitle('🛡️ GENESIZ 2026 OPERATIVE VERIFICATION GATE')
          .setDescription(
            'Welcome to the official **GENESIZ 2026** Discord Cyber-Grid!\n\n' +
            '⚠️ **DONT HAVE AN OPERATIVE CODE YET?**\n' +
            'You **MUST** first register on the official website to unlock this Discord server!\n\n' +
            '📋 **HOW TO UNLOCK OR UPDATE YOUR ROLES:**\n' +
            '1️⃣ Go to the official **GENESIZ Website** (`genesizevent.xyz`).\n' +
            '2️⃣ Copy your unique **Operative Code** (e.g., `GSZ-2026-A4F9`).\n' +
            '3️⃣ Click the **"🔐 Verify / Sync Operative Roles"** button below and enter your code.\n\n' +
            '🔄 *If you change or add/remove categories on the website later, click this button again to automatically update your Discord roles!*'
          )
          .setFooter({ text: 'GENESIZ Security Grid • Register or update on genesizevent.xyz' });

        await interaction.reply({ embeds: [panelEmbed], components: [row] });
      }
    }

    else if (interaction.isButton()) {
      if (interaction.customId === 'open_verify_modal') {
        const modal = new ModalBuilder()
          .setCustomId('verify_modal_submit')
          .setTitle('GENESIZ Operative Verification');

        const codeInput = new TextInputBuilder()
          .setCustomId('operative_code_input')
          .setLabel('ENTER YOUR OPERATIVE CODE')
          .setPlaceholder('e.g. GSZ-2026-A4F9')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(6)
          .setMaxLength(20);

        const actionRow = new ActionRowBuilder().addComponents(codeInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
      }
    }

    else if (interaction.isModalSubmit()) {
      if (interaction.customId === 'verify_modal_submit') {
        const code = interaction.fields.getTextInputValue('operative_code_input');
        await handleVerification(interaction, code);
      }
    }

  } catch (err) {
    console.error('Interaction handling error:', err.message);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: '⚠️ An error occurred during verification. Please try again.' }).catch(() => {});
    } else {
      await interaction.reply({ content: '⚠️ An error occurred during verification.', ephemeral: true }).catch(() => {});
    }
  }
});

// Login
client.login(process.env.DISCORD_TOKEN);
