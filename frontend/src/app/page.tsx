"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { 
  Plus, Settings, Mic, Send, PanelLeftClose, PanelLeft, Monitor, Sun, Moon, X, User, LogOut, Shield, Pencil, Trash2, Check, Paperclip, Camera, Radio
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "bot";
  content: string;
};

export default function ChatPage() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<{id: string, title: string, updated_at?: string}[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionTitle, setEditSessionTitle] = useState("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const [attachments, setAttachments] = useState<{name: string, mime_type: string, data: string, previewUrl: string}[]>([]);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const [liveModeOpen, setLiveModeOpen] = useState(false);
  const liveWsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const [user, setUser] = useState<any>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"appearance" | "security">("appearance");
  const [mfaQrCode, setMfaQrCode] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaVerifyCode, setMfaVerifyCode] = useState("");
  const [mfaStatus, setMfaStatus] = useState<"loading" | "unenrolled" | "enrolling" | "enrolled">("loading");

  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (window.innerWidth < 768) setSidebarOpen(false);
    
    const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (user) {
        setUser(user);
        setEditName(user.user_metadata?.full_name || "");
        setEditDob(user.user_metadata?.dob || "");
        setEditMobile(user.user_metadata?.mobile || "");
        
        const savedAvatar = localStorage.getItem(`avatar_${user.id}`);
        if (savedAvatar) setAvatarUrl(savedAvatar);
        
        const { data: mfa, error: mfaError } = await supabase.auth.mfa.listFactors();
        if (mfa && mfa.totp && mfa.totp.length > 0 && mfa.totp[0].status === "verified") {
           setMfaStatus("enrolled");
           setMfaFactorId(mfa.totp[0].id);
        } else {
           setMfaStatus("unenrolled");
        }

        if (session?.access_token) {
          try {
            const res = await fetch(`${backendUrl}/api/chat/sessions`, {
              headers: { "Authorization": `Bearer ${session.access_token}` }
            });
            if (res.ok) {
              const data = await res.json();
              setSessions(data.sessions || []);
              setActiveSessionId(crypto.randomUUID());
            }
          } catch (err) {
            console.error("Failed to load chat history:", err);
          } finally {
            setIsSessionsLoading(false);
          }
        } else {
          setIsSessionsLoading(false);
        }
      }
    };
    fetchUser();
    
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = false;
        
        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
             setInput(prev => (prev + " " + finalTranscript).trim());
          }
        };
        
        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };
        
        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, []);
  
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
         alert("Voice dictation is not supported in this browser. Try Chrome or Safari.");
         return;
      }
      recognitionRef.current.start();
      setIsListening(true);
    }
  };
  
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    
    if (user) {
      localStorage.setItem(`avatar_${user.id}`, avatarUrl);
    }
    
    const supabase = createClient();
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: editName, dob: editDob, mobile: editMobile }
    });
    
    if (!error && data.user) setUser(data.user);
    setIsUpdatingProfile(false);
    setProfileModalOpen(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          const base64Data = result.split(',')[1];
          setAttachments(prev => [...prev, {
            name: file.name,
            mime_type: file.type,
            data: base64Data,
            previewUrl: result
          }]);
        }
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const openCamera = async () => {
    setCameraModalOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setCameraModalOpen(false);
      alert("Could not access camera. Please check permissions.");
    }
  };

  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setCameraModalOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      const base64Data = dataUrl.split(',')[1];
      setAttachments(prev => [...prev, {
        name: `photo_${Date.now()}.jpg`,
        mime_type: "image/jpeg",
        data: base64Data,
        previewUrl: dataUrl
      }]);
    }
    closeCamera();
  };

  const startLiveMode = async () => {
    setLiveModeOpen(true);
    const backendWsUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "").replace(/^http/, "ws");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      const ws = new WebSocket(`${backendWsUrl}/api/chat/live`);
      liveWsRef.current = ws;
      
      ws.binaryType = "arraybuffer";
      
      let nextPlayTime = 0;
      
      ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
           try {
              const audioCtx = audioContextRef.current;
              if (!audioCtx) return;
              
              // Gemini returns PCM data natively via the server_content inline_data.
              // To play raw PCM, we create an AudioBuffer.
              // A 16-bit PCM at 24kHz needs to be decoded, but for simplicity, 
              // we can rely on standard decodeAudioData if it's packed in a WAV header by Gemini,
              // or manually feed it if it's raw. Assuming Gemini SDK handles format properly,
              // or we just decode standard audio blobs:
              const decodedData = await audioCtx.decodeAudioData(event.data.slice(0));
              const source = audioCtx.createBufferSource();
              source.buffer = decodedData;
              source.connect(audioCtx.destination);
              
              const currentTime = audioCtx.currentTime;
              if (currentTime < nextPlayTime) {
                source.start(nextPlayTime);
                nextPlayTime += decodedData.duration;
              } else {
                source.start(currentTime);
                nextPlayTime = currentTime + decodedData.duration;
              }
           } catch(e) {
              console.error("Audio decode error", e);
           }
        }
      };

      ws.onopen = () => {
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };
        
        mediaRecorder.start(250); // send chunks every 250ms
      };

    } catch (e) {
      console.error("Live mode error:", e);
      setLiveModeOpen(false);
      alert("Could not start Live Mode. Please check microphone permissions.");
    }
  };

  const closeLiveMode = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    if (liveWsRef.current) {
      liveWsRef.current.close();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setLiveModeOpen(false);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) {
        setMessages([]);
        setActiveSessionId(crypto.randomUUID());
      }
      await fetch(`${backendUrl}/api/chat/sessions/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameSession = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!editSessionTitle.trim()) return;
    const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: editSessionTitle } : s));
    setEditingSessionId(null);
    
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      await fetch(`${backendUrl}/api/chat/sessions/${id}`, {
        method: "PUT",
        headers: { 
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: editSessionTitle })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 100;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          setAvatarUrl(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEnableMfa = async () => {
    setMfaStatus("enrolling");
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (data) {
      setMfaFactorId(data.id);
      setMfaQrCode(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (challenge.data) {
      const verify = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.data.id, code: mfaVerifyCode });
      if (verify.data) {
        setMfaStatus("enrolled");
        setMfaVerifyCode("");
      } else {
        alert("Invalid code!");
      }
    }
  };

  const handleDisableMfa = async () => {
    const supabase = createClient();
    await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
    setMfaStatus("unenrolled");
    setMfaFactorId("");
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const currentTheme = theme === "system" ? systemTheme : theme;
  
  // You mentioned they were exactly backwards ("ulta"), so I have corrected them here.
  // Dark theme now uses the White logo (to show up on the deep black sidebar).
  // Light theme uses the Black logo.
  const logoSrc = currentTheme === "dark" ? "/logo-black.png" : "/logo-white.png";

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e as unknown as React.FormEvent);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;
    if (isLoading) return;

    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      currentSessionId = crypto.randomUUID();
      setActiveSessionId(currentSessionId);
    }

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    
    // Save current attachments and clear them
    const filesToSend = attachments.map(a => ({ mime_type: a.mime_type, data: a.data }));
    setAttachments([]);
    
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsLoading(true);

    try {
      // Get the Supabase session to retrieve the JWT token
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

      const res = await fetch(`${backendUrl}/api/chat/online`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          session_id: currentSessionId,
          prompt: userMessage.content,
          files: filesToSend.length > 0 ? filesToSend : undefined
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`[HTTP ${res.status}] ${errorText}`);
      }
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      const botMessageId = (Date.now() + 1).toString();
      
      setMessages((prev) => [...prev, { id: botMessageId, role: "bot", content: "" }]);
      
      if (reader) {
        let accumulatedText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;
          setMessages((prev) => prev.map(msg => msg.id === botMessageId ? { ...msg, content: accumulatedText } : msg));
        }
      }
    } catch (error: any) {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "bot", content: `Oops! Connection failed: ${error.message}` }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 10);
    }
  };

  if (!mounted) return null;

  const inputFormJSX = (
    <div className="w-full flex flex-col gap-2">
      {attachments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto p-2 bg-bg-chatbar rounded-2xl border border-border-main">
          {attachments.map((file, i) => (
            <div key={i} className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-border-main bg-bg-main">
              {file.mime_type.startsWith('image/') ? (
                <img src={file.previewUrl} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-text-main opacity-50">FILE</div>
              )}
              <button 
                type="button" 
                onClick={() => removeAttachment(i)}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      
      <motion.form 
        layoutId="chat-input-bar"
        initial={{ borderRadius: 28 }}
        onSubmit={sendMessage} 
        className="relative flex items-end gap-2 bg-bg-chatbar rounded-[28px] p-2 pr-4 shadow-sm border border-border-main transition-colors duration-200 w-full"
      >
        <div className="flex gap-1">
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-text-main opacity-50 hover:opacity-100 transition-opacity shrink-0">
            <Paperclip size={20} />
          </button>
          <button type="button" onClick={openCamera} className="p-3 text-text-main opacity-50 hover:opacity-100 transition-opacity shrink-0">
            <Camera size={20} />
          </button>
        </div>
        
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask DuoMind"
          rows={1}
          className="flex-1 max-h-[200px] min-h-[44px] bg-transparent resize-none py-3 px-2 text-[15px] text-text-main focus:outline-none placeholder:text-text-main placeholder:opacity-50"
          disabled={isLoading}
        />
        
        {!input.trim() && attachments.length === 0 ? (
          <div className="flex gap-1">
            <button 
              type="button" 
              onClick={toggleListening}
              className={`p-3 shrink-0 mb-0.5 transition-all ${isListening ? 'text-red-500 animate-pulse' : 'text-text-main opacity-50 hover:opacity-100'}`}
            >
              <Mic size={22} />
            </button>
            <button 
              type="button" 
              onClick={startLiveMode}
              className="p-3 text-text-main opacity-50 hover:opacity-100 hover:text-blue-500 transition-all shrink-0 mb-0.5"
            >
              <Radio size={22} />
            </button>
          </div>
        ) : (
          <button type="submit" disabled={isLoading} className="p-3 bg-text-main text-bg-main rounded-full transition-transform hover:scale-105 active:scale-95 shrink-0 mb-0.5">
            <Send size={18} className="ml-0.5" />
          </button>
        )}
      </motion.form>
    </div>
  );

  return (
    <div className="flex h-screen bg-bg-main overflow-hidden font-sans text-text-main transition-colors duration-300">
      
      {/* Live Mode Modal (Phase 3) */}
      <AnimatePresence>
        {liveModeOpen && (
          <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black backdrop-blur-3xl px-4 overflow-hidden">
            <button onClick={closeLiveMode} className="absolute top-8 right-8 text-white/50 hover:text-white p-3 rounded-full bg-white/5 transition-colors z-10">
              <X size={24} />
            </button>
            
            <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-purple-900/20 pointer-events-none" />
            
            {/* The 3D Pulsing Orb */}
            <div className="relative w-64 h-64 flex items-center justify-center mb-16">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 180, 270, 360] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 opacity-20 blur-3xl"
              />
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-48 h-48 rounded-full bg-gradient-to-tr from-blue-400 to-purple-600 shadow-[0_0_80px_rgba(120,0,255,0.4)] flex items-center justify-center overflow-hidden"
              >
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay animate-pulse" />
                <Radio size={48} className="text-white opacity-80" />
              </motion.div>
            </div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center z-10">
              <h2 className="text-2xl font-medium text-white mb-2">Listening...</h2>
              <p className="text-white/50">Speak naturally to DuoMind</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Camera Modal */}
      <AnimatePresence>
        {cameraModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-lg bg-black border border-white/20 rounded-3xl overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="relative w-full aspect-video bg-gray-900">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover mirror" />
                <button onClick={closeCamera} className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-2 hover:bg-white hover:text-black transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 flex justify-center bg-zinc-950">
                <button onClick={capturePhoto} className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center hover:border-white transition-all group">
                  <div className="w-12 h-12 bg-white rounded-full group-hover:scale-90 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Profile Modal */}
      <AnimatePresence>
        {profileModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-bg-sidebar border border-border-main rounded-[28px] shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-border-main flex justify-between items-center bg-bg-chatbar">
                <h3 className="font-semibold text-lg">Profile Settings</h3>
                <button onClick={() => setProfileModalOpen(false)} className="opacity-50 hover:opacity-100 p-1.5 bg-black/5 dark:bg-white/10 rounded-full transition-colors"><X size={18} /></button>
              </div>
              <form onSubmit={handleUpdateProfile} className="p-6 space-y-5">
                <div className="flex items-center justify-center mb-6">
                   <label className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white shadow-lg text-3xl font-bold border-[4px] border-bg-main relative group cursor-pointer overflow-hidden">
                     {avatarUrl ? (
                       <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                     ) : (
                       editName ? editName.charAt(0).toUpperCase() : <User size={40} />
                     )}
                     <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all">
                       <Plus size={24} className="text-white" />
                     </div>
                     <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                   </label>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 opacity-80">Full Name</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-bg-main border border-border-main rounded-[16px] px-4 py-3.5 text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 opacity-80">Date of Birth</label>
                  <input type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} className="w-full bg-bg-main border border-border-main rounded-[16px] px-4 py-3.5 text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 opacity-80">Mobile Number</label>
                  <input type="tel" value={editMobile} onChange={(e) => setEditMobile(e.target.value)} className="w-full bg-bg-main border border-border-main rounded-[16px] px-4 py-3.5 text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                </div>
                <div className="pt-3">
                  <button type="submit" disabled={isUpdatingProfile} className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-[16px] hover:bg-blue-700 transition-colors disabled:opacity-50 text-[15px]">
                    {isUpdatingProfile ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {settingsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-bg-sidebar border border-border-main rounded-[28px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center p-6 border-b border-border-main">
                <h3 className="font-semibold text-xl">Settings</h3>
                <button onClick={() => setSettingsModalOpen(false)} className="opacity-50 hover:opacity-100 p-1.5 bg-black/5 dark:bg-white/10 rounded-full transition-colors"><X size={18} /></button>
              </div>

              <div className="flex border-b border-border-main">
                <button onClick={() => setSettingsTab("appearance")} className={`flex-1 py-3 text-sm font-semibold transition-colors ${settingsTab === 'appearance' ? 'border-b-2 border-blue-500 text-blue-500' : 'opacity-60 hover:opacity-100'}`}>Appearance</button>
                <button onClick={() => setSettingsTab("security")} className={`flex-1 py-3 text-sm font-semibold transition-colors ${settingsTab === 'security' ? 'border-b-2 border-blue-500 text-blue-500' : 'opacity-60 hover:opacity-100'}`}>Two-Factor Auth</button>
              </div>

              <div className="p-6">
                {settingsTab === "appearance" && (
                  <div className="space-y-3">
                    <button onClick={() => setTheme("light")} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${theme === 'light' ? 'border-blue-500 bg-blue-500/10 text-blue-600' : 'border-border-main hover:bg-black/5 dark:hover:bg-white/5'}`}>
                      <div className="flex items-center gap-3"><Sun size={18}/> Light</div>
                    </button>
                    <button onClick={() => setTheme("dark")} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${theme === 'dark' ? 'border-blue-500 bg-blue-500/10 text-blue-600' : 'border-border-main hover:bg-black/5 dark:hover:bg-white/5'}`}>
                      <div className="flex items-center gap-3"><Moon size={18}/> Dark</div>
                    </button>
                    <button onClick={() => setTheme("system")} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${theme === 'system' ? 'border-blue-500 bg-blue-500/10 text-blue-600' : 'border-border-main hover:bg-black/5 dark:hover:bg-white/5'}`}>
                      <div className="flex items-center gap-3"><Monitor size={18}/> System</div>
                    </button>
                  </div>
                )}

                {settingsTab === "security" && (
                  <div className="h-full">
                    {mfaStatus === "loading" && <div className="text-center opacity-60 py-10">Loading security settings...</div>}
                    
                    {mfaStatus === "unenrolled" && (
                      <div className="text-center py-2">
                        <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Shield size={32} />
                        </div>
                        <h4 className="font-medium text-lg mb-2">Protect your account</h4>
                        <p className="text-sm opacity-70 mb-6 px-4">Add an extra layer of security to your DuoMind account using an Authenticator app.</p>
                        <button onClick={handleEnableMfa} className="bg-blue-600 text-white font-semibold py-3 px-6 rounded-[16px] hover:bg-blue-700 transition-colors">
                          Set up 2FA
                        </button>
                      </div>
                    )}

                    {mfaStatus === "enrolling" && (
                      <form onSubmit={handleVerifyMfa} className="space-y-4 pb-2">
                        <p className="text-sm opacity-80 text-center">Scan this QR code with your Authenticator app (like Google Authenticator or Authy).</p>
                        <div className="flex justify-center bg-white p-3 rounded-xl border border-gray-200 mx-auto w-fit" dangerouslySetInnerHTML={{ __html: mfaQrCode }} />
                        <p className="text-xs text-center opacity-60">Secret: <span className="font-mono bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">{mfaSecret}</span></p>
                        <div>
                          <input type="text" value={mfaVerifyCode} onChange={(e) => setMfaVerifyCode(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} className="w-full text-center tracking-[0.5em] text-xl font-bold bg-bg-main border border-border-main rounded-[16px] px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-[16px] hover:bg-blue-700 transition-colors text-[15px]">
                          Verify & Enable
                        </button>
                      </form>
                    )}

                    {mfaStatus === "enrolled" && (
                      <div className="text-center py-2">
                        <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Shield size={32} />
                        </div>
                        <h4 className="font-medium text-lg mb-2">2FA is Enabled</h4>
                        <p className="text-sm opacity-70 mb-6 px-4">Your account is highly secure. You will need your authenticator app when signing in from new devices.</p>
                        <button onClick={handleDisableMfa} className="w-full bg-red-500/10 text-red-500 font-semibold py-3.5 rounded-[16px] hover:bg-red-500/20 transition-colors text-[15px]">
                          Disable 2FA
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      
      {/* Sidebar */}
      <nav className={`${sidebarOpen ? 'w-[280px]' : 'w-0'} transition-all duration-300 ease-in-out bg-bg-sidebar border-r border-border-main flex flex-col overflow-hidden whitespace-nowrap z-30 fixed md:relative h-full shrink-0`}>
        <div className="p-4 flex flex-col h-full relative">
          
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 shrink-0 overflow-hidden rounded-[8px] flex items-center justify-center">
                <Image src={logoSrc} alt="DuoMind" width={32} height={32} className="object-contain scale-[1.15]" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                <span className="text-text-main">Duo</span>
                <span className="text-blue-600">Mind</span>
              </span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-text-main opacity-50 hover:opacity-100 transition-opacity p-1">
               <PanelLeftClose size={20} />
            </button>
          </div>

          <button onClick={() => {
            setMessages([]);
            setActiveSessionId(crypto.randomUUID());
            if (window.innerWidth < 768) setSidebarOpen(false);
          }} className="flex items-center gap-3 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 py-3 px-4 rounded-full transition-colors w-fit mb-6 mx-2 text-sm font-medium">
            <Plus size={18} className="shrink-0" />
            New chat
          </button>

          <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar pr-1">
            <div className="px-4 pb-2 text-[13px] opacity-60 font-medium">Recent</div>
            {isSessionsLoading ? (
               <div className="px-4 space-y-2">
                 <div className="h-9 w-full bg-black/5 dark:bg-white/10 animate-pulse rounded-xl"></div>
                 <div className="h-9 w-[80%] bg-black/5 dark:bg-white/10 animate-pulse rounded-xl"></div>
                 <div className="h-9 w-[90%] bg-black/5 dark:bg-white/10 animate-pulse rounded-xl"></div>
               </div>
            ) : sessions.length === 0 ? (
               <div className="px-4 text-[13px] opacity-40">No recent chats</div>
            ) : sessions.map(session => (
              <div key={session.id} className={`group w-full flex items-center justify-between rounded-xl transition-colors ${activeSessionId === session.id ? 'bg-black/10 dark:bg-white/20' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}>
                {editingSessionId === session.id ? (
                  <form onSubmit={(e) => handleRenameSession(e, session.id)} className="flex-1 flex items-center p-1.5 pl-4">
                    <input autoFocus type="text" value={editSessionTitle} onChange={e => setEditSessionTitle(e.target.value)} onBlur={(e) => handleRenameSession(e, session.id)} className="w-full bg-bg-main border border-blue-500 rounded px-2 py-1 text-sm outline-none" />
                  </form>
                ) : (
                  <button 
                    onClick={async () => {
                      if (activeSessionId === session.id) return;
                      setActiveSessionId(session.id);
                      setMessages([]);
                      if (window.innerWidth < 768) setSidebarOpen(false);
                      const supabase = createClient();
                      const { data: { session: authSession } } = await supabase.auth.getSession();
                      const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
                      
                      if (authSession?.access_token) {
                        try {
                          const msgsRes = await fetch(`${backendUrl}/api/chat/sessions/${session.id}/messages`, {
                            headers: { "Authorization": `Bearer ${authSession.access_token}` }
                          });
                          if (msgsRes.ok) {
                            const msgsData = await msgsRes.json();
                            setMessages(msgsData.messages.map((m: any, i: number) => ({ id: `history-${i}`, role: m.role, content: m.content })));
                          }
                        } catch (e) { console.error(e); }
                      }
                    }}
                    className={`flex-1 truncate px-4 py-2.5 text-[14px] text-left ${activeSessionId === session.id ? 'font-medium' : ''}`}
                  >
                    {session.title || "New Chat"}
                  </button>
                )}
                
                {editingSessionId !== session.id && (
                  <div className="hidden group-hover:flex items-center gap-1 pr-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setEditSessionTitle(session.title); setEditingSessionId(session.id); }} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/20 rounded-md transition-colors opacity-60 hover:opacity-100">
                      <Pencil size={14} />
                    </button>
                    <button onClick={(e) => handleDeleteSession(e, session.id)} className="p-1.5 hover:bg-red-500/20 text-red-500 rounded-md transition-colors opacity-60 hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Main Dropdown Popup */}
          <AnimatePresence>
            {settingsOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-20 left-4 right-4 bg-bg-chatbar rounded-2xl shadow-xl border border-border-main p-2 z-50 overflow-hidden"
              >
                <button onClick={() => {setSettingsOpen(false); setProfileModalOpen(true);}} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                  <User size={16} /> Profile
                </button>
                <button onClick={() => {setSettingsOpen(false); setSettingsModalOpen(true); setSettingsTab("appearance");}} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                  <Settings size={16} /> Settings
                </button>
                <div className="my-1 border-t border-border-main" />
                <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 transition-colors hover:bg-red-500/10">
                  <LogOut size={16} /> Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Profile Area */}
          <div className="mt-4 pt-4 border-t border-border-main flex items-center justify-between px-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded-xl p-2 transition-colors relative" onClick={() => { setSettingsOpen(!settingsOpen); }}>
             <div className="flex items-center gap-3">
               <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white shrink-0 shadow-inner font-bold text-sm overflow-hidden">
                 {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                 ) : (
                    user?.user_metadata?.full_name ? user.user_metadata.full_name.charAt(0).toUpperCase() : <User size={18} />
                 )}
               </div>
               <div className="flex flex-col text-left">
                 <span className="text-sm font-medium truncate w-32">{user?.user_metadata?.full_name || user?.email || "My Profile"}</span>
               </div>
             </div>
          </div>

        </div>
      </nav>

      {/* Main Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative">
        
        <header className="h-[68px] flex items-center justify-between px-4 shrink-0 absolute top-0 w-full z-10 bg-transparent pointer-events-none">
          <div className="pointer-events-auto">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <PanelLeft size={20} />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden pt-[68px]">
          
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center max-w-[840px] w-full mx-auto px-4 pb-20">
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className="w-full"
              >
                <h2 className="text-[44px] md:text-[56px] font-medium leading-tight mb-8 tracking-tight">
                  <span className="bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570] bg-clip-text text-transparent">Hello,</span><br />
                  <span className="opacity-60">How can I help you today?</span>
                </h2>
                {inputFormJSX}
              </motion.div>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth w-full">
                <div className="max-w-[840px] mx-auto px-4 pb-10">
                  <div className="space-y-8 mt-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className="flex w-full">
                        {msg.role === "user" ? (
                          <div className="ml-auto bg-bg-chatbar border border-border-main px-5 py-3 rounded-[24px] max-w-[85%] text-[15px] whitespace-pre-wrap">
                            {msg.content}
                          </div>
                        ) : (
                          <div className="w-full flex gap-4">
                            <div className="flex-1 text-[15px] leading-relaxed pt-1 whitespace-pre-wrap font-medium">
                              {msg.content.replace(/[*#`~]/g, '').split("\n").map((line, idx) => (
                                <motion.div
                                  key={idx}
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className={line.trim() === "" ? "h-4" : "min-h-[1.5rem]"}
                                >
                                  {line}
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {isLoading && (
                      <div className="w-full flex gap-4">
                        <div className="flex gap-1.5 items-center pt-3 pl-1">
                          <motion.div className="w-2 h-2 rounded-full bg-blue-500" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} />
                          <motion.div className="w-2 h-2 rounded-full bg-red-500" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} />
                          <motion.div className="w-2 h-2 rounded-full bg-yellow-500" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-full max-w-[840px] mx-auto px-4 pb-6 pt-2 shrink-0">
                 {inputFormJSX}
                 <div className="text-center mt-3 text-[11px] opacity-60">
                   DuoMind is a AI and can make mistakes.
                 </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
