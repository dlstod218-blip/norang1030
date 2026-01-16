
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { TrendingUp, Settings, Lock, AlertCircle, Loader2, Cloud, CloudOff, CloudSync, Share2, User, Store, Filter, X, ChevronDown, LayoutDashboard, Printer, CheckCircle, FileText } from 'lucide-react';
import { RawSalesData, normalizeChannel, getChannelType } from './types';
import { parseISO, isValid, isWithinInterval, startOfDay, endOfDay, format, subDays, getYear } from 'date-fns';
import DataUploader from './components/DataUploader';
import DashboardOverview from './components/DashboardOverview';
import SalesCharts from './components/SalesCharts';
import DetailedAnalysis from './components/DetailedAnalysis';
import AIInsights from './components/AIInsights';
import PnLAnalysis from './components/PnLAnalysis';
import CommercialAnalysis from './components/CommercialAnalysis';
import StoreDetailAnalysis from './components/StoreDetailAnalysis';

const ADMIN_PASSWORD = "0000";

const App: React.FC = () => {
  const [data, setData] = useState<RawSalesData[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'syncing' | 'error'>('connected');
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'pnl' | 'store_detail' | 'commercial'>('overview');
  
  const [showSettings, setShowSettings] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState(false);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  
  const yesterdayStr = useMemo(() => format(subDays(new Date(), 1), 'yyyy-MM-dd'), []);
  const [startDate, setStartDate] = useState<string>(yesterdayStr);
  const [endDate, setEndDate] = useState<string>(yesterdayStr);

  // Global Filters
  const [selectedManager, setSelectedManager] = useState<string>('all');
  const [selectedStore, setSelectedStore] = useState<string>('all');

  const handleDataLoaded = (loadedData: RawSalesData[]) => {
    setData(loadedData);
  };

  const handleAuthorize = () => {
    if (passwordInput.trim().toLowerCase() === ADMIN_PASSWORD) {
      setIsAuthorized(true);
      setAuthError(false);
      setPasswordInput("");
    } else {
      setAuthError(true);
      setTimeout(() => setAuthError(false), 2000);
    }
  };

  const handlePrint = () => {
    // 1. Enter Print Prep State (Visual Feedback)
    setIsPreparingPrint(true);
    
    // 2. Immediate synchronous call - this is the most reliable way to trigger browser print
    try {
      window.print();
    } catch (e) {
      console.error("Print failed:", e);
      alert("브라우저 인쇄 기능을 실행할 수 없습니다. 수동으로 Ctrl+P를 눌러주세요.");
    } finally {
      // 3. Exit Prep State
      setTimeout(() => setIsPreparingPrint(false), 1000);
    }
  };

  useEffect(() => {
    const handleSyncStart = () => setCloudStatus('syncing');
    const handleSyncEnd = () => setCloudStatus('connected');
    window.addEventListener('cloud-sync-start', handleSyncStart);
    window.addEventListener('cloud-sync-end', handleSyncEnd);
    return () => {
      window.removeEventListener('cloud-sync-start', handleSyncStart);
      window.removeEventListener('cloud-sync-end', handleSyncEnd);
    };
  }, []);

  // Filter for active stores only
  const activeStores = useMemo(() => {
    const stores2026 = new Set<string>();
    data.forEach(d => {
      if (getYear(parseISO(d.date)) === 2026) stores2026.add(d.storeName);
    });
    return stores2026.size === 0 ? new Set(data.map(d => d.storeName)) : stores2026;
  }, [data]);

  const managers = useMemo(() => {
    const set = new Set(data.filter(d => activeStores.has(d.storeName)).map(d => d.managerName));
    return Array.from(set).sort();
  }, [data, activeStores]);

  const stores = useMemo(() => {
    let base = data.filter(d => activeStores.has(d.storeName));
    if (selectedManager !== 'all') {
      base = base.filter(d => d.managerName === selectedManager);
    }
    const set = new Set(base.map(d => d.storeName));
    return Array.from(set).sort();
  }, [data, selectedManager, activeStores]);

  const synthesizedData = useMemo(() => {
    if (data.length === 0) return [];
    
    const baseData = data.filter(d => activeStores.has(d.storeName));
    const latestManagerMap: Record<string, { manager: string, date: string }> = {};
    baseData.forEach(item => {
      const currentLatest = latestManagerMap[item.storeName];
      if (!currentLatest || item.date > currentLatest.date) {
        latestManagerMap[item.storeName] = { manager: item.managerName, date: item.date };
      }
    });

    const storeDateMap: Record<string, any> = {};
    baseData.forEach(item => {
      const key = `${item.storeName}_${item.date}`;
      const effectiveManager = latestManagerMap[item.storeName]?.manager || item.managerName;
      
      if (selectedManager !== 'all' && effectiveManager !== selectedManager) return;
      if (selectedStore !== 'all' && item.storeName !== selectedStore) return;

      if (!storeDateMap[key]) {
        storeDateMap[key] = { 
          totalSheetAmount: 0, totalSheetCount: 0, platformSum: 0, platformCountSum: 0,
          packagingSum: 0, packagingCountSum: 0, platformRows: [], packagingRows: [], materialRows: [],
          procurementAmount: 0, procurementCount: 0, rawMaterialAmount: 0, rawMaterialCount: 0, oilAmount: 0, oilCount: 0,
          meta: { managerName: effectiveManager, region: item.region, date: item.date, storeName: item.storeName }
        };
      }
      const normChan = normalizeChannel(item.channel);
      const cType = getChannelType(normChan);
      const target = storeDateMap[key];
      const normalizedItem = { ...item, managerName: effectiveManager };

      if (cType === 'total') { target.totalSheetAmount += item.amount; target.totalSheetCount += item.orderCount; }
      else if (cType === 'platform') { target.platformSum += item.amount; target.platformCountSum += item.orderCount; target.platformRows.push(normalizedItem); }
      else if (cType === 'takeout') { target.packagingSum += item.amount; target.packagingCountSum += item.orderCount; target.packagingRows.push(normalizedItem); }
      else if (cType === 'material') { 
        target.materialRows.push(normalizedItem);
        if (normChan !== '전용유' && normChan !== '부자재' && normChan !== '발주') { target.rawMaterialAmount += item.amount; target.rawMaterialCount += item.orderCount; }
        else if (normChan === '전용유') { target.oilAmount += item.amount; target.oilCount += item.orderCount; }
      }
      else if (cType === 'procurement') { target.procurementAmount += item.amount; target.procurementCount += item.orderCount; }
    });

    const result: RawSalesData[] = [];
    Object.values(storeDateMap).forEach(val => {
      val.platformRows.forEach((row: any) => result.push(row));
      result.push({ ...val.meta, amount: Math.max(0, val.totalSheetAmount - val.platformSum), channel: '내점', orderCount: Math.max(0, val.totalSheetCount - val.platformCountSum) });
      val.packagingRows.forEach((row: any) => result.push(row));
      val.materialRows.forEach((row: any) => result.push(row));
      if (val.procurementAmount > 0) {
        const subAmt = Math.max(0, val.procurementAmount - val.rawMaterialAmount - val.oilAmount);
        if (subAmt > 0) result.push({ ...val.meta, amount: subAmt, channel: '부자재', orderCount: 0 });
      }
    });
    return result;
  }, [data, selectedManager, selectedStore, activeStores]);

  const finalFilteredData = useMemo(() => {
    let base = synthesizedData;
    if (startDate && endDate) {
      const s = startOfDay(parseISO(startDate));
      const e = endOfDay(parseISO(endDate));
      base = base.filter(d => {
        const dt = parseISO(d.date);
        return isValid(dt) && isWithinInterval(dt, { start: s, end: e });
      });
    }
    return base;
  }, [synthesizedData, startDate, endDate]);

  const currentTabName = useMemo(() => {
    switch(activeTab) {
      case 'overview': return '종합 경영 대시보드';
      case 'detailed': return '성과 정밀 상세 분석';
      case 'pnl': return '월간 손익 관리 리포트';
      case 'store_detail': return '가맹점 통합 진단';
      case 'commercial': return 'AI 상권 입점 분석';
      default: return '매출 분석 리포트';
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-50">
      <div id="data-uploader-root">
        <DataUploader onDataLoaded={handleDataLoaded} autoStart={true} onSyncStatusChange={setIsSyncing} showUI={showSettings && isAuthorized} />
      </div>

      <header className="bg-slate-900/90 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-600/20">
              <TrendingUp className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight leading-none">매출분석 <span className="text-blue-500">마스터</span></h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Enterprise Analytics</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black transition-all ${
              cloudStatus === 'syncing' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            }`}>
              {cloudStatus === 'syncing' ? <CloudSync size={12} className="animate-spin" /> : <Cloud size={12} />}
              {cloudStatus === 'syncing' ? 'SYNCING DATA' : 'CLOUD CONNECTED'}
            </div>
            
            <button 
              onClick={handlePrint} 
              className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 border shadow-lg ${isPreparingPrint ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`} 
            >
              {isPreparingPrint ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
              <span className="text-[11px] font-black hidden sm:inline">{isPreparingPrint ? '인쇄 전송중...' : '리포트 인쇄'}</span>
            </button>

            <button onClick={() => setShowSettings(!showSettings)} className={`p-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${showSettings ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 pb-32"> 
        {/* PRINT ONLY SECTION - FORCE VISIBLE ONLY IN PRINT */}
        <div className="print-only-report-header">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-blue-600 p-3 rounded-xl text-white"><FileText size={32} /></div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">{currentTabName}</h1>
              <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Master Analytics Business Report</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 p-6 bg-slate-50 rounded-2xl border-2 border-slate-200">
            <div className="flex justify-between border-b border-slate-200 pb-2"><span className="font-black text-slate-400">분석 기간</span> <span className="font-bold">{startDate} ~ {endDate}</span></div>
            <div className="flex justify-between border-b border-slate-200 pb-2"><span className="font-black text-slate-400">담당 매니저</span> <span className="font-bold">{selectedManager === 'all' ? '전사 데이터' : selectedManager}</span></div>
            <div className="flex justify-between border-b border-slate-200 pb-2"><span className="font-black text-slate-400">분석 대상 가맹점</span> <span className="font-bold">{selectedStore === 'all' ? '전체 가맹점' : selectedStore}</span></div>
            <div className="flex justify-between border-b border-slate-200 pb-2"><span className="font-black text-slate-400">출력 일시</span> <span className="font-bold">{new Date().toLocaleString()}</span></div>
          </div>
        </div>

        {showSettings && !isAuthorized && (
          <div className="mb-10 animate-in slide-in-from-top-6 duration-500 no-print">
            <div className="max-w-md mx-auto bg-slate-900 p-10 rounded-[40px] shadow-2xl border border-slate-800 text-center">
              <div className="bg-slate-800 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-500">
                <Lock size={32} />
              </div>
              <h2 className="text-xl font-black text-white mb-2">관리자 인증</h2>
              <p className="text-slate-500 text-xs font-bold mb-6">시스템 설정을 변경하려면 비밀번호가 필요합니다.</p>
              <div className="space-y-4">
                <input type="password" placeholder="PASSWORD" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAuthorize()} className="w-full border-2 border-transparent bg-slate-800 rounded-2xl px-5 py-4 text-center font-bold text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-600" />
                <button onClick={handleAuthorize} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all cursor-pointer">인증 및 접속</button>
              </div>
            </div>
          </div>
        )}

        {(data.length > 0 || isSyncing) ? (
          <div className={`space-y-6 transition-all duration-500 ${showSettings && !isAuthorized ? 'opacity-20 blur-sm pointer-events-none' : 'opacity-100'}`}>
            
            <div className="bg-slate-900 p-6 rounded-[32px] shadow-xl border border-slate-800 flex flex-col gap-6 no-print">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="flex bg-slate-800 p-1.5 rounded-2xl overflow-x-auto custom-scrollbar w-full lg:w-auto">
                  {[
                    { id: 'overview', label: '종합 대시보드' },
                    { id: 'detailed', label: '성과 상세 분석' },
                    { id: 'pnl', label: '월간 손익 리포트' },
                    { id: 'store_detail', label: '가맹점 정밀 진단' },
                    { id: 'commercial', label: 'AI 상권 분석' }
                  ].map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4 bg-slate-800 px-5 py-2.5 rounded-2xl border border-slate-700 w-full lg:w-auto justify-center">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-xs font-black text-slate-200 outline-none cursor-pointer" />
                  <span className="text-slate-600 font-black text-[10px]">TO</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-xs font-black text-slate-200 outline-none cursor-pointer" />
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center gap-3 bg-slate-950/50 px-4 py-3 rounded-2xl border border-slate-800 flex-1 w-full">
                  <User size={16} className="text-blue-500" />
                  <div className="flex-1">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Manager Filter</p>
                    <select value={selectedManager} onChange={(e) => { setSelectedManager(e.target.value); setSelectedStore('all'); }} className="w-full bg-transparent border-none text-xs font-bold text-white outline-none cursor-pointer appearance-none">
                      <option value="all" className="bg-slate-900">전체 담당자 보기</option>
                      {managers.map(m => <option key={m} value={m} className="bg-slate-900">{m}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-950/50 px-4 py-3 rounded-2xl border border-slate-800 flex-1 w-full">
                  <Store size={16} className="text-emerald-500" />
                  <div className="flex-1">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Store Filter</p>
                    <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} className="w-full bg-transparent border-none text-xs font-bold text-white outline-none cursor-pointer appearance-none">
                      <option value="all" className="bg-slate-900">전체 가맹점 보기</option>
                      {stores.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                    </select>
                  </div>
                </div>

                {(selectedManager !== 'all' || selectedStore !== 'all') && (
                  <button onClick={() => { setSelectedManager('all'); setSelectedStore('all'); }} className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 hover:bg-rose-500/20 transition-all"><X size={18} /></button>
                )}
              </div>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              {activeTab === 'overview' ? (
                <div className="space-y-6">
                  <div className="no-print"><AIInsights data={finalFilteredData} dateRange={{start: startDate, end: endDate}} /></div>
                  <DashboardOverview data={synthesizedData} startDate={startDate} endDate={endDate} />
                  <SalesCharts data={finalFilteredData} startDate={startDate} endDate={endDate} />
                </div>
              ) : activeTab === 'detailed' ? (
                <DetailedAnalysis data={synthesizedData} startDate={startDate} endDate={endDate} />
              ) : activeTab === 'pnl' ? (
                <PnLAnalysis data={synthesizedData} />
              ) : activeTab === 'store_detail' ? (
                <StoreDetailAnalysis data={synthesizedData} globalSelectedStore={selectedStore} />
              ) : (
                <CommercialAnalysis data={synthesizedData} />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center no-print">
            <Loader2 size={64} className="text-blue-500 animate-spin mb-6" />
            <h2 className="text-xl font-black text-white">데이터 동기화 중...</h2>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
