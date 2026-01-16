
import React, { useState, useEffect, useCallback } from 'react';
import { RawSalesData } from '../types';
import { Search, Loader2, Compass, MapPin, Edit3, Target, Share2, Info, ShieldCheck, CloudOff, ExternalLink, Smartphone, ShoppingBag, Utensils } from 'lucide-react';

interface Props { data: RawSalesData[]; }

const INTERNAL_PW_STORAGE_KEY = 'sales_internal_app_password';

const getInternalPassword = () => {
  try { return sessionStorage.getItem(INTERNAL_PW_STORAGE_KEY) || ''; } catch { return ''; }
};

const MASTER_KV_ID = "1DqXTJZaMQxCAPNNauE-I6rwsuZWV066aNbHETonPewU".substring(0, 16);
const API_BASE = `https://kvdb.io/${MASTER_KV_ID}/`;
const getCommKey = (query: string) => `comm_v3_${query.trim()}`.replace(/\s/g, '_');

const CommercialAnalysis: React.FC<Props> = ({ data }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [radius, setRadius] = useState(2);
  const [loading, setLoading] = useState(false);
  const [consultationNotes, setConsultationNotes] = useState('');
  const [analysis, setAnalysis] = useState<{ 
    summary: string, 
    competitorCount: number, 
    advantage: string, 
    delivery: string,
    takeout: string,
    instore: string,
    sources?: any[] 
  } | null>(null);
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
📊 추정 경쟁사: 약 ${analysis.competitorCount}개소
💡 핵심 경쟁력: ${analysis.advantage}

🛵 배달: ${analysis.delivery}
📦 포장: ${analysis.takeout}
🍽️ 내점: ${analysis.instore}

📝 현장 의견: ${consultationNotes || '없음'}
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
      const prompt = `"${searchQuery}" 지역 상권에 대해 반경 ${radius}km 범위로 치킨 프랜차이즈 입점 타당성을 분석하세요.

요구사항:
1) 주변 경쟁 강도(치킨/분식/배달치킨 등)를 추정하고, 경쟁 강도가 높/중/낮 중 어디에 가까운지 근거를 설명
2) 배달, 포장, 내점 관점에서의 상권 특성과 실행 전략을 각각 작성
3) 답변은 아래 구분자를 사용해 작성
[SUMMARY]: 상권 및 경쟁 현황 요약
[COMP_COUNT]: 주변 경쟁사 수(추정치, 숫자만)
[ADVANTAGE]: 해당 지역 진입 시 핵심 경쟁력 한줄
[DELIVERY]: 배달 성장성 및 전략
[TAKEOUT]: 포장 성장성 및 전략
[INSTORE]: 내점 성장성 및 전략
4) HTML 태그 금지, 줄바꿈은 \n만 사용
`;

      const internalPw = getInternalPassword();
      const resp = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(internalPw ? { 'X-Internal-Password': internalPw } : {}),
        },
        body: JSON.stringify({
          model: 'gemini-1.5-flash',
          prompt,
        }),
      });

      if (resp.status === 401) {
        alert('AI 기능 사용을 위해 사내 접근 비밀번호가 필요합니다. (AI 인사이트 탭에서 먼저 입력 후 다시 시도)');
        return;
      }

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error(json);
        alert('AI 분석 중 오류가 발생했습니다.');
        return;
      }

      const text = (json.text || '') as string;
      const parsedAnalysis = {
        summary: text.match(/\[SUMMARY\]:?([\s\S]*?)(?=\[COMP_COUNT\]|$)/)?.[1]?.trim() || '분석 실패',
        competitorCount: parseInt(text.match(/\[COMP_COUNT\]:?(\d+)/)?.[1] || '0'),
        advantage: text.match(/\[ADVANTAGE\]:?([\s\S]*?)(?=\[DELIVERY\]|$)/)?.[1]?.trim() || '전략 미수립',
        delivery: text.match(/\[DELIVERY\]:?([\s\S]*?)(?=\[TAKEOUT\]|$)/)?.[1]?.trim() || '정보 부족',
        takeout: text.match(/\[TAKEOUT\]:?([\s\S]*?)(?=\[INSTORE\]|$)/)?.[1]?.trim() || '정보 부족',
        instore: text.match(/\[INSTORE\]:?([\s\S]*?)$/)?.[1]?.trim() || '정보 부족',
        sources: [],
      };

      setAnalysis(parsedAnalysis as any);
      pushToCloud(searchQuery, consultationNotes, parsedAnalysis);
    } catch (e) {
      console.error(e);
      alert('오류 발생');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="bg-slate-900 p-10 rounded-[40px] border border-slate-800 shadow-2xl relative">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6"><div className="bg-yellow-500 p-5 rounded-3xl shadow-lg shadow-yellow-500/20"><Compass size={32} className="text-slate-950" /></div><div><h3 className="text-2xl font-black text-white">AI 상권 정밀 분석</h3><p className="text-xs font-bold text-slate-500 uppercase mt-1">Grounding: Maps & Search</p></div></div>
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
              {syncStatus === 'syncing' ? '동기화 중...' : '클라우드 저장됨'}
            </div>
          </div>
          <textarea value={consultationNotes} onChange={handleNoteChange} placeholder="팀원들과 공유할 현장 의견..." className="w-full min-h-[300px] p-8 bg-transparent border-none text-slate-200 text-sm outline-none resize-none leading-relaxed" />
        </div>
        
        <div className="space-y-6">
          {analysis ? (
            <div className="bg-slate-900 rounded-[40px] border border-slate-800 p-8 space-y-8 shadow-2xl animate-in slide-in-from-right-4">
              <div className="flex justify-between items-center"><div className="flex items-center gap-3"><Target className="text-yellow-500" size={20} /><h4 className="text-base font-black text-white">상권 진단 및 경쟁 현황</h4></div><button onClick={handleShare} className="text-slate-400 hover:text-white transition-transform hover:scale-110 cursor-pointer"><Share2 size={18}/></button></div>
              <div className="p-8 bg-slate-950 border border-slate-800 rounded-3xl text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{analysis.summary}</div>
              
              <div className="grid grid-cols-2 gap-6"><div className="bg-blue-500/10 p-6 rounded-3xl border border-blue-500/20"><p className="text-[10px] font-black text-blue-400 uppercase mb-2">반경 내 치킨 경쟁사</p><p className="text-2xl font-black text-white">{analysis.competitorCount}개소 추정</p></div><div className="bg-emerald-500/10 p-6 rounded-3xl border border-emerald-500/20"><p className="text-[10px] font-black text-emerald-400 uppercase mb-2">핵심 차별화 전략</p><p className="text-sm font-bold text-slate-200 leading-tight">{analysis.advantage}</p></div></div>

              {/* Channel Growth Directions */}
              <div className="space-y-4">
                <div className="p-5 bg-blue-600/5 rounded-2xl border border-blue-500/20 flex gap-4">
                  <Smartphone className="text-blue-500 shrink-0" size={20} />
                  <div>
                    <h6 className="text-[10px] font-black text-blue-400 uppercase mb-1">배달 성장성</h6>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{analysis.delivery}</p>
                  </div>
                </div>
                <div className="p-5 bg-rose-600/5 rounded-2xl border border-rose-500/20 flex gap-4">
                  <ShoppingBag className="text-rose-500 shrink-0" size={20} />
                  <div>
                    <h6 className="text-[10px] font-black text-rose-400 uppercase mb-1">포장 성장성</h6>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{analysis.takeout}</p>
                  </div>
                </div>
                <div className="p-5 bg-emerald-600/5 rounded-2xl border border-emerald-500/20 flex gap-4">
                  <Utensils className="text-emerald-500 shrink-0" size={20} />
                  <div>
                    <h6 className="text-[10px] font-black text-emerald-400 uppercase mb-1">내점 성장성</h6>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{analysis.instore}</p>
                  </div>
                </div>
              </div>

              {analysis.sources && analysis.sources.length > 0 && (
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <Info size={12} className="text-blue-500" /> 검색 기반 입점 데이터 근거
                  </p>
                  <div className="space-y-2">
                    {analysis.sources.map((source: any, idx: number) => (
                      source.web && (
                        <a key={idx} href={source.web.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 transition-all group">
                          <span className="text-[11px] font-bold text-slate-400 truncate flex-1 pr-4">{source.web.title || source.web.uri}</span>
                          <ExternalLink size={12} className="text-slate-600 group-hover:text-blue-500 shrink-0" />
                        </a>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 rounded-[40px] border border-slate-800 p-12 h-full flex flex-col items-center justify-center text-center opacity-40"><Search size={48} className="text-slate-700 mb-4" /><p className="text-xs font-black uppercase tracking-widest text-slate-500">지역명을 입력하고 상권 분석을 시작하세요</p></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommercialAnalysis;
