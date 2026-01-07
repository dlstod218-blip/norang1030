
import React, { useMemo, useState } from 'react';
import { RawSalesData, getChannelType, normalizeChannel } from '../types';
import { TrendingUp, Package, ShoppingBag, Activity, PieChart, Utensils, Droplets, AlertCircle, ArrowUpRight, ArrowDownRight, CalendarDays, Zap, Smartphone, Store, ChevronDown, ChevronUp } from 'lucide-react';
import { parseISO, isValid, isWithinInterval, startOfDay, endOfDay, subDays, differenceInDays, startOfMonth, endOfMonth, format } from 'date-fns';

interface Props {
  data: RawSalesData[]; 
  startDate: string;
  endDate: string;
}

const DashboardOverview: React.FC<Props> = ({ data, startDate, endDate }) => {
  const [isPlatformExpanded, setIsPlatformExpanded] = useState(false);

  const calculateStats = (targetData: RawSalesData[]) => {
    let totalSales = 0;
    let totalOrders = 0;
    let platformSales = 0;
    let platformOrders = 0;
    let inStoreSales = 0;
    let inStoreOrders = 0;
    let rawMaterialCost = 0;
    let rawMaterialCount = 0;
    let subMaterialCost = 0;
    let subMaterialCount = 0;
    let oilCost = 0;
    let oilCount = 0;
    let takeoutSales = 0;
    let rawMaterialDetails: Record<string, { amount: number, count: number }> = {};
    let platformDetails: Record<string, { amount: number, count: number }> = {};

    targetData.forEach(item => {
      const normChan = normalizeChannel(item.channel);
      const type = getChannelType(normChan);

      if (type === 'platform') {
        platformSales += item.amount;
        platformOrders += item.orderCount;
        totalSales += item.amount;
        totalOrders += item.orderCount;

        if (!platformDetails[normChan]) platformDetails[normChan] = { amount: 0, count: 0 };
        platformDetails[normChan].amount += item.amount;
        platformDetails[normChan].count += item.orderCount;
      } else if (normChan === '내점') {
        inStoreSales += item.amount;
        inStoreOrders += item.orderCount;
        totalSales += item.amount;
        totalOrders += item.orderCount;
      } else if (type === 'takeout') {
        takeoutSales += item.amount;
      } else if (type === 'material') {
        if (normChan === '원자재') {
          rawMaterialCost += item.amount;
          rawMaterialCount += item.orderCount;
          const detailName = item.channel;
          if (!rawMaterialDetails[detailName]) rawMaterialDetails[detailName] = { amount: 0, count: 0 };
          rawMaterialDetails[detailName].amount += item.amount;
          rawMaterialDetails[detailName].count += item.orderCount;
        } else if (normChan === '부자재') {
          subMaterialCost += item.amount;
          subMaterialCount += item.orderCount;
        } else if (normChan === '전용유') {
          oilCost += item.amount;
          oilCount += item.orderCount;
        }
      }
    });

    const totalCost = rawMaterialCost + subMaterialCost + oilCost;
    const foodCostRatio = totalSales > 0 ? (totalCost / totalSales) * 100 : 0;
    const aov = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

    return { 
      totalSales, totalOrders, platformSales, platformOrders, inStoreSales, inStoreOrders,
      takeoutSales, totalCost, foodCostRatio, aov, 
      rawMaterialCost, rawMaterialCount, 
      subMaterialCost, subMaterialCount,
      oilCost, oilCount, rawMaterialDetails, platformDetails
    };
  };

  const analysis = useMemo(() => {
    if (!startDate || !endDate) return null;

    const currentS = startOfDay(parseISO(startDate));
    const currentE = endOfDay(parseISO(endDate));
    if (!isValid(currentS) || !isValid(currentE)) return null;

    // Calculate duration and same-duration previous period
    const durationDays = differenceInDays(currentE, currentS) + 1;
    const prevE = subDays(currentS, 1);
    const prevS = subDays(prevE, durationDays - 1);

    const currentData = data.filter(d => {
      const dt = parseISO(d.date);
      return isValid(dt) && isWithinInterval(dt, { start: currentS, end: currentE });
    });

    const prevData = data.filter(d => {
      const dt = parseISO(d.date);
      return isValid(dt) && isWithinInterval(dt, { start: startOfDay(prevS), end: endOfDay(prevE) });
    });

    // Monthly summary for efficiency (current month of the end date)
    const monthStart = startOfMonth(currentE);
    const monthEnd = endOfMonth(currentE);
    const fullMonthData = data.filter(d => {
      const dt = parseISO(d.date);
      return isValid(dt) && isWithinInterval(dt, { start: monthStart, end: monthEnd });
    });
    
    const monthlyStats = calculateStats(fullMonthData);

    return {
      current: calculateStats(currentData),
      previous: calculateStats(prevData),
      monthly: monthlyStats,
      monthLabel: format(currentE, 'yyyy년 MM월'),
      prevLabel: `${format(prevS, 'MM/dd')}~${format(prevE, 'MM/dd')}`
    };
  }, [data, startDate, endDate]);

  if (!analysis) return null;

  const { current, previous, monthly, monthLabel, prevLabel } = analysis;

  const getComparison = (curr: number, prev: number) => {
    const diff = curr - prev;
    const percent = prev > 0 ? (diff / prev) * 100 : 0;
    return { diff, percent, isGrow: diff >= 0 };
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Total Sales */}
        <div className="bg-slate-900 p-8 rounded-[40px] border-2 border-slate-800 shadow-2xl transition-all hover:scale-[1.02] group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="flex justify-between items-start mb-6">
            <div className="bg-blue-600/20 p-4 rounded-2xl group-hover:bg-blue-600/30 transition-colors">
              <TrendingUp className="text-blue-500" size={24} />
            </div>
            <div className={`flex flex-col items-end gap-1 px-3 py-1.5 rounded-xl text-[9px] font-black border ${
              getComparison(current.totalSales, previous.totalSales).isGrow 
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
              : 'text-red-400 bg-red-500/10 border-red-500/20'
            }`}>
              <div className="flex items-center gap-1">
                {getComparison(current.totalSales, previous.totalSales).isGrow ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(getComparison(current.totalSales, previous.totalSales).percent).toFixed(1)}%
              </div>
              <span className="opacity-60 font-bold uppercase tracking-tighter">vs {prevLabel}</span>
            </div>
          </div>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">총 매출액 (내점+플랫폼)</p>
          <div className="flex items-baseline gap-1">
            <h4 className="text-4xl font-black text-white tracking-tighter">{current.totalSales.toLocaleString()}</h4>
            <span className="text-xl font-bold text-slate-500">원</span>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-4 bg-slate-800/50 inline-block px-3 py-1 rounded-lg">
            {current.totalOrders.toLocaleString()}건 주문
          </p>
        </div>

        {/* Platform Sales */}
        <div 
          onClick={() => setIsPlatformExpanded(!isPlatformExpanded)}
          className={`bg-slate-900 rounded-[40px] border-2 shadow-2xl transition-all relative overflow-hidden cursor-pointer group hover:scale-[1.02] ${isPlatformExpanded ? 'ring-4 ring-blue-500/10 border-blue-500/40' : 'border-slate-800'}`}
        >
          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="bg-indigo-600/20 p-4 rounded-2xl group-hover:bg-indigo-600/30 transition-colors">
                <Smartphone className="text-indigo-400" size={24} />
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex flex-col items-end gap-1 px-3 py-1.5 rounded-xl text-[9px] font-black border ${
                  getComparison(current.platformSales, previous.platformSales).isGrow 
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                  : 'text-red-400 bg-red-500/10 border-red-500/20'
                }`}>
                  <div className="flex items-center gap-1">
                    {getComparison(current.platformSales, previous.platformSales).isGrow ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(getComparison(current.platformSales, previous.platformSales).percent).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-slate-800 p-2 rounded-lg text-slate-500 group-hover:text-white transition-colors">
                  {isPlatformExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>
            </div>
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">플랫폼 매출액</p>
            <div className="flex items-baseline gap-1">
              <h4 className="text-4xl font-black text-white tracking-tighter">{current.platformSales.toLocaleString()}</h4>
              <span className="text-xl font-bold text-slate-500">원</span>
            </div>
            <div className="flex items-center gap-3 mt-4">
               <span className="text-xs font-bold text-slate-400 bg-slate-800/50 px-3 py-1 rounded-lg">{current.platformOrders.toLocaleString()}건</span>
               <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-1 rounded-lg">배달비중 {current.totalSales > 0 ? ((current.platformSales / current.totalSales) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
          {isPlatformExpanded && (
            <div className="px-8 pb-8 pt-2 border-t border-slate-800 bg-slate-950/40 animate-in slide-in-from-top-2 duration-300">
              <div className="space-y-3 mt-4">
                {(Object.entries(current.platformDetails) as [string, { amount: number, count: number }][])
                  .sort((a, b) => b[1].amount - a[1].amount)
                  .map(([name, stats]) => (
                    <div key={name} className="flex justify-between items-center px-3 py-2.5 rounded-2xl hover:bg-slate-800/60 transition-colors border border-transparent hover:border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                        <span className="text-xs font-bold text-slate-300">{name}</span>
                      </div>
                      <div className="flex gap-6 items-center">
                        <span className="text-[10px] font-bold text-slate-500">{stats.count.toLocaleString()}건</span>
                        <span className="text-xs font-black text-slate-100">{stats.amount.toLocaleString()}원</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* In-Store Sales */}
        <div className="bg-slate-900 p-8 rounded-[40px] border-2 border-slate-800 shadow-2xl transition-all hover:scale-[1.02] group relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div className="bg-emerald-600/20 p-4 rounded-2xl group-hover:bg-emerald-600/30 transition-colors">
              <Store className="text-emerald-400" size={24} />
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black border ${
              getComparison(current.inStoreSales, previous.inStoreSales).isGrow 
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
              : 'text-red-400 bg-red-500/10 border-red-500/20'
            }`}>
              {getComparison(current.inStoreSales, previous.inStoreSales).isGrow ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(getComparison(current.inStoreSales, previous.inStoreSales).percent).toFixed(1)}%
            </div>
          </div>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">내점 매출액</p>
          <div className="flex items-baseline gap-1">
            <h4 className="text-4xl font-black text-white tracking-tighter">{current.inStoreSales.toLocaleString()}</h4>
            <span className="text-xl font-bold text-slate-500">원</span>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-4 bg-slate-800/50 inline-block px-3 py-1 rounded-lg">
            {current.inStoreOrders.toLocaleString()}건 주문
          </p>
        </div>

        {/* Takeout */}
        <div className="bg-slate-900 p-8 rounded-[40px] border-2 border-slate-800 shadow-2xl transition-all hover:scale-[1.02] group relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div className="bg-rose-600/20 p-4 rounded-2xl group-hover:bg-rose-600/30 transition-colors">
              <ShoppingBag className="text-rose-400" size={24} />
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black border ${
              getComparison(current.takeoutSales, previous.takeoutSales).isGrow 
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
              : 'text-red-400 bg-red-500/10 border-red-500/20'
            }`}>
              {getComparison(current.takeoutSales, previous.takeoutSales).isGrow ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(getComparison(current.takeoutSales, previous.takeoutSales).percent).toFixed(1)}%
            </div>
          </div>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">포장 매출 (독립 지표)</p>
          <div className="flex items-baseline gap-1">
            <h4 className="text-4xl font-black text-white tracking-tighter">{current.takeoutSales.toLocaleString()}</h4>
            <span className="text-xl font-bold text-slate-500">원</span>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-4 bg-slate-800/50 inline-block px-3 py-1 rounded-lg">기타 매출 지표</p>
        </div>

        {/* Cost */}
        <div className="bg-slate-900 p-8 rounded-[40px] border-2 border-slate-800 shadow-2xl transition-all hover:scale-[1.02] group relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div className="bg-amber-600/20 p-4 rounded-2xl group-hover:bg-amber-600/30 transition-colors">
              <Package className="text-amber-500" size={24} />
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black border ${
              getComparison(current.totalCost, previous.totalCost).isGrow 
              ? 'text-red-400 bg-red-500/10 border-red-500/20' 
              : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            }`}>
              {getComparison(current.totalCost, previous.totalCost).isGrow ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(getComparison(current.totalCost, previous.totalCost).percent).toFixed(1)}%
            </div>
          </div>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">총 원가액</p>
          <div className="flex items-baseline gap-1">
            <h4 className="text-4xl font-black text-white tracking-tighter">{current.totalCost.toLocaleString()}</h4>
            <span className="text-xl font-bold text-slate-500">원</span>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-4 bg-amber-500/10 text-amber-500 border border-amber-500/20 inline-block px-3 py-1 rounded-lg">원가율 {current.foodCostRatio.toFixed(1)}%</p>
        </div>

        {/* AOV */}
        <div className="bg-slate-900 p-8 rounded-[40px] border-2 border-slate-800 shadow-2xl transition-all hover:scale-[1.02] group relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div className="bg-sky-600/20 p-4 rounded-2xl group-hover:bg-sky-600/30 transition-colors">
              <Activity className="text-sky-400" size={24} />
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black border ${
              getComparison(current.aov, previous.aov).isGrow 
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
              : 'text-red-400 bg-red-500/10 border-red-500/20'
            }`}>
              {getComparison(current.aov, previous.aov).isGrow ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(getComparison(current.aov, previous.aov).percent).toFixed(1)}%
            </div>
          </div>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">평균 객단가 (AOV)</p>
          <div className="flex items-baseline gap-1">
            <h4 className="text-4xl font-black text-white tracking-tighter">{current.aov.toLocaleString()}</h4>
            <span className="text-xl font-bold text-slate-500">원</span>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-4 bg-slate-800/50 inline-block px-3 py-1 rounded-lg">결제 건당 매출 지표</p>
        </div>
      </div>

      <div className="bg-slate-900 p-8 rounded-[40px] border-2 border-slate-800 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="flex items-center gap-3 mb-8 relative z-10">
          <PieChart className="text-blue-500" size={24} />
          <h3 className="text-xl font-black text-white">자재 공급 및 원가 분석 (월 누적 효율)</h3>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-10 gap-8 relative z-10">
          <div className="xl:col-span-4 p-8 rounded-[32px] border border-slate-700/50 bg-blue-500/5 flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-4 rounded-2xl bg-slate-900 shadow-inner text-blue-400 ring-1 ring-slate-800">
                  <Utensils size={20} />
                </div>
                <p className="text-base font-black text-white uppercase tracking-tight">원자재 현황</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-slate-500 uppercase">매출 비중</span>
                <p className="text-lg font-black text-blue-400">
                  {current.totalSales > 0 ? ((current.rawMaterialCost / current.totalSales) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">총 원자재 비용</p>
                <p className="text-2xl font-black text-white tracking-tighter">{current.rawMaterialCost.toLocaleString()}원</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">공급 건수</p>
                <p className="text-2xl font-black text-slate-300 tracking-tighter">{current.rawMaterialCount.toLocaleString()}건</p>
              </div>
            </div>

            <div className="flex-1 bg-slate-950/50 rounded-3xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3 bg-slate-800/80 text-[10px] font-black text-slate-500 uppercase flex justify-between items-center pr-12">
                <span className="flex-1">세부 품목</span>
                <span className="w-20 text-right">건수</span>
                <span className="w-20 text-right">매출비</span>
              </div>
              <div className="divide-y divide-slate-800/50 max-h-[220px] overflow-y-auto custom-scrollbar">
                {Object.entries(current.rawMaterialDetails)
                  .sort((a, b) => (b[1] as any).amount - (a[1] as any).amount)
                  .slice(0, 10)
                  .map(([name, s]: [string, any]) => {
                    const ratio = current.totalSales > 0 ? ((s.amount / current.totalSales) * 100).toFixed(1) : '0';
                    return (
                      <div key={name} className="px-5 py-3.5 flex justify-between items-center hover:bg-slate-800/30 transition-colors">
                        <span className="text-xs font-bold text-slate-300 truncate flex-1 mr-4" title={name}>{name}</span>
                        <div className="flex items-center gap-6 shrink-0">
                          <span className="text-[11px] font-bold text-slate-500 w-16 text-right">{s.count.toLocaleString()}건</span>
                          <span className="text-xs font-black text-slate-100 w-20 text-right">{Math.round(s.amount/1000).toLocaleString()}k</span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/10 w-14 text-center">{ratio}%</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="xl:col-span-3 p-8 rounded-[32px] border-2 border-amber-500/30 bg-amber-500/5 flex flex-col h-full relative shadow-[0_0_40px_rgba(245,158,11,0.08)]">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-4 rounded-2xl bg-slate-900 shadow-inner text-amber-500 ring-1 ring-amber-500/20">
                  <Droplets size={24} />
                </div>
                <p className="text-base font-black text-white uppercase tracking-wider">전용유 효율</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="bg-amber-500/10 text-amber-500 text-[9px] font-black px-3 py-1.5 rounded-xl border border-amber-500/20 flex items-center gap-2">
                  <CalendarDays size={12} /> {monthLabel} 누적
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 mb-8">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">월 누적 비용</p>
                <p className="text-2xl font-black text-white tracking-tighter">{monthly.oilCost.toLocaleString()}원</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">공급 수량</p>
                <p className="text-2xl font-black text-amber-500 tracking-tighter">{monthly.oilCount.toLocaleString()} can</p>
              </div>
            </div>
            <div className={`mt-auto p-6 rounded-[30px] border-2 transition-all ${monthly.oilCount > 0 && (monthly.rawMaterialCount / monthly.oilCount) > 70 ? 'bg-red-500/20 border-red-500/40' : 'bg-slate-900/80 border-emerald-500/30'}`}>
              <div className="flex justify-between items-center mb-2">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">1can 당 조리 효율</p>
                {monthly.oilCount > 0 && (monthly.rawMaterialCount / monthly.oilCount) > 70 ? <AlertCircle size={18} className="text-red-500 animate-pulse" /> : <Zap size={18} className="text-emerald-500" />}
              </div>
              <div className="flex items-baseline gap-2">
                <p className={`text-5xl font-black tracking-tighter ${monthly.oilCount > 0 && (monthly.rawMaterialCount / monthly.oilCount) > 70 ? 'text-red-500' : 'text-emerald-400'}`}>
                  {monthly.oilCount > 0 ? (monthly.rawMaterialCount / monthly.oilCount).toFixed(1) : '-'}
                </p>
                <p className="text-xs font-black text-slate-500 uppercase">수 / can</p>
              </div>
            </div>
          </div>

          <div className="xl:col-span-3 p-8 rounded-[32px] border border-slate-700/50 bg-emerald-500/5 flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-4 rounded-2xl bg-slate-900 shadow-inner text-emerald-400 ring-1 ring-slate-800">
                  <Package size={20} />
                </div>
                <p className="text-base font-black text-white uppercase tracking-tight">부자재 현황</p>
              </div>
            </div>
            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-2">기간 산출 비용</p>
                  <p className="text-2xl font-black text-white tracking-tighter">{current.subMaterialCost.toLocaleString()}원</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-2">공급 건수</p>
                  <p className="text-2xl font-black text-slate-300 tracking-tighter">{current.subMaterialCount.toLocaleString()}건</p>
                </div>
              </div>
              <div className="mt-4 p-5 bg-slate-900/50 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">
                  * 본 지표는 매입 합계에서 원자재 및 전용유 비용을 차감하여 자동 산출된 값입니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
