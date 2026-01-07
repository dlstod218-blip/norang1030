
import React, { useMemo, useState } from 'react';
import { RawSalesData, normalizeChannel, getChannelType } from '../types';
import { 
  ChevronDown, ChevronUp, Store, User, MapPin, 
  Search, Calendar, Utensils, Smartphone, TrendingUp, ShoppingBag, 
  ArrowUpDown, ArrowUp, ArrowDown, Package, Droplets, AlertCircle,
  ArrowUpRight, ArrowDownRight, Zap, PieChart, LayoutList, Award, AlertTriangle
} from 'lucide-react';
import { format, parseISO, startOfWeek, startOfMonth, isWithinInterval, startOfDay, endOfDay, subDays, differenceInDays, endOfMonth, isValid } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Props {
  data: RawSalesData[];
  startDate: string;
  endDate: string;
}

type GroupBy = 'store' | 'manager' | 'region';
type SortKey = 'name' | 'totalAmount' | 'totalCount' | 'takeoutAmount' | 'aov';
type SortDirection = 'asc' | 'desc' | null;

const DetailedAnalysis: React.FC<Props> = ({ data, startDate, endDate }) => {
  const [groupBy, setGroupBy] = useState<GroupBy>('store');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Section collapse states
  const [isChannelsExpanded, setIsChannelsExpanded] = useState(true);
  const [isMaterialsExpanded, setIsMaterialsExpanded] = useState(true);
  const [isStoreEfficiencyExpanded, setIsStoreEfficiencyExpanded] = useState(false);
  const [isTrendsExpanded, setIsTrendsExpanded] = useState(true);
  
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'totalAmount',
    direction: 'desc'
  });

  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
  }, [startDate, endDate]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    } else if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = null; 
    }
    setSortConfig({ key, direction });
  };

  const getTimeKey = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (durationDays <= 31) return format(date, 'MM/dd (E)', { locale: ko });
    if (durationDays <= 180) return format(startOfWeek(date, { weekStartsOn: 1 }), 'MM/dd w주차');
    return format(startOfMonth(date), 'yyyy/MM');
  };

  const getEfficiencyStatus = (ratio: number) => {
    if (ratio === 0) return { label: '데이터 없음', color: 'text-slate-500', bg: 'bg-slate-800/50', border: 'border-slate-800', icon: <AlertCircle size={14}/> };
    if (ratio > 75) return { label: '위험 (교체 필요)', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: <AlertTriangle size={14}/> };
    if (ratio > 65) return { label: '주의 (모니터링)', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: <Zap size={14}/> };
    return { label: '정상 (최적 활용)', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: <Award size={14}/> };
  };

  const aggregatedData = useMemo(() => {
    if (!startDate || !endDate) return [];
    
    const currentS = startOfDay(parseISO(startDate));
    const currentE = endOfDay(parseISO(endDate));
    if (!isValid(currentS) || !isValid(currentE)) return [];

    const prevE = subDays(currentS, 1);
    const prevS = subDays(prevE, durationDays - 1);

    const monthStart = startOfMonth(currentE);
    const monthEnd = endOfMonth(currentE);
    const monthLabel = format(currentE, 'yyyy년 MM월');

    const groups: Record<string, any> = {};

    data.forEach(item => {
      let entityKey = '';
      switch(groupBy) {
        case 'store': entityKey = item.storeName; break;
        case 'manager': entityKey = item.managerName; break;
        case 'region': entityKey = item.region; break;
      }
      
      if (!groups[entityKey]) {
        groups[entityKey] = {
          id: entityKey,
          name: entityKey,
          totalAmount: 0,
          totalCount: 0,
          prevTotalAmount: 0,
          platformAmount: 0,
          inStoreAmount: 0,
          takeoutAmount: 0,
          takeoutCount: 0,
          totalCost: 0,
          totalCostCount: 0,
          channels: {} as Record<string, { amount: number, count: number, prevAmount: number, details: Record<string, { amount: number, count: number }> }>,
          timeSeries: {} as Record<string, { amount: number, count: number }>,
          rawMaterials: {} as Record<string, { amount: number, count: number }>,
          oilCost: 0,
          oilCount: 0,
          subMaterialCost: 0,
          subMaterialCount: 0,
          monthlyEfficiency: { rawCount: 0, oilCount: 0 },
          storeEfficiencyMap: {} as Record<string, { rawCount: number, oilCount: number, oilCost: number }>
        };
      }

      const g = groups[entityKey];
      const normChan = normalizeChannel(item.channel);
      const cType = getChannelType(normChan);
      const itemDate = parseISO(item.date);
      if (!isValid(itemDate)) return;

      const isCurrent = isWithinInterval(itemDate, { start: currentS, end: currentE });
      const isPrevious = isWithinInterval(itemDate, { start: startOfDay(prevS), end: endOfDay(prevE) });
      const isWithinMonth = isWithinInterval(itemDate, { start: monthStart, end: monthEnd });

      if (isCurrent) {
        if (cType === 'material') {
          g.totalCost += item.amount;
          g.totalCostCount += item.orderCount;
        } else if (cType === 'takeout') {
          g.takeoutAmount += item.amount;
          g.takeoutCount += item.orderCount;
        } else {
          const tKey = getTimeKey(item.date);
          if (!g.timeSeries[tKey]) g.timeSeries[tKey] = { amount: 0, count: 0 };
          g.totalAmount += item.amount;
          g.totalCount += item.orderCount;
          g.timeSeries[tKey].amount += item.amount;
          g.timeSeries[tKey].count += item.orderCount;
          if (cType === 'platform') g.platformAmount += item.amount;
          if (normChan === '내점') g.inStoreAmount += item.amount;
        }

        if (!g.channels[normChan]) {
          g.channels[normChan] = { amount: 0, count: 0, prevAmount: 0, details: {} };
        }
        g.channels[normChan].amount += item.amount;
        g.channels[normChan].count += item.orderCount;
      }

      if (isPrevious) {
        if (cType !== 'material' && cType !== 'takeout') {
            g.prevTotalAmount += item.amount;
            if (g.channels[normChan]) {
                g.channels[normChan].prevAmount += item.amount;
            }
        }
      }

      if (isWithinMonth) {
        if (!g.storeEfficiencyMap[item.storeName]) {
          g.storeEfficiencyMap[item.storeName] = { rawCount: 0, oilCount: 0, oilCost: 0 };
        }

        if (cType === 'material') {
          if (normChan === '원자재') {
            if (!g.rawMaterials[item.channel]) g.rawMaterials[item.channel] = { amount: 0, count: 0 };
            g.rawMaterials[item.channel].amount += item.amount;
            g.rawMaterials[item.channel].count += item.orderCount;
            g.monthlyEfficiency.rawCount += item.orderCount;
            g.storeEfficiencyMap[item.storeName].rawCount += item.orderCount;
          } else if (normChan === '전용유') {
            g.oilCost += item.amount;
            g.oilCount += item.orderCount;
            g.monthlyEfficiency.oilCount += item.orderCount;
            g.storeEfficiencyMap[item.storeName].oilCount += item.orderCount;
            g.storeEfficiencyMap[item.storeName].oilCost += item.amount;
          } else if (normChan === '부자재') {
            g.subMaterialCost += item.amount;
            g.subMaterialCount += item.orderCount;
          }
        }
      }
    });

    let result = Object.values(groups)
      .filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(g => ({ ...g, monthLabel }));

    if (sortConfig.direction) {
      result.sort((a, b) => {
        let aValue: any, bValue: any;
        if (sortConfig.key === 'aov') {
          aValue = a.totalCount > 0 ? a.totalAmount / a.totalCount : 0;
          bValue = b.totalCount > 0 ? b.totalAmount / b.totalCount : 0;
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      result.sort((a, b) => b.totalAmount - a.totalAmount);
    }

    return result;
  }, [data, groupBy, searchTerm, sortConfig, startDate, endDate, durationDays]);

  const SortIndicator = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column || !sortConfig.direction) {
      return <ArrowUpDown size={12} className="ml-1 opacity-20 group-hover:opacity-50" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp size={12} className="ml-1 text-blue-500" /> : 
      <ArrowDown size={12} className="ml-1 text-blue-500" />;
  };

  const GrowthBadge = ({ current, previous }: { current: number, previous: number }) => {
    if (previous === 0) return null;
    const diff = current - previous;
    const percent = (diff / previous) * 100;
    const isUp = diff >= 0;
    return (
      <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black border ${
        isUp ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'
      }`}>
        {isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
        {Math.abs(percent).toFixed(1)}%
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-slate-800 p-1.5 rounded-2xl">
          {(['store', 'manager', 'region'] as GroupBy[]).map((type) => (
            <button
              key={type}
              onClick={() => { setGroupBy(type); setExpandedId(null); setSortConfig({ key: 'totalAmount', direction: 'desc' }); }}
              className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${groupBy === type ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {type === 'store' ? '가맹점별' : type === 'manager' ? '담당자별' : '지역별'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" placeholder="분석 대상을 검색하세요..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-6 py-3 bg-slate-800 border-none rounded-2xl text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </div>

      <div className="bg-slate-900 rounded-[32px] border border-slate-800 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-800">
                <th onClick={() => handleSort('name')} className="group px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-800/80 transition-colors">
                  <div className="flex items-center">
                    <span className={sortConfig.key === 'name' ? 'text-blue-400' : ''}>분석 대상</span>
                    <SortIndicator column="name" />
                  </div>
                </th>
                <th onClick={() => handleSort('totalAmount')} className="group px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right cursor-pointer hover:bg-slate-800/80 transition-colors">
                  <div className="flex items-center justify-end">
                    <span className={sortConfig.key === 'totalAmount' ? 'text-blue-400' : ''}>매출액 (신장률)</span>
                    <SortIndicator column="totalAmount" />
                  </div>
                </th>
                <th onClick={() => handleSort('totalCount')} className="group px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right cursor-pointer hover:bg-slate-800/80 transition-colors">
                  <div className="flex items-center justify-end">
                    <span className={sortConfig.key === 'totalCount' ? 'text-blue-400' : ''}>주문 건수</span>
                    <SortIndicator column="totalCount" />
                  </div>
                </th>
                <th onClick={() => handleSort('takeoutAmount')} className="group px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right cursor-pointer hover:bg-slate-800/80 transition-colors">
                  <div className="flex items-center justify-end">
                    <span className={sortConfig.key === 'takeoutAmount' ? 'text-blue-400' : 'text-amber-500/80'}>포장 매출</span>
                    <SortIndicator column="takeoutAmount" />
                  </div>
                </th>
                <th onClick={() => handleSort('aov')} className="group px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right cursor-pointer hover:bg-slate-800/80 transition-colors">
                  <div className="flex items-center justify-end">
                    <span className={sortConfig.key === 'aov' ? 'text-blue-400' : 'text-emerald-500/80'}>평균 객단가</span>
                    <SortIndicator column="aov" />
                  </div>
                </th>
                <th className="px-4 py-5 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {aggregatedData.map((row) => {
                const isExpanded = expandedId === row.id;
                const aov = row.totalCount > 0 ? Math.round(row.totalAmount / row.totalCount) : 0;
                const costRatio = row.totalAmount > 0 ? ((row.totalCost / row.totalAmount) * 100).toFixed(1) : '0';

                return (
                  <React.Fragment key={row.id}>
                    <tr onClick={() => toggleExpand(row.id)} className={`cursor-pointer transition-all ${isExpanded ? 'bg-blue-600/10' : 'hover:bg-slate-800/30'}`}>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl ${isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                            {groupBy === 'store' ? <Store size={20} /> : groupBy === 'manager' ? <User size={20} /> : <MapPin size={20} />}
                          </div>
                          <div>
                            <div className="font-black text-slate-100 text-base">{row.name}</div>
                            <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                              {row.totalCost > 0 ? `선택 기간 원가율: ${costRatio}%` : '자재 정보 없음'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-black text-white text-lg">{row.totalAmount.toLocaleString()}원</span>
                          <GrowthBadge current={row.totalAmount} previous={row.prevTotalAmount} />
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right font-bold text-slate-400">
                        {row.totalCount.toLocaleString()}건
                      </td>
                      <td className="px-8 py-6 text-right font-black text-amber-500">
                        {row.takeoutAmount.toLocaleString()}원
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl inline-block border border-emerald-500/20">
                          {aov.toLocaleString()}원
                        </div>
                      </td>
                      <td className="px-4 py-6 text-center text-slate-600">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-950/30">
                        <td colSpan={6} className="px-8 py-10 border-y border-slate-800">
                          <div className="flex flex-col gap-12">
                            {/* 1. 매출 채널 섹션 */}
                            <div className="space-y-6">
                              <div 
                                onClick={() => setIsChannelsExpanded(!isChannelsExpanded)}
                                className="flex items-center justify-between border-b border-slate-800 pb-4 cursor-pointer group"
                              >
                                <div className="flex items-center gap-4">
                                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <TrendingUp size={16} className="text-blue-500" /> 매출 채널 성과 분석 (선택 기간)
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-500 group-hover:text-blue-400 transition-colors uppercase">
                                    {isChannelsExpanded ? 'Hide' : 'Show'}
                                  </span>
                                  {isChannelsExpanded ? <ChevronUp size={18} className="text-slate-600" /> : <ChevronDown size={18} className="text-slate-600" />}
                                </div>
                              </div>
                              {isChannelsExpanded && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-300">
                                  {Object.entries(row.channels)
                                    .filter(([chan]) => getChannelType(normalizeChannel(chan)) !== 'material' && getChannelType(normalizeChannel(chan)) !== 'procurement')
                                    .sort((a, b) => (b[1] as any).amount - (a[1] as any).amount)
                                    .map(([chan, stats]: any) => {
                                      const normChan = normalizeChannel(chan);
                                      const cType = getChannelType(normChan);
                                      const salesRatio = row.totalAmount > 0 ? ((stats.amount / row.totalAmount) * 100).toFixed(1) : '0';
                                      return (
                                        <div key={chan} className="p-6 rounded-[28px] bg-slate-900 border border-slate-800 hover:border-blue-500/30 transition-all">
                                          <div className="flex justify-between items-start mb-4">
                                            <div className="text-sm font-black text-white flex items-center gap-2 overflow-hidden">
                                              {normChan === '내점' && <Utensils size={14} className="text-emerald-500 shrink-0" />}
                                              {cType === 'platform' && <Smartphone size={14} className="text-blue-500 shrink-0" />}
                                              {cType === 'takeout' && <ShoppingBag size={14} className="text-amber-500 shrink-0" />}
                                              <span className="truncate">{chan}</span>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                              <div className="px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 whitespace-nowrap">비중 {salesRatio}%</div>
                                              <GrowthBadge current={stats.amount} previous={stats.prevAmount} />
                                            </div>
                                          </div>
                                          <div className="space-y-4">
                                            <div>
                                              <p className="text-[9px] font-black text-slate-600 uppercase mb-1">매출액</p>
                                              <p className="text-lg font-black text-white">{stats.amount.toLocaleString()}원</p>
                                            </div>
                                            <div className="pt-3 border-t border-slate-800/50 flex justify-between items-center">
                                              <p className="text-[9px] font-black text-slate-600 uppercase">주문건수</p>
                                              <p className="text-sm font-bold text-slate-400">{stats.count.toLocaleString()}건</p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              )}
                            </div>

                            {/* 2. 자재 및 원가 섹션 (당월 누적 집계) */}
                            <div className="space-y-6">
                                <div 
                                  onClick={() => setIsMaterialsExpanded(!isMaterialsExpanded)}
                                  className="flex items-center justify-between border-b border-slate-800 pb-4 cursor-pointer group"
                                >
                                  <div className="flex items-center gap-4">
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                      <PieChart size={16} className="text-amber-500" /> 자재 공급 및 원가 분석
                                    </h4>
                                    <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
                                      {row.monthLabel} 누적 집계
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-500 group-hover:text-amber-400 transition-colors uppercase">
                                      {isMaterialsExpanded ? 'Hide' : 'Show'}
                                    </span>
                                    {isMaterialsExpanded ? <ChevronUp size={18} className="text-slate-600" /> : <ChevronDown size={18} className="text-slate-600" />}
                                  </div>
                                </div>
                                {isMaterialsExpanded && (
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300">
                                    {/* 원자재 세부 리스트 */}
                                    <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-[32px] p-6">
                                      <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                          <div className="p-2.5 bg-slate-800 rounded-xl text-blue-400"><Utensils size={16}/></div>
                                          <span className="text-xs font-black text-white uppercase tracking-tight">원자재 매입 세부</span>
                                        </div>
                                        <span className="text-[9px] font-black text-slate-500">당월 누적</span>
                                      </div>
                                      <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        {Object.entries(row.rawMaterials).length > 0 ? (
                                          Object.entries(row.rawMaterials)
                                            .sort((a, b) => (b[1] as any).amount - (a[1] as any).amount)
                                            .map(([name, s]: any) => (
                                              <div key={name} className="flex justify-between items-center px-4 py-3 bg-slate-950/40 rounded-2xl border border-slate-800/50">
                                                <span className="text-[11px] font-bold text-slate-300 truncate mr-4">{name}</span>
                                                <div className="text-right shrink-0">
                                                  <div className="text-xs font-black text-slate-100">{s.amount.toLocaleString()}원</div>
                                                  <div className="text-[9px] font-bold text-slate-500">{s.count.toLocaleString()}건</div>
                                                </div>
                                              </div>
                                            ))
                                        ) : (
                                          <p className="text-center py-10 text-[10px] font-bold text-slate-600 italic">원자재 매입 정보가 없습니다.</p>
                                        )}
                                      </div>
                                    </div>

                                    {/* 전용유 효율 */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 flex flex-col justify-between">
                                      <div>
                                        <div className="flex items-center gap-3 mb-8">
                                          <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 ring-1 ring-amber-500/20"><Droplets size={20}/></div>
                                          <span className="text-sm font-black text-white uppercase tracking-wider">전용유 효율 (당월 누적)</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mb-8">
                                          <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">매입 금액</p>
                                            <p className="text-xl font-black text-white">{row.oilCost.toLocaleString()}원</p>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">공급 수량</p>
                                            <p className="text-xl font-black text-amber-500">{row.oilCount.toLocaleString()} can</p>
                                          </div>
                                        </div>
                                      </div>
                                      <div className={`p-6 rounded-[28px] border-2 transition-all ${row.monthlyEfficiency.oilCount > 0 && (row.monthlyEfficiency.rawCount / row.monthlyEfficiency.oilCount) > 70 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800/50 border-emerald-500/20'}`}>
                                        <p className="text-[10px] font-black text-slate-500 uppercase mb-2">1can 당 조리 효율</p>
                                        <div className="flex items-baseline gap-2">
                                          <p className={`text-4xl font-black tracking-tighter ${row.monthlyEfficiency.oilCount > 0 && (row.monthlyEfficiency.rawCount / row.monthlyEfficiency.oilCount) > 70 ? 'text-red-500' : 'text-emerald-400'}`}>
                                            {row.monthlyEfficiency.oilCount > 0 ? (row.monthlyEfficiency.rawCount / row.monthlyEfficiency.oilCount).toFixed(1) : '-'}
                                          </p>
                                          <span className="text-[10px] font-bold text-slate-500">수 / can</span>
                                          {row.monthlyEfficiency.oilCount > 0 && (row.monthlyEfficiency.rawCount / row.monthlyEfficiency.oilCount) > 70 && <AlertCircle size={14} className="text-red-500 ml-auto animate-pulse" />}
                                        </div>
                                      </div>
                                    </div>

                                    {/* 부자재 요약 */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 flex flex-col justify-between">
                                      <div>
                                        <div className="flex items-center gap-3 mb-8">
                                          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 ring-1 ring-emerald-500/20"><Package size={20}/></div>
                                          <span className="text-sm font-black text-white uppercase tracking-wider">부자재 매입 분석 (당월)</span>
                                        </div>
                                        <div className="space-y-4">
                                          <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">부자재 총 비용</p>
                                            <p className="text-3xl font-black text-white">{row.subMaterialCost.toLocaleString()}원</p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-500 uppercase">공급 건수</span>
                                            <span className="text-sm font-bold text-slate-300">{row.subMaterialCount.toLocaleString()}건</span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="mt-8 p-4 bg-slate-800/30 rounded-2xl border border-slate-800 text-[10px] font-bold text-slate-500 leading-relaxed italic">
                                        * 원자재 및 전용유를 제외한 당월 누적 기타 부자재(소모품 등)의 산출 금액입니다.
                                      </div>
                                    </div>
                                  </div>
                                )}
                            </div>

                            {(groupBy === 'manager' || groupBy === 'region') && (
                              <div className="space-y-6">
                                <div 
                                  onClick={() => setIsStoreEfficiencyExpanded(!isStoreEfficiencyExpanded)}
                                  className="flex items-center justify-between border-b border-slate-800 pb-4 cursor-pointer group"
                                >
                                  <div className="flex items-center gap-4">
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                      <LayoutList size={16} className="text-indigo-500" /> 담당 매장별 전용유 효율 현황 (차등 분석)
                                    </h4>
                                    <div className="flex gap-2">
                                      {Object.values(row.storeEfficiencyMap).some((s: any) => s.oilCount > 0 && (s.rawCount / s.oilCount) > 75) && (
                                        <span className="text-[9px] font-black bg-red-500/20 text-red-500 border border-red-500/30 px-2 py-0.5 rounded animate-pulse">위험 매장 감지</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-500 group-hover:text-indigo-400 transition-colors uppercase">
                                      {isStoreEfficiencyExpanded ? 'Hide Details' : 'View Store Rankings'}
                                    </span>
                                    {isStoreEfficiencyExpanded ? <ChevronUp size={20} className="text-slate-600" /> : <ChevronDown size={20} className="text-slate-600" />}
                                  </div>
                                </div>

                                {isStoreEfficiencyExpanded && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-500">
                                    {Object.entries(row.storeEfficiencyMap)
                                      .sort((a, b) => {
                                        const rA = (a[1] as any).oilCount > 0 ? (a[1] as any).rawCount / (a[1] as any).oilCount : 0;
                                        const rB = (b[1] as any).oilCount > 0 ? (b[1] as any).rawCount / (b[1] as any).oilCount : 0;
                                        return rB - rA; // 효율이 낮은(비율이 높은) 순서대로 정렬 (관심 필요 매장 상단)
                                      })
                                      .map(([storeName, stats]: any, index) => {
                                        const ratio = stats.oilCount > 0 ? stats.rawCount / stats.oilCount : 0;
                                        const status = getEfficiencyStatus(ratio);
                                        return (
                                          <div key={storeName} className={`p-8 rounded-[40px] border-2 transition-all relative group shadow-lg ${status.bg} ${status.border} hover:scale-[1.02] hover:shadow-xl`}>
                                            <div className="absolute top-4 right-6 text-[10px] font-black text-slate-600 uppercase">Rank #{index + 1}</div>
                                            <div className="flex justify-between items-start mb-6">
                                              <div>
                                                <div className="font-black text-slate-100 text-base mb-1 group-hover:text-white transition-colors">{storeName}</div>
                                                <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${status.color}`}>
                                                  {status.icon} {status.label}
                                                </div>
                                              </div>
                                              <div className={`p-3 rounded-2xl shadow-inner ${status.bg} ${status.color}`}>
                                                <Droplets size={20} />
                                              </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4 mb-6">
                                              <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-500 uppercase">공급 수량</p>
                                                <p className="text-base font-black text-slate-100">{stats.oilCount.toLocaleString()} can</p>
                                              </div>
                                              <div className="space-y-1 text-right">
                                                <p className="text-[9px] font-black text-slate-500 uppercase">조리 수량</p>
                                                <p className="text-base font-black text-slate-100">{stats.rawCount.toLocaleString()} 수</p>
                                              </div>
                                            </div>

                                            <div className="pt-6 border-t border-slate-700/30 flex justify-between items-end">
                                              <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-500 uppercase mb-1">Efficiency Ratio</span>
                                                <div className="h-1.5 w-24 bg-slate-800 rounded-full overflow-hidden">
                                                  <div 
                                                    className={`h-full ${status.color.replace('text', 'bg')}`} 
                                                    style={{ width: `${Math.min(100, (ratio / 90) * 100)}%` }}
                                                  ></div>
                                                </div>
                                              </div>
                                              <div className="text-right">
                                                <p className={`text-4xl font-black tracking-tighter ${status.color}`}>
                                                  {ratio > 0 ? ratio.toFixed(1) : '-'}
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="space-y-6">
                              <div 
                                onClick={() => setIsTrendsExpanded(!isTrendsExpanded)}
                                className="flex items-center justify-between border-b border-slate-800 pb-4 cursor-pointer group"
                              >
                                <div className="flex items-center gap-4">
                                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Calendar size={16} className="text-purple-500" /> 기간별 매출 추이 ({durationDays}일 분석)
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-500 group-hover:text-purple-400 transition-colors uppercase">
                                    {isTrendsExpanded ? 'Hide' : 'Show'}
                                  </span>
                                  {isTrendsExpanded ? <ChevronUp size={18} className="text-slate-600" /> : <ChevronDown size={18} className="text-slate-600" />}
                                </div>
                              </div>
                              {isTrendsExpanded && (
                                <div className="bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden animate-in slide-in-from-top-2 duration-300">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {Object.entries(row.timeSeries)
                                      .sort((a, b) => b[0].localeCompare(a[0]))
                                      .map(([date, stats]: any) => (
                                        <div key={date} className="flex justify-between items-center p-4 bg-slate-800/40 rounded-2xl border border-slate-800 hover:bg-slate-800 transition-all">
                                          <div className="text-xs font-black text-slate-300">{date}</div>
                                          <div className="text-right">
                                            <div className="text-sm font-black text-white">{stats.amount.toLocaleString()}원</div>
                                            <div className="text-[9px] font-bold text-slate-500">{stats.count.toLocaleString()}건</div>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
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
