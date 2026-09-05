import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify your website Operative Code to unlock the server')
    .addStringOption(option =>
      option.setName('code')
        .setDescription('Your website Operative Code (e.g. GSZ-2026-A4F9)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('setup-verify')
    .setDescription('Post the interactive Verification Panel button in the current channel (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('⏳ Refreshing application (/) commands...');

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log('✅ Successfully registered guild slash commands!');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
