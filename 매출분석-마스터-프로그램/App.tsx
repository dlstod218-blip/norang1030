
import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Filter, Calendar as CalendarIcon, RotateCcw, ChevronDown, Settings, Lock, Eye, AlertCircle, Loader2, CheckCircle2, Database, Map, ShieldCheck, LogOut, Key, Download } from 'lucide-react';
import { RawSalesData, CHANNEL_GROUPS, normalizeChannel, getChannelType } from './types';
import { parseISO, isValid, isWithinInterval, startOfDay, endOfDay, format, subDays } from 'date-fns';
import DataUploader from './components/DataUploader';
import DashboardOverview from './components/DashboardOverview';
import SalesCharts from './components/SalesCharts';
import DetailedAnalysis from './components/DetailedAnalysis';
import AIInsights from './components/AIInsights';
import PnLAnalysis from './components/PnLAnalysis';
import CommercialAnalysis from './components/CommercialAnalysis';

// 상용화 시 발급된 라이선스 키 리스트
const VALID_LICENSE_KEYS = [
  "MASTER-2025-PREMIUM", // 마스터 키
  "NORANG-HQ-01",        // 본사용
  "USER-DEMO-TEST",      // 테스트용
  "ADMIN-GATEWAY-77"     // 관리자 전용
];

const STORAGE_AUTH_KEY = 'sales_master_auth_session';

