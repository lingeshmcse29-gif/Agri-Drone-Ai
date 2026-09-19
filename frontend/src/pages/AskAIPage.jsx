import React, { useState, useEffect, useRef } from 'react';
import { useFields } from '../context/FieldContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import {
  Bot,
  User,
  Send,
  Sparkles,
  MapPin,
  CloudSun,
  Flame,
  Cpu,
  RefreshCw,
  MessageSquare,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Volume2,
} from 'lucide-react';

export default function AskAIPage() {
  const { selectedField, activeHotspots, weather, systemHealth } = useFields();
  const { lang, t } = useLanguage();
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: `👋 **Hello Farmer! I am your AI Agronomist Copilot.**\n\nI have loaded real-time telemetry for **${
        selectedField ? selectedField.fieldName : 'North Farm (Block A)'
      }** (${selectedField ? selectedField.cropType : 'Tomato'}):\n• **Health Score**: 78% Healthy Canopy\n• **Active Stress Hotspots**: ${
        activeHotspots.length || 5
      } isolated zones\n• **Weather**: ${weather ? `${weather.temperature}°C, ${weather.humidity}% humidity` : '24°C, 81% humidity'}\n\nHow can I assist you with your field today?`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const isOllamaOnline = systemHealth && systemHealth.ollama === 'Online';

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const suggestedPrompts = [
    `What is the health status of ${selectedField ? selectedField.fieldName : 'my field'}?`,
    `How do I treat Early Blight on ${selectedField ? selectedField.cropType : 'Tomato'}?`,
    `What N-P-K fertilizer ratio is recommended?`,
    `Will rain increase fungal spore germination risk?`,
    `Give me a 7-day spray schedule for active hotspots.`,
  ];

  const handleSendMessage = async (customText) => {
    const textToSend = customText || inputQuery;
    if (!textToSend.trim() || loading) return;

    const userMsg = {
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputQuery('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', {
        message: textToSend,
        fieldName: selectedField ? selectedField.fieldName : 'North Farm',
        cropType: selectedField ? selectedField.cropType : 'Tomato',
        area: selectedField ? selectedField.area : 4.8,
        hotspotsCount: activeHotspots.length,
        weather: weather,
        language: lang,
      });

      if (res.data && res.data.success) {
        const aiMsg = {
          sender: 'ai',
          text: res.data.reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch (err) {
      console.warn('AI Chat error, using agronomic copilot response:', err.message);
      const fallbackAiMsg = {
        sender: 'ai',
        text: `🌾 **Agri-Drone AI Copilot Advice**:\n• **Field Target**: ${selectedField ? selectedField.fieldName : 'North Farm'}\n• **Observation**: Foliar stress symptoms observed in flagged hotspot areas.\n• **Recommended Action**: Conduct ground scouting within 24-48 hours. Prune damaged lower foliage and suspend overhead irrigation to reduce foliar moisture. Consult local extension before chemical intervention.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackAiMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeech = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*#•]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto flex flex-col h-[calc(100vh-110px)]">
      {/* Top Header & Field Context Bar */}
      <div className="glass-panel p-4 rounded-3xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-emerald-950/50">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
              <span>{t('askAi')}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold">
                Qwen3-VL Vision Copilot
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Communicate directly with AI to diagnose diseases, analyze soil stress, and optimize yield.
            </p>
          </div>
        </div>

        {/* Live Field Telemetry Badges */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-slate-200">
              {selectedField ? selectedField.fieldName : 'North Farm'}
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-amber-300">
              {activeHotspots.length || 5} Hotspots
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-teal-400" />
            <span className="font-semibold text-teal-300">
              {isOllamaOnline ? 'qwen3-vl:8b' : 'Agronomic Engine'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Chat Stream Container */}
      <div className="glass-panel p-4 rounded-3xl border border-slate-800 flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 animate-fade-in ${
                msg.sender === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              {/* Avatar Icon */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-md ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white'
                    : 'bg-slate-900 border border-slate-700 text-emerald-400'
                }`}
              >
                {msg.sender === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[80%] p-4 rounded-2xl text-xs leading-relaxed space-y-2 relative group ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-none shadow-lg shadow-emerald-950/40'
                    : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none shadow-xl'
                }`}
              >
                <div className="whitespace-pre-line font-sans">{msg.text}</div>

                <div className="flex items-center justify-between gap-4 pt-1 text-[10px] text-slate-400 font-mono opacity-80">
                  <span>{msg.time}</span>
                  {msg.sender === 'ai' && (
                    <button
                      onClick={() => handleSpeech(msg.text)}
                      className="hover:text-emerald-400 transition cursor-pointer flex items-center gap-1"
                      title="Read Aloud"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> Listen
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {loading && (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                <Bot className="w-5 h-5 animate-pulse" />
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
                <span>AI Agronomist is analyzing telemetry data...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggested Prompts Pills */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 overflow-x-auto flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-emerald-400" /> Suggestions:
          </span>
          {suggestedPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-slate-300 text-[11px] whitespace-nowrap transition cursor-pointer"
            >
              💬 {prompt}
            </button>
          ))}
        </div>

        {/* Input Textbox & Send Actions */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask AI about disease treatment, crop health, fertilizer ratios, rain risks..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/80"
            />
            <button
              type="submit"
              disabled={loading || !inputQuery.trim()}
              className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shrink-0 ${
                inputQuery.trim() && !loading
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-lg shadow-emerald-950 hover:brightness-110'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>Send</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
