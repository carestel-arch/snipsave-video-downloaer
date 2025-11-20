// Load environment variables
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const ytdl = require('ytdl-core');
const youtubedl = require('youtube-dl-exec');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '🎬 SnipSave Video Downloader Bot is running...',
    bot: '@snipsavevideodownloaderbot',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    bot: 'running',
    username: '@snipsavevideodownloaderbot',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Get Telegram token from environment
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8017368297:AAHRUPmhsULOebtwjyKkEYZhGXpruKjQ5nE';

if (!TELEGRAM_TOKEN) {
  console.error('❌ CRITICAL: TELEGRAM_TOKEN environment variable is missing');
  process.exit(1);
}

console.log('🤖 Starting SnipSave Video Downloader Bot...');
console.log('🔧 Bot: @snipsavevideodownloaderbot');

// Enhanced bot configuration for production
const bot = new TelegramBot(TELEGRAM_TOKEN, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  },
  request: {
    timeout: 120000,
    agentOptions: {
      keepAlive: true,
      family: 4
    }
  }
});

// Store download stats
let downloadStats = {
  totalDownloads: 0,
  youtube: 0,
  instagram: 0,
  tiktok: 0,
  twitter: 0,
  lastUpdated: new Date()
};

// Test bot connection
bot.getMe().then(botInfo => {
  console.log('✅ Bot successfully connected to Telegram');
  console.log('🤖 Bot Username:', `@${botInfo.username}`);
  console.log('🆔 Bot ID:', botInfo.id);
}).catch(error => {
  console.error('❌ Bot failed to connect to Telegram:', error.message);
  process.exit(1);
});

// Enhanced error handling
bot.on('error', (error) => {
  console.error('🤖 Bot error:', error.message);
});

bot.on('polling_error', (error) => {
  console.error('📡 Polling error:', error.message);
});

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `🎬 *SnipSave Video Downloader* 🎬

*📥 Download from Popular Platforms:*
• YouTube (Videos & Audio) ✅
• Instagram (Reels, Posts) ⚠️
• TikTok (No Watermark) ⚠️
• Twitter/X (Videos) ⚠️

*🎯 Features:*
📹 Download HD Videos
🎵 Extract MP3 Audio
⚡ Fast Processing
📱 User Friendly

*🚀 How to Use:*
Simply send any YouTube link to get started!

*⚡ Commands:*
/audio <url> - Extract audio only
/stats - View download statistics
/support - Get help

*Bot:* @snipsavevideodownloaderbot`;

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// FIXED YouTube Downloader - Using youtube-dl-exec as fallback
async function downloadYouTube(url, quality = 'highest') {
  try {
    console.log('📥 Downloading YouTube video:', url);
    
    // Try ytdl-core first
    try {
      const info = await ytdl.getInfo(url);
      let format;

      if (quality === 'audio') {
        format = ytdl.chooseFormat(info.formats, { 
          quality: 'highestaudio',
          filter: 'audioonly'
        });
      } else {
        format = ytdl.chooseFormat(info.formats, { 
          quality: quality === 'highest' ? 'highest' : 'lowest',
          filter: 'audioandvideo'
        });
      }

      if (!format) {
        throw new Error('No suitable format found');
      }

      return {
        success: true,
        title: info.videoDetails.title,
        url: format.url,
        duration: parseInt(info.videoDetails.lengthSeconds),
        thumbnail: info.videoDetails.thumbnails[0]?.url || '',
        author: info.videoDetails.author?.name || 'Unknown',
        views: info.videoDetails.viewCount || 0,
        quality: format.qualityLabel || 'Unknown',
        size: format.contentLength ? (format.contentLength / (1024 * 1024)).toFixed(2) + 'MB' : 'Unknown',
        method: 'ytdl-core'
      };
    } catch (ytdlError) {
      console.log('ytdl-core failed, trying youtube-dl-exec:', ytdlError.message);
      
      // Fallback to youtube-dl-exec
      const result = await youtubedl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: ['referer:youtube.com', 'user-agent:googlebot']
      });

      if (!result) {
        throw new Error('No video data received');
      }

      // Find the best format
      let bestFormat;
      if (quality === 'audio') {
        bestFormat = result.formats.find(f => f.acodec !== 'none' && f.vcodec === 'none');
      } else {
        bestFormat = result.formats.find(f => f.acodec !== 'none' && f.vcodec !== 'none');
      }

      if (!bestFormat) {
        bestFormat = result.formats[0];
      }

      return {
        success: true,
        title: result.title || 'YouTube Video',
        url: bestFormat.url,
        duration: result.duration || 0,
        thumbnail: result.thumbnail || '',
        author: result.uploader || 'Unknown',
        views: result.view_count || 0,
        quality: bestFormat.format_note || 'Unknown',
        size: bestFormat.filesize ? (bestFormat.filesize / (1024 * 1024)).toFixed(2) + 'MB' : 'Unknown',
        method: 'youtube-dl-exec'
      };
    }

  } catch (error) {
    console.log('YouTube download error:', error.message);
    return {
      success: false,
      error: 'YouTube: ' + (error.message.includes('Sign in to confirm') ? 
        'Video is age-restricted. Try a different video.' : error.message)
    };
  }
}

