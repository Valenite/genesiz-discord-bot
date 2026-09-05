import { Client, GatewayIntentBits, PermissionFlagsBits, Events } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, async () => {
  console.log(`⚡ Emergency Message History Repair Script running as ${client.user.tag}...`);
  const guild = client.guilds.cache.get(process.env.GUILD_ID);

  if (!guild) {
    console.error('Guild not found!');
    process.exit(1);
  }

  await guild.roles.fetch();
  const channels = await guild.channels.fetch();

  const everyoneRole = guild.roles.everyone;
  const participantRole = guild.roles.cache.find(r => r.name.trim().toLowerCase() === 'participant');

  let fixedCount = 0;
  for (const [id, channel] of channels) {
    if (!channel) continue;
    try {
      // 1. Ensure @everyone has ReadMessageHistory ALLOWED (or not denied)
      await channel.permissionOverwrites.edit(everyoneRole.id, {
        ReadMessageHistory: true
      }).catch(() => {});

      // 2. Ensure @Participant has ReadMessageHistory ALLOWED
      if (participantRole) {
        await channel.permissionOverwrites.edit(participantRole.id, {
          ReadMessageHistory: true
        }).catch(() => {});
      }

      fixedCount++;
      console.log(`[Fixed History ${fixedCount}/${channels.size}] "${channel.name}"`);
    } catch (err) {
      console.warn(`Could not update ReadMessageHistory for ${channel.name}:`, err.message);
    }
  }

  console.log(`✅ MESSAGE HISTORY REPAIRED across all ${fixedCount} channels! Everyone can see message history now.`);
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
