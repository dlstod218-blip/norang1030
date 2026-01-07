
import React, { useState, useMemo } from 'react';
import { RawSalesData, normalizeChannel, getChannelType } from '../types';
import { AIService } from '../services/aiService';
import { Search, Loader2, ExternalLink, Compass, Target, MapPin, Globe, Database, Map as MapIcon, ChevronRight } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

interface Props {
  data: RawSalesData[];
}

const CommercialAnalysis: React.FC<Props> = ({ data }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [radius, setRadius] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [groundingLinks, setGroundingLinks] = useState<any[]>([]);
  const [searchLinks, setSearchLinks] = useState<any[]>([]);

  const storeSummaries = useMemo(() => {
    const stats: Record<string, any> = {};
    data.forEach(d => {
      const storeKey = d.storeName;
      if (!stats[storeKey]) {
        stats[storeKey] = { name: d.storeName, region: d.region, totalSales: 0 };
      }
      stats[storeKey].totalSales += d.amount;
    });
    return Object.values(stats).sort((a: any, b: any) => b.totalSales - a.totalSales);
  }, [data]);

  const getNaverMapUrl = (query: string) => `https://map.naver.com/v5/search/${encodeURIComponent(query)}`;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setAnalysis(null);
    setGroundingLinks([]);

    try {
      const result = await AIService.getCommercialAnalysis(searchQuery, radius, storeSummaries);
      
      setAnalysis(result.text || '리포트 생성 실패');
      
      const maps = result.grounding.filter((c: any) => c.maps).map((c: any) => ({ title: c.maps.title, uri: c.maps.uri }));
      const web = result.grounding.filter((c: any) => c.web).map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
      
      setGroundingLinks(maps);
      setSearchLinks(web);

    } catch (error) {
      setAnalysis('상권 분석 중 오류가 발생했습니다. 나중에 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-24">
      <div className="bg-slate-900 p-10 rounded-[60px] border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 via-blue-500 to-emerald-500"></div>
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
          <div className="flex items-center gap-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-5 rounded-3xl shadow-xl shadow-blue-900/20">
              <Compass className="text-white w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black text-white tracking-tight">AI 상권 서비스 게이트웨이</h3>
                <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-lg">API Optimzed</span>
              </div>
              <p className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] mt-1">Real-time Grounding Analysis</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-2xl border border-slate-700">
              <select 
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="bg-slate-900 border-none rounded-xl px-4 py-2 text-sm font-black text-blue-400 outline-none"
              >
                {[1, 2, 3, 5, 10].map(r => <option key={r} value={r}>{r}km 반경</option>)}
              </select>
            </div>
            
            <input 
              type="text" 
              placeholder="분석 지역 (예: 성수동)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-3.5 text-sm font-black text-white outline-none focus:border-blue-500 w-full sm:w-64"
            />

            <button 
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
              className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-blue-500 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
              상권 분석 실행
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="py-40 text-center flex flex-col items-center gap-10">
          <div className="w-20 h-20 border-4 border-blue-600/10 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="space-y-2">
            <p className="text-xl font-black text-white">상권 빅데이터 및 지도 정보 동기화 중...</p>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">Gemini 2.5 Flash Grounding Active</p>
          </div>
        </div>
      )}

      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-slate-900 rounded-[50px] border border-slate-800 shadow-2xl p-10 md:p-14">
            <div className="prose prose-invert max-w-none text-slate-200 leading-[1.8] font-medium whitespace-pre-wrap text-lg">
              {analysis}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 rounded-[40px] border border-slate-800 p-8 shadow-xl">
              <h4 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <MapIcon size={16} className="text-emerald-500" /> 분석 근거 및 출처
              </h4>
              <div className="space-y-3">
                {groundingLinks.map((link, idx) => (
                  <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/30 rounded-2xl transition-all group">
                    <span className="text-xs font-bold text-slate-300 truncate pr-4 group-hover:text-white">{link.title}</span>
                    <ExternalLink size={14} className="text-slate-600 group-hover:text-emerald-500 shrink-0" />
                  </a>
                ))}
                {searchLinks.map((link, idx) => (
                  <a key={`web-${idx}`} href={link.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/30 rounded-2xl transition-all group">
                    <span className="text-xs font-bold text-slate-300 truncate pr-4 group-hover:text-white">{link.title}</span>
                    <Globe size={14} className="text-slate-600 group-hover:text-blue-500 shrink-0" />
                  </a>
                ))}
                {(groundingLinks.length === 0 && searchLinks.length === 0) && (
                  <p className="text-xs text-slate-600 italic py-4 text-center">관련 링크가 없습니다.</p>
                )}
              </div>
            </div>

            <a 
              href={getNaverMapUrl(searchQuery)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block bg-slate-900 rounded-[40px] border border-slate-800 p-8 shadow-xl hover:border-emerald-500/50 transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-slate-500 uppercase">Naver Map</span>
                <ChevronRight size={16} className="text-slate-700 group-hover:text-emerald-500" />
              </div>
              <p className="text-sm font-black text-white">네이버 지도에서 직접 확인하기</p>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommercialAnalysis;
