
import React, { useMemo, useState, useEffect } from 'react';
import { RawSalesData, normalizeChannel, getChannelType } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, isValid } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronDown, Store, Calendar, TrendingUp, Package, Users, Calculator, Wallet, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

interface Props {
  data: RawSalesData[];
}

const PnLAnalysis: React.FC<Props> = ({ data }) => {
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // 비용 항목 (사용자 입력 가능 영역)
  const [personnelCost, setPersonnelCost] = useState({ staff: 0, partTimer: 0 });
  const [sgaExpenses, setSgaExpenses] = useState({
    rent: 0,
    mngFee: 0,
    electricity: 0,
    gas: 0,
    water: 0,
    tel: 0,
    deliveryFee: 0,
    pos: 0,
    security: 0,
    cesco: 0,
    tax: 0,
    marketing: 0,
    welfare: 0,
    etc: 0
  });

  // 고유 가맹점 및 월 목록 추출
  const stores = useMemo(() => {
    const s = new Set<string>();
    data.forEach(d => s.add(d.storeName));
    return Array.from(s).sort();
  }, [data]);

  const months = useMemo(() => {
    const m = new Set<string>();
    data.forEach(d => {
      const date = parseISO(d.date);
      if (isValid(date)) {
        m.add(format(date, 'yyyy-MM'));
      }
    });
    return Array.from(m).sort((a, b) => b.localeCompare(a));
  }, [data]);

  useEffect(() => {
    if (stores.length > 0 && !selectedStore) setSelectedStore(stores[0]);
    if (months.length > 0 && !selectedMonth) setSelectedMonth(months[0]);
  }, [stores, months]);

  // 선택된 데이터 필터링 및 집계
  const pnlData = useMemo(() => {
    if (!selectedStore || !selectedMonth) return null;

    const [year, month] = selectedMonth.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));

    const filtered = data.filter(d => {
      const dt = parseISO(d.date);
      return d.storeName === selectedStore && isValid(dt) && dt >= start && dt <= end;
    });

    const stats = {
      sales: {
        baemin: 0, baemin1: 0, coupang: 0, ddangyo: 0, mukkebi: 0, wemake: 0, yogiDel: 0, yogi: 0, app: 0, phone: 0, inStore: 0, total: 0
      },
      costs: {
        meat: 0, meat800: 0, combo: 0, meat600: 0, gizzard: 0, oil: 0, supplies: 0, total: 0
      }
    };

    filtered.forEach(d => {
      const norm = normalizeChannel(d.channel);
      const type = getChannelType(norm);

      if (type === 'platform') {
        if (norm.includes('배민1')) stats.sales.baemin1 += d.amount;
        else if (norm.includes('배달의민족')) stats.sales.baemin += d.amount;
        else if (norm.includes('쿠팡이츠')) stats.sales.coupang += d.amount;
        else if (norm.includes('땡겨요')) stats.sales.ddangyo += d.amount;
        else if (norm.includes('먹깨비')) stats.sales.mukkebi += d.amount;
        else if (norm.includes('위메프오')) stats.sales.wemake += d.amount;
        else if (norm.includes('요기배달')) stats.sales.yogiDel += d.amount;
        else if (norm.includes('요기요')) stats.sales.yogi += d.amount;
        else if (norm.includes('자사앱')) stats.sales.app += d.amount;
        else if (norm.includes('전화')) stats.sales.phone += d.amount;
        stats.sales.total += d.amount;
      } else if (norm === '내점') {
        stats.sales.inStore += d.amount;
        stats.sales.total += d.amount;
      } else if (type === 'material') {
        if (d.channel.includes('절단육')) stats.costs.meat += d.amount;
        else if (d.channel.includes('800g')) stats.costs.meat800 += d.amount;
        else if (d.channel.includes('콤보')) stats.costs.combo += d.amount;
        else if (d.channel.includes('600g')) stats.costs.meat600 += d.amount;
        else if (d.channel.includes('근위')) stats.costs.gizzard += d.amount;
        else if (norm === '전용유') stats.costs.oil += d.amount;
        else if (norm === '부자재') stats.costs.supplies += d.amount;
        stats.costs.total += d.amount;
      }
    });

    return stats;
  }, [selectedStore, selectedMonth, data]);

  if (!pnlData) return <div className="p-20 text-center text-slate-500 font-black">데이터를 불러오는 중입니다...</div>;

  const totalPersonnel = personnelCost.staff + personnelCost.partTimer;
  // Fix: Explicitly type 'a' and 'b' as numbers to resolve the operator '+' error on unknown types.
  const totalSga = Object.values(sgaExpenses).reduce((a: number, b: number) => a + b, 0);
  const totalExpense = pnlData.costs.total + totalPersonnel + totalSga;
  const operatingProfit = pnlData.sales.total - totalExpense;
  const profitMargin = pnlData.sales.total > 0 ? (operatingProfit / pnlData.sales.total) * 100 : 0;
  const foodCostRatio = pnlData.sales.total > 0 ? (pnlData.costs.total / pnlData.sales.total) * 100 : 0;

  const renderInput = (label: string, value: number, setter: (val: number) => void) => (
    <div className="flex items-center justify-between py-2 px-2 hover:bg-slate-800/50 rounded-lg transition-colors group">
      <span className="text-xs font-bold text-slate-400 group-hover:text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <input 
          type="number" 
          value={value === 0 ? '' : value}
          onChange={(e) => setter(parseInt(e.target.value) || 0)}
          className="w-24 bg-transparent border-b border-slate-700 text-right text-xs font-black text-white focus:border-blue-500 outline-none p-1"
          placeholder="0"
        />
        <span className="text-[10px] text-slate-600 font-bold">원</span>
      </div>
    </div>
  );

  const renderRow = (label: string, value: number, isSub = false, colorClass = "text-white") => (
    <div className={`flex items-center justify-between py-2.5 px-3 ${isSub ? 'pl-8' : ''} border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors`}>
      <span className={`text-xs ${isSub ? 'font-medium text-slate-500' : 'font-black text-slate-300'}`}>{label}</span>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-black ${colorClass}`}>{value.toLocaleString()}원</span>
        <span className="text-[9px] font-bold text-slate-600 w-12 text-right">
          {pnlData.sales.total > 0 ? ((value / pnlData.sales.total) * 100).toFixed(1) : 0}%
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* 셀렉터 영역 */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-900 p-6 rounded-[32px] border border-slate-800 shadow-xl items-center justify-between">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3 bg-slate-800 px-5 py-3 rounded-2xl border border-slate-700">
            <Store size={18} className="text-blue-500" />
            <select 
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="bg-transparent border-none text-sm font-black text-slate-100 outline-none appearance-none cursor-pointer"
            >
              {stores.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
            </select>
            <ChevronDown size={14} className="text-slate-500" />
          </div>

          <div className="flex items-center gap-3 bg-slate-800 px-5 py-3 rounded-2xl border border-slate-700">
            <Calendar size={18} className="text-emerald-500" />
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-sm font-black text-slate-100 outline-none appearance-none cursor-pointer"
            >
              {months.map(m => {
                const [y, mm] = m.split('-');
                return <option key={m} value={m} className="bg-slate-900">{y}년 {mm}월</option>
              })}
            </select>
            <ChevronDown size={14} className="text-slate-500" />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">영업 이익율</p>
            <p className={`text-2xl font-black ${operatingProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {profitMargin.toFixed(1)}%
            </p>
          </div>
          <div className="w-px h-10 bg-slate-800"></div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">최종 영업 이익</p>
            <p className={`text-2xl font-black ${operatingProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {operatingProfit.toLocaleString()}원
            </p>
          </div>
        </div>
      </div>

      {/* 메인 손익 레이아웃 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* 왼쪽: 매출 및 원가 (자동 집계) */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-xl overflow-hidden">
            <div className="bg-blue-600/10 px-8 py-5 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <TrendingUp size={20} className="text-blue-500" />
                <h3 className="text-base font-black text-white uppercase tracking-tight">매출 내역 (Sales)</h3>
              </div>
              <span className="text-xs font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full">실적 기준</span>
            </div>
            <div className="p-4 space-y-0.5">
              {renderRow("배달의민족 (일반)", pnlData.sales.baemin, true)}
              {renderRow("배민1", pnlData.sales.baemin1, true)}
              {renderRow("쿠팡이츠", pnlData.sales.coupang, true)}
              {renderRow("요기배달", pnlData.sales.yogiDel, true)}
              {renderRow("요기요 (일반)", pnlData.sales.yogi, true)}
              {renderRow("땡겨요", pnlData.sales.ddangyo, true)}
              {renderRow("먹깨비", pnlData.sales.mukkebi, true)}
              {renderRow("위메프오", pnlData.sales.wemake, true)}
              {renderRow("자사앱", pnlData.sales.app, true)}
              {renderRow("전화 주문", pnlData.sales.phone, true)}
              {renderRow("내점 (홀)", pnlData.sales.inStore, true)}
              <div className="flex items-center justify-between py-4 px-3 bg-slate-800/40 mt-2 rounded-2xl">
                <span className="text-sm font-black text-blue-400">총 매출 합계</span>
                <span className="text-lg font-black text-white">{pnlData.sales.total.toLocaleString()}원</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-xl overflow-hidden">
            <div className="bg-red-600/10 px-8 py-5 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Package size={20} className="text-red-500" />
                <h3 className="text-base font-black text-white uppercase tracking-tight">원재료비 (Food Cost)</h3>
              </div>
              <span className="text-xs font-black text-red-400 bg-red-500/10 px-3 py-1 rounded-full">공급가 기준</span>
            </div>
            <div className="p-4 space-y-0.5">
              {renderRow("절단육", pnlData.costs.meat, true)}
              {renderRow("순살 (800g)", pnlData.costs.meat800, true)}
              {renderRow("콤보", pnlData.costs.combo, true)}
              {renderRow("순살 (600g)", pnlData.costs.meat600, true)}
              {renderRow("근위", pnlData.costs.gizzard, true)}
              {renderRow("전용유", pnlData.costs.oil, true)}
              {renderRow("부자재 (박스/봉투 등)", pnlData.costs.supplies, true)}
              <div className="flex items-center justify-between py-4 px-3 bg-slate-800/40 mt-2 rounded-2xl">
                <div>
                  <span className="text-sm font-black text-red-400">총 원가 합계</span>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">원가율: {foodCostRatio.toFixed(1)}%</p>
                </div>
                <span className="text-lg font-black text-white">{pnlData.costs.total.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 인건비 및 판관비 (수동 입력) */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-xl overflow-hidden">
            <div className="bg-emerald-600/10 px-8 py-5 border-b border-slate-800 flex items-center gap-3">
              <Users size={20} className="text-emerald-500" />
              <h3 className="text-base font-black text-white uppercase tracking-tight">인건비 (Labor)</h3>
            </div>
            <div className="p-6 space-y-2">
              {renderInput("정규직 직원 급여", personnelCost.staff, (val) => setPersonnelCost({...personnelCost, staff: val}))}
              {renderInput("아르바이트 급여", personnelCost.partTimer, (val) => setPersonnelCost({...personnelCost, partTimer: val}))}
              <div className="flex items-center justify-between py-4 px-4 bg-emerald-500/5 mt-4 rounded-2xl border border-emerald-500/20">
                <span className="text-sm font-black text-emerald-400">총 인건비</span>
                <span className="text-lg font-black text-white">{totalPersonnel.toLocaleString()}원</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-xl overflow-hidden">
            <div className="bg-amber-600/10 px-8 py-5 border-b border-slate-800 flex items-center gap-3">
              <Calculator size={20} className="text-amber-500" />
              <h3 className="text-base font-black text-white uppercase tracking-tight">판매관리비 (SG&A)</h3>
            </div>
            <div className="p-6 space-y-1 max-h-[500px] overflow-y-auto custom-scrollbar">
              {renderInput("임대료 (월세)", sgaExpenses.rent, (val) => setSgaExpenses({...sgaExpenses, rent: val}))}
              {renderInput("건물 관리비", sgaExpenses.mngFee, (val) => setSgaExpenses({...sgaExpenses, mngFee: val}))}
              {renderInput("전기 요금", sgaExpenses.electricity, (val) => setSgaExpenses({...sgaExpenses, electricity: val}))}
              {renderInput("가스 요금", sgaExpenses.gas, (val) => setSgaExpenses({...sgaExpenses, gas: val}))}
              {renderInput("수도 요금", sgaExpenses.water, (val) => setSgaExpenses({...sgaExpenses, water: val}))}
              {renderInput("통신비 (인터넷/TV/전화)", sgaExpenses.tel, (val) => setSgaExpenses({...sgaExpenses, tel: val}))}
              {renderInput("배달 대행료 (지출)", sgaExpenses.deliveryFee, (val) => setSgaExpenses({...sgaExpenses, deliveryFee: val}))}
              {renderInput("POS/키오스크 비용", sgaExpenses.pos, (val) => setSgaExpenses({...sgaExpenses, pos: val}))}
              {renderInput("보안 서비스 (ADT/캡스 등)", sgaExpenses.security, (val) => setSgaExpenses({...sgaExpenses, security: val}))}
              {renderInput("방역 서비스 (세스코 등)", sgaExpenses.cesco, (val) => setSgaExpenses({...sgaExpenses, cesco: val}))}
              {renderInput("세무/기장료", sgaExpenses.tax, (val) => setSgaExpenses({...sgaExpenses, tax: val}))}
              {renderInput("홍보 및 마케팅비", sgaExpenses.marketing, (val) => setSgaExpenses({...sgaExpenses, marketing: val}))}
              {renderInput("직원 복지비 (식대 등)", sgaExpenses.welfare, (val) => setSgaExpenses({...sgaExpenses, welfare: val}))}
              {renderInput("기타 잡비", sgaExpenses.etc, (val) => setSgaExpenses({...sgaExpenses, etc: val}))}
              
              <div className="flex items-center justify-between py-4 px-4 bg-amber-500/5 mt-6 rounded-2xl border border-amber-500/20 sticky bottom-0">
                <span className="text-sm font-black text-amber-500">총 판관비 합계</span>
                <span className="text-lg font-black text-white">{totalSga.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 최종 요약 리포트 바 */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-blue-600 via-emerald-500 to-amber-500"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gross Sales (총 매출)</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-white">{pnlData.sales.total.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-500">원</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Expense (총 비용)</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-red-400">{totalExpense.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-500">원</span>
              <ArrowDownCircle size={16} className="text-red-500/50" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Operating Profit (영업이익)</p>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black ${operatingProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {operatingProfit.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-500">원</span>
              {operatingProfit >= 0 ? <ArrowUpCircle size={16} className="text-emerald-500" /> : <ArrowDownCircle size={16} className="text-red-500" />}
            </div>
          </div>
          <div className="flex flex-col justify-center items-end border-l border-slate-800 pl-8">
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase mb-1">BEP 달성률</p>
                <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                   <div 
                    className={`h-full transition-all duration-1000 ${operatingProfit >= 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                    style={{width: `${Math.min(100, Math.max(0, (pnlData.sales.total / totalExpense) * 100))}%`}}
                   ></div>
                </div>
              </div>
              <span className="text-xl font-black text-slate-300">
                {totalExpense > 0 ? ((pnlData.sales.total / totalExpense) * 100).toFixed(0) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PnLAnalysis;
