
import React, { useMemo, useState } from 'react';
import { RawSalesData, normalizeChannel, getChannelType } from '../types';
import { 
  ChevronDown, ChevronUp, Search, Smartphone, Package, Droplets, 
  CalendarDays, Info, ArrowUpRight, ArrowDownRight, ShoppingBag, PieChart, Box, Droplet, ShoppingCart,
  // Fix: Added missing TrendingUp import
  TrendingUp
} from 'lucide-react';
import { format, parseISO, startOfMonth, isWithinInterval, startOfDay, endOfDay, 
  subDays, differenceInDays, isValid, isToday, subMonths, eachDayOfInterval 
} from 'date-fns';
import { getEfficiencyGuide, GrowthBadge } from './DashboardOverview';

interface Props {
  data: RawSalesData[];
  startDate: string;
  endDate: string;
}

interface GroupData {
  id: string;
  name: string;
  totalAmount: number;
  totalCount: number;
  prevTotalAmount: number;
  takeoutAmountSum: number;
  takeoutCountSum: number;
  platformAmountSum: number;
  platformCountSum: number;
  inStoreAmountSum: number;
  inStoreCountSum: number;
  rawMaterialAmountSum: number;
  oilAmountSum: number;
  subMaterialAmountSum: number;
  totalProcurementSum: number;
  cumRawCount: number;
  cumOilCount: number;
  channels: Record<string, { amount: number, count: number }>;
  rawMaterials: Record<string, { amount: number, count: number }>;
  prevChannels: Record<string, { amount: number, count: number }>;
  prevRawMaterials: Record<string, { amount: number, count: number }>;
  storeDailyRevenue: Record<string, Record<string, number>>;
  storeEffMap: Record<string, { raw: number, oil: number }>;
}

