
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { RawSalesData, normalizeChannel, getChannelType } from '../types';
import { Store, Calendar, CalendarOff, TrendingUp, Package, Sparkles, Loader2, MessageCircle, Droplets, CheckCircle2, AlertCircle, Edit3, Share2, Cloud, Zap, Moon, AlertTriangle, SearchX, LayoutDashboard, Target, Activity, Coffee, Info, ShoppingBag, Check, ChevronDown, X, Trash2, MousePointer2, ArrowUpRight, ArrowDownRight, ShieldCheck, CloudOff } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isValid, isWithinInterval, eachDayOfInterval, subDays, startOfDay, isSameMonth, subMonths, isToday, differenceInDays } from 'date-fns';
import { GoogleGenAI } from '@google/genai';

interface Props { 
  data: RawSalesData[]; 
  globalSelectedStore?: string;
}

const getEfficiencyStatus = (eff: number, prevEff?: number) => {
  if (eff === 0) return { label: '심각: 전용유 미발주', color: 'text-rose-500', bg: 'bg-rose-500/10', icon: <AlertTriangle size={14}/>, isAnomaly: true };
  if (eff >= 60 && eff <= 70) return { label: '정상범위', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <CheckCircle2 size={14}/> };
  if (eff > 30 && eff < 60) return { label: '저효율 (이익저하)', color: 'text-amber-400', bg: 'bg-emerald-500/10', icon: <AlertCircle size={14}/> };
  if (eff > 0 && eff <= 30) return { label: '원자재 사입/이월의심', color: 'text-rose-400', bg: 'bg-rose-500/10', icon: <AlertTriangle size={14}/>, isAnomaly: true };
  if (eff > 70) return { label: '전용유 사입/산가초과 의심', color: 'text-rose-400', bg: 'bg-rose-500/10', icon: <AlertTriangle size={14}/>, isAnomaly: true };
  return { label: '데이터 없음', color: 'text-slate-500', bg: 'bg-slate-500/10', icon: <SearchX size={14}/> };
};

