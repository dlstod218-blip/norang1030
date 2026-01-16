
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { RawSalesData, normalizeChannel, getChannelType } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, isValid, isWithinInterval, differenceInDays, isSameMonth, subDays, startOfDay, isBefore, subMonths, endOfDay, eachDayOfInterval } from 'date-fns';
import { Store, Sparkles, Loader2, Droplets, CalendarDays, ChevronDown, ChevronUp, Info, Search, Edit3, ShieldCheck, CloudOff, Share2, CheckSquare, Square, Smartphone, ShoppingBag, Utensils, MapPin, ExternalLink, Package, TrendingUp, Box, Droplet, ShoppingCart } from 'lucide-react';
import { getEfficiencyGuide, GrowthBadge } from './DashboardOverview';

interface Props { 
  data: RawSalesData[]; 
  globalSelectedStore?: string;
}

const INTERNAL_PW_STORAGE_KEY = 'sales_internal_app_password';
const getInternalPassword = () => {
  try { return sessionStorage.getItem(INTERNAL_PW_STORAGE_KEY) || ''; } catch { return ''; }
};

const MASTER_KV_ID = "1DqXTJZaMQxCAPNNauE-I6rwsuZWV066aNbHETonPewU".substring(0, 16);
const API_BASE = `https://kvdb.io/${MASTER_KV_ID}/`;
const getStoreMemoKey = (store: string, month: string) => `memo_v1_${store}_${month}`.replace(/\s/g, '_');

