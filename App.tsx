
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { TrendingUp, Settings, Lock, AlertCircle, Loader2, Cloud, CloudOff, CloudSync, Share2, User, Store, Filter, X, ChevronDown, LayoutDashboard, Printer, CheckCircle, FileText, LogOut, KeyRound, UserPlus, Users, Trash2, ShieldCheck, Sparkles } from 'lucide-react';
import { RawSalesData, normalizeChannel, getChannelType } from './types';
import { supabase, type AppProfile } from './supabaseClient';
import { parseISO, isValid, isWithinInterval, startOfDay, endOfDay, format, subDays, getYear } from 'date-fns';
import DataUploader from './components/DataUploader';
import DashboardOverview from './components/DashboardOverview';
import SalesCharts from './components/SalesCharts';
import DetailedAnalysis from './components/DetailedAnalysis';
import AIInsights from './components/AIInsights';
import PnLAnalysis from './components/PnLAnalysis';
import CommercialAnalysis from './components/CommercialAnalysis';
import StoreDetailAnalysis from './components/StoreDetailAnalysis';

type AuthState = {
  isLoading: boolean;
  accessToken: string | null;
  profile: AppProfile | null;
};

type AdminUserRow = {
  user_id: string;
  username: string;
  display_name: string;
  role: 'MASTER' | 'STAFF';
  active: boolean;
  created_at?: string;
};

