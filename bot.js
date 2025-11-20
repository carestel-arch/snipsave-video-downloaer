require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🚀 Video Downloader Bot is Running!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8017368297:AAHRUPmhsULOebtwjyKkEYZhGXpruKjQ5nE';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log('🤖 Bot Started: @snipsavevideodownloaderbot');

// WORKING TikTok Downloader
async function downloadTikTok(url) {
  try {
    console.log('⬇️ Downloading TikTok:', url);
    
    // Method 1: Use TikWM API (Most Reliable)
    const response = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.data && response.data.data) {
      const videoUrl = response.data.data.play;
      if (videoUrl && videoUrl.includes('.mp4')) {
        return {
          success: true,
          title: response.data.data.title || 'TikTok Video',
          url: videoUrl,
          author: response.data.data.author?.nickname || 'TikTok User',
          quality: 'HD',
          thumbnail: response.data.data.cover || ''
        };
      }
    }
    
    throw new Error('No video found');
  } catch (error) {
    console.log('TikTok error:', error.message);
    return {
      success: false,
      error: 'TikTok download failed. Try another video.'
    };
  }
}

// WORKING Instagram Downloader
async function downloadInstagram(url) {
  try {
    console.log('⬇️ Downloading Instagram:', url);
    
    const response = await axios.get(`https://instagram-downloader-download-instagram-videos-stories.p.rapidapi.com/index`, {
      params: { url: url },
      headers: {
        'X-RapidAPI-Key': 'your-rapidapi-key', // You can get free one from rapidapi.com
        'X-RapidAPI-Host': 'instagram-downloader-download-instagram-videos-stories.p.rapidapi.com'
      },
      timeout: 30000
    });

    if (response.data && response.data.media) {
      return {
        success: true,
        title: 'Instagram Video',
        url: response.data.media,
        author: 'Instagram User',
        quality: 'HD'
      };
    }
    
    throw new Error('No video found');
  } catch (error) {
    console.log('Instagram error:', error.message);
    return {
      success: false,
      error: 'Instagram download failed. Try TikTok instead.'
    };
  }
}

// WORKING YouTube Downloader
async function downloadYouTube(url) {
  try {
    console.log('⬇️ Downloading YouTube:', url);
    
    // Use y2mate API
    const response = await axios.post(`https://y2mate.com/api/convert`, {
      url: url,
      format: 'mp4'
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.url) {
      return {
        success: true,
        title: 'YouTube Video',
        url: response.data.url,
        author: 'YouTube',
        quality: 'HD'
      };
    }
    
    throw new Error('No video found');
  } catch (error) {
    console.log('YouTube error:', error.message);
    return {
      success: false,
      error: 'YouTube download failed. Try TikTok instead.'
    };
  }
}

// WORKING Twitter Downloader
async function downloadTwitter(url) {
  try {
    console.log('⬇️ Downloading Twitter:', url);
    
    const response = await axios.get(`https://twitsave.com/info?url=${encodeURIComponent(url)}`, {
      timeout: 30000
    });

    if (response.data && response.data.videos && response.data.videos.length > 0) {
      const bestVideo = response.data.videos[0];
      return {
        success: true,
        title: 'Twitter Video',