const GrowthBadge = ({ current, previous }: { current: number, previous: number }) => {
  if (previous <= 0) return (
    <div className="px-1.5 py-0.5 rounded text-[8px] font-black text-slate-500 bg-slate-800 border border-slate-700 uppercase">New</div>
  );
  const growth = ((current - previous) / previous) * 100;
  const isPositive = growth >= 0;
  return (
    <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black border ${isPositive ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
      {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />} {Math.abs(growth).toFixed(1)}%
    </div>
  );
};

const MASTER_KV_ID = "1DqXTJZaMQxCAPNNauE-I6rwsuZWV066aNbHETonPewU".substring(0, 16);
const API_BASE = `https://kvdb.io/${MASTER_KV_ID}/`;

const getCloudKey = (stores: string[], month: string) => {
  // If only one store is selected, use a simpler key for better retention
  const storesPart = stores.length === 1 ? stores[0] : `multi_${stores.sort().join('_').substring(0, 50)}`;
  return `note_v13_${storesPart}_${month}`.replace(/\s/g, '_');
};

const StoreDetailAnalysis: React.FC<Props> = ({ data, globalSelectedStore }) => {
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [isStoreSelectorOpen, setIsStoreSelectorOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [consultationNotes, setConsultationNotes] = useState<string>('');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');

  const allStores = useMemo(() => Array.from(new Set(data.map(d => d.storeName))).sort(), [data]);
  const months = useMemo(() => (Array.from(new Set(data.filter(d => isValid(parseISO(d.date))).map(d => format(parseISO(d.date), 'yyyy-MM')))) as string[]).sort((a, b) => b.localeCompare(a)), [data]);

  useEffect(() => {
    if (globalSelectedStore && globalSelectedStore !== 'all') {
      setSelectedStores([globalSelectedStore]);
    } else {
      setSelectedStores([]);
    }
  }, [globalSelectedStore]);

  useEffect(() => {
    if (months.length > 0 && !selectedMonth) setSelectedMonth(months[0]);
  }, [months]);

  const toggleStore = (store: string) => {
    setSelectedStores(prev => 
      prev.includes(store) ? prev.filter(s => s !== store) : [...prev, store]
    );
  };

  const handleSelectAll = () => setSelectedStores([...allStores]);
  const handleClearAll = () => setSelectedStores([]);

  const pullFromCloud = useCallback(async (stores: string[], month: string) => {
    if (stores.length === 0 || !month) return;
    setSyncStatus('syncing');
    try {
      const response = await fetch(`${API_BASE}${getCloudKey(stores, month)}`);
      if (response.ok) {
        const cloudData = await response.json();
        setConsultationNotes(cloudData.notes || "");
        setAiInsight(cloudData.ai || null);
        setSyncStatus('saved');
      } else {
        setSyncStatus('idle');
      }
    } catch (e) {
      setSyncStatus('error');
    }
  }, []);

  const pushToCloud = useCallback(async (stores: string[], month: string, notes: string, ai: string | null) => {
    if (stores.length === 0 || !month) return;
    setSyncStatus('syncing');
    try {
      await fetch(`${API_BASE}${getCloudKey(stores, month)}`, {
        method: 'POST',
        body: JSON.stringify({ notes, ai, updatedAt: Date.now() })
      });
      setSyncStatus('saved');
    } catch (e) {
      setSyncStatus('error');
    }
  }, []);

  useEffect(() => {
    if (selectedStores.length > 0 && selectedMonth) {
      setConsultationNotes("");
      setAiInsight(null);
      pullFromCloud(selectedStores, selectedMonth);
    }
  }, [selectedStores, selectedMonth, pullFromCloud]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedStores.length > 0 && selectedMonth && syncStatus === 'syncing') {
        pushToCloud(selectedStores, selectedMonth, consultationNotes, aiInsight);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [consultationNotes, aiInsight, selectedStores, selectedMonth, pushToCloud]);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConsultationNotes(e.target.value);
    setSyncStatus('syncing');
  };

  const stats = useMemo(() => {
    if (selectedStores.length === 0 || !selectedMonth) return null;
    
    const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
    const monthEnd = endOfMonth(monthStart);
    const today = startOfDay(new Date());
    
    let effectiveEnd = monthEnd;
    if (isSameMonth(monthStart, today)) {
        effectiveEnd = subDays(today, 1);
    }
    const daysElapsed = differenceInDays(effectiveEnd, monthStart) + 1;

    const calculateForRange = (rangeStart: Date, rangeEnd: Date) => {
      const revMap: Record<string, { amount: number, count: number }> = {};
      const matMap: Record<string, { amount: number, count: number }> = {};
      let totalChicken = 0, totalOil = 0, totalRevenue = 0, totalOrderCount = 0, materialTotalAmount = 0, materialTotalCount = 0, storeDaySum = 0;

      selectedStores.forEach(store => {
        const storeActiveDates = new Set<string>();
        data.filter(d => d.storeName === store).forEach(d => {
          const dDate = parseISO(d.date);
          if (!isValid(dDate) || !isWithinInterval(dDate, { start: rangeStart, end: rangeEnd })) return;
          const norm = normalizeChannel(d.channel);
          const type = getChannelType(norm);
          if (type === 'platform' || type === 'calculated' || type === 'takeout') {
            if (!revMap[norm]) revMap[norm] = { amount: 0, count: 0 };
            revMap[norm].amount += d.amount; revMap[norm].count += d.orderCount;
            totalRevenue += d.amount; totalOrderCount += d.orderCount;
            storeActiveDates.add(d.date);
          } else if (type === 'material') {
            if (!matMap[norm]) matMap[norm] = { amount: 0, count: 0 };
            matMap[norm].amount += d.amount; matMap[norm].count += d.orderCount;
            materialTotalAmount += d.amount; materialTotalCount += d.orderCount;
            if (norm === '전용유') totalOil += d.orderCount;
            else if (norm !== '부자재' && norm !== '발주') totalChicken += d.orderCount;
          }
        });
        storeDaySum += storeActiveDates.size;
      });
      return { revMap, matMap, totalRevenue, totalOrderCount, materialTotalAmount, materialTotalCount, efficiency: totalOil > 0 ? (totalChicken / totalOil) : 0, avgDailySales: storeDaySum > 0 ? totalRevenue / storeDaySum : 0, aov: totalOrderCount > 0 ? totalRevenue / totalOrderCount : 0, operatingDays: storeDaySum };
    };

    const currentStats = calculateForRange(monthStart, effectiveEnd);
    const prevMonthStart = startOfMonth(subMonths(monthStart, 1));
    const prevRangeEnd = subDays(startOfMonth(subMonths(monthStart, 1)), -(daysElapsed - 1));
    const prevStats = calculateForRange(prevMonthStart, prevRangeEnd);
    const totalPossibleDays = daysElapsed * selectedStores.length;
    return { current: currentStats, previous: prevStats, holidayCount: totalPossibleDays - currentStats.operatingDays, daysElapsed, prevRangeLabel: `${format(prevMonthStart, 'MM/dd')}~${format(prevRangeEnd, 'MM/dd')}` };
  }, [selectedStores, selectedMonth, data]);

  if (selectedStores.length > 0 && !stats) return null;
  const current = stats?.current;
  const previous = stats?.previous;
  const effStatus = current ? getEfficiencyStatus(current.efficiency, previous?.efficiency) : null;

  const handleAIAnalysis = async () => {
    if (!current) return;
    setIsAnalyzing(true);
    setAiInsight(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `다점포 경영 포트폴리오 정밀 데이터 (대상: ${selectedStores.join(', ')}, 기간: ${selectedMonth}): 통합 일평균 매출: ${Math.round(current.avgDailySales).toLocaleString()}원, 통합 조리 효율: ${current.efficiency.toFixed(1)}수/can. 컨설팅을 수행하세요.`;
      const resp = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      const result = resp.text || "";
      setAiInsight(result);
      pushToCloud(selectedStores, selectedMonth, consultationNotes, result);
    } catch (e) { setAiInsight("AI 분석 엔진 오류 발생."); } 
    finally { setIsAnalyzing(false); }
  };

  const handleShare = async () => {
    if (!current || !effStatus) return;
    const shareMessage = `[통합 분석 리포트] 효율: ${current.efficiency.toFixed(1)}수/can, 일매출: ${Math.round(current.avgDailySales).toLocaleString()}원`.trim();
    if (navigator.share) await navigator.share({ title: `통합 경영 분석`, text: shareMessage });
    else { await navigator.clipboard.writeText(shareMessage); alert('리포트가 복사되었습니다.'); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-2xl flex flex-col xl:flex-row items-center justify-between gap-6 relative">
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
          <div className="relative group w-full sm:w-auto">
            <button 
              onClick={() => setIsStoreSelectorOpen(!isStoreSelectorOpen)}
              className="w-full flex items-center justify-between gap-3 bg-slate-800 px-6 py-3.5 rounded-2xl border border-slate-700 text-sm font-black text-white hover:bg-slate-700 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Store size={18} className="text-blue-500" />
                <span>{selectedStores.length === 0 ? '분석할 매장을 선택하세요' : selectedStores.length === 1 ? selectedStores[0] : `매장 ${selectedStores.length}개 통합 분석`}</span>
              </div>
              <ChevronDown size={16} className={`transition-transform ${isStoreSelectorOpen ? 'rotate-180' : ''}`} />
            </button>
            {isStoreSelectorOpen && (
              <div className="absolute top-full left-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-[100] p-5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4 px-1"><span className="text-[10px] font-black text-slate-500 uppercase">매장 선택 ({selectedStores.length}/{allStores.length})</span><div className="flex gap-3"><button onClick={handleSelectAll} className="text-[10px] font-black text-blue-500 hover:text-blue-400">전체</button><button onClick={handleClearAll} className="text-[10px] font-black text-rose-500 hover:text-rose-400">해제</button></div></div>
                <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">{allStores.map(store => (<div key={store} onClick={() => toggleStore(store)} className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all ${selectedStores.includes(store) ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:bg-slate-800 border border-transparent'}`}><span className="text-xs font-bold">{store}</span>{selectedStores.includes(store) ? <Check size={14} /> : <div className="w-3.5 h-3.5 rounded border border-slate-700" />}</div>))}</div>
                <button onClick={() => setIsStoreSelectorOpen(false)} className="w-full mt-5 py-3.5 bg-blue-600 text-white text-xs font-black rounded-xl shadow-lg">확인</button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 bg-slate-800 px-6 py-3.5 rounded-2xl border border-slate-700 w-full sm:w-auto">
            <Calendar size={18} className="text-emerald-500" />
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent border-none text-sm font-black text-white outline-none cursor-pointer flex-1">{months.map(m => <option key={m} value={m} className="bg-slate-900">{m}</option>)}</select>
          </div>
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black transition-all ${
            syncStatus === 'syncing' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
            syncStatus === 'saved' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
            syncStatus === 'error' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-slate-500 bg-slate-800 border-slate-700'
          }`}>
            {syncStatus === 'syncing' ? <Loader2 size={10} className="animate-spin" /> : 
             syncStatus === 'saved' ? <ShieldCheck size={10} /> : <CloudOff size={10} />}
            {syncStatus === 'syncing' ? '동기화 중...' : 
             syncStatus === 'saved' ? '저장됨' : 
             syncStatus === 'error' ? '저장 실패' : '대기'}
          </div>
        </div>
        <div className="flex items-center gap-3 w-full xl:w-auto">
          <button onClick={handleShare} disabled={selectedStores.length === 0} className="flex-1 xl:flex-none bg-slate-800 text-slate-300 px-6 py-3.5 rounded-2xl text-xs font-black flex items-center justify-center gap-2 hover:bg-slate-700 disabled:opacity-30"><Share2 size={16} /> 공유</button>
          <button onClick={handleAIAnalysis} disabled={isAnalyzing || selectedStores.length === 0} className={`flex-1 xl:flex-none px-8 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${isAnalyzing ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 hover:bg-blue-500 text-white'} disabled:opacity-30`}>{isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} {isAnalyzing ? '분석 중' : '경영 분석'}</button>
        </div>
      </div>

      {selectedStores.length > 0 && current && effStatus && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-wrap gap-2">{selectedStores.map(store => (<div key={store} className="bg-blue-600/10 text-blue-400 px-4 py-1.5 rounded-full text-[10px] font-black flex items-center gap-2 border border-blue-600/20 group">{store}<X size={12} className="cursor-pointer hover:text-white" onClick={() => toggleStore(store)} /></div>))}{selectedStores.length > 1 && (<button onClick={handleClearAll} className="text-[10px] font-black text-rose-500 hover:text-rose-400 px-3 py-1.5 flex items-center gap-1"><Trash2 size={12} /> 해제</button>)}</div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-xl relative overflow-hidden"><div className={`w-14 h-14 rounded-2xl ${effStatus.bg} ${effStatus.color} flex items-center justify-center mb-6`}>{effStatus.icon}</div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">통합 조리 효율</p><div className="flex items-baseline gap-2"><h4 className={`text-3xl font-black ${effStatus.color}`}>{current.efficiency.toFixed(1)}</h4><GrowthBadge current={current.efficiency} previous={previous?.efficiency || 0} /></div><p className={`text-[10px] font-bold mt-2 ${effStatus.color}`}>{effStatus.label}</p></div>
            <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-xl group"><div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6"><TrendingUp size={24}/></div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">통합 일평균 매출</p><div className="flex items-baseline gap-2"><h4 className="text-2xl font-black text-white">{Math.round(current.avgDailySales).toLocaleString()}원</h4><GrowthBadge current={current.totalRevenue} previous={previous?.totalRevenue || 0} /></div></div>
            <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-xl group"><div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-6"><Target size={24}/></div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">통합 평균 객단가</p><div className="flex items-baseline gap-2"><h4 className="text-2xl font-black text-white">{Math.round(current.aov).toLocaleString()}원</h4><GrowthBadge current={current.aov} previous={previous?.aov || 0} /></div></div>
            <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-xl group"><div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6"><CalendarOff size={24}/></div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">운영 및 휴무</p><div className="flex items-baseline gap-2"><h4 className="text-2xl font-black text-white">{current.operatingDays}일 운영</h4><span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">{stats.holidayCount}일 휴무</span></div><p className="text-[9px] font-bold text-slate-600 mt-2 tracking-tighter uppercase">대비: {stats.prevRangeLabel}</p></div>
          </div>

          {aiInsight && (
            <div className="bg-slate-900 rounded-[40px] border-2 border-blue-500/30 overflow-hidden shadow-2xl animate-in slide-in-from-top-4 duration-500"><div className="p-8 border-b border-slate-800 flex items-center justify-between bg-blue-500/5"><div className="flex items-center gap-3"><Sparkles className="text-blue-400" size={22} /><h4 className="text-lg font-black text-white">AI 통합 경영 분석 리포트</h4></div><button onClick={handleShare} className="p-2 text-slate-400 hover:text-white"><Share2 size={20} /></button></div><div className="p-10 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-medium">{aiInsight}</div></div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900 rounded-[40px] border border-slate-800 overflow-hidden shadow-xl flex flex-col">
              <div className="p-8 border-b border-slate-800 flex items-center gap-3 bg-slate-800/30"><Edit3 className="text-yellow-500" size={20} /><h4 className="text-base font-black text-white">통합 경영 관리 메모 (실시간 동기화)</h4></div>
              <textarea value={consultationNotes} onChange={handleNoteChange} placeholder="선택된 매장들에 대한 통합 관리 지침을 입력하세요. 입력 즉시 자동 저장됩니다." className="w-full min-h-[400px] p-8 bg-transparent border-none text-slate-200 text-sm outline-none resize-none leading-relaxed" />
            </div>
            <div className="space-y-8">
              <div className="bg-slate-900 rounded-[40px] border border-slate-800 overflow-hidden shadow-xl p-8"><div className="flex items-center gap-3 mb-6"><Activity size={20} className="text-blue-500" /><h4 className="text-base font-black text-white">채널별 통합 매출 현황</h4></div><div className="space-y-3">{Object.entries(current.revMap).sort((a: any, b: any) => b[1].amount - a[1].amount).map(([chan, v]: [string, any]) => (<div key={chan} className="grid grid-cols-12 items-center p-4 bg-slate-800/20 rounded-2xl border border-slate-800/50"><div className="col-span-6 flex items-center gap-2"><span className="text-xs font-bold text-slate-100">{chan}</span><GrowthBadge current={v.amount} previous={previous?.revMap[chan]?.amount || 0} /></div><div className="col-span-4 text-right text-sm font-black text-slate-200">{v.amount.toLocaleString()}원</div><div className="col-span-2 text-right flex flex-col items-end"><span className="text-[10px] font-bold text-slate-500">{v.count}건</span><GrowthBadge current={v.count} previous={previous?.revMap[chan]?.count || 0} /></div></div>))}</div></div>
              <div className="bg-slate-900 rounded-[40px] border border-slate-800 overflow-hidden shadow-xl p-8"><div className="flex items-center gap-3 mb-6"><Package size={20} className="text-rose-500" /><h4 className="text-base font-black text-white">원부자재 통합 매입 현황</h4></div><div className="space-y-3">{Object.entries(current.matMap).sort((a: any, b: any) => b[1].amount - a[1].amount).map(([chan, v]: [string, any]) => (<div key={chan} className="grid grid-cols-12 items-center p-4 bg-slate-800/20 rounded-2xl border border-slate-800/50"><div className="col-span-6 flex items-center gap-2"><span className="text-xs font-bold text-slate-100">{chan}</span><GrowthBadge current={v.amount} previous={previous?.matMap[chan]?.amount || 0} /></div><div className="col-span-4 text-right text-sm font-black text-slate-200">{v.amount.toLocaleString()}원</div><div className="col-span-2 text-right flex flex-col items-end"><span className="text-[10px] font-bold text-slate-500">{v.count}{chan.includes('전용유') ? 'can' : '수'}</span><GrowthBadge current={v.count} previous={previous?.matMap[chan]?.count || 0} /></div></div>))}<div className="grid grid-cols-12 p-5 mt-4 bg-rose-600/10 rounded-2xl border border-rose-500/20"><div className="col-span-6 flex items-center gap-2"><span className="text-xs font-black text-rose-400">통합 매입 총액</span><GrowthBadge current={current.materialTotalAmount} previous={previous?.materialTotalAmount || 0} /></div><div className="col-span-4 text-right text-base font-black text-white">{current.materialTotalAmount.toLocaleString()}원</div><div className="col-span-2 text-right flex flex-col items-end"><span className="text-[10px] font-bold text-white">{current.materialTotalCount}수/can</span><GrowthBadge current={current.materialTotalCount} previous={previous?.materialTotalCount || 0} /></div></div></div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreDetailAnalysis;
