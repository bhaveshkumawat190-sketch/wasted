/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Type, Menu, LogIn, LogOut, Database, Home, Trash2, Edit, Plus, Save, X, Lock, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  getDoc,
  getDocs,
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';

type Screen = 'cover' | 'toc' | 'reader' | 'admin-login' | 'admin-dashboard';

interface Chapter {
  id: number;
  label: string;
  title: string;
  content: string;
  order: number;
  isNew?: boolean;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
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
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [loginError, setLoginError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [coverImage, setCoverImage] = useState<string>('/cover.png');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const readerRef = useRef<HTMLDivElement>(null);

  const ADMIN_EMAIL = "bhavesh.kumawat@myoperator.co";

  // Test connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAdmin(currentUser?.email === ADMIN_EMAIL && currentUser?.emailVerified === true);
      setIsAuthReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'chapters'), orderBy('order', 'asc'));
    const unsubscribeChapters = onSnapshot(q, (snapshot) => {
      const chaptersData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: parseInt(doc.id)
      })) as Chapter[];
      setChapters(chaptersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chapters');
    });

    const unsubscribeMetadata = onSnapshot(doc(db, 'metadata', 'app_state'), (docSnap) => {
      if (docSnap.exists()) {
        setCoverImage(docSnap.data().coverImage || '/cover.png');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'metadata/app_state');
    });

    return () => {
      unsubscribeChapters();
      unsubscribeMetadata();
    };
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

  const handleAdminLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setScreen('admin-dashboard');
    } catch (error: any) {
      setLoginError(error.message || 'Login failed');
    }
  };

  const handleAdminLogout = async () => {
    await signOut(auth);
    setScreen('cover');
  };

  const handleSaveChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChapter || !isAdmin) return;

    setSaveStatus('saving');
    try {
      const chapterDoc = doc(db, 'chapters', editingChapter.id.toString());
      await setDoc(chapterDoc, {
        label: editingChapter.label,
        title: editingChapter.title,
        content: editingChapter.content,
        order: editingChapter.order || editingChapter.id,
        id: editingChapter.id
      });
      setEditingChapter(null);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chapters/${editingChapter.id}`);
      setSaveStatus('error');
    }
  };

  const startEditing = (chapter: Chapter | null) => {
    if (chapter) {
      setEditingChapter({ ...chapter });
    } else {
      const nextOrder = chapters.length > 0 ? Math.max(...chapters.map(c => c.order)) + 1 : 1;
      setEditingChapter({
        id: Date.now(),
        label: `Chapter ${chapters.length + 1}`,
        title: '',
        content: '',
        order: nextOrder
      });
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isAdmin) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        setSaveStatus('saving');
        try {
          await setDoc(doc(db, 'metadata', 'app_state'), { coverImage: base64String }, { merge: true });
          setSaveStatus('success');
          setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'metadata/app_state');
          setSaveStatus('error');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const migrateData = async () => {
    if (!isAdmin) return;
    setSaveStatus('saving');
    try {
      const staticResponse = await fetch('/chapters.json');
      if (staticResponse.ok) {
        const data = await staticResponse.json();
        const batch = writeBatch(db);
        data.forEach((ch: any, index: number) => {
          const chDoc = doc(db, 'chapters', (ch.id || Date.now() + index).toString());
          batch.set(chDoc, {
            ...ch,
            id: ch.id || Date.now() + index,
            order: index
          });
        });
        await batch.commit();
        alert("Migration successful!");
      }
    } catch (error) {
      console.error("Migration failed:", error);
      alert("Migration failed");
    } finally {
      setSaveStatus('idle');
    }
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

                <button 
                  onClick={() => setScreen('admin-login')}
                  className="mt-8 text-[11px] text-[var(--txt3)] hover:text-[var(--gold)] transition-colors uppercase tracking-[0.1em]"
                >
                  Admin Login
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

            {screen === 'admin-login' && (
              <motion.div
                key="admin-login"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-[var(--surf)]"
              >
                <div className="w-full max-w-[320px]">
                  <div className="flex justify-center mb-6 text-[var(--gold)]">
                    <Lock size={40} />
                  </div>
                  <h2 className="font-serif-display text-[24px] text-[var(--txt)] text-center mb-8">Admin Access</h2>
                  
                  <div className="space-y-4">
                    <button 
                      onClick={handleAdminLogin}
                      className="w-full p-3.5 bg-white border border-gray-300 rounded-lg text-gray-700 font-sans text-[14px] flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                      Sign in with Google
                    </button>
                    
                    {loginError && (
                      <div className="text-red-500 text-[12px] text-center bg-red-500/10 py-2 rounded-md border border-red-500/20">
                        {loginError}
                      </div>
                    )}
                  </div>

                  <div className="mt-8 pt-6 border-t border-[var(--surf3)] flex flex-col gap-3">
                    <button 
                      onClick={() => setScreen('cover')}
                      className="w-full p-3 text-[var(--txt3)] text-[12px] hover:text-[var(--gold)] transition-colors"
                    >
                      Back to Home
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {screen === 'admin-dashboard' && isAdmin && (
              <motion.div
                key="admin-dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col bg-[var(--surf)]"
              >
                <div className="p-[18px_20px_12px] flex items-center justify-between border-b border-[var(--surf3)]">
                  <div className="flex items-center gap-3">
                    <h2 className="font-serif-display text-[18px] text-[var(--txt)]">Admin Dashboard</h2>
                    {saveStatus === 'success' && <span className="text-[10px] text-green-500 animate-pulse">Saved!</span>}
                    {saveStatus === 'error' && <span className="text-[10px] text-red-500">Error saving</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {chapters.length === 0 && (
                      <button 
                        onClick={migrateData}
                        className="text-[10px] text-[var(--gold)] border border-[var(--gold)] px-2 py-1 rounded hover:bg-[var(--gold)]/10"
                      >
                        Migrate Initial Data
                      </button>
                    )}
                    <button 
                      onClick={handleAdminLogout}
                      className="text-[12px] text-[var(--txt3)] hover:text-[var(--gold)] transition-colors flex items-center gap-1"
                    >
                      <LogOut size={14} /> Logout
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  {!editingChapter && (
                    <div className="mb-8 p-4 bg-[var(--surf2)] border border-[var(--surf3)] rounded-lg">
                      <h3 className="font-serif-display text-[15px] text-[var(--gold)] mb-3 flex items-center gap-2">
                        <Camera size={16} /> Cover Image
                      </h3>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-24 bg-[var(--surf3)] rounded overflow-hidden flex-shrink-0 border border-[var(--surf3)]">
                          <img src={coverImage} alt="Current Cover" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] uppercase text-[var(--txt3)] mb-2">Upload new cover</label>
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleCoverUpload}
                            className="text-[11px] text-[var(--txt2)] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[11px] file:bg-[var(--gold2)] file:text-[var(--gold)] hover:file:bg-[#a07040] transition-all cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {editingChapter ? (
                    <form onSubmit={handleSaveChapter} className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-serif-display text-[16px] text-[var(--gold)]">
                          {chapters.find(c => c.id === editingChapter.id) ? 'Edit Chapter' : 'Add New Chapter'}
                        </h3>
                        <button type="button" onClick={() => setEditingChapter(null)} className="text-[var(--txt3)]">
                          <X size={20} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] uppercase text-[var(--txt3)] mb-1">ID (Unique)</label>
                          <input 
                            type="number" 
                            value={editingChapter.id}
                            onChange={(e) => setEditingChapter({...editingChapter, id: parseInt(e.target.value)})}
                            className="w-full bg-[var(--surf2)] border border-[var(--surf3)] rounded p-2 text-[var(--txt)] text-[13px]"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-[var(--txt3)] mb-1">Order</label>
                          <input 
                            type="number" 
                            value={editingChapter.order}
                            onChange={(e) => setEditingChapter({...editingChapter, order: parseInt(e.target.value)})}
                            className="w-full bg-[var(--surf2)] border border-[var(--surf3)] rounded p-2 text-[var(--txt)] text-[13px]"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-[var(--txt3)] mb-1">Label</label>
                          <input 
                            type="text" 
                            value={editingChapter.label}
                            onChange={(e) => setEditingChapter({...editingChapter, label: e.target.value})}
                            className="w-full bg-[var(--surf2)] border border-[var(--surf3)] rounded p-2 text-[var(--txt)] text-[13px]"
                            placeholder="Chapter 1"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase text-[var(--txt3)] mb-1">Title</label>
                        <input 
                          type="text" 
                          value={editingChapter.title}
                          onChange={(e) => setEditingChapter({...editingChapter, title: e.target.value})}
                          className="w-full bg-[var(--surf2)] border border-[var(--surf3)] rounded p-2 text-[var(--txt)] text-[13px]"
                          placeholder="Chapter Title"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase text-[var(--txt3)] mb-1">Content (Markdown)</label>
                        <textarea 
                          value={editingChapter.content}
                          onChange={(e) => setEditingChapter({...editingChapter, content: e.target.value})}
                          className="w-full bg-[var(--surf2)] border border-[var(--surf3)] rounded p-2 text-[var(--txt)] text-[13px] h-[200px] resize-none font-mono"
                          placeholder="Write your story here..."
                          required
                        />
                      </div>

                      <button 
                        type="submit"
                        className="w-full p-3 bg-[var(--gold2)] rounded-lg text-[var(--gold)] font-serif-display text-[14px] flex items-center justify-center gap-2 hover:bg-[#a07040] transition-colors"
                      >
                        <Save size={16} /> Save Chapter
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      <button 
                        onClick={() => startEditing(null)}
                        className="w-full p-3 border border-dashed border-[var(--gold2)] rounded-lg text-[var(--gold)] text-[13px] flex items-center justify-center gap-2 hover:bg-[var(--gold2)]/10 transition-colors mb-4"
                      >
                        <Plus size={16} /> Add New Chapter
                      </button>

                      {chapters.map((ch) => (
                        <div key={ch.id} className="p-3 bg-[var(--surf2)] border border-[var(--surf3)] rounded-lg flex items-center justify-between">
                          <div>
                            <div className="text-[10px] text-[var(--txt3)] uppercase tracking-wider">{ch.label}</div>
                            <div className="text-[14px] text-[var(--txt)] font-serif-display">{ch.title}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            {confirmDeleteId === ch.id ? (
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={async () => {
                                    if (!isAdmin) return;
                                    try {
                                      await deleteDoc(doc(db, 'chapters', ch.id.toString()));
                                      setConfirmDeleteId(null);
                                    } catch (error) {
                                      handleFirestoreError(error, OperationType.DELETE, `chapters/${ch.id}`);
                                    }
                                  }}
                                  className="text-[10px] bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors"
                                >
                                  Confirm
                                </button>
                                <button 
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-[10px] bg-[var(--surf3)] text-[var(--txt2)] px-2 py-1 rounded hover:bg-[var(--surf2)] transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <button 
                                  onClick={() => startEditing(ch)}
                                  className="p-2 text-[var(--txt3)] hover:text-[var(--gold)] transition-colors"
                                  title="Edit"
                                >
                                  <Edit size={16} />
                                </button>
                                <button 
                                  onClick={() => setConfirmDeleteId(ch.id)}
                                  className="p-2 text-[var(--txt3)] hover:text-red-500 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
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
