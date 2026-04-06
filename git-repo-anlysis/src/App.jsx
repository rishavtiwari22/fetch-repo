import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Copy, 
  Check, 
  Download, 
  Loader2, 
  AlertCircle, 
  FileCode, 
  Terminal,
  ExternalLink,
  Search,
  Key
} from 'lucide-react';

const Github = ({ size = 24, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

import { parseGitHubUrl, fetchRepoTree, fetchFileContent, isTextFile, estimateTokens, compressCode } from './utils/github';
import { saveRepoData, getRepoData, removeRepoData } from './utils/storage';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [rawTokens, setRawTokens] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  const [isSmartCompressionEnabled, setIsSmartCompressionEnabled] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [storedData, setStoredData] = useState(null);




  const handleFetch = async (e, forceRefresh = false) => {
    e.preventDefault();
    if (!url) return;

    setError('');
    
    // Only reset if it's a fresh fetch or forced refresh
    if (forceRefresh || !showWarning) {
       setContent('');
       setLoading(true);
       setStatus('Parsing URL...');
    }

    const repoInfo = parseGitHubUrl(url);
    if (!repoInfo) {
      setError('Invalid GitHub repository URL');
      setLoading(false);
      return;
    }

    const { owner, repo, branch } = repoInfo;
    
    // Check if repo is already stored
    const existingData = getRepoData(url);
    if (existingData && !showWarning) {
       setStoredData(existingData);
       setShowWarning(true);
       setLoading(false);
       return;
    }

    try {
      setStatus(`Fetching tree for ${owner}/${repo}...`);
      const tree = await fetchRepoTree(owner, repo, branch, token);
      
      const textFiles = tree.filter((node) => node.type === 'blob' && isTextFile(node.path));
      
      if (textFiles.length === 0) {
        setError('No text files found in the repository.');
        setLoading(false);
        return;
      }

      let allContent = `Repository: ${url}\nTotal Files: ${textFiles.length}\nGenerated on: ${new Date().toLocaleString()}\n\n`;
      let currentTokens = 0;
      let currentRawTokens = 0;
      allContent += "=".repeat(80) + "\n\n";

      for (let i = 0; i < textFiles.length; i++) {
        const file = textFiles[i];
        setStatus(`Fetching (${i + 1}/${textFiles.length}): ${file.path}`);
        
        try {
          const fileContent = await fetchFileContent(owner, repo, branch, file.path);
          const rawCount = estimateTokens(fileContent);
          currentRawTokens += rawCount;

          let processedContent = fileContent;
          if (isSmartCompressionEnabled) {
            processedContent = compressCode(fileContent, file.path);
          }

          const processedCount = estimateTokens(processedContent);
          currentTokens += processedCount;
          
          allContent += `File: ${file.path}\n`;
          allContent += "-".repeat(file.path.length + 6) + "\n";
          allContent += processedContent + "\n\n";
          allContent += "=".repeat(80) + "\n\n";
        } catch (err) {
          allContent += `[ERROR] Failed to fetch: ${file.path}\n\n`;
        }
      }

      const finalData = {
        content: allContent,
        totalTokens: currentTokens,
        rawTokens: currentRawTokens,
        fileCount: textFiles.length,
        isSmartCompressionEnabled
      };

      setContent(allContent);
      setTotalTokens(currentTokens);
      setRawTokens(currentRawTokens);
      setFileCount(textFiles.length);
      saveRepoData(url, finalData);
      setStatus('Completed!');
    } catch (err) {
      setError(err.message || 'An error occurred while fetching the repository.');
    } finally {
      setLoading(false);
      setShowWarning(false);
    }
  };

  const handleUseStored = () => {
    if (storedData) {
      setContent(storedData.content);
      setTotalTokens(storedData.totalTokens);
      setRawTokens(storedData.rawTokens);
      setFileCount(storedData.fileCount);
      setIsSmartCompressionEnabled(storedData.isSmartCompressionEnabled);
      setShowWarning(false);
    }
  };

  const handleFetchLatest = (e) => {
    setShowWarning(false);
    // Artificially reset showWarning so handleFetch proceeds
    const pseudoEvent = { preventDefault: () => {} };
    handleFetch(pseudoEvent, true);
  };


  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repo-content-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 lg:py-24 relative">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-brand-primary/10 blur-[120px] rounded-full -z-10" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-96 h-96 bg-brand-secondary/10 blur-[120px] rounded-full -z-10" />

      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 glass mb-6 text-brand-primary font-medium text-sm">
          <Terminal size={16} />
          <span>Code Context Generator</span>
        </div>
        <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-white via-slate-300 to-slate-500 bg-clip-text text-transparent">
          Code to Context. <br /> In Seconds.
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
          The fastest way to extract and concatenate GitHub repositories for LLM context, documentation, or local analysis.
        </p>
      </motion.header>

      {/* Main Input Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="glass p-8 mb-12 shadow-2xl group"
      >
        <form onSubmit={handleFetch} className="space-y-6">
          <div className="relative">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500">
              <Github size={20} />
            </div>
            <input 
              type="text" 
              placeholder="https://github.com/owner/repository"
              className="input-field pl-14 pr-32"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
            />
            <button 
              type="submit" 
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary py-2 text-sm"
              disabled={loading || !url}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Fetch Repo"}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button 
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-2 text-sm"
              >
                <Key size={14} />
                {showToken ? "Hide Access Token" : "Add GitHub Token (Optional)"}
              </button>
              
              <div className="h-4 w-px bg-white/5 hidden sm:block" />

              <label className="relative inline-flex items-center cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={isSmartCompressionEnabled}
                  onChange={(e) => setIsSmartCompressionEnabled(e.target.checked)}
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
                <span className="ms-3 text-sm font-medium text-slate-400 group-hover:text-slate-200 transition-colors">Smart Context Compression</span>
              </label>
            </div>
            
            {loading && (
              <div className="flex items-center gap-3 text-brand-primary animate-pulse">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm font-medium">{status}</span>
              </div>
            )}
          </div>

          <AnimatePresence>
            {showToken && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2">
                  <input 
                    type="password" 
                    placeholder="Personal Access Token (for private repos or rate limits)"
                    className="input-field py-3 text-sm"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                  <p className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                    <AlertCircle size={10} />
                    Tokens are only used for current requests and never stored.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </motion.div>

      {/* Duplicate Warning Prompt */}
      <AnimatePresence>
        {showWarning && storedData && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8"
          >
            <div className="glass border-brand-primary p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 -z-10 bg-brand-primary rounded-full translate-x-1/4 -translate-y-1/4 group-hover:scale-150 transition-transform duration-700" />
              
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">Repository already stored.</h4>
                    <p className="text-slate-400 text-sm">
                      Previously fetched on {new Date(storedData.timestamp).toLocaleString()}. 
                      <span className="text-brand-primary ml-1">{storedData.totalTokens.toLocaleString()} tokens stored locally.</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleUseStored}
                    className="px-6 py-2 glass hover:bg-white/10 text-white font-semibold transition-colors text-sm"
                  >
                    Use Stored
                  </button>
                  <button 
                    onClick={handleFetchLatest}
                    className="px-6 py-2 btn-primary font-semibold transition-all text-sm"
                  >
                    Fetch Latest
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400"
          >
            <AlertCircle size={20} />
            <p className="text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Area */}
      <AnimatePresence>
        {content && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <FileCode className="text-brand-primary" size={20} />
                  Repository Content
                </h3>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 glass border-brand-primary/20 text-brand-primary text-[10px] uppercase tracking-wider font-bold rounded-full flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                    {totalTokens.toLocaleString()} Est. Tokens
                  </div>
                  {isSmartCompressionEnabled && rawTokens > totalTokens && (
                    <div className="px-3 py-1 glass border-green-500/20 text-green-400 text-[10px] uppercase tracking-wider font-bold rounded-full">
                      Saved {Math.round(((rawTokens - totalTokens) / rawTokens) * 100)}%
                    </div>
                  )}
                  <div className="px-3 py-1 glass border-white/5 text-slate-400 text-[10px] uppercase tracking-wider font-bold rounded-full">
                    {fileCount} Files
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 glass hover:bg-white/10 transition-colors text-sm font-medium"
                >
                  {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  {copied ? "Copied!" : "Copy ALL"}
                </button>
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 glass hover:bg-white/10 transition-colors text-sm font-medium"
                >
                  <Download size={16} />
                  Download .txt
                </button>
              </div>
            </div>

            <div className="glass overflow-hidden border-white/5 relative group">
              <pre className="p-6 text-sm text-slate-300 font-mono leading-relaxed max-h-[600px] overflow-auto custom-scrollbar whitespace-pre-wrap">
                {content}
              </pre>
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface-950/80 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            <p className="text-center text-slate-500 text-xs mt-4">
              Tip: Paste this content into your favorite AI tool for coding assistance.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-24 pt-12 border-t border-white/5 text-center text-slate-600 text-sm">
        <p>&copy; {new Date().getFullYear()} CodeContext. Built with React 19 & Tailwind v4.</p>
      </footer>
    </div>
  );
}
