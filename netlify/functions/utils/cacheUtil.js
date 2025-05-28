// utils/cacheUtil.js
const fs = require('fs');
const path = require('path');

const CACHE_DIR = '/tmp'; // Netlify의 임시 저장소

function getCacheFilePath(key) {
  return path.join(CACHE_DIR, key);
}

function getCache(key) {
  const filePath = getCacheFilePath(key);
  if (!fs.existsSync(filePath)) return false;

  const stat = fs.statSync(filePath);
  const now = new Date();
  const isExpired = now - stat.birthtime > 1000 * 60 * 60 * 24; // 24시간

  if (isExpired) {
    fs.unlinkSync(filePath);
    return false;
  }
  return true;
}

function setCache(key) {
  const filePath = getCacheFilePath(key);
  fs.writeFileSync(filePath, 'cached');
}

module.exports = { getCache, setCache };
