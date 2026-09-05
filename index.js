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
  ChannelType,
  PermissionFlagsBits,
  Events
} from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import http from 'http';

dotenv.config();

// Minimal HTTP server for Render Free Web Service ($0/month)
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('🤖 GENESIZ 2026 Verification Bot is active!');
}).listen(port, () => {
  console.log(`🌐 Free Web Service HTTP listener running on port ${port}`);
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

// Initialize Discord Client
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

// Helper: Query Registration Code
async function findRegistration(codeClean) {
  if (supabase) {
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .ilike('id', codeClean)
      .maybeSingle();

    if (error) {
      console.error('Supabase lookup error:', error);
    }

    if (data) {
      console.log(`[Verification Match] Code '${codeClean}' matched Team '${data.team_name || data.teamName}'`);
      return {
        id: data.id,
        teamName: data.team_name || data.teamName,
        selectedEvents: data.selected_events || data.selectedEvents || [],
        selectedEventNames: data.selected_event_names || data.selectedEventNames || [],
        leaderName: data.leader_name || data.leaderName,
        leaderEmail: data.leader_email || data.leaderEmail
      };
    }
  }

  // Fallback to local JSON
  const localRec = getRegistrationFromLocalJSON(codeClean);
  if (localRec) {
    console.log(`[Local JSON Match] Code '${codeClean}' matched Team '${localRec.teamName}'`);
    return {
      id: localRec.id,
      teamName: localRec.teamName,
      selectedEvents: localRec.selectedEvents || [],
      selectedEventNames: localRec.selectedEventNames || [],
      leaderName: localRec.leaderName,
      leaderEmail: localRec.leaderEmail
    };
  }

  console.warn(`[Verification Miss] No registration found for code '${codeClean}'`);
  return null;
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

// Sync Roles for a Specific Member based on their Registration Record
async function syncMemberRoles(guild, member, registration) {
  const targetRoleNames = getTargetRoleNames(registration);

  // 1. Assign Main Participant Role
  const mainRoleName = process.env.PARTICIPANT_ROLE_NAME || 'Participant';
  let participantRole = guild.roles.cache.find(r => r.name.trim().toLowerCase() === mainRoleName.trim().toLowerCase());

  if (!participantRole) {
    try {
      participantRole = await guild.roles.create({
        name: mainRoleName,
        color: 0x00F0FF,
        reason: 'GENESIZ Automatic Verification Role'
      });
    } catch (err) {
      console.error('Failed to create participant role:', err);
    }
  }

  if (participantRole && !member.roles.cache.has(participantRole.id)) {
    await member.roles.add(participantRole).catch(console.error);
  }

  const addedRoles = [];
  const removedRoles = [];

  // 2. Synchronize Event Roles: ADD required roles & REMOVE unselected roles
  for (const eventRoleName of ALL_EVENT_ROLES) {
    const shouldHaveRole = targetRoleNames.has(eventRoleName);
    let roleObj = guild.roles.cache.find(r => r.name.trim().toLowerCase() === eventRoleName.trim().toLowerCase());

    if (shouldHaveRole) {
      // Role SHOULD be assigned
      if (!roleObj) {
        try {
          roleObj = await guild.roles.create({
            name: eventRoleName,
            color: 0x9900FF,
            reason: `GENESIZ Event Role for ${eventRoleName}`
          });
        } catch (err) {
          console.error(`Failed to create role ${eventRoleName}:`, err);
        }
      }

      if (roleObj && !member.roles.cache.has(roleObj.id)) {
        await member.roles.add(roleObj).catch(console.error);
        addedRoles.push(eventRoleName);
      }
    } else {
      // Role SHOULD NOT be assigned -> REMOVE if user currently has it!
      if (roleObj && member.roles.cache.has(roleObj.id)) {
        await member.roles.remove(roleObj).catch(console.error);
        removedRoles.push(eventRoleName);
      }
    }
  }

  // 3. Set/Update Nickname
  const teamName = registration.teamName;
  const currentUsername = member.user.username;
  let newNickname = `[${teamName}] ${currentUsername}`;
  if (newNickname.length > 32) newNickname = newNickname.substring(0, 31);

  if (member.id !== guild.ownerId && member.nickname !== newNickname) {
    await member.setNickname(newNickname).catch(err => {
      console.warn(`Could not update nickname for ${member.user.tag}:`, err.message);
    });
  }

  return { targetRoleNames: Array.from(targetRoleNames), addedRoles, removedRoles };
}

// Interactive Verification Handler
async function handleVerification(interaction, rawCode) {
  const codeClean = rawCode.trim().toUpperCase();

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
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

    return interaction.editReply({ embeds: [errorEmbed] });
  }

  const guild = interaction.guild;
  const member = interaction.member;

  await guild.roles.fetch().catch(console.error);

  // Store user-code association for background auto-syncing
  userCodeMap.set(member.id, codeClean);

  // Execute Role Sync (Adds new roles, removes revoked/unselected roles)
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
    .setFooter({ text: 'GENESIZ 2026 • Live Auto-Sync Active' })
    .setTimestamp();

  if (addedRoles.length > 0) {
    successEmbed.addFields({ name: '➕ Roles Added', value: addedRoles.map(r => `\`+@${r}\``).join(', '), inline: true });
  }

  if (removedRoles.length > 0) {
    successEmbed.addFields({ name: '➖ Roles Removed', value: removedRoles.map(r => `\`-@${r}\``).join(', '), inline: true });
  }

  return interaction.editReply({ embeds: [successEmbed] });
}

// Background Task: Periodic Auto-Sync All Users Every 2 Minutes
async function runBackgroundAutoSync() {
  if (!supabase) return;

  try {
    const guildId = process.env.GUILD_ID;
    if (!guildId) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    await guild.roles.fetch().catch(() => {});

    // For every mapped user in memory, re-fetch their latest registration from Supabase and sync roles
    for (const [userId, code] of userCodeMap.entries()) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) continue;

        const registration = await findRegistration(code);
        if (registration) {
          await syncMemberRoles(guild, member, registration);
        }
      } catch (err) {
        // Ignore individual sync errors
      }
    }
  } catch (err) {
    console.error('Background sync error:', err);
  }
}

// Event: Ready
client.once(Events.ClientReady, c => {
  console.log(`🤖 GENESIZ Verification Bot active as ${c.user.tag}`);
  console.log('🔄 Persistent Background Role Synchronization initialized (15-sec interval)');

  // Run background auto-sync every 15 seconds for near-instant role updates
  setInterval(runBackgroundAutoSync, 15 * 1000);
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
    console.error('Interaction handling error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: '⚠️ An error occurred during verification. Please try again.' }).catch(() => {});
    } else {
      await interaction.reply({ content: '⚠️ An error occurred during verification.', ephemeral: true }).catch(() => {});
    }
  }
});

// Login
client.login(process.env.DISCORD_TOKEN);