const App: React.FC = () => {
  const [data, setData] = useState<RawSalesData[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'syncing' | 'error'>('connected');
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'pnl' | 'store_detail' | 'commercial'>('overview');
  
  // Supabase Auth State
  const [auth, setAuth] = useState<AuthState>({
    isLoading: true,
    accessToken: null,
    profile: null,
  });
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);

  // Admin: staff management (MASTER only)
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserDisplayName, setNewUserDisplayName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<'MASTER' | 'STAFF'>('STAFF');
  const [settingsTab, setSettingsTab] = useState<'data' | 'users'>('data');

  const [showSettings, setShowSettings] = useState(false);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  
  const yesterdayStr = useMemo(() => format(subDays(new Date(), 1), 'yyyy-MM-dd'), []);
  const [startDate, setStartDate] = useState<string>(yesterdayStr);
  const [endDate, setEndDate] = useState<string>(yesterdayStr);

  const [selectedManager, setSelectedManager] = useState<string>('all');
  const [selectedStore, setSelectedStore] = useState<string>('all');

  // Bootstrap auth session + profile
  useEffect(() => {
    let mounted = true;

    const loadProfile = async (accessToken: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) {
        if (mounted) setAuth({ isLoading: false, accessToken: null, profile: null });
        return;
      }
      const { data, error } = await supabase
        .from('app_profiles')
        .select('user_id, username, display_name, role, active')
        .eq('user_id', uid)
        .maybeSingle();

      if (error || !data) {
        // 계정은 있으나 권한 테이블에 미등록이면 로그아웃 처리
        await supabase.auth.signOut();
        if (mounted) {
          setAuth({ isLoading: false, accessToken: null, profile: null });
          setAuthErrorMsg('권한이 등록되지 않았습니다. 관리자에게 문의하세요.');
        }
        return;
      }

      if (!data.active) {
        await supabase.auth.signOut();
        if (mounted) {
          setAuth({ isLoading: false, accessToken: null, profile: null });
          setAuthErrorMsg('비활성화된 계정입니다. 관리자에게 문의하세요.');
        }
        return;
      }

      if (mounted) setAuth({ isLoading: false, accessToken, profile: data as AppProfile });
    };

    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || null;
      if (token) {
        await loadProfile(token);
      } else {
        if (mounted) setAuth({ isLoading: false, accessToken: null, profile: null });
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      const token = session?.access_token || null;
      if (!mounted) return;
      if (!token) {
        setAuth({ isLoading: false, accessToken: null, profile: null });
        return;
      }
      setAuth(prev => ({ ...prev, isLoading: true }));
      await loadProfile(token);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleDataLoaded = (loadedData: RawSalesData[]) => {
    setData(loadedData);
  };

  const handleLogin = async () => {
    setAuthErrorMsg(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim(),
        password: passwordInput,
      });
      if (error || !data.session) {
        setAuthErrorMsg('로그인 실패: 이메일/비밀번호를 확인하세요.');
        return;
      }
      // onAuthStateChange에서 profile 로드됨
      setEmailInput("");
      setPasswordInput("");
    } catch (e) {
      setAuthErrorMsg('로그인 실패: 잠시 후 다시 시도하세요.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowSettings(false);
    setData([]);
  };

  const fetchAdminUsers = useCallback(async () => {
    if (!auth.accessToken) return;
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Failed');
    setAdminUsers(json.users || []);
  }, [auth.accessToken]);

  const handleAddUser = useCallback(async () => {
    if (!newUserEmail || !newUserDisplayName || !newUserPassword) {
      alert('이메일/이름/비밀번호를 모두 입력하세요.');
      return;
    }
    if (!auth.accessToken) return;
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({
        email: newUserEmail.trim(),
        password: newUserPassword,
        display_name: newUserDisplayName,
        role: newUserRole,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || '직원 생성 실패');
      return;
    }
    setNewUserEmail('');
    setNewUserDisplayName('');
    setNewUserPassword('');
    setNewUserRole('STAFF');
    await fetchAdminUsers();
  }, [auth.accessToken, fetchAdminUsers, newUserEmail, newUserDisplayName, newUserPassword, newUserRole]);

  const handleDeleteUser = useCallback(async (user_id: string) => {
    if (!auth.accessToken) return;
    if (auth.profile?.user_id === user_id) {
      alert('현재 로그인한 계정은 삭제할 수 없습니다.');
      return;
    }
    if (!window.confirm('해당 계정을 완전히 삭제하시겠습니까?')) return;
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({ user_id }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || '삭제 실패');
      return;
    }
    await fetchAdminUsers();
  }, [auth.accessToken, auth.profile?.user_id, fetchAdminUsers]);

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
  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-300 font-black">
          <Loader2 className="animate-spin" size={20} />
          세션 확인 중...
        </div>
      </div>
    );
  }

  if (!auth.profile) {
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
                type="email"
                placeholder="EMAIL"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
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
            
            {authErrorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 py-4 rounded-2xl text-rose-500 text-[11px] font-black animate-in shake duration-300 flex items-center justify-center gap-2">
                <AlertCircle size={16} />
                {authErrorMsg}
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
          showUI={showSettings && auth.profile?.role === 'MASTER' && settingsTab === 'data'} 
        />
      </div>

      {/* ADMIN USER MANAGEMENT UI */}
      {showSettings && auth.profile?.role === 'MASTER' && settingsTab === 'users' && (
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

            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => fetchAdminUsers().catch(e => alert(e.message))}
                className="text-xs font-black px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700"
              >
                목록 새로고침
              </button>
              <p className="text-[11px] text-slate-500 font-bold">※ 계정 생성/삭제는 Supabase Auth + app_profiles에 자동 반영됩니다.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 p-6 bg-slate-800/30 rounded-3xl border border-slate-800">
              <input type="email" placeholder="직원 이메일" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" placeholder="표시 이름" value={newUserDisplayName} onChange={(e) => setNewUserDisplayName(e.target.value)} className="bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="password" placeholder="초기 비밀번호" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className="bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as any)} className="bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-black text-white outline-none focus:ring-2 focus:ring-blue-500">
                <option value="STAFF">STAFF</option>
                <option value="MASTER">MASTER</option>
              </select>
              <button onClick={() => handleAddUser().catch(e => alert(e.message))} className="bg-blue-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"><UserPlus size={18} /> 계정 생성</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminUsers.map(u => (
                <div key={u.user_id} className="p-5 bg-slate-800/40 border border-slate-800 rounded-3xl flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${u.role === 'MASTER' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {u.role === 'MASTER' ? <ShieldCheck size={20} /> : <User size={20} />}
                    </div>
                    <div>
                      <div className="font-black text-white text-sm flex items-center gap-2">
                        {u.display_name}
                        {u.role === 'MASTER' && <span className="bg-amber-500/10 text-amber-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-amber-500/20">MASTER</span>}
                        {!u.active && <span className="bg-rose-500/10 text-rose-400 text-[8px] font-black px-1.5 py-0.5 rounded border border-rose-500/20">DISABLED</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{u.username}</div>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteUser(u.user_id).catch(e => alert(e.message))} className="p-2 text-slate-600 hover:text-rose-500 transition-colors" title="삭제"><Trash2 size={18} /></button>
                </div>
              ))}
              {adminUsers.length === 0 && (
                <div className="col-span-full text-slate-500 text-sm font-bold">직원 목록이 비어있습니다. "목록 새로고침"을 눌러주세요.</div>
              )}
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
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{auth.profile.display_name} 접속 중</p>
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

            {auth.profile.role === 'MASTER' && (
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
