import { Client, GatewayIntentBits, ChannelType, Events } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, async () => {
  console.log(`⚡ Emergency Restoration Script running as ${client.user.tag}...`);
  const guild = client.guilds.cache.get(process.env.GUILD_ID);

  if (!guild) {
    console.error('Guild not found!');
    process.exit(1);
  }

  console.log('Fetching roles and channels...');
  await guild.roles.fetch();
  const channels = await guild.channels.fetch();

  const everyoneRole = guild.roles.everyone;
  const participantRole = guild.roles.cache.find(r => r.name.trim().toLowerCase() === 'participant');

  let resetCount = 0;
  console.log(`Found ${channels.size} channels to restore.`);

  for (const [id, channel] of channels) {
    if (!channel) continue;
    try {
      // Remove @everyone ViewChannel DENY overwrite added by bot
      const everyoneOv = channel.permissionOverwrites?.cache.get(everyoneRole.id);
      if (everyoneOv) {
        await channel.permissionOverwrites.delete(everyoneRole.id).catch(() => {});
      }

      // Remove @Participant ViewChannel DENY overwrite
      if (participantRole) {
        const participantOv = channel.permissionOverwrites?.cache.get(participantRole.id);
        if (participantOv) {
          await channel.permissionOverwrites.delete(participantRole.id).catch(() => {});
        }
      }

      // Sync text & voice channels back to parent category cleanly
      if (channel.type !== ChannelType.GuildCategory && channel.parent) {
        await channel.lockPermissions().catch(() => {});
      }

      resetCount++;
      console.log(`[Restored ${resetCount}/${channels.size}] "${channel.name}"`);
    } catch (err) {
      console.warn(`Could not reset permissions for ${channel.name}:`, err.message);
    }
  }

  console.log(`✅ RESTORATION COMPLETE! Removed bot permission overwrites and resynced ${resetCount} channels back to original state.`);
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
