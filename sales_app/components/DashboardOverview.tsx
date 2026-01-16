
import React, { useMemo, useState } from 'react';
import { RawSalesData, getChannelType, normalizeChannel } from '../types';
import { 
  TrendingUp, Package, ShoppingBag, Activity, PieChart, Utensils, 
  Droplets, AlertCircle, ArrowUpRight, ArrowDownRight, CalendarDays, 
  Zap, Smartphone, Store, ChevronDown, ChevronUp, CalendarOff, 
  Moon, Layers, Filter, CheckCircle2, ChevronRight, Laptop,
  ClipboardList, SearchX, FlaskConical, AlertTriangle
} from 'lucide-react';
import { 
  parseISO, isValid, isWithinInterval, startOfDay, endOfDay, 
  subDays, differenceInDays, startOfMonth, endOfMonth, format, 
  isBefore, isToday, getYear, subMonths 
} from 'date-fns';

interface Props {
  data: RawSalesData[]; 
  startDate: string;
  endDate: string;
}

const getEfficiencyStatus = (eff: number, prevEff?: number) => {
  if (eff === 0) return { label: '심각: 전용유 미발주', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: <AlertTriangle size={12}/> };
  if (eff >= 60 && eff <= 70) {
    return { label: '정상범위', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: <CheckCircle2 size={12}/> };
  }
  if (eff > 30 && eff < 60) {
    return { label: '저효율 (이익저하)', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: <AlertCircle size={12}/> };
  }
  
  if (eff > 0 && eff <= 30) {
    let subLabel = '원자재 및 전용유 사입/이월의심';
    if (prevEff !== undefined && prevEff > 70) subLabel = '전월 과다사용 후 이월소진 의심';
    return { label: subLabel, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: <AlertTriangle size={12}/> };
  }
  
  if (eff > 70) {
    let subLabel = '전용유 사입, 산가초과 의심';
    if (prevEff !== undefined && prevEff > 70) subLabel = '중복 초과사용 매장 (외부사입 의심)';
    return { label: subLabel, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: <AlertTriangle size={12}/> };
  }
  
  return { label: '데이터 없음', color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-800', icon: <SearchX size={12}/> };
};

const GrowthIndicator = ({ current, previous }: { current: number, previous: number }) => {
  if (previous <= 0) return null;
  const growth = ((current - previous) / previous) * 100;
  const isPositive = growth >= 0;
  return (
    <div className={`flex items-center gap-0.5 text-[9px] font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
      {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {Math.abs(growth).toFixed(1)}%
    </div>
  );
};

const DashboardOverview: React.FC<Props> = ({ data, startDate, endDate }) => {
  const [isPlatformExpanded, setIsPlatformExpanded] = useState(true);
  const [isMaterialExpanded, setIsMaterialExpanded] = useState(true);
  const [isHolidayExpanded, setIsHolidayExpanded] = useState(false);
  const [isEffAnomaliesExpanded, setIsEffAnomaliesExpanded] = useState(false);

  const stats = useMemo(() => {
    if (!startDate || !endDate || data.length === 0) return null;

    const currentS = startOfDay(parseISO(startDate));
    const currentE = endOfDay(parseISO(endDate));
    const monthStart = startOfMonth(currentE);
    const durationDaysVal = differenceInDays(currentE, currentS) + 1;
    
    // Previous period logic: if partial month, use same days last month. Else use previous equivalent duration.
    const isMTD = isToday(currentE) || isToday(subDays(new Date(), 1));
    const prevS = isMTD ? startOfMonth(subMonths(currentS, 1)) : subDays(currentS, durationDaysVal);
    const prevE = isMTD ? subMonths(currentE, 1) : subDays(currentS, 1);

    const prevMonthStart = startOfMonth(subMonths(monthStart, 1));
    const prevMonthEnd = endOfMonth(prevMonthStart);

    const targetYear = getYear(currentE);
    const activeStoresInYear = new Set<string>();
    data.forEach(d => {
      if (getYear(parseISO(d.date)) === targetYear) activeStoresInYear.add(d.storeName);
    });

    const today = startOfDay(new Date());
    let effectiveEndForHoliday = currentE;
    if (isToday(currentE) || isBefore(today, currentE)) effectiveEndForHoliday = subDays(today, 1);
    const effectiveDuration = Math.max(0, differenceInDays(effectiveEndForHoliday, currentS) + 1);

    const initStats = () => ({
      totalSales: 0, totalOrders: 0, platformSales: 0, platformOrders: 0,
      inStoreSales: 0, inStoreOrders: 0, takeoutSales: 0, takeoutOrders: 0,
      totalCost: 0, rawMaterialCount: 0, oilCount: 0,
      platformDetails: {} as Record<string, { amount: number, count: number }>,
      rawMaterialDetails: {} as Record<string, { amount: number, count: number }>,
      storeActiveDays: {} as Record<string, Set<string>>
    });

    const curr = initStats();
    const prev = initStats();
    const storeCumEffMap: Record<string, { raw: number, oil: number }> = {};
    const storePrevMonthEffMap: Record<string, { raw: number, oil: number }> = {};
    let totalCumRaw = 0, totalCumOil = 0;

    data.forEach(item => {
      const itemDate = parseISO(item.date);
      if (!isValid(itemDate)) return;
      const normChan = normalizeChannel(item.channel);
      const type = getChannelType(normChan);
      const isCurrent = isWithinInterval(itemDate, { start: currentS, end: currentE });
      const isPrevious = isWithinInterval(itemDate, { start: startOfDay(prevS), end: endOfDay(prevE) });
      const isCumulative = isWithinInterval(itemDate, { start: monthStart, end: currentE });
      const isPrevMonth = isWithinInterval(itemDate, { start: prevMonthStart, end: prevMonthEnd });

      if (isCumulative && type === 'material') {
        if (!storeCumEffMap[item.storeName]) storeCumEffMap[item.storeName] = { raw: 0, oil: 0 };
        if (normChan === '전용유') { totalCumOil += item.orderCount; storeCumEffMap[item.storeName].oil += item.orderCount; }
        else if (normChan !== '부자재' && normChan !== '발주') { totalCumRaw += item.orderCount; storeCumEffMap[item.storeName].raw += item.orderCount; }
      }
      if (isPrevMonth && type === 'material') {
        if (!storePrevMonthEffMap[item.storeName]) storePrevMonthEffMap[item.storeName] = { raw: 0, oil: 0 };
        if (normChan === '전용유') storePrevMonthEffMap[item.storeName].oil += item.orderCount;
        else if (normChan !== '부자재' && normChan !== '발주') storePrevMonthEffMap[item.storeName].raw += item.orderCount;
      }

      const processItem = (target: any, it: RawSalesData) => {
        if (it.channel === '포장' || type === 'takeout') {
          target.takeoutSales += it.amount; target.takeoutOrders += it.orderCount;
        } else if (type === 'platform' || normChan === '내점') {
          target.totalSales += it.amount; target.totalOrders += it.orderCount;
          if (!target.storeActiveDays[it.storeName]) target.storeActiveDays[it.storeName] = new Set();
          target.storeActiveDays[it.storeName].add(it.date);
          if (type === 'platform') {
            target.platformSales += it.amount; target.platformOrders += it.orderCount;
            if (!target.platformDetails[normChan]) target.platformDetails[normChan] = { amount: 0, count: 0 };
            target.platformDetails[normChan].amount += it.amount; target.platformDetails[normChan].count += it.orderCount;
          } else { target.inStoreSales += it.amount; target.inStoreOrders += it.orderCount; }
        } else if (type === 'material') {
          target.totalCost += it.amount;
          if (normChan === '전용유') target.oilCount += it.orderCount;
          else if (normChan !== '부자재' && normChan !== '발주') target.rawMaterialCount += it.orderCount;
          if (!target.rawMaterialDetails[normChan]) target.rawMaterialDetails[normChan] = { amount: 0, count: 0 };
          target.rawMaterialDetails[normChan].amount += it.amount; target.rawMaterialDetails[normChan].count += it.orderCount;
        }
      };
      if (isCurrent) processItem(curr, item);
      if (isPrevious) processItem(prev, item);
    });

    const holidayStores = Array.from(activeStoresInYear).map(store => {
      const activeCount = curr.storeActiveDays[store]?.size || 0;
      return { store, holidayCount: effectiveDuration - activeCount };
    }).filter(s => s.holidayCount > 0).sort((a, b) => b.holidayCount - a.holidayCount);

    const anomalies = Object.entries(storeCumEffMap)
      .map(([storeName, stats]) => ({
        storeName,
        efficiency: stats.oil > 0 ? stats.raw / stats.oil : 0,
        prevEfficiency: storePrevMonthEffMap[storeName]?.oil > 0 ? storePrevMonthEffMap[storeName].raw / storePrevMonthEffMap[storeName].oil : undefined
      }))
      .filter(s => s.efficiency < 60 || s.efficiency > 70) 
      .sort((a, b) => b.efficiency - a.efficiency);

    const growthRate = prev.totalSales > 0 ? ((curr.totalSales - prev.totalSales) / prev.totalSales) * 100 : 0;

    return {
      current: { ...curr, totalStores: activeStoresInYear.size, aov: curr.totalOrders > 0 ? Math.round(curr.totalSales / curr.totalOrders) : 0 },
      previous: prev, monthlyEfficiency: totalCumOil > 0 ? totalCumRaw / totalCumOil : 0, effAnomalies: anomalies, holidayStores, growthRate, prevLabel: `${format(prevS, 'MM/dd')}~${format(prevE, 'MM/dd')}`
    };
  }, [data, startDate, endDate]);

  if (!stats) return null;
  const { current, previous, monthlyEfficiency, effAnomalies, holidayStores, growthRate, prevLabel } = stats;
  const mainEffStatus = getEfficiencyStatus(monthlyEfficiency);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-slate-900 p-8 rounded-[40px] border-2 border-slate-800 shadow-2xl relative overflow-hidden">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">총 매출액 (포장 제외)</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-3xl font-black text-white">{current.totalSales.toLocaleString()}원</h4>
            {previous.totalSales > 0 && (
              <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-black border ${growthRate >= 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
                {growthRate >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />} {Math.abs(growthRate).toFixed(1)}%
              </div>
            )}
          </div>
          <p className="text-[9px] font-bold text-slate-600 mt-2 uppercase tracking-tighter">대비 기간: {prevLabel}</p>
        </div>
        <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-2xl group relative overflow-hidden">
          <div className="flex justify-between items-start mb-6"><div className="bg-emerald-600/20 p-4 rounded-2xl"><Utensils className="text-emerald-500" size={24} /></div></div>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">평균 객단가 (AOV)</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-3xl font-black text-white">{current.aov.toLocaleString()}원</h4>
            {previous.totalOrders > 0 && <GrowthIndicator current={current.aov} previous={previous.totalOrders > 0 ? previous.totalSales / previous.totalOrders : 0} />}
          </div>
        </div>
        <div onClick={() => setIsEffAnomaliesExpanded(!isEffAnomaliesExpanded)} className={`bg-slate-900 rounded-[40px] border-2 shadow-2xl transition-all relative overflow-hidden cursor-pointer group hover:scale-[1.01] ${isEffAnomaliesExpanded ? 'border-rose-500/40 ring-4 ring-rose-500/10' : 'border-slate-800'}`}>
          <div className="p-8 pb-6">
            <div className="flex justify-between items-start mb-6"><div className="bg-amber-600/20 p-4 rounded-2xl"><Droplets className="text-amber-500" size={24} /></div><span className={`text-[10px] font-black px-3 py-1 rounded-lg border ${mainEffStatus.bg} ${mainEffStatus.color} ${mainEffStatus.border}`}>월 누적 효율</span></div>
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">통합 조리 효율 (수/can)</p>
            <h4 className={`text-3xl font-black ${mainEffStatus.color}`}>{monthlyEfficiency.toFixed(1)}</h4>
            <div className={`flex items-center gap-1.5 text-[10px] font-black mt-2 ${mainEffStatus.color}`}>{mainEffStatus.icon} {mainEffStatus.label}</div>
          </div>
          {isEffAnomaliesExpanded && (
            <div className="px-8 pb-8 pt-2 border-t border-slate-800 bg-slate-950/40">
              <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                {effAnomalies.map((s, i) => {
                  const sStatus = getEfficiencyStatus(s.efficiency, s.prevEfficiency);
                  return (
                    <div key={i} className="flex flex-col p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                      <div className="flex justify-between items-center"><span className="text-xs font-black text-slate-200">{s.storeName}</span><span className={`text-xs font-black ${sStatus.color}`}>{s.efficiency.toFixed(1)}수/can</span></div>
                      <div className={`text-[9px] font-bold ${sStatus.color}`}>{sStatus.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-2xl group relative overflow-hidden">
          <div className="flex justify-between items-start mb-6"><div className="bg-rose-600/20 p-4 rounded-2xl"><ShoppingBag className="text-rose-400" size={24} /></div></div>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">총 단독 포장 매출</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-3xl font-black text-rose-400">{current.takeoutSales.toLocaleString()}원</h4>
            {previous.takeoutSales > 0 && <GrowthIndicator current={current.takeoutSales} previous={previous.takeoutSales} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-xl overflow-hidden flex flex-col">
          <div onClick={() => setIsPlatformExpanded(!isPlatformExpanded)} className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-800/20 cursor-pointer">
            <div className="flex items-center gap-3"><Smartphone className="text-blue-500" size={20} /><h4 className="text-base font-black text-white">플랫폼별 상세 매출 및 상승률</h4></div>
            {isPlatformExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
          </div>
          {isPlatformExpanded && (
            <div className="p-8 space-y-4">
              {Object.entries(current.platformDetails).sort((a:any,b:any)=>b[1].amount-a[1].amount).map(([name, val]: [string, any]) => (
                <div key={name} className="flex items-center justify-between p-5 bg-slate-800/40 rounded-2xl border border-slate-800">
                  <div className="font-bold text-slate-200">
                    {name}
                    {previous.platformDetails[name] && <GrowthIndicator current={val.amount} previous={previous.platformDetails[name].amount} />}
                  </div>
                  <div className="text-right"><p className="text-sm font-black text-white">{val.amount.toLocaleString()}원</p><p className="text-[10px] text-slate-500">{val.count}건</p></div>
                </div>
              ))}
              <div className="flex items-center justify-between p-5 bg-blue-500/10 rounded-2xl border border-blue-500/20 mt-4">
                <div className="font-black text-blue-400">
                  총 배달 플랫폼 합계
                  {previous.platformSales > 0 && <GrowthIndicator current={current.platformSales} previous={previous.platformSales} />}
                </div>
                <div className="text-right"><p className="text-lg font-black text-white">{current.platformSales.toLocaleString()}원</p><p className="text-xs font-bold text-slate-500">{current.platformOrders}건</p></div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-xl overflow-hidden flex flex-col">
          <div onClick={() => setIsMaterialExpanded(!isMaterialExpanded)} className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-800/20 cursor-pointer">
            <div className="flex items-center gap-3"><Package className="text-rose-500" size={20} /><h4 className="text-base font-black text-white">원부자재 매입 상세 분석</h4></div>
            {isMaterialExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
          </div>
          {isMaterialExpanded && (
            <div className="p-8 space-y-4">
              {Object.entries(current.rawMaterialDetails).sort((a:any,b:any)=>b[1].amount-a[1].amount).map(([name, val]: [string, any]) => (
                <div key={name} className="flex items-center justify-between p-5 bg-slate-800/40 rounded-2xl border border-slate-800">
                  <div className="font-bold text-slate-200">
                    {name}
                    {previous.rawMaterialDetails[name] && <GrowthIndicator current={val.amount} previous={previous.rawMaterialDetails[name].amount} />}
                  </div>
                  <div className="text-right"><p className="text-sm font-black text-white">{val.amount.toLocaleString()}원</p><p className="text-[10px] text-slate-500">{val.count}{name.includes('전용유')?'can':'수'}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-xl overflow-hidden flex flex-col">
          <div onClick={() => setIsHolidayExpanded(!isHolidayExpanded)} className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-800/20 cursor-pointer">
            <div className="flex items-center gap-3"><CalendarOff className="text-amber-500" size={20} /><h4 className="text-base font-black text-white">휴무 발생 매장 요약</h4></div>
            {isHolidayExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
          </div>
          {isHolidayExpanded && (
            <div className="p-8 space-y-4 flex-1">
              <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                {holidayStores.length > 0 ? holidayStores.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20">
                    <div className="font-bold text-slate-200">{s.store}</div>
                    <div className="text-xs font-black text-amber-500 bg-amber-500/10 px-3 py-1 rounded-lg">{s.holidayCount}일 휴무</div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-600 opacity-50">
                    <CheckCircle2 size={32} className="mb-3" />
                    <p className="text-xs font-black uppercase tracking-widest">전 매장 정상 운영 중</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