const DetailedAnalysis: React.FC<Props> = ({ data, startDate, endDate }) => {
  const [groupBy, setGroupBy] = useState<'store' | 'manager' | 'region'>('store');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedSection, setExpandedSection] = useState<Record<string, Set<string>>>({});

  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
  }, [startDate, endDate]);

  const aggregatedData = useMemo(() => {
    if (!startDate || !endDate || data.length === 0) return [];

    const currentS = startOfDay(parseISO(startDate));
    const currentE = endOfDay(parseISO(endDate));
    const monthStart = startOfMonth(currentE);
    const dateRangeList = eachDayOfInterval({ start: currentS, end: currentE }).map(d => format(d, 'yyyy-MM-dd'));
    
    const isMTD = isToday(currentE) || isToday(subDays(new Date(), 1));
    const prevS = isMTD ? startOfMonth(subMonths(currentS, 1)) : subDays(currentS, durationDays);
    const prevE = isMTD ? subMonths(currentE, 1) : subDays(currentS, 1);

    const groups: Record<string, GroupData> = {};
    const allStoreNamesByGroup: Record<string, Set<string>> = {};

    data.forEach(item => {
      let entityKey = item[groupBy === 'store' ? 'storeName' : groupBy === 'manager' ? 'managerName' : 'region'];
      if (!allStoreNamesByGroup[entityKey]) allStoreNamesByGroup[entityKey] = new Set();
      allStoreNamesByGroup[entityKey].add(item.storeName);
    });

    data.forEach(item => {
      const itemDate = parseISO(item.date);
      if (!isValid(itemDate)) return;

      const normChan = normalizeChannel(item.channel);
      const cType = getChannelType(normChan);
      const isCurrent = isWithinInterval(itemDate, { start: currentS, end: currentE });
      const isPrevious = isWithinInterval(itemDate, { start: startOfDay(prevS), end: endOfDay(prevE) });
      const isCumulative = isWithinInterval(itemDate, { start: monthStart, end: currentE });

      let entityKey = item[groupBy === 'store' ? 'storeName' : groupBy === 'manager' ? 'managerName' : 'region'];

      if (!groups[entityKey]) {
        groups[entityKey] = {
          id: entityKey, name: entityKey, totalAmount: 0, totalCount: 0, prevTotalAmount: 0,
          takeoutAmountSum: 0, takeoutCountSum: 0,
          platformAmountSum: 0, platformCountSum: 0, inStoreAmountSum: 0, inStoreCountSum: 0,
          rawMaterialAmountSum: 0, oilAmountSum: 0, subMaterialAmountSum: 0,
          totalProcurementSum: 0, cumRawCount: 0, cumOilCount: 0,
          channels: {}, rawMaterials: {},
          prevChannels: {}, prevRawMaterials: {},
          storeDailyRevenue: {}, storeEffMap: {}
        };
      }
      const g = groups[entityKey];

      if (isCurrent) {
        if (cType === 'takeout') {
          g.takeoutAmountSum += item.amount; g.takeoutCountSum += item.orderCount;
        }

        if (cType === 'platform' || normChan === '내점' || cType === 'takeout') {
          if (!g.storeDailyRevenue[item.storeName]) g.storeDailyRevenue[item.storeName] = {};
          
          if (normChan !== '포장' && cType !== 'takeout') {
            g.totalAmount += item.amount; g.totalCount += item.orderCount;
            g.storeDailyRevenue[item.storeName][item.date] = (g.storeDailyRevenue[item.storeName][item.date] || 0) + item.amount;
            
            if (cType === 'platform') { g.platformAmountSum += item.amount; g.platformCountSum += item.orderCount; }
            else if (normChan === '내점') { g.inStoreAmountSum += item.amount; g.inStoreCountSum += item.orderCount; }
            
            if (!g.channels[normChan]) g.channels[normChan] = { amount: 0, count: 0 };
            g.channels[normChan].amount += item.amount; g.channels[normChan].count += item.orderCount;
          }
        } else if (cType === 'material') {
          g.totalProcurementSum += item.amount;
          if (normChan === '전용유') g.oilAmountSum += item.amount;
          else if (normChan === '부자재' || normChan === '발주') g.subMaterialAmountSum += item.amount;
          else g.rawMaterialAmountSum += item.amount;

          if (!g.rawMaterials[normChan]) g.rawMaterials[normChan] = { amount: 0, count: 0 };
          g.rawMaterials[normChan].amount += item.amount; g.rawMaterials[normChan].count += item.orderCount;
        }
      }

      if (isPrevious) {
        if (cType === 'platform' || normChan === '내점') {
          g.prevTotalAmount += item.amount;
          if (!g.prevChannels[normChan]) g.prevChannels[normChan] = { amount: 0, count: 0 };
          g.prevChannels[normChan].amount += item.amount; g.prevChannels[normChan].count += item.orderCount;
        } else if (cType === 'material') {
          if (!g.prevRawMaterials[normChan]) g.prevRawMaterials[normChan] = { amount: 0, count: 0 };
          g.prevRawMaterials[normChan].amount += item.amount; g.prevRawMaterials[normChan].count += item.orderCount;
        }
      }

      if (isCumulative && cType === 'material') {
        if (!g.storeEffMap[item.storeName]) g.storeEffMap[item.storeName] = { raw: 0, oil: 0 };
        if (normChan === '전용유') { g.cumOilCount += item.orderCount; g.storeEffMap[item.storeName].oil += item.orderCount; }
        else if (normChan !== '부자재' && normChan !== '발주') { g.cumRawCount += item.orderCount; g.storeEffMap[item.storeName].raw += item.orderCount; }
      }
    });

    return Object.values(groups).map(g => {
      const storesHolidaysList = Array.from(allStoreNamesByGroup[g.id]).map(sName => {
        const dailyRev = g.storeDailyRevenue[sName] || {};
        let missing = 0;
        dateRangeList.forEach(dStr => {
          if (!dailyRev[dStr] || dailyRev[dStr] <= 0) {
            missing++;
          }
        });
        return { name: sName, missing };
      }).sort((a, b) => b.missing - a.missing);

      const totalHolidays = storesHolidaysList.reduce((acc, curr) => acc + curr.missing, 0);
      const storesEffList = Object.entries(g.storeEffMap).map(([sName, sVal]) => ({
        name: sName,
        val: sVal.oil > 0 ? sVal.raw / sVal.oil : 0
      })).sort((a, b) => a.val - b.val);

      return {
        ...g,
        efficiency: g.cumOilCount > 0 ? g.cumRawCount / g.cumOilCount : 0,
        totalHolidays,
        growthRate: g.prevTotalAmount > 0 ? ((g.totalAmount - g.prevTotalAmount) / g.prevTotalAmount) * 100 : 0,
        storesEffList,
        storesHolidayList: storesHolidaysList
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [data, groupBy, startDate, endDate, durationDays]);

  const filtered = useMemo(() => {
    return aggregatedData.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [aggregatedData, searchTerm]);

  const toggleRow = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const toggleSection = (rowId: string, section: string) => {
    setExpandedSection(prev => {
      const rowSet = new Set(prev[rowId] || []);
      if (rowSet.has(section)) rowSet.delete(section);
      else rowSet.add(section);
      return { ...prev, [rowId]: rowSet };
    });
  };

  const isSectionOpen = (rowId: string, section: string) => {
    return expandedSection[rowId]?.has(section) || false;
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 flex flex-col md:flex-row justify-between gap-4">
        <div className="flex bg-slate-800 p-1.5 rounded-2xl">
          {(['store', 'manager', 'region'] as const).map((type) => (
            <button key={type} onClick={() => { setGroupBy(type); setExpandedIds(new Set()); setExpandedSection({}); }} className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${groupBy === type ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
              {type === 'store' ? '가맹점별' : type === 'manager' ? '담당자별' : '지역별'}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input type="text" placeholder="분석 대상 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-3 bg-slate-800 rounded-2xl text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
        </div>
      </div>

      <div className="bg-slate-900 rounded-[32px] border border-slate-800 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-800">
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase">명칭</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase text-center">조리 효율</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase text-right">매출 실적 (신장률)</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase text-right">총 휴무일</th>
                <th className="px-4 py-5 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map((row) => {
                const isExpanded = expandedIds.has(row.id);
                const effInfo = getEfficiencyGuide(row.efficiency);
                
                return (
                  <React.Fragment key={row.id}>
                    <tr onClick={() => toggleRow(row.id)} className={`cursor-pointer transition-all ${isExpanded ? 'bg-blue-600/10' : 'hover:bg-slate-800/30'}`}>
                      <td className="px-8 py-6"><span className="font-black text-slate-100">{row.name}</span></td>
                      <td className="px-8 py-6 text-center"><span className={`text-[11px] font-black ${effInfo.color}`}>{row.efficiency.toFixed(1)} <span className="text-[9px]">수</span></span></td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-black text-white">{row.totalAmount.toLocaleString()}원</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-bold text-slate-500">({row.totalCount.toLocaleString()}건)</span>
                            <GrowthBadge current={row.totalAmount} previous={row.prevTotalAmount} />
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right"><span className="text-xs font-bold text-slate-400">{row.totalHolidays.toLocaleString()}일</span></td>
                      <td className="px-4 py-6 text-center text-slate-600">{isExpanded ? <ChevronUp /> : <ChevronDown />}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-950/30">
                        <td colSpan={5} className="px-8 py-10">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                            {/* Efficiency Card */}
                            <div 
                              className={`p-8 rounded-[40px] border transition-all cursor-pointer min-h-[160px] flex flex-col justify-between ${isSectionOpen(row.id, 'eff') ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-800 bg-slate-900 shadow-xl'}`}
                              onClick={(e) => { e.stopPropagation(); toggleSection(row.id, 'eff'); }}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2 text-blue-500"><Droplets size={20}/><span className="text-[11px] font-black uppercase tracking-widest">조리 효율</span></div>
                                  {isSectionOpen(row.id, 'eff') ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                </div>
                                <h5 className={`text-3xl font-black mb-1 ${effInfo.color}`}>{row.efficiency.toFixed(1)} <span className="text-sm">수/can</span></h5>
                              </div>
                              {isSectionOpen(row.id, 'eff') && (
                                <div className={`mt-5 p-4 rounded-2xl ${effInfo.bg} animate-in slide-in-from-top-2 space-y-4`}>
                                  <p className={`text-[11px] font-bold leading-relaxed ${effInfo.color}`}>{effInfo.ment}</p>
                                </div>
                              )}
                            </div>

                            {/* Holiday Card */}
                            <div 
                              className={`p-8 rounded-[40px] border transition-all cursor-pointer min-h-[160px] flex flex-col justify-between ${isSectionOpen(row.id, 'holiday') ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800 bg-slate-900 shadow-xl'}`}
                              onClick={(e) => { e.stopPropagation(); toggleSection(row.id, 'holiday'); }}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2 text-amber-500"><CalendarDays size={20}/><span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">총 휴무 분석</span></div>
                                  {isSectionOpen(row.id, 'holiday') ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                </div>
                                <h5 className="text-3xl font-black text-white mb-1">{row.totalHolidays.toLocaleString()} <span className="text-sm">일</span></h5>
                              </div>
                              {isSectionOpen(row.id, 'holiday') && (
                                <div className="mt-5 p-4 rounded-2xl bg-slate-800 animate-in slide-in-from-top-2">
                                  <p className="text-[11px] font-bold text-slate-400">총 {durationDays}일 중 누적 공백</p>
                                </div>
                              )}
                            </div>

                            {/* Takeout Accordion */}
                            <div 
                              className={`p-8 rounded-[40px] border transition-all cursor-pointer min-h-[160px] flex flex-col justify-between ${isSectionOpen(row.id, 'takeout') ? 'border-rose-500/40 bg-rose-500/5' : 'border-slate-800 bg-slate-900 shadow-xl'}`}
                              onClick={(e) => { e.stopPropagation(); toggleSection(row.id, 'takeout'); }}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2 text-rose-500"><ShoppingBag size={20}/><span className="text-[11px] font-black uppercase tracking-widest">단독 포장 실적</span></div>
                                  {isSectionOpen(row.id, 'takeout') ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                </div>
                                <h5 className="text-3xl font-black text-white mb-1">{row.takeoutAmountSum.toLocaleString()}원</h5>
                              </div>
                              {isSectionOpen(row.id, 'takeout') && (
                                <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 animate-in slide-in-from-top-2">
                                  <p className="text-[11px] font-bold text-rose-300">{row.takeoutCountSum.toLocaleString()}건의 포장 주문</p>
                                </div>
                              )}
                            </div>

                            {/* Platform Ratio Accordion */}
                            <div 
                              className={`p-8 rounded-[40px] border transition-all cursor-pointer min-h-[160px] flex flex-col justify-between ${isSectionOpen(row.id, 'platform') ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-800 bg-slate-900 shadow-xl'}`}
                              onClick={(e) => { e.stopPropagation(); toggleSection(row.id, 'platform'); }}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2 text-emerald-500"><Smartphone size={20}/><span className="text-[11px] font-black uppercase tracking-widest">플랫폼 비중</span></div>
                                  {isSectionOpen(row.id, 'platform') ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                </div>
                                <h5 className="text-3xl font-black text-white mb-1">{row.totalAmount > 0 ? ((row.platformAmountSum / row.totalAmount) * 100).toFixed(1) : 0}%</h5>
                              </div>
                              {isSectionOpen(row.id, 'platform') && (
                                <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 animate-in slide-in-from-top-2">
                                  <p className="text-[11px] font-bold text-emerald-300">총 {row.platformCountSum.toLocaleString()}건 주문</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            {/* Channels Details */}
                            <div className="bg-slate-900/50 rounded-[40px] border border-slate-800 overflow-hidden shadow-xl">
                              <div 
                                className="p-8 border-b border-slate-800 flex justify-between items-center cursor-pointer hover:bg-slate-800/30 transition-colors"
                                onClick={() => toggleSection(row.id, 'channels')}
                              >
                                <div className="flex items-center gap-3">
                                  <PieChart size={18} className="text-blue-500" /> 
                                  <div className="flex flex-col">
                                    <h4 className="text-sm font-black text-white">채널별 실적 상세</h4>
                                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">플랫폼 총합: {row.platformAmountSum.toLocaleString()}원</p>
                                  </div>
                                </div>
                                {isSectionOpen(row.id, 'channels') ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                              </div>
                              {isSectionOpen(row.id, 'channels') && (
                                <div className="p-8 space-y-4 animate-in fade-in duration-300">
                                  <div className="flex justify-between items-center p-5 bg-blue-500/5 rounded-2xl border border-blue-500/20 mb-2">
                                    <div className="flex items-center gap-3">
                                      <div className="bg-blue-600 p-2 rounded-lg text-white"><TrendingUp size={14}/></div>
                                      <div>
                                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter block mb-0.5">Hall Sales</span>
                                        <span className="text-xs font-black text-white">내점(홀) 매출</span>
                                      </div>
                                      <GrowthBadge current={row.inStoreAmountSum} previous={row.prevChannels['내점']?.amount || 0} />
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-black text-white">{row.inStoreAmountSum.toLocaleString()}원 <span className="text-[10px] text-blue-500">({row.inStoreCountSum.toLocaleString()}건)</span></p>
                                      <p className="text-[10px] text-slate-500">비중 {row.totalAmount > 0 ? ((row.inStoreAmountSum / row.totalAmount) * 100).toFixed(1) : 0}%</p>
                                    </div>
                                  </div>
                                  {Object.entries(row.channels).filter(([c]) => c !== '내점').sort((a:any,b:any)=>b[1].amount-a[1].amount).map(([chan, val]: [string, any]) => (
                                    <div key={chan} className="flex justify-between items-center p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
                                      <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-slate-300">{chan}</span>
                                        <GrowthBadge current={val.amount} previous={row.prevChannels[chan]?.amount || 0} />
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-black text-white">{val.amount.toLocaleString()}원 <span className="text-[10px] text-slate-500">({val.count.toLocaleString()}건)</span></p>
                                        <p className="text-[10px] text-slate-500">비중 {row.totalAmount > 0 ? ((val.amount / row.totalAmount) * 100).toFixed(1) : 0}%</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Materials Details */}
                            <div className="bg-slate-900/50 rounded-[40px] border border-slate-800 overflow-hidden shadow-xl">
                              <div 
                                className="p-8 border-b border-slate-800 flex justify-between items-center cursor-pointer hover:bg-slate-800/30 transition-colors"
                                onClick={() => toggleSection(row.id, 'materials')}
                              >
                                <div className="flex items-center gap-3">
                                  <Package size={18} className="text-rose-500" /> 
                                  <div className="flex flex-col">
                                    <h4 className="text-sm font-black text-white">원부자재 매입 상세</h4>
                                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-tighter">매입 총합: {row.totalProcurementSum.toLocaleString()}원</p>
                                  </div>
                                </div>
                                {isSectionOpen(row.id, 'materials') ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                              </div>
                              {isSectionOpen(row.id, 'materials') && (
                                <div className="p-8 space-y-4 animate-in fade-in duration-300">
                                  <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10 text-center">
                                      <div className="flex justify-center mb-1 text-rose-500"><Box size={14}/></div>
                                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">원자재(육류)</p>
                                      <p className="text-xs font-black text-white">{row.rawMaterialAmountSum.toLocaleString()}원</p>
                                    </div>
                                    <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10 text-center">
                                      <div className="flex justify-center mb-1 text-blue-500"><Droplet size={14}/></div>
                                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">전용유</p>
                                      <p className="text-xs font-black text-white">{row.oilAmountSum.toLocaleString()}원</p>
                                    </div>
                                    <div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10 text-center">
                                      <div className="flex justify-center mb-1 text-amber-500"><ShoppingCart size={14}/></div>
                                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">부자재/발주</p>
                                      <p className="text-xs font-black text-white">{row.subMaterialAmountSum.toLocaleString()}원</p>
                                    </div>
                                  </div>
                                  <div className="h-px bg-slate-800/50 mb-4"></div>
                                  {Object.entries(row.rawMaterials).sort((a:any,b:any)=>b[1].amount-a[1].amount).map(([name, val]: [string, any]) => (
                                    <div key={name} className="flex justify-between items-center p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
                                      <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-slate-300">{name}</span>
                                        <GrowthBadge current={val.amount} previous={row.prevRawMaterials[name]?.amount || 0} />
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-black text-white">{val.amount.toLocaleString()}원 <span className="text-[10px] text-slate-500">({val.count.toLocaleString()}건)</span></p>
                                        <p className="text-[10px] text-slate-500">원가율 {row.totalAmount > 0 ? ((val.amount / row.totalAmount) * 100).toFixed(1) : 0}%</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
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
