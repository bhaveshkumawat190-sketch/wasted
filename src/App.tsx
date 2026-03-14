/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Type, Menu, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

type Screen = 'cover' | 'toc' | 'reader';

interface Chapter {
  id: number;
  label: string;
  title: string;
  content: string;
  isNew?: boolean;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6 text-center">
          <div className="bg-[var(--surf)] p-8 rounded-2xl shadow-2xl border border-[var(--surf3)] max-w-md">
            <h2 className="text-[var(--gold)] font-serif-display text-2xl mb-4">Application Error</h2>
            <p className="text-[var(--txt2)] text-sm mb-6">{this.state.error?.message || "Something went wrong."}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-[var(--gold2)] text-[var(--gold)] rounded-lg font-serif-display hover:bg-[#a07040] transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>('cover');
  const [currentChapterIdx, setCurrentChapterIdx] = useState<number>(0);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [coverImage, setCoverImage] = useState<string>('https://images.unsplash.com/photo-1543333995-a78439f7efce?auto=format&fit=crop&q=80&w=1000');
  const readerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/chapters.json');
        if (response.ok) {
          const data = await response.json();
          setChapters(data);
        }
      } catch (error) {
        console.error("Error loading chapters:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const openChapter = (idx: number) => {
    if (idx < 0 || idx >= chapters.length) return;
    setCurrentChapterIdx(idx);
    setScreen('reader');
    setTimeout(() => {
      if (readerRef.current) {
        readerRef.current.scrollTop = 0;
      }
    }, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-[var(--gold)] font-serif-display text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex justify-center">
      <div className="w-full max-w-[500px] bg-[var(--surf)] relative flex flex-col shadow-2xl min-h-screen">
        
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {screen === 'cover' && (
              <motion.div
                key="cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-[var(--surf)]"
              >
                <div className="cover-art w-[240px] h-[340px] bg-[var(--surf2)] rounded-sm border border-[var(--surf3)] flex flex-col items-center justify-center mb-8 relative overflow-hidden shadow-2xl">
                  <img 
                    src={coverImage} 
                    alt="How i lost my Sumi" 
                    className="absolute inset-0 w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = "https://picsum.photos/seed/sumi-cover/400/600";
                      e.currentTarget.className = "absolute inset-0 w-full h-full object-cover opacity-40";
                    }}
                  />
                </div>

                <div className="text-center mb-6">
                  <h1 className="font-serif-display text-[22px] text-[var(--txt)] leading-[1.3]">Lost Memories with Sumi</h1>
                  <p className="text-[13px] text-[var(--txt2)] mt-1 italic">by Sumo</p>
                  <span className="inline-block text-[10px] text-[var(--gold)] border border-[var(--gold2)] px-2.5 py-0.5 rounded-full mt-2.5 tracking-[0.08em]">
                    New chapter every week
                  </span>
                </div>

                <button 
                  onClick={() => openChapter(0)}
                  disabled={chapters.length === 0}
                  className="w-full p-3.5 bg-[var(--gold2)] rounded-lg text-[var(--gold)] font-serif-display text-[15px] cursor-pointer mt-1 transition-colors hover:bg-[#a07040] disabled:opacity-50"
                >
                  {chapters.length > 0 ? 'Start reading' : 'No chapters available'}
                </button>
                <button 
                  onClick={() => setScreen('toc')}
                  className="w-full p-[11px] bg-transparent border border-[var(--surf3)] rounded-lg text-[var(--txt2)] text-[13px] cursor-pointer mt-2 transition-colors hover:bg-[var(--surf2)]"
                >
                  View all chapters
                </button>
              </motion.div>
            )}

            {screen === 'toc' && (
              <motion.div
                key="toc"
                initial={{ x: 360 }}
                animate={{ x: 0 }}
                exit={{ x: 360 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute inset-0 flex flex-col bg-[var(--surf)]"
              >
                <div className="p-[18px_20px_12px] flex items-center justify-between border-b border-[var(--surf3)]">
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => setScreen('cover')} className="w-8 h-8 flex items-center justify-center text-[var(--txt2)] hover:text-[var(--gold)] transition-colors">
                      <ChevronLeft size={20} />
                    </button>
                    <h2 className="font-serif-display text-[18px] text-[var(--txt)]">Contents</h2>
                  </div>
                  <button 
                    onClick={() => setScreen('cover')}
                    className="w-8 h-8 flex items-center justify-center text-[var(--txt2)] hover:text-[var(--gold)] transition-colors"
                    title="Home"
                  >
                    <Home size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-[16px_20px]">
                  {chapters.map((ch, idx) => (
                    <div 
                      key={ch.id || idx} 
                      onClick={() => openChapter(idx)}
                      className="py-3.5 border-b border-[var(--surf3)] cursor-pointer flex justify-between items-center group last:border-0"
                    >
                      <div>
                        <div className="text-[11px] text-[var(--txt3)] tracking-[0.08em] uppercase mb-0.5">{ch.label}</div>
                        <div className="font-serif-display text-[15px] text-[var(--txt)] group-hover:text-[var(--gold)] transition-colors">
                          {ch.title}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {ch.isNew && <span className="text-[10px] text-[var(--gold)] border border-[var(--gold2)] px-1.5 py-0.5 rounded-md">Latest</span>}
                        <ChevronRight size={16} className="text-[var(--txt3)]" />
                      </div>
                    </div>
                  ))}
                  {chapters.length === 0 && (
                    <div className="text-center py-10 text-[var(--txt3)] italic">
                      No chapters found.
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {screen === 'reader' && chapters[currentChapterIdx] && (
              <motion.div
                key="reader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col bg-[var(--surf)]"
              >
                <div className="p-[12px_16px_10px] flex items-center justify-between border-b border-[var(--surf3)] bg-[var(--surf)] z-10">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setScreen('toc')} className="flex items-center gap-1.5 text-[var(--txt2)] text-[12px] font-sans hover:text-[var(--gold)] transition-colors">
                      <Menu size={15} />
                      Contents
                    </button>
                    <button onClick={() => setScreen('cover')} className="flex items-center gap-1.5 text-[var(--txt2)] text-[12px] font-sans hover:text-[var(--gold)] transition-colors">
                      <Home size={15} />
                      Home
                    </button>
                  </div>
                  <div className="text-[12px] text-[var(--txt3)] font-sans italic hidden sm:block">{chapters[currentChapterIdx].label}</div>
                  <button className="w-[30px] h-[30px] border border-[var(--surf3)] rounded-md flex items-center justify-center text-[var(--txt2)] hover:bg-[var(--surf2)] transition-colors">
                    <Type size={14} />
                  </button>
                </div>
                
                <div 
                  ref={readerRef}
                  className="flex-1 overflow-y-auto bg-[var(--page)] p-[28px_22px_32px] reader-scroll"
                >
                  <div className="chapter-eyebrow text-[10px] tracking-[0.14em] uppercase text-[var(--ptxt2)] mb-1.5 font-sans">
                    {chapters[currentChapterIdx].label}
                  </div>
                  <h2 className="chapter-heading font-serif-display text-[21px] text-[var(--ptxt)] mb-[22px] leading-[1.35]">
                    {chapters[currentChapterIdx].title}
                  </h2>
                  <div className="markdown-body font-serif-body text-[16px] leading-[1.9] text-[var(--ptxt)] text-justify">
                    <ReactMarkdown>
                      {chapters[currentChapterIdx].content}
                    </ReactMarkdown>
                  </div>
                  
                  <div className="tbc-block mt-8 pt-6 border-t border-[#d0c8b8] text-center">
                    <div className="tbc-ornament text-[20px] text-[#b0a890] tracking-[0.3em] mb-3">* * *</div>
                    <div className="tbc-text font-serif-display text-[17px] text-[var(--ptxt2)] italic">To be continued...</div>
                    <div className="tbc-sub text-[12px] text-[#a09888] mt-1.5 font-sans">New chapter coming next week</div>
                  </div>
                </div>

                <div className="p-[10px_16px_14px] bg-[var(--surf)] flex flex-col gap-3 border-t border-[var(--surf3)] shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 h-[2px] bg-[var(--surf3)] rounded-full">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentChapterIdx + 1) / chapters.length) * 100}%` }}
                        className="h-full bg-[var(--gold)] rounded-full" 
                      />
                    </div>
                    <div className="text-[11px] text-[var(--txt3)] font-sans min-w-[48px] text-right">
                      {currentChapterIdx + 1} / {chapters.length}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <button 
                      onClick={() => openChapter(currentChapterIdx - 1)}
                      disabled={currentChapterIdx === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-md border border-[var(--surf3)] text-[12px] text-[var(--txt2)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--surf2)] transition-colors"
                    >
                      <ChevronLeft size={14} />
                      Previous
                    </button>
                    <button 
                      onClick={() => openChapter(currentChapterIdx + 1)}
                      disabled={currentChapterIdx === chapters.length - 1}
                      className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-md bg-[var(--gold2)] text-[var(--gold)] text-[12px] font-serif-display disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#a07040] transition-colors"
                    >
                      Next
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
