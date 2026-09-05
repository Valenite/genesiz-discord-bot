import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log(`Diagnostic script connected as ${client.user.tag}`);
  const guild = client.guilds.cache.get(process.env.GUILD_ID);

  if (!guild) {
    console.error('Guild not found! Check GUILD_ID in .env');
    process.exit(1);
  }

  await guild.roles.fetch();
  await guild.channels.fetch();

  const everyoneRole = guild.roles.everyone;
  const participantRole = guild.roles.cache.find(r => r.name.trim().toLowerCase() === 'participant');

  console.log('\n--- SERVER ROLES ---');
  guild.roles.cache.forEach(r => {
    console.log(`Role: "${r.name}" | ID: ${r.id} | Position: ${r.position} | Admin: ${r.permissions.has('Administrator')}`);
  });

  console.log('\n--- CHANNEL PERMISSIONS AUDIT ---');
  guild.channels.cache.forEach(ch => {
    const everyoneOv = ch.permissionOverwrites.cache.get(everyoneRole.id);
    const participantOv = participantRole ? ch.permissionOverwrites.cache.get(participantRole.id) : null;

    const everyoneView = everyoneOv ? (everyoneOv.allow.has('ViewChannel') ? 'ALLOW' : (everyoneOv.deny.has('ViewChannel') ? 'DENY' : 'NEUTRAL')) : 'NONE';
    const participantView = participantOv ? (participantOv.allow.has('ViewChannel') ? 'ALLOW' : (participantOv.deny.has('ViewChannel') ? 'DENY' : 'NEUTRAL')) : 'NONE';

    const parentName = ch.parent ? ch.parent.name : 'NO PARENT';
    const typeStr = ch.type === ChannelType.GuildCategory ? 'CATEGORY' : 'CHANNEL';

    console.log(`[${typeStr}] "${ch.name}" (Parent: "${parentName}") | @everyone: ${everyoneView} | @Participant: ${participantView}`);
  });

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
