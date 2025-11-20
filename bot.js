const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const ytdl = require('ytdl-core');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🎬 Video Downloader Bot is running...');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Bot token from environment variable
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

if (!TELEGRAM_TOKEN) {
  console.log('❌ ERROR: TELEGRAM_TOKEN environment variable is missing');
  process.exit(1);
}

console.log('🚀 Starting Video Downloader Bot...');

const bot = new TelegramBot(TELEGRAM_TOKEN, { 
  polling: true,
  request: {
    timeout: 15000
  }
});

// Test connection
bot.getMe().then(botInfo => {
  console.log('✅ Bot connected to Telegram:', botInfo.username);
  console.log('✅ Bot is ready for video downloads!');
}).catch(error => {
  console.log('❌ Bot failed to connect:', error.message);
});

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `🎬 *Video Downloader Bot* 🎬

*Send me any video link from:*
• YouTube
• Instagram (Coming Soon)
• TikTok (Coming Soon)
• Twitter/X (Coming Soon)

*Features:*
📹 Download HD videos
🎵 Extract audio (MP3)
⚡ Fast downloads
📱 Mobile optimized

*Just paste a YouTube link to start!*

*Commands:*
/audio <url> - Extract audio only
/support - Get help
/stats - Bot statistics`;

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Handle all messages for link detection
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Skip commands
  if (text.startsWith('/')) return;

  // Detect URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex);

  if (urls && urls.length > 0) {
    await handleVideoDownload(chatId, urls[0]);
  }
});

// YouTube Downloader
async function downloadYouTube(url) {
  try {
    console.log('📥 Downloading YouTube video:', url);
    
    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { 
      quality: 'highest',
      filter: 'audioandvideo'
    });

    if (!format) {
      throw new Error('No suitable video format found');
    }

    return {
      success: true,
      title: info.videoDetails.title,
      url: format.url,
      duration: parseInt(info.videoDetails.lengthSeconds),
      thumbnail: info.videoDetails.thumbnails[0].url,
      author: info.videoDetails.author.name,
      views: info.videoDetails.viewCount
    };
  } catch (error) {
    console.log('YouTube download error:', error.message);
    return {
      success: false,
      error: 'YouTube: ' + error.message
    };
  }
}

// Format duration from seconds to MM:SS
function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Main download handler
async function handleVideoDownload(chatId, url) {
  try {
    // Show typing indicator
    await bot.sendChatAction(chatId, 'typing');

    let result;
    let platform = 'Unknown';

    // Determine platform
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      platform = 'YouTube';
      result = await downloadYouTube(url);
    } else {
      return bot.sendMessage(chatId, 
        `❌ *Platform Not Supported Yet!*\n\n` +
        `*Currently Supported:*\n` +
        `✅ YouTube\n\n` +
        `*Coming Soon:*\n` +
        `📸 Instagram\n` +
        `🎵 TikTok\n` +
        `🐦 Twitter/X\n\n` +
        `Try a YouTube link for now!`,
        { parse_mode: 'Markdown' }
      );
    }

    if (!result.success) {
      return bot.sendMessage(chatId, 
        `❌ *Download Failed!*\n\n` +
        `*Error:* ${result.error}\n\n` +
        `Please try:\n` +
        `• A different video\n` +
        `• A shorter video\n` +
        `• Another YouTube link`,
        { parse_mode: 'Markdown' }
      );
    }

    // Send downloading message
    const progressMsg = await bot.sendMessage(chatId, 
      `⬇️ *Downloading from ${platform}...*\n\n` +
      `📹 *Title:* ${result.title}\n` +
      `⏱️ *Duration:* ${formatDuration(result.duration)}\n` +
      `👤 *Channel:* ${result.author}\n` +
      `👁️ *Views:* ${result.views || 'N/A'}\n\n` +
      `_Please wait while I download your video..._`,
      { parse_mode: 'Markdown' }
    );

    // Send the video (max 50MB for Telegram)
    await bot.sendVideo(chatId, result.url, {
      caption: `📹 *${platform} Video*\n\n` +
               `📝 **${result.title}**\n` +
               `👤 ${result.author}\n` +
               `⏱️ ${formatDuration(result.duration)}\n` +
               `👁️ ${result.views || 'N/A'} views\n\n` +
               `⬇️ Downloaded via @${(await bot.getMe()).username}`,
      parse_mode: 'Markdown'
    });

    // Update progress message
    await bot.editMessageText(`✅ *Download Complete!*\n\nEnjoy your video from ${platform}! 🎬`, {
      chat_id: chatId,
      message_id: progressMsg.message_id,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.log('Download handler error:', error.message);
    
    await bot.sendMessage(chatId, 
      `❌ *Download Failed!*\n\n` +
      `*Error:* ${error.message}\n\n` +
      `This might be because:\n` +
      `• The video is too long\n` +
      `• The video is private\n` +
      `• Network issues\n\n` +
      `Try a different video or contact support.`,
      { parse_mode: 'Markdown' }
    );
  }
}

// Audio extraction command
bot.onText(/\/audio (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1].trim();
  
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    await bot.sendMessage(chatId, 
      `🎵 *Audio Extraction*\n\n` +
      `Audio download feature is coming soon!\n\n` +
      `For now, you can:\n` +
      `1. Download the video normally\n` +
      `2. Use a video-to-audio converter app\n\n` +
      `Audio extraction will be available in the next update!`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await bot.sendMessage(chatId, 'Audio extraction currently only supports YouTube.');
  }
});

// Support command
bot.onText(/\/support/, (msg) => {
  const chatId = msg.chat.id;
  const supportMessage = `🆘 *Support*\n\n` +
                        `*Having issues?*\n\n` +
                        `1. Make sure you're sending *YouTube links*\n` +
                        `2. Videos should be *public* (not private)\n` +
                        `3. Try *shorter videos* first\n` +
                        `4. Check your *internet connection*\n\n` +
                        `*Supported formats:*\n` +
                        `• YouTube videos\n` +
                        `• MP4 format\n` +
                        `• Up to 50MB\n\n` +
                        `More platforms coming soon!`;

  bot.sendMessage(chatId, supportMessage, { parse_mode: 'Markdown' });
});

// Stats command
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const botInfo = await bot.getMe();
  
  const statsMessage = `📊 *Bot Statistics*\n\n` +
                      `🤖 *Bot:* @${botInfo.username}\n` +
                      `🎬 *Function:* Video Downloader\n` +
                      `✅ *Status:* Operational\n` +
                      `📹 *Supported:* YouTube\n` +
                      `🚀 *More platforms:* Coming soon!\n\n` +
                      `*Just send any YouTube link to download!*`;

  bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
});

// Handle errors
bot.on('polling_error', (error) => {
  console.log('Polling error:', error.message);
});

bot.on('webhook_error', (error) => {
  console.log('Webhook error:', error);
});

console.log('✅ Video Downloader Bot is running!');
console.log('📹 Supported: YouTube');
console.log('🚀 Ready for downloads!');
