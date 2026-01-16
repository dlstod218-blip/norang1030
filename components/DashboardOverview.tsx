
import React, { useMemo, useState } from 'react';
import { RawSalesData, getChannelType, normalizeChannel } from '../types';
import { 
  TrendingUp, Package, Smartphone, ChevronDown, ChevronUp, 
  CalendarDays, Droplets, ArrowUpRight, ArrowDownRight, Info, AlertTriangle, CheckCircle2, Search, Box, Droplet, ShoppingCart
} from 'lucide-react';
import { 
  parseISO, isValid, isWithinInterval, startOfDay, endOfDay, 
  subDays, differenceInDays, startOfMonth, endOfMonth, format, 
  isToday, subMonths, eachDayOfInterval 
} from 'date-fns';

interface Props {
  data: RawSalesData[]; 
  startDate: string;
  endDate: string;
}

export const getEfficiencyGuide = (eff: number) => {
  if (eff === 0) return { label: '미발주', ment: '전용유 발주 내역이 없습니다. 사입 또는 이월 재고 확인 필요.', color: 'text-rose-500', bg: 'bg-rose-500/10' };
  if (eff >= 60 && eff <= 70) return { label: '정상', ment: '최적의 조리 효율을 유지하고 있습니다. (품질/수익 안정)', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  if (eff > 30 && eff < 60) return { label: '저효율', ment: '조리 효율이 낮습니다. 파우더 과다 사용 또는 육류 사입 점검 필요.', color: 'text-amber-400', bg: 'bg-amber-500/10' };
  if (eff > 70) return { label: '과효율', ment: '조리 효율이 너무 높습니다. 튀김유 산가 초과 및 품질 저하 주의.', color: 'text-rose-400', bg: 'bg-rose-500/10' };
  return { label: '주의', ment: '비정상적인 효율 수치입니다. 데이터 누락 또는 외부 사입이 강력히 의심됩니다.', color: 'text-rose-500', bg: 'bg-rose-500/10' };
};

export const GrowthBadge = ({ current, previous }: { current: number, previous: number }) => {
  if (previous <= 0) return null;
  const rate = ((current - previous) / previous) * 100;
  if (Math.abs(rate) < 0.1) return null;
  const isPos = rate >= 0;
  return (
    <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black border ${isPos ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
      {isPos ? <ArrowUpRight size={8} /> : <ArrowDownRight size={8} />}
      {Math.abs(rate).toFixed(1)}%
    </div>
  );
};

const DashboardOverview: React.FC<Props> = ({ data, startDate, endDate }) => {
  const [isEffExpanded, setIsEffExpanded] = useState(false);
  const [isHolidayExpanded, setIsHolidayExpanded] = useState(false);
  const [isPlatformExpanded, setIsPlatformExpanded] = useState(true);
  const [isMaterialExpanded, setIsMaterialExpanded] = useState(true);
  
  const [effSearch, setEffSearch] = useState('');
  const [holidaySearch, setHolidaySearch] = useState('');

  const stats = useMemo(() => {
    if (!startDate || !endDate || data.length === 0) return null;

    const currentS = startOfDay(parseISO(startDate));
    const currentE = endOfDay(parseISO(endDate));
    const monthStart = startOfMonth(currentE);
    const durationDaysVal = differenceInDays(currentE, currentS) + 1;
    
    const isMTD = isToday(currentE) || isToday(subDays(new Date(), 1));
    const prevS = isMTD ? startOfMonth(subMonths(currentS, 1)) : subDays(currentS, durationDaysVal);
    const prevE = isMTD ? subMonths(currentE, 1) : subDays(currentS, 1);

    const allStoreNames = Array.from(new Set(data.map(d => d.storeName)));
    const dateRangeList = eachDayOfInterval({ start: currentS, end: currentE }).map(d => format(d, 'yyyy-MM-dd'));

    const initStats = () => ({
      totalSales: 0, totalOrders: 0, platformSales: 0,
      inStoreSales: 0, inStoreOrders: 0, takeoutSales: 0, takeoutOrders: 0,
      totalCost: 0, rawMaterialAmount: 0, oilAmount: 0, subMaterialAmount: 0,
      platformDetails: {} as Record<string, { amount: number, count: number }>,
      rawMaterialDetails: {} as Record<string, { amount: number, count: number }>,
      storeDailyRevenue: {} as Record<string, Record<string, number>>,
      storeEfficiencyMTD: {} as Record<string, { raw: number, oil: number }>
    });

    const curr = initStats();
    const prev = initStats();

    const processItem = (target: any, it: RawSalesData, isCurrentPeriod: boolean, normChan: string, type: string) => {
      if (it.channel === '포장' || type === 'takeout') {
        target.takeoutSales += it.amount; target.takeoutOrders += it.orderCount;
      } else if (type === 'platform' || normChan === '내점') {
        target.totalSales += it.amount; target.totalOrders += it.orderCount;
        
        if (isCurrentPeriod) {
          if (!target.storeDailyRevenue[it.storeName]) target.storeDailyRevenue[it.storeName] = {};
          target.storeDailyRevenue[it.storeName][it.date] = (target.storeDailyRevenue[it.storeName][it.date] || 0) + it.amount;
        }

        if (type === 'platform') {
          target.platformSales += it.amount;
          if (!target.platformDetails[normChan]) target.platformDetails[normChan] = { amount: 0, count: 0 };
          target.platformDetails[normChan].amount += it.amount; target.platformDetails[normChan].count += it.orderCount;
        } else { 
          target.inStoreSales += it.amount; target.inStoreOrders += it.orderCount; 
        }
      } else if (type === 'material') {
        target.totalCost += it.amount;
        if (normChan === '전용유') { target.oilAmount += it.amount; }
        else if (normChan === '부자재' || normChan === '발주') { target.subMaterialAmount += it.amount; }
        else { target.rawMaterialAmount += it.amount; }
        
        if (!target.rawMaterialDetails[normChan]) target.rawMaterialDetails[normChan] = { amount: 0, count: 0 };
        target.rawMaterialDetails[normChan].amount += it.amount; target.rawMaterialDetails[normChan].count += it.orderCount;
      }
    };

    data.forEach(item => {
      const itemDate = parseISO(item.date);
      if (!isValid(itemDate)) return;
      const normChan = normalizeChannel(item.channel);
      const type = getChannelType(normChan);
      
      const isCurrentRange = isWithinInterval(itemDate, { start: currentS, end: currentE });
      const isPreviousRange = isWithinInterval(itemDate, { start: startOfDay(prevS), end: endOfDay(prevE) });
      const isMTDRange = isWithinInterval(itemDate, { start: monthStart, end: currentE });

      if (isMTDRange && type === 'material') {
        if (!curr.storeEfficiencyMTD[item.storeName]) curr.storeEfficiencyMTD[item.storeName] = { raw: 0, oil: 0 };
        if (normChan === '전용유') curr.storeEfficiencyMTD[item.storeName].oil += item.orderCount;
        else if (normChan !== '부자재' && normChan !== '발주') curr.storeEfficiencyMTD[item.storeName].raw += item.orderCount;
      }

      if (isCurrentRange) processItem(curr, item, true, normChan, type);
      if (isPreviousRange) processItem(prev, item, false, normChan, type);
    });

    const holidayList = allStoreNames.map((name: string) => {
      const dailyRev = curr.storeDailyRevenue[name] || {};
      let missingCount = 0;
      dateRangeList.forEach(dateStr => {
        if (!dailyRev[dateStr] || dailyRev[dateStr] <= 0) {
          missingCount++;
        }
      });
      return { name, missing: missingCount };
    }).sort((a, b) => b.missing - a.missing);

    const totalHolidays = holidayList.reduce((acc, cur) => acc + cur.missing, 0);
    const efficiencyList = Object.entries(curr.storeEfficiencyMTD).map(([name, val]) => ({
      name,
      eff: val.oil > 0 ? val.raw / val.oil : 0
    })).sort((a, b) => a.eff - b.eff);

    const totalCumRaw = Object.values(curr.storeEfficiencyMTD).reduce((a, b) => a + b.raw, 0);
    const totalCumOil = Object.values(curr.storeEfficiencyMTD).reduce((a, b) => a + b.oil, 0);

    return {
      current: curr, previous: prev, 
      monthlyEfficiency: totalCumOil > 0 ? totalCumRaw / totalCumOil : 0,
      totalHolidays, durationDays: durationDaysVal,
      efficiencyList, holidayList
    };
  }, [data, startDate, endDate]);

  if (!stats) return null;
  const { current, previous, monthlyEfficiency, totalHolidays, durationDays, efficiencyList, holidayList } = stats;
  const effInfo = getEfficiencyGuide(monthlyEfficiency);

  const filteredEffList = efficiencyList.filter(s => s.name.toLowerCase().includes(effSearch.toLowerCase()));
  const filteredHolidayList = holidayList.filter(s => s.name.toLowerCase().includes(holidaySearch.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-slate-900 p-8 rounded-[40px] border-2 border-slate-800 shadow-2xl relative overflow-hidden">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">총 매출 (홀/플랫폼 합산)</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-3xl font-black text-white">{current.totalSales.toLocaleString()}원</h4>
            <GrowthBadge current={current.totalSales} previous={previous.totalSales} />
          </div>
          <p className="mt-3 text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 inline-block">{current.totalOrders.toLocaleString()}건</p>
        </div>

        <div className={`bg-slate-900 p-8 rounded-[40px] border-2 shadow-2xl transition-all cursor-pointer ${isEffExpanded ? 'border-blue-500/40' : 'border-slate-800 hover:border-slate-700'}`} onClick={() => setIsEffExpanded(!isEffExpanded)}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">통합 조리 효율 (월 누적)</p>
              <h4 className={`text-3xl font-black ${effInfo.color}`}>{monthlyEfficiency.toFixed(1)} <span className="text-sm font-bold">수/can</span></h4>
            </div>
            {isEffExpanded ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
          </div>
          {isEffExpanded && (
            <div className="mt-4 pt-4 border-t border-slate-800 animate-in slide-in-from-top-2 duration-300 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className={`p-4 rounded-2xl ${effInfo.bg} border ${effInfo.color.replace('text', 'border')}/20 flex items-start gap-3`}>
                <Info size={14} className={`mt-0.5 shrink-0 ${effInfo.color}`} />
                <p className={`text-[11px] font-bold leading-relaxed ${effInfo.color}`}>{effInfo.ment}</p>
              </div>
              
              <div className="bg-slate-950/50 p-5 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-500 uppercase">전 가맹점 월 누적 효율</p>
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input 
                      type="text" 
                      placeholder="매장 검색..." 
                      value={effSearch}
                      onChange={(e) => setEffSearch(e.target.value)}
                      className="bg-slate-900 border-none rounded-lg pl-7 pr-2 py-1 text-[10px] text-white outline-none w-32 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-1 pr-1">
                  {filteredEffList.map(store => {
                    const storeEffInfo = getEfficiencyGuide(store.eff);
                    return (
                      <div key={store.name} className="flex justify-between items-center py-2 px-3 hover:bg-slate-800/50 rounded-xl transition-colors">
                        <span className="text-[10px] font-bold text-slate-400">{store.name}</span>
                        <span className={`text-[10px] font-black ${storeEffInfo.color}`}>{store.eff.toFixed(1)}수</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`bg-slate-900 p-8 rounded-[40px] border-2 shadow-2xl transition-all cursor-pointer ${isHolidayExpanded ? 'border-amber-500/40' : 'border-slate-800 hover:border-slate-700'}`} onClick={() => setIsHolidayExpanded(!isHolidayExpanded)}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">총 휴무일수 (선택기간)</p>
              <h4 className="text-3xl font-black text-amber-400">{totalHolidays.toLocaleString()} <span className="text-sm font-bold">일</span></h4>
            </div>
            {isHolidayExpanded ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
          </div>
          {isHolidayExpanded && (
            <div className="mt-4 pt-4 border-t border-slate-800 animate-in slide-in-from-top-2 duration-300 space-y-4" onClick={(e) => e.stopPropagation()}>
              <p className="text-[11px] font-bold text-slate-400 px-1">분석 기간 {durationDays}일 기준, 전체 매장 누적 휴무일 (매출 0원 포함)</p>
              
              <div className="bg-slate-950/50 p-5 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-500 uppercase">가맹점별 휴무 현황 (전체)</p>
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input 
                      type="text" 
                      placeholder="매장 검색..." 
                      value={holidaySearch}
                      onChange={(e) => setHolidaySearch(e.target.value)}
                      className="bg-slate-900 border-none rounded-lg pl-7 pr-2 py-1 text-[10px] text-white outline-none w-32 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-1 pr-1">
                  {filteredHolidayList.map(store => (
                    <div key={store.name} className="flex justify-between items-center py-2 px-3 hover:bg-slate-800/50 rounded-xl transition-colors">
                      <span className="text-[10px] font-bold text-slate-400">{store.name}</span>
                      <span className={`text-[10px] font-black ${store.missing > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {store.missing > 0 ? `${store.missing}일 휴무` : '정상 영업'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-2xl group relative overflow-hidden">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">단독 포장 매출</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-3xl font-black text-rose-400">{current.takeoutSales.toLocaleString()}원</h4>
            <GrowthBadge current={current.takeoutSales} previous={previous.takeoutSales} />
          </div>
          <p className="mt-3 text-[10px] font-black text-rose-500/60 bg-rose-500/5 px-2 py-0.5 rounded-md border border-rose-500/10 inline-block">{current.takeoutOrders.toLocaleString()}건</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-xl overflow-hidden">
          <div onClick={() => setIsPlatformExpanded(!isPlatformExpanded)} className="p-8 border-b border-slate-800 bg-slate-800/20 flex justify-between items-center cursor-pointer">
            <div className="flex items-center gap-3">
              <Smartphone className="text-blue-500" size={20} />
              <div className="flex flex-col">
                <h4 className="text-base font-black text-white">채널별 매출 상세</h4>
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">플랫폼 총합: {current.platformSales.toLocaleString()}원</p>
              </div>
            </div>
            {isPlatformExpanded ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
          </div>
          {isPlatformExpanded && (
            <div className="p-8 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between p-5 bg-blue-500/5 rounded-2xl border border-blue-500/20 mb-2">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-2 rounded-lg text-white"><TrendingUp size={14}/></div>
                  <div>
                    <span className="text-[11px] font-black text-blue-400 uppercase tracking-tighter block mb-0.5">Hall Sales</span>
                    <span className="text-sm font-black text-white">내점(홀) 매출</span>
                  </div>
                  <GrowthBadge current={current.inStoreSales} previous={previous.inStoreSales} />
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-white">{current.inStoreSales.toLocaleString()}원 <span className="text-[10px] text-blue-500">({current.inStoreOrders.toLocaleString()}건)</span></p>
                  <p className="text-[10px] text-slate-500">비중 {current.totalSales > 0 ? ((current.inStoreSales / current.totalSales) * 100).toFixed(1) : 0}%</p>
                </div>
              </div>
              {Object.entries(current.platformDetails).sort((a:any,b:any)=>b[1].amount-a[1].amount).map(([name, val]: [string, any]) => (
                <div key={name} className="flex items-center justify-between p-4 bg-slate-800/40 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300">{name}</span>
                    <GrowthBadge current={val.amount} previous={previous.platformDetails[name]?.amount || 0} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-white">{val.amount.toLocaleString()}원 <span className="text-[10px] text-slate-500">({val.count.toLocaleString()}건)</span></p>
                    <p className="text-[10px] text-slate-500">비중 {current.totalSales > 0 ? ((val.amount / current.totalSales) * 100).toFixed(1) : 0}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-xl overflow-hidden">
          <div onClick={() => setIsMaterialExpanded(!isMaterialExpanded)} className="p-8 border-b border-slate-800 bg-slate-800/20 flex justify-between items-center cursor-pointer">
            <div className="flex items-center gap-3">
              <Package className="text-rose-500" size={20} />
              <div className="flex flex-col">
                <h4 className="text-base font-black text-white">원부자재 매입 상세</h4>
                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-tighter">매입 총합: {current.totalCost.toLocaleString()}원</p>
              </div>
            </div>
            {isMaterialExpanded ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
          </div>
          {isMaterialExpanded && (
            <div className="p-8 space-y-3 animate-in fade-in duration-300">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10 text-center">
                  <div className="flex justify-center mb-1 text-rose-500"><Box size={14}/></div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">원자재(육류)</p>
                  <p className="text-xs font-black text-white">{current.rawMaterialAmount.toLocaleString()}원</p>
                </div>
                <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10 text-center">
                  <div className="flex justify-center mb-1 text-blue-500"><Droplet size={14}/></div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">전용유</p>
                  <p className="text-xs font-black text-white">{current.oilAmount.toLocaleString()}원</p>
                </div>
                <div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10 text-center">
                  <div className="flex justify-center mb-1 text-amber-500"><ShoppingCart size={14}/></div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">부자재/발주</p>
                  <p className="text-xs font-black text-white">{current.subMaterialAmount.toLocaleString()}원</p>
                </div>
              </div>
              <div className="h-px bg-slate-800/50 mb-4"></div>
              {Object.entries(current.rawMaterialDetails).sort((a:any,b:any)=>b[1].amount-a[1].amount).map(([name, val]: [string, any]) => (
                <div key={name} className="flex items-center justify-between p-4 bg-slate-800/40 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300">{name}</span>
                    <GrowthBadge current={val.amount} previous={previous.rawMaterialDetails[name]?.amount || 0} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-white">{val.amount.toLocaleString()}원 <span className="text-[10px] text-slate-500">({val.count.toLocaleString()}건)</span></p>
                    <p className="text-[10px] text-slate-500">원가율 {current.totalSales > 0 ? ((val.amount / current.totalSales) * 100).toFixed(1) : 0}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
