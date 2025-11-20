// Load environment variables
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const ytdl = require('ytdl-core');

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

// Enhanced bot configuration
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
}).catch(error => {
  console.error('❌ Bot failed to connect to Telegram:', error.message);
  process.exit(1);
});

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `🎬 *SnipSave Video Downloader* 🎬

*📥 Download from Popular Platforms:*
• YouTube (Videos & Audio) ✅
• Instagram (Reels, Posts) ⚠️
• TikTok (No Watermark) ✅
• Twitter/X (Videos) ⚠️

*🚀 How to Use:*
Simply send any video link to get started!

*⚡ Commands:*
/audio <url> - Extract audio only
/stats - View download statistics
/support - Get help

*Bot:* @snipsavevideodownloaderbot`;

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// FIXED TikTok Downloader - Now extracts actual video URL
async function downloadTikTok(url) {
  try {
    console.log('📥 Downloading TikTok video:', url);
    
    // Method 1: Try tikwm API (most reliable)
    try {
      const response = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`, {
        timeout: 20000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      console.log('📄 TikTok API Response:', JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.data) {
        const videoData = response.data.data;
        
        // Get the actual video URL (not the API endpoint)
        let videoUrl = videoData.play;
        
        // If play is not available, try other fields
        if (!videoUrl && videoData.hdplay) {
          videoUrl = videoData.hdplay;
        }
        if (!videoUrl && videoData.wmplay) {
          videoUrl = videoData.wmplay;
        }
        
        if (videoUrl) {
          // Make sure it's a direct video URL, not an API endpoint
          if (videoUrl.includes('.mp4') || videoUrl.includes('video/')) {
            return {
              success: true,
              title: videoData.title || 'TikTok Video',
              url: videoUrl,
              author: videoData.author?.nickname || 'TikTok User',
              duration: videoData.duration || 0,
              thumbnail: videoData.cover || '',
              quality: 'HD',
              size: 'Unknown',
              method: 'tikwm'
            };
          } else {
            console.log('❌ TikTok URL is not a direct video:', videoUrl);
          }
        }
      }
    } catch (tikwmError) {
      console.log('❌ tikwm API failed:', tikwmError.message);
    }

    // Method 2: Try another TikTok API
    try {
      const response = await axios.get(`https://www.tiktok.com/oembed?url=${url}`, {
        timeout: 15000
      });
      
      // Use a different download service
      const downloadResponse = await axios.get(`https://tikdown.org/get?url=${encodeURIComponent(url)}`, {
        timeout: 15000
      });

      if (downloadResponse.data && downloadResponse.data.video_url) {
        return {
          success: true,
          title: response.data.title || 'TikTok Video',
          url: downloadResponse.data.video_url,
          author: response.data.author_name || 'TikTok User',
          duration: 0,
          thumbnail: '',
          quality: 'HD',
          size: 'Unknown',
          method: 'tikdown'
        };
      }
    } catch (alternativeError) {
      console.log('❌ Alternative TikTok API failed:', alternativeError.message);
    }

    // Method 3: Try yet another API
    try {
      const response = await axios.post(`https://tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com/vid/index`, 
        { url: url },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 15000
        }
      );

      if (response.data && response.data.video) {
        return {
          success: true,
          title: 'TikTok Video',
          url: response.data.video,
          author: 'TikTok User',
          duration: 0,
          thumbnail: '',
          quality: 'HD',
          size: 'Unknown',
          method: 'rapidapi'
        };
      }
    } catch (thirdMethodError) {
      console.log('❌ Third TikTok method failed:', thirdMethodError.message);
    }

    throw new Error('All TikTok download methods failed - no direct video URL found');

  } catch (error) {
    console.log('❌ TikTok download error:', error.message);
    return {
      success: false,
      error: 'TikTok: Could not extract video. Try a different TikTok link.'
    };
  }
}