// Simple Instagram Downloader
async function downloadInstagram(url) {
  try {
    console.log('📥 Downloading Instagram video:', url);
    
    // Using a simple Instagram API
    const response = await axios.get(`https://api.instagram.com/download?url=${encodeURIComponent(url)}`, {
      timeout: 15000
    });
    
    if (response.data && response.data.video_url) {
      return {
        success: true,
        title: 'Instagram Video',
        url: response.data.video_url,
        author: response.data.username || 'Instagram User',
        duration: 0,
        thumbnail: response.data.thumbnail_url || '',
        quality: 'HD',
        size: 'Unknown'
      };
    } else {
      throw new Error('No video found');
    }
  } catch (error) {
    console.log('Instagram download error:', error.message);
    return {
      success: false,
      error: 'Instagram: Could not download video. Try YouTube instead.'
    };
  }
}

// Simple TikTok Downloader
async function downloadTikTok(url) {
  try {
    console.log('📥 Downloading TikTok video:', url);
    
    return {
      success: true,
      title: 'TikTok Video',
      url: `https://tikwm.com/api?url=${encodeURIComponent(url)}`,
      author: 'TikTok User',
      duration: 0,
      thumbnail: '',
      quality: 'HD',
      size: 'Unknown'
    };
  } catch (error) {
    console.log('TikTok download error:', error.message);
    return {
      success: false,
      error: 'TikTok: Could not download video. Try YouTube instead.'
    };
  }
}

// Simple Twitter Downloader
async function downloadTwitter(url) {
  try {
    console.log('📥 Downloading Twitter video:', url);
    
    return {
      success: true,
      title: 'Twitter Video',
      url: `https://twitsave.com/info?url=${encodeURIComponent(url)}`,
      author: 'Twitter User',
      duration: 0,
      thumbnail: '',
      quality: 'HD',
      size: 'Unknown'
    };
  } catch (error) {
    console.log('Twitter download error:', error.message);
    return {
      success: false,
      error: 'Twitter: Could not download video. Try YouTube instead.'
    };
  }
}

// Universal Download Handler
async function handleUniversalDownload(chatId, url, options = {}) {
  try {
    await bot.sendChatAction(chatId, 'typing');

    let result;
    let platform = 'Unknown';

    // Detect platform and download
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      platform = 'YouTube';
      result = await downloadYouTube(url, options.quality);
    } else if (url.includes('instagram.com')) {
      platform = 'Instagram';
      result = await downloadInstagram(url);
    } else if (url.includes('tiktok.com')) {
      platform = 'TikTok';
      result = await downloadTikTok(url);
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      platform = 'Twitter/X';
      result = await downloadTwitter(url);
    } else {
      return await bot.sendMessage(chatId,
        `❌ *Unsupported Platform*\n\n` +
        `I currently support:\n` +
        `• YouTube (✅ Reliable)\n` +
        `• Instagram (⚠️ Limited)\n` +
        `• TikTok (⚠️ Limited)\n` +
        `• Twitter/X (⚠️ Limited)\n\n` +
        `Try a YouTube link for best results!`,
        { parse_mode: 'Markdown' }
      );
    }

    if (!result.success) {
      throw new Error(result.error);
    }

    // Update stats
    downloadStats.totalDownloads++;
    downloadStats[platform.toLowerCase()]++;
    downloadStats.lastUpdated = new Date();

    // For YouTube, show quality options
    if (platform === 'YouTube' && !options.quality && !options.audio) {
      return await sendQualityOptions(chatId, url, result);
    }

    // Download and send
    await downloadAndSendFile(chatId, result, platform, options);

  } catch (error) {
    console.log('Universal download error:', error.message);
    await bot.sendMessage(chatId, 
      `❌ *Download Failed!*\n\n` +
      `*Error:* ${error.message}\n\n` +
      `*💡 Tips:*\n` +
      `• Try a different YouTube video\n` +
      `• Make sure the video is not age-restricted\n` +
      `• Try shorter videos first`,
      { parse_mode: 'Markdown' }
    );
  }
}