const App: React.FC = () => {
  const [data, setData] = useState<RawSalesData[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'pnl' | 'commercial'>('overview');
  const [selectedChannel, setSelectedChannel] = useState<string>('전체');
  
  const [showSettings, setShowSettings] = useState(false);
  
  // PWA 설치 프롬프트 상태
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  // 라이선스 인증 상태 관리 (초기 로드 시 localStorage 확인)
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_AUTH_KEY) === 'true';
  });
  const [licenseInput, setLicenseInput] = useState("");
  const [authError, setAuthError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // 기본 날짜를 '어제'로 설정
  const yesterdayStr = useMemo(() => format(subDays(new Date(), 1), 'yyyy-MM-dd'), []);
  const [startDate, setStartDate] = useState<string>(yesterdayStr);
  const [endDate, setEndDate] = useState<string>(yesterdayStr);

  useEffect(() => {
    // PWA 설치 가능 여부 감지
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDataLoaded = (loadedData: RawSalesData[]) => {
    setData(loadedData);
  };

  // 라이선스 인증 실행
  const handleAuthorize = () => {
    const cleanInput = licenseInput.trim().toUpperCase();
    
    if (VALID_LICENSE_KEYS.includes(cleanInput)) {
      setIsSuccess(true);
      setAuthError(false);
      
      // 시각적 피드백 후 실제 상태 변경 및 로컬 스토리지 저장
      setTimeout(() => {
        localStorage.setItem(STORAGE_AUTH_KEY, 'true');
        setIsAuthorized(true);
        setLicenseInput("");
        setIsSuccess(false);
      }, 800);
    } else {
      setAuthError(true);
      // 흔들림 효과 후 에러 메시지 초기화
      setTimeout(() => setAuthError(false), 2000);
    }
  };

  // 로그아웃 실행 (강력한 초기화)
  const handleLogout = () => {
    if (window.confirm("시스템에서 로그아웃 하시겠습니까?\n보안을 위해 모든 세션 정보와 캐시된 데이터가 즉시 삭제됩니다.")) {
      // 1. 스토리지 삭제
      localStorage.removeItem(STORAGE_AUTH_KEY);
      localStorage.removeItem('sales_insight_master_connections'); // 연결된 시트 정보도 보안상 초기화 가능 (선택사항)
      
      // 2. 상태 초기화
      setIsAuthorized(false);
      setData([]);
      
      // 3. 페이지 새로고침 (가장 확실한 초기화 방법)
      window.location.reload();
    }
  };

  const synthesizedData = useMemo(() => {
    if (data.length === 0) return [];

    const storeDateMap: Record<string, { 
      total: number, 
      totalCount: number,
      platforms: number, 
      platformCounts: number,
      platformItems: RawSalesData[], 
      takeoutItems: RawSalesData[],
      materialItems: RawSalesData[],
      procurementAmount: number,
      procurementCount: number,
      rawMaterialAmount: number,
      rawMaterialCount: number,
      oilAmount: number,
      oilCount: number,
      meta: any 
    }> = {};
    
    data.forEach(item => {
      const key = `${item.storeName}_${item.date}`;
      if (!storeDateMap[key]) {
        storeDateMap[key] = { 
          total: 0, 
          totalCount: 0,
          platforms: 0, 
          platformCounts: 0,
          platformItems: [],
          takeoutItems: [],
          materialItems: [],
          procurementAmount: 0,
          procurementCount: 0,
          rawMaterialAmount: 0,
          rawMaterialCount: 0,
          oilAmount: 0,
          oilCount: 0,
          meta: { managerName: item.managerName, region: item.region, date: item.date, storeName: item.storeName }
        };
      }
      
      const normalizedChan = normalizeChannel(item.channel);
      const cType = getChannelType(normalizedChan);
      
      const target = storeDateMap[key];
      if (cType === 'total') {
        target.total += item.amount;
        target.totalCount += item.orderCount;
      } else if (cType === 'platform') {
        target.platforms += item.amount;
        target.platformCounts += item.orderCount;
        target.platformItems.push(item);
      } else if (cType === 'takeout') {
        target.takeoutItems.push(item);
      } else if (cType === 'material') {
        target.materialItems.push(item);
        if (normalizedChan === '원자재') {
          target.rawMaterialAmount += item.amount;
          target.rawMaterialCount += item.orderCount;
        } else if (normalizedChan === '전용유') {
          target.oilAmount += item.amount;
          target.oilCount += item.orderCount;
        }
      } else if (cType === 'procurement') {
        target.procurementAmount += item.amount;
        target.procurementCount += item.orderCount;
      }
    });

    const result: RawSalesData[] = [];
    Object.values(storeDateMap).forEach(val => {
      val.platformItems.forEach(item => result.push(item));
      const inStoreAmount = Math.max(0, val.total - val.platforms);
      const inStoreCount = Math.max(0, val.totalCount - val.platformCounts);
      result.push({ ...val.meta, amount: inStoreAmount, channel: '내점', orderCount: inStoreCount });
      val.takeoutItems.forEach(item => result.push(item));
      val.materialItems.forEach(item => result.push(item));
      if (val.procurementAmount > 0 || val.procurementCount > 0) {
        const calculatedSubMaterialAmount = Math.max(0, val.procurementAmount - val.rawMaterialAmount - val.oilAmount);
        const calculatedSubMaterialCount = Math.max(0, val.procurementCount - val.rawMaterialCount - val.oilCount);
        if (calculatedSubMaterialAmount > 0 || calculatedSubMaterialCount > 0) {
          result.push({ ...val.meta, amount: calculatedSubMaterialAmount, channel: '부자재', orderCount: calculatedSubMaterialCount });
        }
      }
    });

    return result;
  }, [data]);

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
    if (selectedChannel === '전체') return base;
    return base.filter(d => normalizeChannel(d.channel) === selectedChannel);
  }, [synthesizedData, startDate, endDate, selectedChannel]);

  // 라이선스 비인증 시 로그인 화면 렌더링
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans select-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
        
        <div className="max-w-md w-full bg-slate-900/40 backdrop-blur-3xl p-10 md:p-14 rounded-[50px] shadow-2xl border border-white/5 text-center relative z-10 animate-in fade-in zoom-in duration-700">
          <div className={`w-24 h-24 rounded-[35px] flex items-center justify-center mx-auto mb-10 shadow-2xl transition-all duration-500 ${isSuccess ? 'bg-emerald-500 shadow-emerald-900/40 rotate-[360deg]' : 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-blue-900/40'}`}>
            {isSuccess ? <CheckCircle2 size={48} className="text-white" /> : <ShieldCheck size={48} className="text-white" />}
          </div>
          
          <h1 className="text-3xl font-black text-white tracking-tighter mb-4">
            매출분석 마스터 <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Corporate Edition</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium mb-10 leading-relaxed">
            허가된 사용자 전용 분석 시스템입니다.<br/>
            발급받은 <span className="text-blue-400 font-bold">기업용 라이선스 키</span>를 입력하세요.
          </p>
          
          <div className="space-y-4">
            <div className="relative group">
              <Key className={`absolute left-6 top-1/2 -translate-y-1/2 transition-colors ${authError ? 'text-red-500' : 'text-slate-500 group-focus-within:text-blue-400'}`} size={20} />
              <input 
                type="text" 
                placeholder="LICENSE KEY"
                autoFocus
                value={licenseInput}
                onChange={(e) => {
                  setLicenseInput(e.target.value);
                  if (authError) setAuthError(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAuthorize()}
                className={`w-full bg-slate-800/50 border-2 rounded-3xl pl-16 pr-6 py-5 text-center font-mono font-black tracking-widest outline-none transition-all ${authError ? 'border-red-500 bg-red-900/10 text-red-500 animate-shake' : 'border-white/5 focus:border-blue-500 text-white'}`}
              />
            </div>
            
            {authError && (
              <div className="flex items-center justify-center gap-2 text-xs font-black text-red-500 animate-bounce">
                <AlertCircle size={14} /> 유효하지 않은 라이선스 키입니다.
              </div>
            )}

            <button 
              onClick={handleAuthorize}
              disabled={isSuccess || !licenseInput.trim()}
              className={`w-full py-5 rounded-3xl font-black shadow-2xl transition-all transform active:scale-95 flex items-center justify-center gap-3 mt-4 ${isSuccess ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-800 disabled:text-slate-600'}`}
            >
              {isSuccess ? (
                <>인증 성공 <CheckCircle2 size={20} /></>
              ) : (
                <>시스템 접속하기 <ChevronDown size={20} className="-rotate-90" /></>
              )}
            </button>
          </div>
          
          <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-center gap-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
            <span>v2.6.0 STABLE</span>
            <div className="w-1.5 h-1.5 bg-slate-700 rounded-full"></div>
            <span>ENTERPRISE GATEWAY</span>
          </div>
        </div>
      </div>
    );
  }

  // 인증된 사용자를 위한 메인 대시보드 화면
  const hasData = data.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-50 transition-colors duration-500 font-sans">
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">매출분석 마스터 <span className="text-blue-500">프로그램</span></h1>
            <span className="ml-2 text-[9px] font-black bg-blue-600/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-md animate-pulse">PREMIUM</span>
          </div>
          
          <div className="flex items-center gap-3">
            {deferredPrompt && (
              <button 
                onClick={handleInstallClick}
                className="hidden sm:flex p-2.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all items-center gap-2 border border-blue-600/30 shadow-lg"
              >
                <Download size={18} />
                <span className="text-xs font-black">앱 설치</span>
              </button>
            )}
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2.5 rounded-xl transition-all flex items-center gap-2 ${showSettings ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              <Settings size={18} />
              <span className="text-xs font-bold hidden sm:inline">{showSettings ? '설정 닫기' : '데이터 관리'}</span>
            </button>
            <div className="w-px h-6 bg-slate-800 mx-1"></div>
            {/* 활성화된 로그아웃 버튼 */}
            <button 
              onClick={handleLogout}
              className="p-2.5 bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all flex items-center gap-2 border border-transparent hover:border-red-400/30 group active:scale-95"
              title="로그아웃"
            >
              <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
              <span className="text-xs font-black hidden sm:inline">로그아웃</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 pb-64"> 
        {showSettings && (
          <div className="mb-10 animate-in slide-in-from-top-6 duration-500">
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-emerald-900/10 px-6 py-4 rounded-3xl border border-emerald-800/30 text-emerald-500 shadow-inner">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="animate-pulse" />
                  <p className="font-black text-[11px] uppercase tracking-widest">Authorized Access: 기업용 데이터 동기화 활성</p>
                </div>
              </div>
              <DataUploader onDataLoaded={handleDataLoaded} autoStart={true} onSyncStatusChange={setIsSyncing} />
            </div>
          </div>
        )}

        {!hasData ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
            {isSyncing ? (
              <div className="flex flex-col items-center gap-8 bg-slate-900/50 p-16 rounded-[60px] border border-white/5 shadow-2xl">
                <div className="relative">
                  <Loader2 className="animate-spin text-blue-500" size={80} />
                  <ShieldCheck size={32} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-100 mb-2">기업 전용 클라우드 동기화 중</p>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em]">Secure Data Pipeline Active</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 p-16 rounded-[60px] shadow-2xl border border-slate-800 max-w-lg mx-auto transform transition-all hover:scale-[1.01]">
                <div className="bg-slate-800 w-24 h-24 rounded-[40px] flex items-center justify-center mx-auto mb-10 text-blue-500 shadow-inner ring-1 ring-white/5">
                  <Database size={40} />
                </div>
                <h2 className="text-3xl font-black text-white mb-4">데이터 로드 필요</h2>
                <p className="text-slate-400 font-medium mb-12 leading-relaxed">상단 '데이터 관리' 메뉴를 통해 <br/> Google Sheets 연동 URL을 등록하고 분석을 시작하세요.</p>
                <button onClick={() => setShowSettings(true)} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black hover:bg-blue-700 transition-all shadow-2xl shadow-blue-900/30 flex items-center justify-center gap-3">
                  데이터 소스 연결하기 <ChevronDown size={20} className="-rotate-90" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={`space-y-6 transition-all duration-500 ${showSettings ? 'opacity-20 blur-sm pointer-events-none scale-[0.98]' : 'opacity-100'}`}>
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-slate-900 p-6 rounded-[35px] shadow-lg border border-slate-800">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex bg-slate-800 p-1.5 rounded-2xl overflow-x-auto custom-scrollbar max-w-full">
                  {[
                    { id: 'overview', label: '종합 대시보드' },
                    { id: 'detailed', label: '성과 상세' },
                    { id: 'pnl', label: '손익 분석' },
                    { id: 'commercial', label: 'AI 상권분석' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-8 py-3 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                        activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab !== 'pnl' && activeTab !== 'commercial' && (
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="relative group">
                      <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <select 
                        value={selectedChannel}
                        onChange={(e) => setSelectedChannel(e.target.value)}
                        className="appearance-none bg-slate-800 border border-slate-700 pl-10 pr-10 py-3 rounded-2xl text-xs font-black text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="전체">전체 채널</option>
                        {CHANNEL_GROUPS.filter(g => g.type === 'platform').map(g => (
                          <option key={g.name} value={g.name}>{g.name}</option>
                        ))}
                        <option value="내점">내점 (산출)</option>
                        <option value="포장">포장 (단독)</option>
                        <option value="원자재">원자재</option>
                        <option value="전용유">전용유</option>
                        <option value="부자재">부자재</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-800 px-5 py-3 rounded-2xl border border-slate-700 shadow-inner">
                      <CalendarIcon size={16} className="text-blue-500" />
                      <div className="flex items-center gap-2">
                        <input 
                          type="date" 
                          value={startDate} 
                          onChange={(e) => setStartDate(e.target.value)} 
                          className="bg-transparent border-none text-xs font-black text-slate-200 outline-none" 
                        />
                        <span className="text-slate-600 font-black">-</span>
                        <input 
                          type="date" 
                          value={endDate} 
                          onChange={(e) => setEndDate(e.target.value)} 
                          className="bg-transparent border-none text-xs font-black text-slate-200 outline-none" 
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <span className="hidden lg:inline-block text-[9px] font-black px-4 py-2 rounded-xl bg-slate-800 text-slate-500 uppercase tracking-widest border border-slate-700">
                  Data Refresh Every Sync
                </span>
              </div>
            </div>

            {activeTab !== 'pnl' && activeTab !== 'commercial' && <AIInsights data={finalFilteredData} />}

            {activeTab === 'overview' ? (
              <div className="space-y-6 animate-in fade-in duration-700">
                <DashboardOverview 
                  data={synthesizedData} 
                  startDate={startDate} 
                  endDate={endDate} 
                />
                <SalesCharts 
                  data={finalFilteredData} 
                  startDate={startDate} 
                  endDate={endDate} 
                />
              </div>
            ) : activeTab === 'detailed' ? (
              <div className="animate-in fade-in duration-700">
                <DetailedAnalysis 
                  data={synthesizedData} 
                  startDate={startDate} 
                  endDate={endDate} 
                />
              </div>
            ) : activeTab === 'pnl' ? (
              <div className="animate-in fade-in duration-700">
                <PnLAnalysis data={synthesizedData} />
              </div>
            ) : (
              <div className="animate-in fade-in duration-700">
                <CommercialAnalysis data={synthesizedData} />
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">
            &copy; 2025 매출분석 마스터 프로그램 Corporate Edition <br/>
            <span className="text-slate-700 mt-2 block italic">Enterprise Intelligence Service by Norang Chicken HQ</span>
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
};

export default App;
