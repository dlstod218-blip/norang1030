
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { RawSalesData, normalizeChannel, getChannelType } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, isValid } from 'date-fns';
import { Store, Calendar, Users, Calculator, TrendingUp, DollarSign, Share2, Loader2, Receipt, Package, Droplets, Lightbulb, Flame, Waves, Truck, Megaphone, PlusCircle, Phone, Smartphone, ShoppingBag, Utensils, Heart, ShieldCheck, UserCheck, Briefcase, FileText, Globe, Box, Cloud, CloudCheck, CloudOff, Coffee, Beer } from 'lucide-react';

interface Props { data: RawSalesData[]; }

const MASTER_KV_ID = "1DqXTJZaMQxCAPNNauE-I6rwsuZWV066aNbHETonPewU".substring(0, 16);
const API_BASE = `https://kvdb.io/${MASTER_KV_ID}/`;
const getPnLKey = (store: string, month: string) => `pnl_v6_${store}_${month}`.replace(/\s/g, '_');

const PnLAnalysis: React.FC<Props> = ({ data }) => {
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');
  
  const [personnelCost, setPersonnelCost] = useState({ staff: 0, partTimer: 0 });
  const [sgaExpenses, setSgaExpenses] = useState<Record<string, number>>({
    supplies: 0, rent: 0, mngFee: 0, electricity: 0, gas: 0, water: 0, comm: 0, delivery: 0,
    pos: 0, security: 0, cesco: 0, tax: 0, marketing: 0, welfare: 0, etc: 0,
    beverage: 0, alcohol: 0
  });

  const stores = useMemo(() => Array.from(new Set(data.map(d => d.storeName))).sort(), [data]);
  const months = useMemo(() => (Array.from(new Set(data.filter(d => isValid(parseISO(d.date))).map(d => format(parseISO(d.date), 'yyyy-MM')))) as string[]).sort((a, b) => b.localeCompare(a)), [data]);

  const pullFromCloud = useCallback(async (store: string, month: string) => {
    if (!store || !month) return;
    setSyncStatus('syncing');
    try {
      const response = await fetch(`${API_BASE}${getPnLKey(store, month)}`);
      if (response.ok) {
        const cloudData = await response.json();
        if (cloudData.personnel) setPersonnelCost(cloudData.personnel);
        if (cloudData.sga) setSgaExpenses(cloudData.sga);
        setSyncStatus('saved');
      } else {
        setPersonnelCost({ staff: 0, partTimer: 0 });
        setSgaExpenses({ 
          supplies: 0, rent: 0, mngFee: 0, electricity: 0, gas: 0, water: 0, comm: 0, delivery: 0,
          pos: 0, security: 0, cesco: 0, tax: 0, marketing: 0, welfare: 0, etc: 0,
          beverage: 0, alcohol: 0
        });
        setSyncStatus('idle');
      }
    } catch (e) {
      setSyncStatus('error');
    }
  }, []);

  const pushToCloud = useCallback(async (store: string, month: string, personnel: any, sga: any) => {
    if (!store || !month) return;
    setSyncStatus('syncing');
    window.dispatchEvent(new CustomEvent('cloud-sync-start'));
    try {
      await fetch(`${API_BASE}${getPnLKey(store, month)}`, {
        method: 'POST',
        body: JSON.stringify({ personnel, sga, updatedAt: Date.now() })
      });
      setSyncStatus('saved');
    } catch (e) {
      setSyncStatus('error');
    } finally {
      window.dispatchEvent(new CustomEvent('cloud-sync-end'));
    }
  }, []);

  useEffect(() => {
    if (stores.length > 0 && !selectedStore) setSelectedStore(stores[0]);
    if (months.length > 0 && !selectedMonth) setSelectedMonth(months[0]);
  }, [stores, months]);

  useEffect(() => {
    if (selectedStore && selectedMonth) pullFromCloud(selectedStore, selectedMonth);
  }, [selectedStore, selectedMonth, pullFromCloud]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedStore && selectedMonth && syncStatus === 'syncing') {
        pushToCloud(selectedStore, selectedMonth, personnelCost, sgaExpenses);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [personnelCost, sgaExpenses, selectedStore, selectedMonth, pushToCloud]);

  const handlePersonnelChange = (field: string, val: number) => {
    setPersonnelCost(prev => ({ ...prev, [field]: val }));
    setSyncStatus('syncing');
  };

  const handleSgaChange = (field: string, val: number) => {
    setSgaExpenses(prev => ({ ...prev, [field]: val }));
    setSyncStatus('syncing');
  };

  const pnlData = useMemo(() => {
    if (!selectedStore || !selectedMonth) return null;
    
    const revItems: Record<string, number> = {
      '전화': 0, '배민': 0, '배민1': 0, '쿠팡이츠': 0, '땡겨요': 0, '먹깨비': 0, 
      '위메프오': 0, '요기배달': 0, '요기요': 0, '자사앱': 0, '내점': 0
    };
    
    const matItems: Record<string, number> = {
      '절단육': 0, '순살(800g)': 0, '콤보': 0, '순살(600g)': 0, '근위': 0, '전용유': 0, '부자재': 0
    };
    
    let standalonePackaging = 0;
    let totalRevenueSum = 0;
    let totalMaterialSum = 0;

    data.filter(d => d.storeName === selectedStore && d.date.startsWith(selectedMonth)).forEach(d => {
      const norm = normalizeChannel(d.channel);
      const type = getChannelType(norm);
      
      if (revItems.hasOwnProperty(norm)) {
        revItems[norm] += d.amount;
        totalRevenueSum += d.amount;
      } else if (norm === '포장') {
        standalonePackaging += d.amount;
      }

      if (matItems.hasOwnProperty(norm)) {
        matItems[norm] += d.amount;
        totalMaterialSum += d.amount;
      }
    });
    
    return { revItems, matItems, totalRevenueSum, totalMaterialSum, standalonePackaging };
  }, [selectedStore, selectedMonth, data]);

  if (!pnlData) return null;

  const totalPersonnel = Number(personnelCost.staff || 0) + Number(personnelCost.partTimer || 0);
  const totalSga = Object.values(sgaExpenses).reduce((acc: number, val) => acc + Number(val || 0), 0);
  
  const revenueAmount = Number(pnlData?.totalRevenueSum || 0);
  const materialAmount = Number(pnlData?.totalMaterialSum || 0);
  const operatingProfit = Number(revenueAmount) - Number(materialAmount) - Number(totalPersonnel) - Number(totalSga);
  const profitMargin = revenueAmount > 0 ? (operatingProfit / revenueAmount) * 100 : 0;
  const materialMargin = revenueAmount > 0 ? (materialAmount / revenueAmount) * 100 : 0;

  const handleShare = async () => {
    if (!pnlData) return;
    
    const sgaBreakdown = Object.entries(sgaExpenses)
      .filter(([_, val]) => Number(val || 0) > 0)
      .map(([key, val]) => {
        const field = sgaFields.find(f => f.key === key);
        return `- ${field?.label || key}: ${Number(val || 0).toLocaleString()}원`;
      }).join('\n');

    const shareMessage = `
[${selectedStore} ${selectedMonth} 손익 리포트 전문]
━━━━━━━━━━━━━━━━━━━━
📈 수익성 요약
- 총 매출액: ${revenueAmount.toLocaleString()}원
- 영업 이익: ${operatingProfit.toLocaleString()}원
- 최종 이익률: ${profitMargin.toFixed(1)}%

💸 지출 상세 리포트
- 원부자재: ${materialAmount.toLocaleString()}원 (${materialMargin.toFixed(1)}%)
- 인건비 합계: ${totalPersonnel.toLocaleString()}원 (비중 ${revenueAmount > 0 ? ((totalPersonnel / revenueAmount) * 100).toFixed(1) : '0.0'}%)
  ㄴ 정직원: ${Number(personnelCost.staff).toLocaleString()}원
  ㄴ 알바/일용: ${Number(personnelCost.partTimer).toLocaleString()}원

📂 주요 판관비 내역
${sgaBreakdown || '- 기록된 지출 내역 없음'}
- 판관비 총액: ${totalSga.toLocaleString()}원

📦 보조 지표
- 별도 포장매출: ${pnlData.standalonePackaging.toLocaleString()}원
━━━━━━━━━━━━━━━━━━━━
    `.trim();

    if (navigator.share) {
      await navigator.share({ title: `${selectedStore} 손익 정밀 리포트`, text: shareMessage });
    } else {
      await navigator.clipboard.writeText(shareMessage);
      alert('상세 손익 리포트 전문이 클립보드에 복사되었습니다.');
    }
  };

  const sgaFields = [
    { label: '소모품', key: 'supplies', icon: <Package size={12}/> },
    { label: '임대료', key: 'rent', icon: <Store size={12}/> },
    { label: '관리비', key: 'mngFee', icon: <PlusCircle size={12}/> },
    { label: '전기', key: 'electricity', icon: <Lightbulb size={12}/> },
    { label: '가스', key: 'gas', icon: <Flame size={12}/> },
    { label: '수도', key: 'water', icon: <Waves size={12}/> },
    { label: '전화,인터넷,TV', key: 'comm', icon: <Globe size={12}/> },
    { label: '배달대행비용', key: 'delivery', icon: <Truck size={12}/> },
    { label: 'POS', key: 'pos', icon: <Smartphone size={12}/> },
    { label: '보안업체', key: 'security', icon: <ShieldCheck size={12}/> },
    { label: '세스코', key: 'cesco', icon: <UserCheck size={12}/> },
    { label: '세무기장료', key: 'tax', icon: <FileText size={12}/> },
    { label: '홍보(마케팅)', key: 'marketing', icon: <Megaphone size={12}/> },
    { label: '직원복지(식대)', key: 'welfare', icon: <Heart size={12}/> },
    { label: '음료 매입', key: 'beverage', icon: <Coffee size={12}/> },
    { label: '주류 매입', key: 'alcohol', icon: <Beer size={12}/> },
    { label: '기타지출', key: 'etc', icon: <Calculator size={12}/> }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-2xl flex flex-col xl:flex-row items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 bg-slate-800 px-6 py-3.5 rounded-2xl border border-slate-700">
            <Store size={18} className="text-blue-500" />
            <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} className="bg-transparent border-none text-sm font-black text-white outline-none cursor-pointer">
              {stores.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 bg-slate-800 px-6 py-3.5 rounded-2xl border border-slate-700">
            <Calendar size={18} className="text-emerald-500" />
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent border-none text-sm font-black text-white outline-none cursor-pointer">
              {months.map(m => <option key={m} value={m} className="bg-slate-900">{m}</option>)}
            </select>
          </div>
          <button onClick={handleShare} className="bg-slate-800 text-slate-300 px-5 py-3.5 rounded-2xl text-xs font-black flex items-center gap-2 hover:bg-slate-700 transition-all cursor-pointer shadow-lg">
            <Share2 size={16} /> 리포트 공유
          </button>
          
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black transition-all ${
            syncStatus === 'syncing' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
            syncStatus === 'saved' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
            syncStatus === 'error' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-slate-500 bg-slate-800 border-slate-700'
          }`}>
            {syncStatus === 'syncing' ? <Loader2 size={10} className="animate-spin" /> : 
             syncStatus === 'saved' ? <ShieldCheck size={10} /> : <CloudOff size={10} />}
            {syncStatus === 'syncing' ? '저장 중...' : 
             syncStatus === 'saved' ? '클라우드 저장됨' : 
             syncStatus === 'error' ? '저장 실패' : '동기화 대기'}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">최종 영업 이익 (포장 제외)</p>
          <p className={`text-4xl font-black ${operatingProfit >= 0 ? 'text-blue-400' : 'text-rose-500'}`}>{operatingProfit.toLocaleString()}원</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-slate-900 rounded-[40px] border border-slate-800 p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2"><TrendingUp size={20} className="text-blue-500"/><h4 className="text-base font-black text-white">매출 및 원가 상세</h4></div>
          <div className="space-y-4">
            <div className="p-5 bg-blue-600/5 border border-blue-500/20 rounded-3xl mb-4">
              <p className="text-[10px] font-black text-blue-400 uppercase mb-1">총 매출액 (11개 채널 합계)</p>
              <p className="text-xl font-black text-white">{pnlData.totalRevenueSum.toLocaleString()}원</p>
            </div>
            <div className="p-5 bg-amber-600/5 border border-amber-500/20 rounded-3xl mb-4">
              <p className="text-[10px] font-black text-amber-500 uppercase mb-1">단독 포장 매출 (합계 미포함)</p>
              <p className="text-xl font-black text-white">{pnlData.standalonePackaging.toLocaleString()}원</p>
            </div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
              {Object.entries(pnlData.revItems).map(([name, val]) => (
                <div key={name} className="flex justify-between items-center py-1.5 border-b border-slate-800/40">
                  <span className="text-[11px] font-bold text-slate-500">{name}</span>
                  <span className="text-xs font-black text-slate-200">{val.toLocaleString()}원</span>
                </div>
              ))}
            </div>
            <div className="h-px bg-slate-800 my-6"></div>
            <div className="p-5 bg-rose-600/5 border border-rose-500/20 rounded-3xl mb-4">
              <p className="text-[10px] font-black text-rose-400 uppercase mb-1">총 매입 원가 (7종 합계)</p>
              <p className="text-xl font-black text-white">{pnlData.totalMaterialSum.toLocaleString()}원</p>
            </div>
            <div className="space-y-2">
              {Object.entries(pnlData.matItems).map(([name, val]) => (
                <div key={name} className="flex justify-between items-center py-1.5 border-b border-slate-800/40">
                  <span className="text-[11px] font-bold text-slate-500">{name}</span>
                  <span className="text-xs font-black text-slate-200">{val.toLocaleString()}원</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[40px] border border-slate-800 p-8 space-y-6 flex flex-col">
          <div className="flex items-center gap-3 mb-2"><Users size={20} className="text-emerald-500"/><h4 className="text-base font-black text-white">고정비 (인건비)</h4></div>
          <div className="space-y-6 flex-1">
            <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl"><span className="text-xs font-bold text-slate-400">정직원 급여</span><input type="number" value={personnelCost.staff || ""} onChange={(e) => handlePersonnelChange('staff', parseInt(e.target.value) || 0)} className="w-32 bg-slate-900 border-none rounded-xl px-4 py-2 text-right text-sm font-black text-white outline-none focus:ring-1 focus:ring-emerald-500" /></div>
            <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl"><span className="text-xs font-bold text-slate-400">알바/일용직</span><input type="number" value={personnelCost.partTimer || ""} onChange={(e) => handlePersonnelChange('partTimer', parseInt(e.target.value) || 0)} className="w-32 bg-slate-900 border-none rounded-xl px-4 py-2 text-right text-sm font-black text-white outline-none focus:ring-1 focus:ring-emerald-500" /></div>
            <div className="mt-auto pt-10">
              <div className="p-8 bg-emerald-500/10 rounded-[32px] text-right border border-emerald-500/20 shadow-xl">
                <p className="text-[10px] font-black text-emerald-500 uppercase mb-1">인건비 합계</p>
                <p className="text-3xl font-black text-emerald-400">{totalPersonnel.toLocaleString()}원</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[40px] border border-slate-800 p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2"><Calculator size={20} className="text-amber-500"/><h4 className="text-base font-black text-white">판관비 상세 (수동)</h4></div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {sgaFields.map(item => (
              <div key={item.key} className="flex justify-between items-center py-2 border-b border-slate-800/50 pb-2">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-2">{item.icon} {item.label}</span>
                <input type="number" value={sgaExpenses[item.key] || ""} onChange={(e) => handleSgaChange(item.key, parseInt(e.target.value) || 0)} className="w-24 bg-slate-800 border-none rounded-lg px-2 py-1 text-right text-xs font-bold text-white outline-none focus:ring-1 focus:ring-amber-500" />
              </div>
            ))}
          </div>
          <div className="p-8 bg-amber-500/10 rounded-[32px] text-right border border-amber-500/20 shadow-xl mt-6">
            <p className="text-[10px] font-black text-amber-500 uppercase mb-1">판관비 총계</p>
            <p className="text-3xl font-black text-amber-400">{totalSga.toLocaleString()}원</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PnLAnalysis;