const StoreDetailAnalysis: React.FC<Props> = ({ data, globalSelectedStore }) => {
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [isStoreSelectorOpen, setIsStoreSelectorOpen] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [aiInsight, setAiInsight] = useState<{
    main: string,
    delivery: string,
    takeout: string,
    instore: string,
    sources: any[]
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [isEffExpanded, setIsEffExpanded] = useState(false);
  const [isHolidayExpanded, setIsHolidayExpanded] = useState(false);
  const [isChannelsExpanded, setIsChannelsExpanded] = useState(true);
  const [isMaterialsExpanded, setIsMaterialsExpanded] = useState(true);

  const [consultationNotes, setConsultationNotes] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');

  const allStores = useMemo(() => Array.from(new Set(data.map(d => d.storeName))).sort(), [data]);
  const months = useMemo(() => (Array.from(new Set(data.filter(d => isValid(parseISO(d.date))).map(d => format(parseISO(d.date), 'yyyy-MM')))) as string[]).sort((a, b) => b.localeCompare(a)), [data]);

  const filteredStoresList = useMemo(() => {
    return allStores.filter(s => s.toLowerCase().includes(storeSearch.toLowerCase()));
  }, [allStores, storeSearch]);

  useEffect(() => {
    if (globalSelectedStore && globalSelectedStore !== 'all') setSelectedStores([globalSelectedStore]);
  }, [globalSelectedStore]);

  useEffect(() => {
    if (months.length > 0 && !selectedMonth) setSelectedMonth(months[0]);
  }, [months]);

  const pullFromCloud = useCallback(async (store: string, month: string) => {
    if (!store || !month) return;
    setSyncStatus('syncing');
    try {
      const response = await fetch(`${API_BASE}${getStoreMemoKey(store, month)}`);
      if (response.ok) {
        const cloudData = await response.json();
        setConsultationNotes(cloudData.notes || "");
        setSyncStatus('saved');
      } else {
        setConsultationNotes("");
        setSyncStatus('idle');
      }
    } catch (e) { setSyncStatus('error'); }
  }, []);

  const pushToCloud = useCallback(async (store: string, month: string, notes: string) => {
    if (!store || !month) return;
    setSyncStatus('syncing');
    window.dispatchEvent(new CustomEvent('cloud-sync-start'));
    try {
      await fetch(`${API_BASE}${getStoreMemoKey(store, month)}`, {
        method: 'POST',
        body: JSON.stringify({ notes, updatedAt: Date.now() })
      });
      setSyncStatus('saved');
    } catch (e) { setSyncStatus('error'); }
    finally { window.dispatchEvent(new CustomEvent('cloud-sync-end')); }
  }, []);

  useEffect(() => {
    if (selectedStores.length === 1 && selectedMonth) {
      pullFromCloud(selectedStores[0], selectedMonth);
    }
  }, [selectedStores, selectedMonth, pullFromCloud]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedStores.length === 1 && selectedMonth && syncStatus === 'syncing') {
        pushToCloud(selectedStores[0], selectedMonth, consultationNotes);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [consultationNotes, selectedStores, selectedMonth, pushToCloud]);

  const stats = useMemo(() => {
    if (selectedStores.length === 0 || !selectedMonth) return null;
    const monthDate = parseISO(`${selectedMonth}-01`);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    
    const today = startOfDay(new Date());
    let effectiveEnd = monthEnd;
    if (isSameMonth(monthStart, today)) {
      effectiveEnd = subDays(today, 1);
      if (isBefore(effectiveEnd, monthStart)) effectiveEnd = monthStart;
    }
    const totalDaysPerStore = differenceInDays(effectiveEnd, monthStart) + 1;
    const totalPotentialDays = totalDaysPerStore * selectedStores.length;
    const dateRangeList = eachDayOfInterval({ start: monthStart, end: effectiveEnd }).map(d => format(d, 'yyyy-MM-dd'));

    const prevMonthStart = startOfMonth(subMonths(monthStart, 1));
    const prevMonthEnd = endOfMonth(prevMonthStart);

    const revMap: Record<string, { amount: number, count: number, prevAmount: number }> = {};
    const matMap: Record<string, { amount: number, count: number, prevAmount: number }> = {};
    let totalRevenue = 0, totalOrders = 0, prevTotalRevenue = 0, platformSum = 0, rawMatSum = 0, totalProcurement = 0, chickenCount = 0, oilCount = 0, takeoutSum = 0, instoreSum = 0;
    
    let oilAmountSum = 0;
    let subMaterialAmountSum = 0;

    const storeDailyRevenue: Record<string, Record<string, number>> = {};
    selectedStores.forEach(s => storeDailyRevenue[s] = {});

    data.forEach(d => {
      if (!selectedStores.includes(d.storeName)) return;
      const dt = parseISO(d.date);
      if (!isValid(dt)) return;
      const norm = normalizeChannel(d.channel);
      const type = getChannelType(norm);
      
      const isCurrent = isWithinInterval(dt, { start: monthStart, end: monthEnd });
      const isPrevious = isWithinInterval(dt, { start: prevMonthStart, end: prevMonthEnd });

      if (isCurrent) {
        if (type === 'platform' || norm === '내점') {
          totalRevenue += d.amount; 
          totalOrders += d.orderCount;
          if (type === 'platform') platformSum += d.amount;
          else if (norm === '내점') instoreSum += d.amount;

          if (!revMap[norm]) revMap[norm] = { amount: 0, count: 0, prevAmount: 0 };
          revMap[norm].amount += d.amount; revMap[norm].count += d.orderCount;
          
          if (isBefore(dt, endOfDay(effectiveEnd))) {
            storeDailyRevenue[d.storeName][d.date] = (storeDailyRevenue[d.storeName][d.date] || 0) + d.amount;
          }
        } else if (type === 'takeout') {
          takeoutSum += d.amount;
          if (!revMap[norm]) revMap[norm] = { amount: 0, count: 0, prevAmount: 0 };
          revMap[norm].amount += d.amount; revMap[norm].count += d.orderCount;
        } else if (type === 'material') {
          totalProcurement += d.amount;
          if (norm === '전용유') {
            oilCount += d.orderCount;
            oilAmountSum += d.amount;
          } else if (norm === '부자재' || norm === '발주') {
            subMaterialAmountSum += d.amount;
          } else {
            rawMatSum += d.amount;
            chickenCount += d.orderCount;
          }
          if (!matMap[norm]) matMap[norm] = { amount: 0, count: 0, prevAmount: 0 };
          matMap[norm].amount += d.amount; matMap[norm].count += d.orderCount;
        }
      } else if (isPrevious) {
        if (type === 'platform' || norm === '내점') {
          prevTotalRevenue += d.amount;
          if (!revMap[norm]) revMap[norm] = { amount: 0, count: 0, prevAmount: 0 };
          revMap[norm].prevAmount += d.amount;
        } else if (type === 'takeout') {
          if (!revMap[norm]) revMap[norm] = { amount: 0, count: 0, prevAmount: 0 };
          revMap[norm].prevAmount += d.amount;
        } else if (type === 'material') {
          if (!matMap[norm]) matMap[norm] = { amount: 0, count: 0, prevAmount: 0 };
          matMap[norm].prevAmount += d.amount;
        }
      }
    });

    let totalHolidays = 0;
    selectedStores.forEach(sName => {
      const dailyRev = storeDailyRevenue[sName] || {};
      dateRangeList.forEach(dStr => {
        if (!dailyRev[dStr] || dailyRev[dStr] <= 0) {
          totalHolidays++;
        }
      });
    });

    return { 
      totalRevenue, totalOrders, prevTotalRevenue, platformSum, takeoutSum, instoreSum, 
      rawMatSum, oilAmountSum, subMaterialAmountSum,
      totalProcurement, efficiency: oilCount > 0 ? chickenCount / oilCount : 0, 
      totalHolidays, totalPotentialDays, revMap, matMap 
    };
  }, [selectedStores, selectedMonth, data]);

  const handleAIAnalysis = async () => {
    if (selectedStores.length === 0 || !stats) return;
    setIsAnalyzing(true);
    try {
      const prompt = `가맹점(${selectedStores.join(', ')})의 ${selectedMonth}월 정밀 분석 리포트를 작성하세요.
- 매출(홀+배달): ${stats.totalRevenue.toLocaleString()}원 (배달: ${stats.platformSum.toLocaleString()}, 내점: ${stats.instoreSum.toLocaleString()})
- 별도 포장매출: ${stats.takeoutSum.toLocaleString()}원
- 조리 효율: ${stats.efficiency.toFixed(1)}수/can
- 총 휴무: ${stats.totalHolidays}/${stats.totalPotentialDays}일

요구사항:
1) 경쟁 강도(치킨/분식/배달치킨 등)를 추정하고, 근거와 함께 높/중/낮으로 분류
2) 배달/포장/내점 각각 데이터 기반 성장 전략 제시
3) 아래 구분자 사용
[SUMMARY]: 가맹점 현황 및 경쟁 분석 요약
[DELIVERY]: 배달 채널 성장 전략
[TAKEOUT]: 포장 채널 성장 전략
[INSTORE]: 내점 채널 성장 전략
4) HTML 태그 금지, 줄바꿈은 \n만 사용
`;

      const internalPw = getInternalPassword();
      const resp = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(internalPw ? { 'X-Internal-Password': internalPw } : {}),
        },
        body: JSON.stringify({ model: 'gemini-1.5-flash', prompt }),
      });

      if (resp.status === 401) {
        setAiInsight({ main: 'AI 기능 사용을 위해 사내 접근 비밀번호가 필요합니다. (AI 인사이트 탭에서 먼저 입력 후 다시 시도)', delivery: '', takeout: '', instore: '', sources: [] });
        return;
      }

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error(json);
        setAiInsight({ main: '분석 중 오류가 발생했습니다. (환경변수/서버 설정 확인)', delivery: '', takeout: '', instore: '', sources: [] });
        return;
      }

      const text = (json.text || '') as string;
      const parts = {
        main: text.match(/\[SUMMARY\]:?([\s\S]*?)(?=\[DELIVERY\]|$)/)?.[1]?.trim() || '분석 결과를 불러오지 못했습니다.',
        delivery: text.match(/\[DELIVERY\]:?([\s\S]*?)(?=\[TAKEOUT\]|$)/)?.[1]?.trim() || '데이터 부족으로 전략 수립 불가.',
        takeout: text.match(/\[TAKEOUT\]:?([\s\S]*?)(?=\[INSTORE\]|$)/)?.[1]?.trim() || '데이터 부족으로 전략 수립 불가.',
        instore: text.match(/\[INSTORE\]:?([\s\S]*?)$/)?.[1]?.trim() || '데이터 부족으로 전략 수립 불가.',
        sources: [],
      };

      setAiInsight(parts);
    } catch (e) {
      console.error(e);
      setAiInsight({ main: '분석 중 오류가 발생했습니다.', delivery: '', takeout: '', instore: '', sources: [] });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleShare = async () => {
    if (!aiInsight || !stats) return;
    
    const shareMessage = `
[${selectedStores.join(', ')} 정밀 진단 리포트 - ${selectedMonth}]
━━━━━━━━━━━━━━━━━━━━
📈 매출(홀+배달): ${stats.totalRevenue.toLocaleString()}원
🥡 포장: ${stats.takeoutSum.toLocaleString()}원
📊 효율: ${stats.efficiency.toFixed(1)}수/can

📝 종합 진단:
${aiInsight.main}

🛵 배달 전략: ${aiInsight.delivery}
📦 포장 전략: ${aiInsight.takeout}
🍽️ 내점 전략: ${aiInsight.instore}
━━━━━━━━━━━━━━━━━━━━
    `.trim();

    if (navigator.share) {
      await navigator.share({ title: `${selectedStores.join(', ')} 정밀 진단`, text: shareMessage });
    } else {
      await navigator.clipboard.writeText(shareMessage);
      alert('진단 리포트가 클립보드에 복사되었습니다.');
    }
  };

  const toggleAllStores = () => {
    if (selectedStores.length === filteredStoresList.length) setSelectedStores([]);
    else setSelectedStores(filteredStoresList);
  };

  const effInfo = stats ? getEfficiencyGuide(stats.efficiency) : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-2xl flex flex-col xl:flex-row items-center justify-between gap-6 relative">
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
          <div className="relative">
            <button onClick={() => setIsStoreSelectorOpen(!isStoreSelectorOpen)} className="flex items-center gap-3 bg-slate-800 px-6 py-3.5 rounded-2xl border border-slate-700 text-sm font-black text-white min-w-[200px] justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <Store size={18} className="text-blue-500" />
                <span>{selectedStores.length === 0 ? '가맹점 선택' : `${selectedStores.length}개 매장`}</span>
              </div>
              <ChevronDown size={16} className={`transition-transform ${isStoreSelectorOpen ? 'rotate-180' : ''}`} />
            </button>
            {isStoreSelectorOpen && (
              <div className="absolute top-full left-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-[32px] shadow-[0_30px_60px_rgba(0,0,0,0.6)] z-[100] p-6 animate-in zoom-in-95 duration-200">
                <div className="relative mb-4">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="매장명 검색..." value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} className="w-full bg-slate-800 border-none rounded-xl pl-9 pr-4 py-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500 shadow-inner" />
                </div>
                
                <div className="flex gap-2 mb-4">
                  <button onClick={toggleAllStores} className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-[10px] font-black transition-all">
                    {selectedStores.length === filteredStoresList.length ? <><Square size={12}/> 전체 해제</> : <><CheckSquare size={12}/> 전체 선택</>}
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                  {filteredStoresList.map(s => (
                    <div 
                      key={s} 
                      onClick={(e) => { e.stopPropagation(); setSelectedStores(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]); }} 
                      className={`px-4 py-2.5 rounded-xl cursor-pointer text-xs font-bold transition-all flex items-center justify-between ${selectedStores.includes(s) ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                      {s}
                      {selectedStores.includes(s) && <CheckSquare size={12}/>}
                    </div>
                  ))}
                </div>
                <button onClick={() => setIsStoreSelectorOpen(false)} className="w-full mt-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs shadow-lg transition-all active:scale-95">선택 완료</button>
              </div>
            )}
          </div>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-slate-800 px-6 py-3.5 rounded-2xl border border-slate-700 text-sm font-black text-white outline-none cursor-pointer shadow-lg">
            {months.map(m => <option key={m} value={m} className="bg-slate-900">{m}</option>)}
          </select>
        </div>
        <div className="flex gap-4">
          <button onClick={handleShare} disabled={!aiInsight} className="bg-slate-800 text-slate-300 px-6 py-3.5 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-slate-700 transition-all cursor-pointer shadow-lg disabled:opacity-30">
            <Share2 size={18} /> 리포트 공유
          </button>
          <button onClick={handleAIAnalysis} disabled={isAnalyzing || selectedStores.length === 0} className="bg-blue-600 hover:bg-blue-700 px-8 py-3.5 rounded-2xl font-black text-white flex items-center gap-2 shadow-lg transition-all disabled:opacity-50">
            {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} 
            정밀 진단 리포트 생성
          </button>
        </div>
      </div>

      {stats && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900 p-8 rounded-[40px] border-2 border-blue-500/30 shadow-2xl">
              <p className="text-[10px] font-black text-blue-400 mb-2 uppercase tracking-widest">선택 기간 매출 (홀+배달)</p>
              <div className="flex items-baseline gap-2">
                <h4 className="text-3xl font-black text-white">{stats.totalRevenue.toLocaleString()}원</h4>
                <GrowthBadge current={stats.totalRevenue} previous={stats.prevTotalRevenue} />
              </div>
              <p className="text-[10px] font-bold text-slate-500 mt-1">총 {stats.totalOrders.toLocaleString()}건 결제</p>
            </div>

            <div className="bg-slate-900 p-8 rounded-[40px] border-2 border-rose-500/30 shadow-2xl">
              <p className="text-[10px] font-black text-rose-400 mb-2 uppercase tracking-widest">선택 기간 단독 포장</p>
              <div className="flex items-baseline gap-2">
                <h4 className="text-3xl font-black text-white">{stats.takeoutSum.toLocaleString()}원</h4>
              </div>
              <p className="text-[10px] font-bold text-slate-500 mt-1">포장 전용 매출 (합계 제외)</p>
            </div>

            <div className={`bg-slate-900 p-8 rounded-[40px] border-2 shadow-xl cursor-pointer transition-all ${isEffExpanded ? 'border-blue-500/40' : 'border-slate-800 hover:border-slate-700'}`} onClick={() => setIsEffExpanded(!isEffExpanded)}>
              <div className="flex justify-between items-start">
                <div>
                  <p className={`text-[10px] font-black mb-2 uppercase tracking-widest ${effInfo?.color}`}>조리 효율 진단</p>
                  <h4 className={`text-3xl font-black ${effInfo?.color}`}>{stats.efficiency.toFixed(1)} <span className="text-sm">수</span></h4>
                </div>
                {isEffExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
              </div>
              {isEffExpanded && effInfo && (
                <div className="mt-4 pt-4 border-t border-slate-800 animate-in slide-in-from-top-1">
                  <div className={`p-3 rounded-xl ${effInfo.bg} border ${effInfo.color.replace('text', 'border')}/20 flex items-start gap-2`}>
                    <Info size={12} className={`mt-0.5 shrink-0 ${effInfo.color}`} />
                    <p className={`text-[10px] font-bold leading-relaxed ${effInfo.color}`}>{effInfo.ment}</p>
                  </div>
                </div>
              )}
            </div>

            <div className={`bg-slate-900 p-8 rounded-[40px] border-2 shadow-xl cursor-pointer transition-all ${isHolidayExpanded ? 'border-amber-500/40' : 'border-slate-800 hover:border-slate-700'}`} onClick={() => setIsHolidayExpanded(!isHolidayExpanded)}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">총 휴무 현황</p>
                  <h4 className="text-3xl font-black text-white">{stats.totalHolidays.toLocaleString()} / {stats.totalPotentialDays.toLocaleString()} 일</h4>
                </div>
                {isHolidayExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
              </div>
              {isHolidayExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-800 animate-in slide-in-from-top-1 space-y-1">
                  <p className="text-[10px] font-bold text-rose-400">기준 기간 내 {stats.totalHolidays}일 휴무 (매출 0원 포함)</p>
                </div>
              )}
            </div>
          </div>

          {/* Detailed Lists Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-xl overflow-hidden">
              <div onClick={() => setIsChannelsExpanded(!isChannelsExpanded)} className="p-8 border-b border-slate-800 bg-slate-800/20 flex justify-between items-center cursor-pointer">
                <div className="flex items-center gap-3">
                  <Smartphone className="text-blue-500" size={20} />
                  <div className="flex flex-col">
                    <h4 className="text-base font-black text-white">채널별 매출 상세</h4>
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">플랫폼 총합: {stats.platformSum.toLocaleString()}원</p>
                  </div>
                </div>
                {isChannelsExpanded ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
              </div>
              {isChannelsExpanded && (
                <div className="p-8 space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between p-5 bg-blue-500/5 rounded-2xl border border-blue-500/20 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-600 p-2 rounded-lg text-white"><TrendingUp size={14}/></div>
                      <div>
                        <span className="text-[11px] font-black text-blue-400 uppercase tracking-tighter block mb-0.5">Hall Sales</span>
                        <span className="text-sm font-black text-white">내점(홀) 매출</span>
                      </div>
                      <GrowthBadge current={stats.instoreSum} previous={stats.revMap['내점']?.prevAmount || 0} />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-white">{stats.instoreSum.toLocaleString()}원</p>
                      <p className="text-[10px] text-slate-500">비중 {stats.totalRevenue > 0 ? ((stats.instoreSum / stats.totalRevenue) * 100).toFixed(1) : 0}%</p>
                    </div>
                  </div>
                  {Object.entries(stats.revMap).filter(([n]) => n !== '내점').sort((a:any, b:any) => b[1].amount - a[1].amount).map(([name, val]: [string, any]) => (
                    <div key={name} className="flex items-center justify-between p-4 bg-slate-800/40 rounded-2xl border border-slate-800">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-300">{name}</span>
                        <GrowthBadge current={val.amount} previous={val.prevAmount} />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-white">{val.amount.toLocaleString()}원</p>
                        <p className="text-[10px] text-slate-500">({val.count.toLocaleString()}건)</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-xl overflow-hidden">
              <div onClick={() => setIsMaterialsExpanded(!isMaterialsExpanded)} className="p-8 border-b border-slate-800 bg-slate-800/20 flex justify-between items-center cursor-pointer">
                <div className="flex items-center gap-3">
                  <Package className="text-rose-500" size={20} />
                  <div className="flex flex-col">
                    <h4 className="text-base font-black text-white">원부자재 매입 상세</h4>
                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-tighter">매입 총합: {stats.totalProcurement.toLocaleString()}원</p>
                  </div>
                </div>
                {isMaterialsExpanded ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
              </div>
              {isMaterialsExpanded && (
                <div className="p-8 space-y-3 animate-in fade-in duration-300">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10 text-center">
                      <div className="flex justify-center mb-1 text-rose-500"><Box size={14}/></div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">원자재(육류)</p>
                      <p className="text-xs font-black text-white">{stats.rawMatSum.toLocaleString()}원</p>
                    </div>
                    <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10 text-center">
                      <div className="flex justify-center mb-1 text-blue-500"><Droplet size={14}/></div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">전용유</p>
                      <p className="text-xs font-black text-white">{stats.oilAmountSum.toLocaleString()}원</p>
                    </div>
                    <div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10 text-center">
                      <div className="flex justify-center mb-1 text-amber-500"><ShoppingCart size={14}/></div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">부자재/발주</p>
                      <p className="text-xs font-black text-white">{stats.subMaterialAmountSum.toLocaleString()}원</p>
                    </div>
                  </div>
                  <div className="h-px bg-slate-800/50 mb-4"></div>
                  {Object.entries(stats.matMap).sort((a:any, b:any) => b[1].amount - a[1].amount).map(([name, val]: [string, any]) => (
                    <div key={name} className="flex items-center justify-between p-4 bg-slate-800/40 rounded-2xl border border-slate-800">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-300">{name}</span>
                        <GrowthBadge current={val.amount} previous={val.prevAmount} />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-white">{val.amount.toLocaleString()}원</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-600/5 border border-blue-500/20 p-8 rounded-[40px] shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Smartphone className="text-blue-500" size={20} />
                <h5 className="text-sm font-black text-white uppercase tracking-widest">배달 성장 전략</h5>
              </div>
              <p className="text-xs font-bold text-slate-300 leading-relaxed whitespace-pre-wrap">{aiInsight?.delivery || '진단 리포트를 생성하여 데이터 기반 전략을 확인하세요.'}</p>
            </div>
            <div className="bg-rose-600/5 border border-rose-500/20 p-8 rounded-[40px] shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <ShoppingBag className="text-rose-500" size={20} />
                <h5 className="text-sm font-black text-white uppercase tracking-widest">포장 성장 전략</h5>
              </div>
              <p className="text-xs font-bold text-slate-300 leading-relaxed whitespace-pre-wrap">{aiInsight?.takeout || '진단 리포트를 생성하여 데이터 기반 전략을 확인하세요.'}</p>
            </div>
            <div className="bg-emerald-600/5 border border-emerald-500/20 p-8 rounded-[40px] shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Utensils className="text-emerald-500" size={20} />
                <h5 className="text-sm font-black text-white uppercase tracking-widest">내점 성장 전략</h5>
              </div>
              <p className="text-xs font-bold text-slate-300 leading-relaxed whitespace-pre-wrap">{aiInsight?.instore || '진단 리포트를 생성하여 데이터 기반 전략을 확인하세요.'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-xl overflow-hidden">
              <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
                <div className="flex items-center gap-3"><Edit3 className="text-blue-500" size={20} /><h4 className="text-base font-black text-white">가맹점 정밀 상담 메모</h4></div>
                {selectedStores.length === 1 && (
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black transition-all ${syncStatus === 'syncing' ? 'text-blue-400 border-blue-500/20' : 'text-emerald-400 border-emerald-500/20'}`}>
                    {syncStatus === 'syncing' ? <Loader2 size={10} className="animate-spin" /> : <ShieldCheck size={10} />}
                    {syncStatus === 'syncing' ? '동기화 중...' : '클라우드 저장됨'}
                  </div>
                )}
              </div>
              <textarea value={consultationNotes} onChange={(e) => { setConsultationNotes(e.target.value); setSyncStatus('syncing'); }} placeholder={selectedStores.length === 1 ? "이 가맹점에 대한 상담 내역을 기록하세요..." : "메모 기능은 한 개의 가맹점 선택 시에만 활성화됩니다."} disabled={selectedStores.length !== 1} className="w-full min-h-[300px] p-8 bg-transparent border-none text-slate-200 text-sm outline-none resize-none leading-relaxed placeholder:text-slate-600" />
            </div>
            <div className="space-y-6">
              {aiInsight && (
                <div className="bg-slate-900 rounded-[40px] border border-blue-500/20 p-8 shadow-2xl animate-in slide-in-from-bottom-4 space-y-6">
                  <div className="flex items-center gap-3">
                    <Sparkles className="text-blue-500" size={20} />
                    <h4 className="text-base font-black text-white">AI 통합 경영 진단 및 경쟁사 분석</h4>
                  </div>
                  <div className="bg-slate-950/50 p-6 rounded-3xl text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{aiInsight.main}</div>
                  
                  {aiInsight.sources.length > 0 && (
                    <div className="p-4 bg-slate-800/20 border border-slate-700 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-3 flex items-center gap-2"><MapPin size={12} className="text-blue-500" /> 분석 근거 데이터</p>
                      <div className="space-y-2">
                        {aiInsight.sources.map((s: any, idx: number) => (
                          s.web && (
                            <a key={idx} href={s.web.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-blue-500/30 transition-all group">
                              <span className="text-[10px] font-bold text-slate-400 truncate flex-1 pr-4">{s.web.title || s.web.uri}</span>
                              <ExternalLink size={10} className="text-slate-600 group-hover:text-blue-500" />
                            </a>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreDetailAnalysis;
