import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
import ytdl from 'ytdl-core';
import { join } from 'path';
import { createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayerStatus } from '@discordjs/voice';

// Load environment variables
dotenv.config();

const TOKEN = process.env.TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;
const PREFIX = process.env.PREFIX || '!'; // Optional prefix for error messages

// Initialize the Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages] });

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a YouTube video in the voice channel.')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('YouTube URL of the video to play.')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playing and leave the voice channel.'),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!')
].map(command => command.toJSON());

// Register slash commands with Discord
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

// Audio player state
let player = createAudioPlayer();
let connection: any = null;

// Event handler: Bot ready
client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

// Event handler: Slash command interaction
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options, guild, member } = interaction;

  if (commandName === 'ping') {
    await interaction.reply('Pong!');
  }

  if (commandName === 'play') {
    const url = options.getString('url')!;
    const voiceChannel = (member as any).voice.channel;

    if (!voiceChannel) {
      await interaction.reply('You need to be in a voice channel to use this command!');
      return;
    }

    try {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild!.id,
        adapterCreator: guild!.voiceAdapterCreator as any
      });

      await interaction.reply(`Playing video: ${url}`);

      const stream = ytdl(url, { filter: 'audioonly' });
      const resource = createAudioResource(stream);

      player.play(resource);
      connection.subscribe(player);

      player.on(AudioPlayerStatus.Idle, () => {
        connection?.destroy();
        connection = null;
      });
    } catch (error) {
      console.error(error);
      await interaction.reply('There was an error trying to play the video.');
    }
  }

  if (commandName === 'stop') {
    if (!connection) {
      await interaction.reply('I am not in a voice channel.');
      return;
    }

    connection.destroy();
    connection = null;
    await interaction.reply('Stopped playing and left the voice channel.');
  }
});

// Log in to Discord
client.login(TOKEN);
