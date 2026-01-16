
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { TrendingUp, Settings, Lock, AlertCircle, Loader2, Cloud, CloudOff, CloudSync, Share2, User, Store, Filter, X, ChevronDown, LayoutDashboard, Printer, CheckCircle, FileText, LogOut, KeyRound, UserPlus, Users, Trash2, ShieldCheck, Sparkles } from 'lucide-react';
import { RawSalesData, normalizeChannel, getChannelType, UserAccount } from './types';
import { parseISO, isValid, isWithinInterval, startOfDay, endOfDay, format, subDays, getYear } from 'date-fns';
import DataUploader from './components/DataUploader';
import DashboardOverview from './components/DashboardOverview';
import SalesCharts from './components/SalesCharts';
import DetailedAnalysis from './components/DetailedAnalysis';
import AIInsights from './components/AIInsights';
import PnLAnalysis from './components/PnLAnalysis';
import CommercialAnalysis from './components/CommercialAnalysis';
import StoreDetailAnalysis from './components/StoreDetailAnalysis';

const STORAGE_ACCOUNTS_KEY = 'sales_insight_master_accounts';

const INITIAL_ACCOUNTS: UserAccount[] = [
  { id: 'admin', name: '마스터 관리자', password: '0000', role: 'ADMIN' },
  { id: 'staff1', name: '지원팀1', password: '1111', role: 'USER' },
];

