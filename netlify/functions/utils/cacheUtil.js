// utils/cacheUtil.js
const fs = require('fs');
const path = require('path');

const CACHE_DIR = '/tmp'; // Netlify의 임시 저장소
const STORE_NAME = 'webhook-dedupe';
const TTL_MS = 1000 * 60 * 60 * 24; // 24시간

async function getStore() {
  // 동적으로 ESM 로드 (CommonJS에서 안전)
  const mod = await import('@netlify/blobs');
  return mod.getStore(STORE_NAME);
}

function getCacheFilePath(key) {
  return path.join(CACHE_DIR, key);
}

async function getCache(key) {
  try {
    const store = await getStore(STORE_NAME);
    const data = await store.getJSON(key);
    if (!data) return false;

    // 만료 체크
    if (data.expiresAt && Date.now() > data.expiresAt) {
      await store.delete(key).catch(() => {});
      return false;
    }
    return true; // 존재하고 아직 유효하면 true
  } catch (e) {
    console.warn('getCache error:', e?.message);
    return false;
  }
}

async function setCache(key) {
  try {
    const store = await getStore(STORE_NAME);
    await store.setJSON(key, {
      value: true,
      setAt: Date.now(),
      expiresAt: Date.now() + TTL_MS,
    });
    return true;
  } catch (e) {
    console.warn('setCache error:', e?.message);
    return false;
  }
}

module.exports = { getCache, setCache };