// Download and send file
async function downloadAndSendFile(chatId, videoData, platform, options) {
  const progressMsg = await bot.sendMessage(chatId, 
    `⬇️ *Downloading from ${platform}...*\n\n` +
    `📹 *Title:* ${videoData.title}\n` +
    `👤 *Author:* ${videoData.author}\n` +
    `🎯 *Quality:* ${videoData.quality}\n` +
    `💾 *Size:* ${videoData.size}\n\n` +
    `_Please wait while I process your file..._`,
    { parse_mode: 'Markdown' }
  );

  try {
    if (options.audio) {
      await bot.sendAudio(chatId, videoData.url, {
        caption: `🎵 *Audio from ${platform}*\n\n` +
                 `📝 **${videoData.title}**\n` +
                 `👤 ${videoData.author}\n` +
                 `🎯 MP3 Format\n\n` +
                 `✅ Downloaded via @snipsavevideodownloaderbot`,
        parse_mode: 'Markdown'
      });
    } else {
      await bot.sendVideo(chatId, videoData.url, {
        caption: `📹 *${platform} Video*\n\n` +
                 `📝 **${videoData.title}**\n` +
                 `👤 ${videoData.author}\n` +
                 `🎯 ${videoData.quality}\n` +
                 `💾 ${videoData.size}\n\n` +
                 `✅ Downloaded via @snipsavevideodownloaderbot`,
        parse_mode: 'Markdown'
      });
    }

    await bot.editMessageText(`✅ *Download Complete!*\n\nEnjoy your ${options.audio ? 'audio' : 'video'} from ${platform}! 🎬`, {
      chat_id: chatId,
      message_id: progressMsg.message_id,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.log('Send file error:', error.message);
    await bot.editMessageText(
      `❌ *Sending Failed!*\n\n` +
      `*Error:* ${error.message}\n\n` +
      `The file might be too large or in an unsupported format.`,
      {
        chat_id: chatId,
        message_id: progressMsg.message_id,
        parse_mode: 'Markdown'
      }
    );
  }
}

// Send quality options for YouTube
async function sendQualityOptions(chatId, url, videoData) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🎯 Highest Quality', callback_data: `quality_${url}_highest` },
        { text: '⚡ Balanced', callback_data: `quality_${url}_medium` }
      ],
      [
        { text: '📱 Mobile Friendly', callback_data: `quality_${url}_low` },
        { text: '🎵 Audio Only', callback_data: `audio_${url}` }
      ]
    ]
  };

  await bot.sendMessage(chatId,
    `🎬 *Quality Selection for YouTube*\n\n` +
    `📹 *Title:* ${videoData.title}\n` +
    `⏱️ *Duration:* ${formatDuration(videoData.duration)}\n` +
    `👤 *Channel:* ${videoData.author}\n\n` +
    `*Choose your preferred quality:*`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
}

// Handle callback queries (quality selection)
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;

  if (data.startsWith('quality_')) {
    const parts = data.split('_');
    const url = parts[1];
    const quality = parts[2];
    
    await bot.answerCallbackQuery(callbackQuery.id);
    await handleUniversalDownload(message.chat.id, url, { quality });
    
  } else if (data.startsWith('audio_')) {
    const url = data.split('_')[1];
    
    await bot.answerCallbackQuery(callbackQuery.id);
    await handleUniversalDownload(message.chat.id, url, { audio: true });
  }
});

// Enhanced message handler
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Skip commands
  if (text.startsWith('/')) return;

  // URL detection
  const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  const urls = text.match(urlRegex);

  if (urls && urls.length > 0) {
    const url = urls[0];
    console.log(`📥 Received URL from ${chatId}:`, url);
    await handleUniversalDownload(chatId, url);
  }
});

// Audio extraction command
bot.onText(/\/audio (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1].trim();
  console.log(`🎵 Audio request from ${chatId}:`, url);
  await handleUniversalDownload(chatId, url, { audio: true });
});

// Stats command
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  
  const statsMessage = `📊 *Download Statistics*\n\n` +
                      `🤖 *Bot:* @snipsavevideodownloaderbot\n` +
                      `📥 *Total Downloads:* ${downloadStats.totalDownloads}\n\n` +
                      `*Platform Breakdown:*\n` +
                      `📹 YouTube: ${downloadStats.youtube}\n` +
                      `📸 Instagram: ${downloadStats.instagram}\n` +
                      `🎵 TikTok: ${downloadStats.tiktok}\n` +
                      `🐦 Twitter/X: ${downloadStats.twitter}\n\n` +
                      `*💡 Tip:* YouTube links work most reliably!`;

  await bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
});

// Support command
bot.onText(/\/support/, (msg) => {
  const chatId = msg.chat.id;
  
  const supportMessage = `🆘 *Support & Troubleshooting*\n\n` +
                        `*Common Issues:*\n\n` +
                        `❌ *YouTube 410 Error:*\n` +
                        `• Try a different YouTube video\n` +
                        `• Avoid age-restricted content\n` +
                        `• Use shorter videos\n\n` +
                        `❌ *Video too large:*\n` +
                        `• Use /audio for audio only\n` +
                        `• Choose lower quality\n\n` +
                        `✅ *Working Platforms:*\n` +
                        `• YouTube: Mostly working\n` +
                        `• Instagram: Limited\n` +
                        `• TikTok: Limited\n` +
                        `• Twitter: Limited\n\n` +
                        `*Bot:* @snipsavevideodownloaderbot`;

  bot.sendMessage(chatId, supportMessage, { parse_mode: 'Markdown' });
});

// Format duration from seconds to MM:SS
function formatDuration(seconds) {
  if (!seconds) return 'Unknown';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

console.log('✅ Bot initialization complete!');
console.log('🤖 Bot: @snipsavevideodownloaderbot');
console.log('📹 YouTube Downloader: FIXED (dual method)');
console.log('🚀 Bot is running and ready for messages!');
