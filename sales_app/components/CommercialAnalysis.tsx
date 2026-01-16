
import React, { useState, useEffect, useCallback } from 'react';
import { RawSalesData } from '../types';
import { GoogleGenAI } from '@google/genai';
import { Search, Loader2, Compass, MapPin, Edit3, Target, Share2, Info, ShieldCheck, CloudOff } from 'lucide-react';

interface Props { data: RawSalesData[]; }

const MASTER_KV_ID = "1DqXTJZaMQxCAPNNauE-I6rwsuZWV066aNbHETonPewU".substring(0, 16);
const API_BASE = `https://kvdb.io/${MASTER_KV_ID}/`;
const getCommKey = (query: string) => `comm_v3_${query.trim()}`.replace(/\s/g, '_');

const CommercialAnalysis: React.FC<Props> = ({ data }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [radius, setRadius] = useState(2);
  const [loading, setLoading] = useState(false);
  const [consultationNotes, setConsultationNotes] = useState('');
  const [analysis, setAnalysis] = useState<{ summary: string, competitorCount: number, advantage: string, sources?: any[] } | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');

  const pullFromCloud = useCallback(async (query: string) => {
    if (!query) return;
    setSyncStatus('syncing');
    try {
      const response = await fetch(`${API_BASE}${getCommKey(query)}`);
      if (response.ok) {
        const cloudData = await response.json();
        setConsultationNotes(cloudData.notes || "");
        if (cloudData.analysis) setAnalysis(cloudData.analysis);
        setSyncStatus('saved');
      } else {
        setSyncStatus('idle');
      }
    } catch (e) {
      setSyncStatus('error');
    }
  }, []);

  const pushToCloud = useCallback(async (query: string, notes: string, currentAnalysis: any) => {
    if (!query) return;
    setSyncStatus('syncing');
    window.dispatchEvent(new CustomEvent('cloud-sync-start'));
    try {
      await fetch(`${API_BASE}${getCommKey(query)}`, {
        method: 'POST',
        body: JSON.stringify({ notes, analysis: currentAnalysis, updatedAt: Date.now() })
      });
      setSyncStatus('saved');
    } catch (e) {
      setSyncStatus('error');
    } finally {
      window.dispatchEvent(new CustomEvent('cloud-sync-end'));
    }
  }, []);

  useEffect(() => {
    if (searchQuery) pullFromCloud(searchQuery);
  }, [searchQuery, pullFromCloud]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery && syncStatus === 'syncing') {
        pushToCloud(searchQuery, consultationNotes, analysis);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [consultationNotes, searchQuery, pushToCloud]);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConsultationNotes(e.target.value);
    setSyncStatus('syncing');
  };

  const handleShare = async () => {
    if (!analysis) return;
    
    const shareMessage = `
[AI 상권 분석 리포트: ${searchQuery}]
📐 분석 범위: 반경 ${radius}km
📝 분석 요약: ${analysis.summary}
📊 추정 경쟁사: 약 ${analysis.competitorCount}개소
💡 현장 상담 의견: ${consultationNotes || '추가된 현장 의견 없음'}
    `.trim();

    if (navigator.share) {
      await navigator.share({ title: `상권 분석: ${searchQuery}`, text: shareMessage });
    } else {
      await navigator.clipboard.writeText(shareMessage);
      alert('상권 분석 리포트가 클립보드에 복사되었습니다.');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `"${searchQuery}" 지역 상권에 대해 반경 ${radius}km 범위로 치킨 프랜차이즈 '노랑통닭' 입점 타당성을 분석하세요. JSON 응답: { "summary": "3줄 요약", "competitorCount": "주변 치킨집 수(숫자)", "advantage": "핵심 경쟁력 한줄" }`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
      });
      
      const result = JSON.parse(response.text || "{}");
      setAnalysis(result);
      pushToCloud(searchQuery, consultationNotes, result);
    } catch (e) { alert("오류 발생"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="bg-slate-900 p-10 rounded-[40px] border border-slate-800 shadow-2xl relative">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6"><div className="bg-yellow-500 p-5 rounded-3xl shadow-lg shadow-yellow-500/20"><Compass size={32} className="text-slate-950" /></div><div><h3 className="text-2xl font-black text-white">AI 상권 정밀 분석</h3><p className="text-xs font-bold text-slate-500 uppercase mt-1">Google Search Grounding</p></div></div>
          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-center">
            <div className="flex items-center gap-4 bg-slate-800 px-6 py-4 rounded-2xl border border-slate-700 w-full sm:w-auto">
              <span className="text-xs font-black text-slate-500 whitespace-nowrap">반경 {radius}km</span>
              <input type="range" min="0.5" max="10" step="0.5" value={radius} onChange={(e) => setRadius(parseFloat(e.target.value))} className="w-32 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
            </div>
            <div className="relative flex-1 w-full">
              <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="text" placeholder="지역/상권명 입력" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-800 border-none rounded-2xl pl-12 pr-6 py-4 text-sm font-black text-white outline-none" />
            </div>
            <button onClick={handleSearch} disabled={loading} className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 px-10 py-4 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl cursor-pointer disabled:opacity-50">{loading ? <Loader2 className="animate-spin" /> : <Search />} 분석</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900 rounded-[40px] border border-slate-800 overflow-hidden shadow-xl flex flex-col">
          <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
            <div className="flex items-center gap-3"><Edit3 className="text-yellow-500" size={20} /><h4 className="text-base font-black text-white">상권 공유 메모</h4></div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black transition-all ${
              syncStatus === 'syncing' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
              syncStatus === 'saved' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
              syncStatus === 'error' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-slate-500 bg-slate-800 border-slate-700'
            }`}>
              {syncStatus === 'syncing' ? <Loader2 size={10} className="animate-spin" /> : 
               syncStatus === 'saved' ? <ShieldCheck size={10} /> : <CloudOff size={10} />}
              {syncStatus === 'syncing' ? '동기화 중...' : 
               syncStatus === 'saved' ? '클라우드에 안전하게 저장됨' : 
               syncStatus === 'error' ? '저장 실패' : '동기화 대기'}
            </div>
          </div>
          <textarea value={consultationNotes} onChange={handleNoteChange} placeholder="팀원들과 공유할 현장 의견..." className="w-full min-h-[300px] p-8 bg-transparent border-none text-slate-200 text-sm outline-none resize-none leading-relaxed" />
        </div>
        <div className="space-y-6">
          {analysis ? (
            <div className="bg-slate-900 rounded-[40px] border border-slate-800 p-8 space-y-8 shadow-2xl">
              <div className="flex justify-between items-center"><div className="flex items-center gap-3"><Target className="text-yellow-500" size={20} /><h4 className="text-base font-black text-white">상권 진단 요약</h4></div><button onClick={handleShare} className="text-slate-400 hover:text-white transition-transform hover:scale-110 cursor-pointer"><Share2 size={18}/></button></div>
              <div className="p-8 bg-slate-950 border border-slate-800 rounded-3xl text-slate-300 text-sm leading-relaxed">{analysis.summary}</div>
              <div className="grid grid-cols-2 gap-6"><div className="bg-blue-500/10 p-6 rounded-3xl border border-blue-500/20"><p className="text-[10px] font-black text-blue-400 uppercase mb-2">경쟁사 수</p><p className="text-2xl font-black text-white">{analysis.competitorCount}개</p></div><div className="bg-emerald-500/10 p-6 rounded-3xl border border-emerald-500/20"><p className="text-[10px] font-black text-emerald-400 uppercase mb-2">핵심 메리트</p><p className="text-sm font-bold text-slate-200">{analysis.advantage}</p></div></div>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-[40px] border border-slate-800 p-12 h-full flex flex-col items-center justify-center text-center opacity-40"><Search size={48} className="text-slate-700 mb-4" /><p className="text-xs font-black uppercase tracking-widest text-slate-500">분석을 기다리고 있습니다</p></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommercialAnalysis;
