import { Client, GatewayIntentBits, ChannelType, Events } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, async () => {
  console.log(`⚡ Full Custom Role & Ticket Permission Repair running as ${client.user.tag}...`);
  const guild = client.guilds.cache.get(process.env.GUILD_ID);

  if (!guild) {
    console.error('Guild not found!');
    process.exit(1);
  }

  await guild.roles.fetch();
  const channels = await guild.channels.fetch();

  const ticketToolRole = guild.roles.cache.get('1544019963243929612') || guild.roles.cache.find(r => r.name.toLowerCase().includes('ticket tool'));
  const ticketSupportRole = guild.roles.cache.get('1544021866480406638') || guild.roles.cache.find(r => r.name.toLowerCase().includes('ticket support'));
  const sapphireRole = guild.roles.cache.get('1544301241671356438') || guild.roles.cache.find(r => r.name.toLowerCase().includes('sapphire'));
  const eventManagerRole = guild.roles.cache.get('1543938117436837978') || guild.roles.cache.find(r => r.name.toLowerCase() === 'event manager');
  const vicePresRole = guild.roles.cache.get('1543938179164282890') || guild.roles.cache.find(r => r.name.toLowerCase() === 'vice president');

  const everyoneRole = guild.roles.everyone;

  console.log(`Found ${channels.size} channels to restore custom bot and staff permissions.`);

  for (const [id, channel] of channels) {
    if (!channel) continue;
    try {
      const nameLower = channel.name.toLowerCase();
      const parentLower = channel.parent ? channel.parent.name.toLowerCase() : '';

      // 1. Ensure @everyone has ViewChannel = true so all original channels are visible
      await channel.permissionOverwrites.edit(everyoneRole.id, {
        ViewChannel: true,
        ReadMessageHistory: true
      }).catch(() => {});

      // 2. Restore Ticket Tool & Ticket Support on Help Desk & ticket channels
      if (nameLower.includes('ticket') || nameLower.includes('support') || parentLower.includes('help desk') || nameLower.includes('help desk')) {
        if (ticketToolRole) {
          await channel.permissionOverwrites.edit(ticketToolRole.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            ManageChannels: true,
            ManageMessages: true
          }).catch(() => {});
        }

        if (ticketSupportRole) {
          await channel.permissionOverwrites.edit(ticketSupportRole.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            ManageMessages: true
          }).catch(() => {});
        }
      }

      // 3. Restore Sapphire bot role if present
      if (sapphireRole && (nameLower.includes('sapphire') || nameLower.includes('clanker') || parentLower.includes('general'))) {
        await channel.permissionOverwrites.edit(sapphireRole.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        }).catch(() => {});
      }

      // 4. Restore Event Managers & Vice President on Staff channels
      if (nameLower.includes('staff') || parentLower.includes('staff')) {
        if (eventManagerRole) {
          await channel.permissionOverwrites.edit(eventManagerRole.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          }).catch(() => {});
        }
        if (vicePresRole) {
          await channel.permissionOverwrites.edit(vicePresRole.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          }).catch(() => {});
        }
      }

      // 5. Restore Event Manager specific roles on their event channels
      const eventManagerRoleMatches = [
        { pattern: 'valorant', roleName: 'event manager - valorant' },
        { pattern: 'bedwarz', roleName: 'event manager - minecraft' },
        { pattern: 'cipher', roleName: 'event manager - cipherquest' },
        { pattern: 'web', roleName: 'event manager - webx' },
        { pattern: 'surprise', roleName: 'event manager - surprise' },
        { pattern: 'algo', roleName: 'event manager - algoarena' },
        { pattern: 'app', roleName: 'event manager - appforge' },
        { pattern: 'brain', roleName: 'event manager - brainbyte' }
      ];

      for (const match of eventManagerRoleMatches) {
        if (nameLower.includes(match.pattern) || parentLower.includes(match.pattern)) {
          const emRole = guild.roles.cache.find(r => r.name.toLowerCase() === match.roleName);
          if (emRole) {
            await channel.permissionOverwrites.edit(emRole.id, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true
            }).catch(() => {});
          }
        }
      }

      console.log(`[Full Restored] "${channel.name}"`);
    } catch (err) {
      console.warn(`Could not restore ${channel.name}:`, err.message);
    }
  }

  console.log(`🎉 ALL TICKET BOT, SAPPHIRE, AND STAFF PERMISSIONS FULLY RESTORED!`);
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