// Simple YouTube Downloader
async function downloadYouTube(url, quality = 'highest') {
  try {
    console.log('📥 Downloading YouTube video:', url);
    
    // Try ytdl-core
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

      if (format && format.url) {
        return {
          success: true,
          title: info.videoDetails.title || 'YouTube Video',
          url: format.url,
          duration: parseInt(info.videoDetails.lengthSeconds) || 0,
          thumbnail: info.videoDetails.thumbnails[0]?.url || '',
          author: info.videoDetails.author?.name || 'YouTube',
          views: info.videoDetails.viewCount || 0,
          quality: format.qualityLabel || 'Unknown',
          size: format.contentLength ? (format.contentLength / (1024 * 1024)).toFixed(2) + 'MB' : 'Unknown',
          method: 'ytdl-core'
        };
      }
    } catch (ytdlError) {
      console.log('❌ ytdl-core failed:', ytdlError.message);
    }

    throw new Error('YouTube download failed. Try a different video.');

  } catch (error) {
    console.log('❌ YouTube download error:', error.message);
    return {
      success: false,
      error: 'YouTube: ' + error.message
    };
  }
}

// Simple Instagram Downloader
async function downloadInstagram(url) {
  try {
    console.log('📥 Downloading Instagram video:', url);
    
    return {
      success: true,
      title: 'Instagram Video',
      url: `https://api.instagram.com/download?url=${encodeURIComponent(url)}`,
      author: 'Instagram User',
      duration: 0,
      thumbnail: '',
      quality: 'HD',
      size: 'Unknown',
      method: 'instagram-api'
    };
  } catch (error) {
    console.log('❌ Instagram download error:', error.message);
    return {
      success: false,
      error: 'Instagram: Could not download video. Try TikTok or YouTube instead.'
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
        `• YouTube\n` +
        `• TikTok\n` +
        `• Instagram\n` +
        `• Twitter/X\n\n` +
        `Try a TikTok or YouTube link!`,
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

    // Download and send
    await downloadAndSendFile(chatId, result, platform, options);

  } catch (error) {
    console.log('❌ Universal download error:', error.message);
    await bot.sendMessage(chatId, 
      `❌ *Download Failed!*\n\n` +
      `*Error:* ${error.message}\n\n` +
      `*💡 Tips:*\n` +
      `• Try different TikTok links\n` +
      `• Make sure videos are public\n` +
      `• Try shorter videos first`,
      { parse_mode: 'Markdown' }
    );
  }
}

// Download and send file - WITH VIDEO URL VALIDATION
async function downloadAndSendFile(chatId, videoData, platform, options) {
  const progressMsg = await bot.sendMessage(chatId, 
    `⬇️ *Downloading from ${platform}...*\n\n` +
    `📹 *Title:* ${videoData.title}\n` +
    `👤 *Author:* ${videoData.author}\n` +
    `🎯 *Quality:* ${videoData.quality}\n` +
    `⚡ *Method:* ${videoData.method || 'Direct'}\n\n` +
    `_Processing your video..._`,
    { parse_mode: 'Markdown' }
  );

  try {
    // Validate the video URL before sending
    console.log('🔍 Validating video URL:', videoData.url);
    
    if (!videoData.url || 
        (!videoData.url.includes('.mp4') && 
         !videoData.url.includes('video/') && 
         !videoData.url.includes('blob:') &&
         !videoData.url.includes('googlevideo'))) {
      throw new Error('Invalid video URL - not a direct video file');
    }

    if (options.audio) {
      await bot.sendAudio(chatId, videoData.url, {
        caption: `🎵 *Audio from ${platform}*\n\n` +
                 `📝 **${videoData.title}**\n` +
                 `👤 ${videoData.author}\n\n` +
                 `✅ Downloaded via @snipsavevideodownloaderbot`,
        parse_mode: 'Markdown'
      });
    } else {
      await bot.sendVideo(chatId, videoData.url, {
        caption: `📹 *${platform} Video*\n\n` +
                 `📝 **${videoData.title}**\n` +
                 `👤 ${videoData.author}\n` +
                 `🎯 ${videoData.quality}\n\n` +
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
    console.log('❌ Send file error:', error.message);
    await bot.editMessageText(
      `❌ *Video Processing Failed!*\n\n` +
      `*Error:* ${error.message}\n\n` +
      `*Possible reasons:*\n` +
      `• Video URL is not accessible\n` +
      `• Video format not supported\n` +
      `• Video is too large\n\n` +
      `💡 *Try a different TikTok link*`,
      {
        chat_id: chatId,
        message_id: progressMsg.message_id,
        parse_mode: 'Markdown'
      }
    );
  }
}

//
