const STORAGE_KEY_PREFIX = 'repo_cache_';

export const saveRepoData = (url, { content, totalTokens, rawTokens, fileCount, isSmartCompressionEnabled }) => {
  const data = {
    content,
    totalTokens,
    rawTokens,
    fileCount,
    isSmartCompressionEnabled,
    timestamp: new Date().toISOString(),
    url
  };
  
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${url}`, JSON.stringify(data));
    
    // Also maintain a list of stored URLs for easy lookup
    const storedUrls = JSON.parse(localStorage.getItem('stored_repo_urls') || '[]');
    if (!storedUrls.includes(url)) {
      storedUrls.push(url);
      localStorage.setItem('stored_repo_urls', JSON.stringify(storedUrls));
    }
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
    // If quota exceeded, we might want to clear old entries, 
    // but for now we'll just log it.
  }
};

export const getRepoData = (url) => {
  const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${url}`);
  return data ? JSON.parse(data) : null;
};

export const getAllStoredUrls = () => {
  return JSON.parse(localStorage.getItem('stored_repo_urls') || '[]');
};

export const removeRepoData = (url) => {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${url}`);
  const storedUrls = JSON.parse(localStorage.getItem('stored_repo_urls') || '[]');
  const filtered = storedUrls.filter(u => u !== url);
  localStorage.setItem('stored_repo_urls', JSON.stringify(filtered));
};