const App: React.FC = () => {
  const [data, setData] = useState<RawSalesData[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'syncing' | 'error'>('connected');
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'pnl' | 'store_detail' | 'commercial'>('overview');
  
  // Auth & Accounts State
  const [accounts, setAccounts] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
    return saved ? JSON.parse(saved) : INITIAL_ACCOUNTS;
  });
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [idInput, setIdInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState(false);
  
  // User Management State
  const [newUserId, setNewUserId] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPw, setNewUserPw] = useState("");
  const [settingsTab, setSettingsTab] = useState<'data' | 'users'>('data');

  const [showSettings, setShowSettings] = useState(false);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  
  const yesterdayStr = useMemo(() => format(subDays(new Date(), 1), 'yyyy-MM-dd'), []);
  const [startDate, setStartDate] = useState<string>(yesterdayStr);
  const [endDate, setEndDate] = useState<string>(yesterdayStr);

  const [selectedManager, setSelectedManager] = useState<string>('all');
  const [selectedStore, setSelectedStore] = useState<string>('all');

  // Persist accounts
  useEffect(() => {
    localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
  }, [accounts]);

  const handleDataLoaded = (loadedData: RawSalesData[]) => {
    setData(loadedData);
  };

  const handleLogin = () => {
    const user = accounts.find(acc => acc.id === idInput && acc.password === passwordInput);
    if (user) {
      setCurrentUser(user);
      setAuthError(false);
      setIdInput("");
      setPasswordInput("");
    } else {
      setAuthError(true);
      setTimeout(() => setAuthError(false), 2000);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setShowSettings(false);
    setData([]);
  };

  const handleAddUser = () => {
    if (!newUserId || !newUserName || !newUserPw) {
      alert("모든 정보를 입력하세요.");
      return;
    }
    if (accounts.some(acc => acc.id === newUserId)) {
      alert("이미 존재하는 아이디입니다.");
      return;
    }
    const newUser: UserAccount = {
      id: newUserId,
      name: newUserName,
      password: newUserPw,
      role: 'USER'
    };
    setAccounts(prev => [...prev, newUser]);
    setNewUserId("");
    setNewUserName("");
    setNewUserPw("");
  };

  const handleDeleteUser = (id: string) => {
    if (id === 'admin') {
      alert("마스터 관리자 계정은 삭제할 수 없습니다.");
      return;
    }
    if (currentUser?.id === id) {
      alert("현재 접속 중인 계정은 삭제할 수 없습니다.");
      return;
    }
    if (window.confirm(`계정 ID [${id}]를 시스템에서 완전히 삭제하시겠습니까?`)) {
      setAccounts(prev => prev.filter(acc => acc.id !== id));
    }
  };

  const handlePrint = () => {
    setIsPreparingPrint(true);
    try {
      window.print();
    } catch (e) {
      alert("브라우저 인쇄 기능을 실행할 수 없습니다.");
    } finally {
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

  // Compute stores present in each year to handle "closed" stores (폐점)
  const storesByYear = useMemo(() => {
    const map: Record<number, Set<string>> = {};
    data.forEach(d => {
      const dt = parseISO(d.date);
      if (!isValid(dt)) return;
      const year = getYear(dt);
      if (!map[year]) map[year] = new Set();
      map[year].add(d.storeName);
    });
    return map;
  }, [data]);

  // Determine active stores based on the year of the selected endDate.
  const activeStores = useMemo(() => {
    const targetDate = parseISO(endDate);
    if (!isValid(targetDate)) return new Set<string>();
    const year = getYear(targetDate);
    return storesByYear[year] || new Set<string>();
  }, [storesByYear, endDate]);

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
    
    // Use data filtered by activeStores (year-sensitive)
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

  // LOGIN SCREEN
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Dynamic Collage of Brand Images */}
        <div className="absolute top-[5%] left-[5%] w-[30vw] h-[30vw] opacity-20 pointer-events-none animate-pulse duration-[10000ms]">
          <img src="https://www.norangtongdak.co.kr/pds/gallerys/6_1?1766019277" alt="brand collage 1" className="w-full h-full object-cover rounded-[100px] blur-[1px]" />
        </div>
        <div className="absolute top-[60%] left-[-5%] w-[25vw] h-[25vw] opacity-15 pointer-events-none animate-bounce duration-[15000ms]">
          <img src="https://www.norangtongdak.co.kr/pds/product/61_1?1753319201" alt="product 1" className="w-full h-full object-contain rotate-12" />
        </div>
        <div className="absolute top-[-10%] right-[10%] w-[35vw] h-[35vw] opacity-20 pointer-events-none animate-pulse duration-[12000ms]">
          <img src="https://www.norangtongdak.co.kr/pds/gallerys/5_3?1766019474" alt="brand collage 2" className="w-full h-full object-cover rounded-full blur-[2px]" />
        </div>
        <div className="absolute bottom-[5%] right-[5%] w-[20vw] h-[20vw] opacity-25 pointer-events-none animate-bounce duration-[11000ms]">
          <img src="https://www.norangtongdak.co.kr/pds/product/61_1?1753319201" alt="product 2" className="w-full h-full object-contain -rotate-12" />
        </div>

        {/* Cinematic Blobs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-yellow-400/5 rounded-full blur-[200px] pointer-events-none"></div>
        <div className="absolute top-1/4 left-1/3 w-[40vw] h-[40vw] bg-blue-600/5 rounded-full blur-[150px] pointer-events-none"></div>

        <div className="max-w-md w-full bg-slate-900/30 backdrop-blur-[60px] p-12 rounded-[72px] shadow-[0_64px_160px_rgba(0,0,0,0.7)] border border-slate-800/40 text-center relative z-10 overflow-hidden group">
          {/* Top Shimmer Line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-60"></div>
          
          <div className="mb-12">
            <div className="w-40 h-40 bg-white rounded-full mx-auto mb-10 p-4 shadow-[0_24px_48px_rgba(251,191,36,0.3)] flex items-center justify-center overflow-hidden border-4 border-yellow-400 relative group-hover:scale-105 transition-transform duration-700">
               <div className="absolute inset-0 bg-yellow-400/10 animate-pulse"></div>
               <img 
                 src="https://www.norangtongdak.co.kr/image/intro_img.png" 
                 alt="Brand Logo" 
                 className="w-full h-auto scale-125 relative z-10"
               />
            </div>
            <h2 className="text-3xl font-black text-white mb-2 tracking-tighter flex items-center justify-center gap-2">
               jc_매출분석 <span className="text-yellow-400">마스터</span>
            </h2>
            <div className="flex items-center justify-center gap-3">
              <div className="h-[2px] w-10 bg-gradient-to-r from-transparent to-slate-800"></div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.45em]">Master Analytics Suite</p>
              <div className="h-[2px] w-10 bg-gradient-to-l from-transparent to-slate-800"></div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="relative group/field">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <User className="text-slate-500 group-focus-within/field:text-yellow-400 transition-colors" size={20} />
                <div className="w-px h-5 bg-slate-800"></div>
              </div>
              <input 
                type="text" 
                placeholder="USER ID" 
                value={idInput} 
                onChange={(e) => setIdInput(e.target.value)} 
                className="w-full bg-slate-900/50 border border-slate-800/60 rounded-[28px] pl-16 pr-8 py-4.5 text-sm font-bold text-white focus:border-yellow-400/50 focus:bg-slate-900/80 outline-none transition-all placeholder:text-slate-600 shadow-inner" 
              />
            </div>
            
            <div className="relative group/field">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <KeyRound className="text-slate-500 group-focus-within/field:text-yellow-400 transition-colors" size={20} />
                <div className="w-px h-5 bg-slate-800"></div>
              </div>
              <input 
                type="password" 
                placeholder="PASSWORD" 
                value={passwordInput} 
                onChange={(e) => setPasswordInput(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full bg-slate-900/50 border border-slate-800/60 rounded-[28px] pl-16 pr-8 py-4.5 text-sm font-bold text-white focus:border-yellow-400/50 focus:bg-slate-900/80 outline-none transition-all placeholder:text-slate-600 shadow-inner" 
              />
            </div>
            
            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/20 py-4 rounded-2xl text-rose-500 text-[11px] font-black animate-in shake duration-300 flex items-center justify-center gap-2">
                <AlertCircle size={16} />
                데이터베이스에 등록된 계정 정보가 일치하지 않습니다.
              </div>
            )}
            
            <button 
              onClick={handleLogin} 
              className="w-full bg-yellow-400 text-slate-950 py-5 rounded-[28px] font-black shadow-[0_24px_48px_rgba(251,191,36,0.3)] hover:bg-yellow-300 hover:-translate-y-1.5 hover:shadow-yellow-400/50 active:translate-y-0 transition-all cursor-pointer mt-8 group/btn overflow-hidden relative"
            >
              <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]"></div>
              SYSTEM LOGIN
            </button>
          </div>
          
          <div className="mt-14 pt-8 border-t border-slate-800/50 flex flex-col items-center gap-4">
             <div className="flex items-center gap-3 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                <ShieldCheck size={14} className="text-yellow-400/70" />
                <span>Enterprise Protocol v4.2.1</span>
             </div>
             <div className="flex items-center gap-3 opacity-40 group-hover:opacity-100 transition-opacity duration-500">
               <Sparkles size={12} className="text-yellow-400" />
               <p className="text-[9px] font-bold text-slate-400 tracking-tighter">INTELLIGENT DECISION SUPPORT SYSTEM</p>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-50">
      <div id="data-uploader-root">
        <DataUploader 
          onDataLoaded={handleDataLoaded} 
          autoStart={true} 
          onSyncStatusChange={setIsSyncing} 
          showUI={showSettings && currentUser.role === 'ADMIN' && settingsTab === 'data'} 
        />
      </div>

      {/* ADMIN USER MANAGEMENT UI */}
      {showSettings && currentUser.role === 'ADMIN' && settingsTab === 'users' && (
        <div className="max-w-7xl mx-auto w-full px-4 mb-10 animate-in slide-in-from-top-6 duration-500">
          <div className="bg-slate-900 rounded-[40px] shadow-2xl border border-slate-800 p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-blue-600 p-4 rounded-2xl">
                <Users className="text-white w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">직원 계정 관리</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">시스템 접속 권한을 제어하세요.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 p-6 bg-slate-800/30 rounded-3xl border border-slate-800">
              <input type="text" placeholder="접속 ID" value={newUserId} onChange={(e) => setNewUserId(e.target.value)} className="bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" placeholder="성함" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="password" placeholder="비밀번호" value={newUserPw} onChange={(e) => setNewUserPw(e.target.value)} className="bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleAddUser} className="bg-blue-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"><UserPlus size={18} /> 계정 생성</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map(acc => (
                <div key={acc.id} className="p-5 bg-slate-800/40 border border-slate-800 rounded-3xl flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${acc.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {acc.role === 'ADMIN' ? <ShieldCheck size={20} /> : <User size={20} />}
                    </div>
                    <div>
                      <div className="font-black text-white text-sm flex items-center gap-2">
                        {acc.name}
                        {acc.role === 'ADMIN' && <span className="bg-amber-500/10 text-amber-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-amber-500/20">MASTER</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">ID: {acc.id} / PW: {acc.password}</div>
                    </div>
                  </div>
                  {acc.id !== 'admin' && (
                    <button onClick={() => handleDeleteUser(acc.id)} className="p-2 text-slate-600 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <header className="bg-slate-900/90 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 p-1.5 rounded-xl shadow-lg shadow-yellow-400/20">
              <TrendingUp className="text-slate-950 w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight leading-none">jc_매출분석 <span className="text-yellow-400">마스터</span></h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{currentUser.name} 접속 중</p>
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

            {currentUser.role === 'ADMIN' && (
              <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button 
                  onClick={() => { setShowSettings(true); setSettingsTab('data'); }} 
                  className={`p-1.5 rounded-lg transition-all ${showSettings && settingsTab === 'data' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}
                  title="데이터 소스 설정"
                >
                  <Settings size={18} />
                </button>
                <button 
                  onClick={() => { setShowSettings(true); setSettingsTab('users'); }} 
                  className={`p-1.5 rounded-lg transition-all ${showSettings && settingsTab === 'users' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}
                  title="계정 관리"
                >
                  <Users size={18} />
                </button>
                {showSettings && (
                  <button onClick={() => setShowSettings(false)} className="p-1.5 text-slate-500 hover:text-white"><X size={18} /></button>
                )}
              </div>
            )}

            <button 
              onClick={handleLogout} 
              className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
              title="로그아웃"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 pb-32"> 
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

        {(data.length > 0 || isSyncing) ? (
          <div className="space-y-6 animate-in fade-in duration-700">
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
            <h2 className="text-xl font-black text-white">데이터 동기화 및 초기 분석 중...</h2>
            <p className="text-slate-500 text-sm mt-2">안전한 데이터 소스에서 경영 정보를 가져오고 있습니다.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
