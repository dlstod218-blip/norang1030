
import React, { useMemo, useState } from 'react';
import { RawSalesData, normalizeChannel, getChannelType } from '../types';
import { 
  ChevronDown, ChevronUp, Store, User, MapPin, 
  Search, Calendar, Utensils, Smartphone, TrendingUp, ShoppingBag, 
  ArrowUpDown, ArrowUp, ArrowDown, Package, Droplets, AlertCircle,
  ArrowUpRight, ArrowDownRight, Zap, PieChart, LayoutList, Award, AlertTriangle,
  CalendarOff, Moon, CheckCircle2, ClipboardList, SearchX, Star, Medal, Crown, Activity
} from 'lucide-react';
import { format, parseISO, startOfWeek, startOfMonth, isWithinInterval, startOfDay, endOfDay, subDays, differenceInDays, endOfMonth, isValid, isToday, isBefore, getYear, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Props {
  data: RawSalesData[];
  startDate: string;
  endDate: string;
}

type GroupBy = 'store' | 'manager' | 'region';
type SortKey = 'name' | 'totalAmount' | 'totalCount' | 'takeoutAmount' | 'aov';
type SortDirection = 'asc' | 'desc' | null;

const getEfficiencyAlert = (eff: number, prevEff?: number) => {
  if (eff === 0) return { label: '심각: 전용유 미발주', color: 'text-rose-500', icon: <AlertTriangle size={12}/> };
  if (eff >= 60 && eff <= 70) return { label: '정상범위', color: 'text-emerald-500', icon: <CheckCircle2 size={12}/> };
  if (eff > 30 && eff < 60) return { label: '저효율 (이익저하)', color: 'text-amber-500', icon: <AlertCircle size={12}/> };
  
  if (eff > 0 && eff <= 30) {
    let sub = '원자재 사입, 전월이월 의심 및 전용유 사입의심';
    if (prevEff && prevEff > 70) sub = '전월 과다사용 이월소진 의심';
    return { label: sub, color: 'text-rose-500', icon: <AlertTriangle size={12}/> };
  }
  
  if (eff > 70) {
    let sub = '전용유 사입, 산가초과 의심';
    if (prevEff && prevEff > 70) sub = '중복 초과사용 매장';
    return { label: sub, color: 'text-rose-500', icon: <AlertTriangle size={12}/> };
  }
  
  return { label: '데이터 없음', color: 'text-slate-500', icon: <SearchX size={12}/> };
};

const GrowthIndicatorSmall = ({ current, previous }: { current: number, previous: number }) => {
  if (previous <= 0) return null;
  const growth = ((current - previous) / previous) * 100;
  const isPositive = growth >= 0;
  return (
    <span className={`text-[8px] font-black inline-flex items-center ml-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
      {isPositive ? '▲' : '▼'} {Math.abs(growth).toFixed(0)}%
    </span>
  );
};

const DetailedAnalysis: React.FC<Props> = ({ data, startDate, endDate }) => {
  const [groupBy, setGroupBy] = useState<GroupBy>('store');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isStoreEffExpanded, setIsStoreEffExpanded] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'totalAmount', direction: 'desc' });

  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
  }, [startDate, endDate]);

  const getTimeKey = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (durationDays <= 31) return format(date, 'MM/dd (E)', { locale: ko });
    if (durationDays <= 180) return format(startOfWeek(date, { weekStartsOn: 1 }), 'MM/dd w주차');
    return format(startOfMonth(date), 'yyyy/MM');
  };

  const aggregatedData = useMemo(() => {
    if (!startDate || !endDate || data.length === 0) return [];

    const currentS = startOfDay(parseISO(startDate));
    const currentE = endOfDay(parseISO(endDate));
    const monthStart = startOfMonth(currentE);
    
    // Previous period logic
    const isMTD = isToday(currentE) || isToday(subDays(new Date(), 1));
    const prevS = isMTD ? startOfMonth(subMonths(currentS, 1)) : subDays(currentS, durationDays);
    const prevE = isMTD ? subMonths(currentE, 1) : subDays(currentS, 1);
    
    const today = startOfDay(new Date());
    let effectiveEndForHoliday = currentE;
    if (isToday(currentE) || isBefore(today, currentE)) effectiveEndForHoliday = subDays(today, 1);
    const effectiveDuration = Math.max(0, differenceInDays(effectiveEndForHoliday, currentS) + 1);

    const groupToStoresMap: Record<string, Set<string>> = {};
    data.forEach(item => {
      let key = '';
      if (groupBy === 'store') key = item.storeName;
      else if (groupBy === 'manager') key = item.managerName;
      else key = item.region;
      if (!groupToStoresMap[key]) groupToStoresMap[key] = new Set();
      groupToStoresMap[key].add(item.storeName);
    });

    const groups: Record<string, any> = {};

    data.forEach(item => {
      const itemDate = parseISO(item.date);
      if (!isValid(itemDate)) return;

      const normChan = normalizeChannel(item.channel);
      const cType = getChannelType(normChan);
      const isCurrent = isWithinInterval(itemDate, { start: currentS, end: currentE });
      const isPrevious = isWithinInterval(itemDate, { start: startOfDay(prevS), end: endOfDay(prevE) });
      const isCumulative = isWithinInterval(itemDate, { start: monthStart, end: currentE });

      let entityKey = '';
      if (groupBy === 'store') entityKey = item.storeName;
      else if (groupBy === 'manager') entityKey = item.managerName;
      else entityKey = item.region;

      if (!groups[entityKey]) {
        groups[entityKey] = {
          id: entityKey, name: entityKey, totalAmount: 0, totalCount: 0, prevTotalAmount: 0, prevTotalCount: 0, 
          takeoutAmount: 0, takeoutCount: 0, prevTakeoutAmount: 0,
          totalCost: 0, totalCostCount: 0, rawCount: 0, oilCount: 0,
          cumRawCount: 0, cumOilCount: 0,
          channels: {} as Record<string, any>, timeSeries: {} as Record<string, any>, rawMaterials: {} as Record<string, any>,
          activeDaysMap: {} as Record<string, Set<string>>,
          storeCumMap: {} as Record<string, { raw: number, oil: number }>
        };
      }
      const g = groups[entityKey];

      if (isCurrent) {
        if (normChan === '포장' || cType === 'takeout') {
          g.takeoutAmount += item.amount; g.takeoutCount += item.orderCount;
          if (!g.activeDaysMap[item.storeName]) g.activeDaysMap[item.storeName] = new Set();
          g.activeDaysMap[item.storeName].add(item.date);
        } else if (cType === 'platform' || normChan === '내점') {
          if (!g.activeDaysMap[item.storeName]) g.activeDaysMap[item.storeName] = new Set();
          g.activeDaysMap[item.storeName].add(item.date);
          g.totalAmount += item.amount; g.totalCount += item.orderCount;
          const tKey = getTimeKey(item.date);
          if (!g.timeSeries[tKey]) g.timeSeries[tKey] = { amount: 0, count: 0 };
          g.timeSeries[tKey].amount += item.amount; g.timeSeries[tKey].count += item.orderCount;
          
          if (!g.channels[normChan]) g.channels[normChan] = { amount: 0, count: 0, prevAmount: 0, prevCount: 0 };
          g.channels[normChan].amount += item.amount; g.channels[normChan].count += item.orderCount;
        }
        
        if (cType === 'material') {
          g.totalCost += item.amount; g.totalCostCount += item.orderCount;
          if (normChan === '전용유') g.oilCount += item.orderCount;
          else if (normChan !== '부자재' && normChan !== '발주') g.rawCount += item.orderCount;
          if (!g.rawMaterials[normChan]) g.rawMaterials[normChan] = { amount: 0, count: 0, prevAmount: 0, prevCount: 0 };
          g.rawMaterials[normChan].amount += item.amount; g.rawMaterials[normChan].count += item.orderCount;
        }
      }

      if (isCumulative && cType === 'material') {
        if (!g.storeCumMap[item.storeName]) g.storeCumMap[item.storeName] = { raw: 0, oil: 0 };
        if (normChan === '전용유') {
          g.cumOilCount += item.orderCount;
          g.storeCumMap[item.storeName].oil += item.orderCount;
        } else if (normChan !== '부자재' && normChan !== '발주') {
          g.cumRawCount += item.orderCount;
          g.storeCumMap[item.storeName].raw += item.orderCount;
        }
      }

      if (isPrevious) {
        if (cType === 'platform' || normChan === '내점') {
          g.prevTotalAmount += item.amount;
          g.prevTotalCount += item.orderCount;
          if (!g.channels[normChan]) g.channels[normChan] = { amount: 0, count: 0, prevAmount: 0, prevCount: 0 };
          g.channels[normChan].prevAmount += item.amount;
          g.channels[normChan].prevCount += item.orderCount;
        } else if (normChan === '포장' || cType === 'takeout') {
          g.prevTakeoutAmount += item.amount;
        } else if (cType === 'material') {
          if (!g.rawMaterials[normChan]) g.rawMaterials[normChan] = { amount: 0, count: 0, prevAmount: 0, prevCount: 0 };
          g.rawMaterials[normChan].prevAmount += item.amount;
          g.rawMaterials[normChan].prevCount += item.orderCount;
        }
      }
    });

    let result = Object.values(groups).filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase())).map(g => {
      const holidayStoreDetails: Array<{ storeName: string, holidayCount: number, activeCount: number }> = [];
      const storesInGroup = groupToStoresMap[g.id] || new Set();
      let groupTotalActiveDays = 0;
      storesInGroup.forEach(store => {
        const activeCount = g.activeDaysMap[store]?.size || 0;
        groupTotalActiveDays += activeCount;
        if (activeCount < effectiveDuration) {
          holidayStoreDetails.push({ storeName: store, holidayCount: effectiveDuration - activeCount, activeCount });
        }
      });
      const efficiency = g.cumOilCount > 0 ? g.cumRawCount / g.cumOilCount : 0;
      const storeEffList = Object.entries(g.storeCumMap).map(([storeName, stats]: [string, any]) => ({
        name: storeName,
        eff: stats.oil > 0 ? stats.raw / stats.oil : 0,
        raw: stats.raw,
        oil: stats.oil
      })).sort((a, b) => b.eff - a.eff);
      const growthRate = g.prevTotalAmount > 0 ? ((g.totalAmount - g.prevTotalAmount) / g.prevTotalAmount) * 100 : 0;
      return { ...g, efficiency, growthRate, holidayStoresCount: holidayStoreDetails.length, holidayStoreDetails: holidayStoreDetails.sort((a, b) => b.holidayCount - a.holidayCount), storeEffList, totalOperatingDays: groupTotalActiveDays };
    });

    if (sortConfig.direction) {
      result.sort((a, b) => {
        let aV = sortConfig.key === 'aov' ? (a.totalCount > 0 ? a.totalAmount/a.totalCount : 0) : a[sortConfig.key];
        let bV = sortConfig.key === 'aov' ? (b.totalCount > 0 ? b.totalAmount/b.totalCount : 0) : b[sortConfig.key];
        return sortConfig.direction === 'asc' ? (aV < bV ? -1 : 1) : (aV > bV ? -1 : 1);
      });
    } else { result.sort((a, b) => b.totalAmount - a.totalAmount); }
    return result;
  }, [data, groupBy, searchTerm, sortConfig, startDate, endDate, durationDays]);

  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);
  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    else if (sortConfig.key === key && sortConfig.direction === 'asc') direction = null;
    setSortConfig({ key, direction });
  };

  const GrowthBadge = ({ current, previous }: { current: number, previous: number }) => {
    if (previous === 0) return null;
    const diff = current - previous;
    const isUp = diff >= 0;
    return (
      <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black border ${isUp ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
        {isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />} {Math.abs((diff/previous)*100).toFixed(1)}%
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row justify-between gap-4">
        <div className="flex bg-slate-800 p-1.5 rounded-2xl w-full md:w-auto">
          {(['store', 'manager', 'region'] as GroupBy[]).map((type) => (
            <button key={type} onClick={() => { setGroupBy(type); setExpandedId(null); }} className={`flex-1 md:flex-none px-8 py-2.5 rounded-xl text-xs font-black transition-all ${groupBy === type ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
              {type === 'store' ? '가맹점별' : type === 'manager' ? '담당자별' : '지역별'}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input type="text" placeholder="분석 대상을 검색하세요..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-3 bg-slate-800 border-none rounded-2xl text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
        </div>
      </div>

      <div className="bg-slate-900 rounded-[32px] border border-slate-800 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-800">
                <th onClick={() => handleSort('name')} className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase cursor-pointer">분석 대상 명칭 (운영일수)</th>
                {(groupBy === 'store' || groupBy === 'manager') && <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase text-center">조리 효율 (누적)</th>}
                <th onClick={() => handleSort('totalAmount')} className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase text-right cursor-pointer">총 매출 실적 및 상승률</th>
                <th onClick={() => handleSort('totalCount')} className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase text-right cursor-pointer">주문 건수</th>
                <th onClick={() => handleSort('takeoutAmount')} className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase text-right cursor-pointer">단독 포장 실적</th>
                <th onClick={() => handleSort('aov')} className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase text-right cursor-pointer">평균 객단가</th>
                <th className="px-4 py-5 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {aggregatedData.map((row) => {
                const isExpanded = expandedId === row.id;
                const effAlert = getEfficiencyAlert(row.efficiency);
                const aov = row.totalCount > 0 ? row.totalAmount / row.totalCount : 0;
                const prevAov = row.prevTotalCount > 0 ? row.prevTotalAmount / row.prevTotalCount : 0;
                
                return (
                  <React.Fragment key={row.id}>
                    <tr onClick={() => toggleExpand(row.id)} className={`cursor-pointer transition-all ${isExpanded ? 'bg-blue-600/10' : 'hover:bg-slate-800/30'}`}>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl ${isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{groupBy === 'store' ? <Store size={20} /> : groupBy === 'manager' ? <User size={20} /> : <MapPin size={20} />}</div>
                          <div>
                            <div className="font-black text-slate-100 text-base flex items-center gap-2">
                              {row.name}
                              <span className="text-[10px] text-slate-500 font-bold bg-slate-800 px-2 py-0.5 rounded">{row.totalOperatingDays}일 운영</span>
                              {row.holidayStoresCount > 0 && <span className="text-[9px] font-black bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded border border-rose-500/20 uppercase flex items-center gap-1"><CalendarOff size={10} /> {row.holidayStoresCount}개점 휴무</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      {(groupBy === 'store' || groupBy === 'manager') && (
                        <td className="px-8 py-6">
                          <div className="flex flex-col items-center">
                            <span className={`text-[11px] font-black ${effAlert.color}`}>{row.efficiency.toFixed(1)}수/can</span>
                            <span className={`text-[8px] font-black uppercase ${effAlert.color} flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-700/50`}>{effAlert.label}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-8 py-6 text-right"><div className="flex flex-col items-end gap-1"><span className="font-black text-white text-lg">{row.totalAmount.toLocaleString()}원</span><GrowthBadge current={row.totalAmount} previous={row.prevTotalAmount} /></div></td>
                      <td className="px-8 py-6 text-right"><div className="flex flex-col items-end gap-1 font-bold text-slate-400">{row.totalCount.toLocaleString()}건 <GrowthBadge current={row.totalCount} previous={row.prevTotalCount} /></div></td>
                      <td className="px-8 py-6 text-right"><div className="flex flex-col items-end gap-1 font-black text-amber-500">{row.takeoutAmount.toLocaleString()}원 <GrowthBadge current={row.takeoutAmount} previous={row.prevTakeoutAmount} /></div></td>
                      <td className="px-8 py-6 text-right"><div className="flex flex-col items-end gap-1"><div className="inline-block font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">{Math.round(aov).toLocaleString()}원</div><GrowthBadge current={aov} previous={prevAov} /></div></td>
                      <td className="px-4 py-6 text-center text-slate-600">{isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-950/30">
                        <td colSpan={groupBy === 'store' || groupBy === 'manager' ? 7 : 6} className="px-8 py-10 border-y border-slate-800">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <div className="space-y-6">
                               <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                                  <Activity size={18} className="text-blue-500" />
                                  <h4 className="text-sm font-black text-white">채널별 상세 매출 및 상승률</h4>
                               </div>
                               <div className="space-y-2">
                                  {Object.entries(row.channels).sort((a:any,b:any)=>b[1].amount-a[1].amount).map(([chan, val]: [string, any]) => (
                                    <div key={chan} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl">
                                      <span className="text-xs font-bold text-slate-300">
                                        {chan}
                                        <GrowthIndicatorSmall current={val.amount} previous={val.prevAmount} />
                                      </span>
                                      <div className="text-right">
                                        <p className="text-xs font-black text-white">{val.amount.toLocaleString()}원</p>
                                        <p className="text-[10px] font-bold text-slate-500">{val.count}건 <GrowthIndicatorSmall current={val.count} previous={val.prevCount} /></p>
                                      </div>
                                    </div>
                                  ))}
                               </div>
                            </div>
                            
                            <div className="space-y-6">
                               <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                                  <Package size={18} className="text-rose-500" />
                                  <h4 className="text-sm font-black text-white">원부자재 매입 상세 및 상승률</h4>
                               </div>
                               <div className="space-y-2">
                                  {Object.entries(row.rawMaterials).sort((a:any,b:any)=>b[1].amount-a[1].amount).map(([name, val]: [string, any]) => (
                                    <div key={name} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl">
                                      <span className="text-xs font-bold text-slate-300">
                                        {name}
                                        <GrowthIndicatorSmall current={val.amount} previous={val.prevAmount} />
                                      </span>
                                      <div className="text-right">
                                        <p className="text-xs font-black text-white">{val.amount.toLocaleString()}원</p>
                                        <p className="text-[10px] font-bold text-slate-500">{val.count}{name.includes('전용유')?'can':'수'} <GrowthIndicatorSmall current={val.count} previous={val.prevCount} /></p>
                                      </div>
                                    </div>
                                  ))}
                               </div>

                               {row.holidayStoresCount > 0 && (
                                 <div className="mt-8">
                                    <div className="flex items-center gap-2 border-b border-slate-800 pb-4 mb-4">
                                      <CalendarOff size={18} className="text-amber-500" />
                                      <h4 className="text-sm font-black text-white">상세 휴무 현황</h4>
                                    </div>
                                    <div className="space-y-2">
                                      {row.holidayStoreDetails.map((h: any) => (
                                        <div key={h.storeName} className="flex justify-between items-center p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                                          <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-300">{h.storeName}</span>
                                            <span className="text-[10px] text-slate-500">{h.activeCount}일 운영</span>
                                          </div>
                                          <span className="text-xs font-black text-amber-500">{h.holidayCount}일 휴무</span>
                                        </div>
                                      ))}
                                    </div>
                                 </div>
                               )}
                            </div>

                            {groupBy !== 'store' && (
                              <div className="lg:col-span-2 mt-6 space-y-6">
                                <div onClick={() => setIsStoreEffExpanded(!isStoreEffExpanded)} className="flex items-center justify-between border-b border-slate-800 pb-4 cursor-pointer group hover:border-emerald-500/30 transition-colors">
                                  <div className="flex items-center gap-2">
                                    <div className="bg-emerald-500/10 p-2 rounded-lg"><Store size={16} className="text-emerald-500" /></div>
                                    <h4 className="text-sm font-black text-white">소속 가맹점별 조리 효율 현황 (심각 매장 포함)</h4>
                                  </div>
                                  {isStoreEffExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                                </div>
                                {isStoreEffExpanded && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-300">
                                    {row.storeEffList.map((s: any) => {
                                      const sAlert = getEfficiencyAlert(s.eff);
                                      return (
                                        <div key={s.name} className="p-6 rounded-[28px] bg-slate-900 border border-slate-800 hover:border-emerald-500/30 transition-all">
                                          <div className="flex justify-between items-start mb-4"><div className="text-sm font-black text-white truncate w-2/3">{s.name}</div><div className={`p-2 rounded-xl bg-slate-800 ${sAlert.color}`}>{sAlert.icon}</div></div>
                                          <div className="flex items-baseline gap-1"><p className={`text-xl font-black ${sAlert.color}`}>{s.eff.toFixed(1)}</p><span className="text-[10px] font-bold text-slate-500">수/can</span></div>
                                          <p className={`text-[9px] font-black mt-1 ${sAlert.color}`}>{sAlert.label}</p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DetailedAnalysis;
