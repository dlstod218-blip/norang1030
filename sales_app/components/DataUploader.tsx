
import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Link as LinkIcon, Plus, Trash2, Database, RefreshCcw, ShieldCheck, FileText, Upload, X, Copy, RotateCcw, Zap } from 'lucide-react';
import { RawSalesData, normalizeChannel } from '../types';

interface Props {
  onDataLoaded: (data: RawSalesData[]) => void;
  autoStart?: boolean;
  onSyncStatusChange?: (isSyncing: boolean) => void;
  showUI?: boolean;
}

interface SheetConnection {
  id: string;
  name: string;
  url: string;
  gid: string;
  status: 'success' | 'error';
}

const STORAGE_KEY = 'sales_insight_master_connections';

// Hardcoded Master Data Sources
const SHEET_2025_ID = "1e2A0psmQveufXa975n_YS2HDZrNtLjeiFNJZ-RSDBfc";
const SHEET_CURRENT_ID = "1DqXTJZaMQxCAPNNauE-I6rwsuZWV066aNbHETonPewU";

const createConn = (name: string, sheetId: string, gid: string): SheetConnection => ({
  id: `${sheetId}_${gid}`,
  name,
  url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit?gid=${gid}#gid=${gid}`,
  gid,
  status: 'success'
});

const MASTER_CONNECTIONS: SheetConnection[] = [
  // 2025 Data
  createConn('2025년 총매출', SHEET_2025_ID, '853433463'),
  createConn('2025년 총매출 건수', SHEET_2025_ID, '1322266991'),
  createConn('2025년 전화', SHEET_2025_ID, '422047647'),
  createConn('2025년 전화 건수', SHEET_2025_ID, '296139135'),
  createConn('2025년 배달의민족', SHEET_2025_ID, '1158032807'),
  createConn('2025년 배달의민족 건수', SHEET_2025_ID, '1555739668'),
  createConn('2025년 배민1', SHEET_2025_ID, '44155628'),
  createConn('2025년 배민1 건수', SHEET_2025_ID, '1505900092'),
  createConn('2025년 쿠팡이츠', SHEET_2025_ID, '623563092'),
  createConn('2025년 쿠팡이츠 건수', SHEET_2025_ID, '2055187662'),
  createConn('2025년 땡겨요', SHEET_2025_ID, '1516912649'),
  createConn('2025년 땡겨요 건수', SHEET_2025_ID, '1128713926'),
  createConn('2025년 먹깨비', SHEET_2025_ID, '229487939'),
  createConn('2025년 먹깨비 건수', SHEET_2025_ID, '1864607533'),
  createConn('2025년 위메프오', SHEET_2025_ID, '259142647'),
  createConn('2025년 위메프오 건수', SHEET_2025_ID, '1018047887'),
  createConn('2025년 요기배달', SHEET_2025_ID, '994885392'),
  createConn('2025년 요기배달 건수', SHEET_2025_ID, '601502536'),
  createConn('2025년 요기요', SHEET_2025_ID, '756734570'),
  createConn('2025년 요기요 건수', SHEET_2025_ID, '723377995'),
  createConn('2025년 자사앱', SHEET_2025_ID, '1670864074'),
  createConn('2025년 자사앱 건수', SHEET_2025_ID, '1067520237'),
  createConn('2025년 포장', SHEET_2025_ID, '2132687144'),
  createConn('2025년 포장 건수', SHEET_2025_ID, '106138625'),
  createConn('2025년 절단육', SHEET_2025_ID, '305081758'),
  createConn('2025년 절단육 건수', SHEET_2025_ID, '639604083'),
  createConn('2025년 정육800g', SHEET_2025_ID, '1248192593'),
  createConn('2025년 정육800g 건수', SHEET_2025_ID, '1888832136'),
  createConn('2025년 콤보', SHEET_2025_ID, '2084828753'),
  createConn('2025년 콤보 건수', SHEET_2025_ID, '527341642'),
  createConn('2025년 정육600g', SHEET_2025_ID, '868510655'),
  createConn('2025년 정육600g 건수', SHEET_2025_ID, '996006444'),
  createConn('2025년 근위', SHEET_2025_ID, '1155357423'),
  createConn('2025년 근위 건수', SHEET_2025_ID, '1643894110'),
  createConn('2025년 전용유', SHEET_2025_ID, '1438667836'),
  createConn('2025년 전용유 건수', SHEET_2025_ID, '280988912'),
  createConn('2025년 발주', SHEET_2025_ID, '946988708'),
  createConn('2025년 발주 건수', SHEET_2025_ID, '860204257'),

  // Current Data
  createConn('총매출', SHEET_CURRENT_ID, '853433463'),
  createConn('총매출 건수', SHEET_CURRENT_ID, '1322266991'),
  createConn('전화', SHEET_CURRENT_ID, '422047647'),
  createConn('전화 건수', SHEET_CURRENT_ID, '296139135'),
  createConn('배달의민족', SHEET_CURRENT_ID, '1158032807'),
  createConn('배달의민족 건수', SHEET_CURRENT_ID, '1555739668'),
  createConn('배민1', SHEET_CURRENT_ID, '44155628'),
  createConn('배민1 건수', SHEET_CURRENT_ID, '1505900092'),
  createConn('쿠팡이츠', SHEET_CURRENT_ID, '623563092'),
  createConn('쿠팡이츠 건수', SHEET_CURRENT_ID, '2055187662'),
  createConn('땡겨요', SHEET_CURRENT_ID, '1516912649'),
  createConn('땡겨요 건수', SHEET_CURRENT_ID, '1128713926'),
  createConn('먹깨비', SHEET_CURRENT_ID, '229487939'),
  createConn('먹깨비 건수', SHEET_CURRENT_ID, '1864607533'),
  createConn('위메프오', SHEET_CURRENT_ID, '259142647'),
  createConn('위메프오 건수', SHEET_CURRENT_ID, '1018047887'),
  createConn('요기배달', SHEET_CURRENT_ID, '994885392'),
  createConn('요기배달 건수', SHEET_CURRENT_ID, '601502536'),
  createConn('요기요', SHEET_CURRENT_ID, '756734570'),
  createConn('요기요 건수', SHEET_CURRENT_ID, '723377995'),
  createConn('자사앱', SHEET_CURRENT_ID, '1670864074'),
  createConn('자사앱 건수', SHEET_CURRENT_ID, '1067520237'),
  createConn('포장', SHEET_CURRENT_ID, '2132687144'),
  createConn('포장 건수', SHEET_CURRENT_ID, '106138625'),
  createConn('절단육', SHEET_CURRENT_ID, '305081758'),
  createConn('절단육 건수', SHEET_CURRENT_ID, '639604083'),
  createConn('정육800g', SHEET_CURRENT_ID, '1248192593'),
  createConn('정육800g 건수', SHEET_CURRENT_ID, '1888832136'),
  createConn('콤보', SHEET_CURRENT_ID, '2084828753'),
  createConn('콤보 건수', SHEET_CURRENT_ID, '527341642'),
  createConn('정육600g', SHEET_CURRENT_ID, '868510655'),
  createConn('정육600g 건수', SHEET_CURRENT_ID, '996006444'),
  createConn('근위', SHEET_CURRENT_ID, '1155357423'),
  createConn('근위 건수', SHEET_CURRENT_ID, '1643894110'),
  createConn('전용유', SHEET_CURRENT_ID, '1438667836'),
  createConn('전용유 건수', SHEET_CURRENT_ID, '280988912'),
  createConn('발주', SHEET_CURRENT_ID, '946988708'),
  createConn('발주 건수', SHEET_CURRENT_ID, '860204257'),
];

const DataUploader: React.FC<Props> = ({ onDataLoaded, autoStart = false, onSyncStatusChange, showUI = false }) => {
  const [connections, setConnections] = useState<SheetConnection[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : MASTER_CONNECTIONS;
      } catch (e) {
        return MASTER_CONNECTIONS;
      }
    }
    return MASTER_CONNECTIONS;
  });

  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  
  const hasStartedRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
    if (connections.length > 0) {
      setSaveStatus('saved');
      const timer = setTimeout(() => setSaveStatus('idle'), 2000);
      return () => clearTimeout(timer);
    }
  }, [connections]);

  // 컴포넌트 마운트 시 자동 시작 (백그라운드에서 실행)
  useEffect(() => {
    if (autoStart && connections.length > 0 && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startAnalysis();
    }
  }, [autoStart, connections.length]);

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    });
  };

  const getExportUrl = (url: string) => {
    const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = url.match(/gid=([0-9]+)/);
    if (idMatch && idMatch[1]) {
      const id = idMatch[1];
      const gid = gidMatch ? gidMatch[1] : '0';
      return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    }
    return null;
  };

  const verifyAndAddConnection = async () => {
    if (!newUrl) return;
    setIsVerifying(true);
    setError(null);
    const exportUrl = getExportUrl(newUrl);
    if (!exportUrl) {
      setError("올바른 구글 시트 주소가 아닙니다.");
      setIsVerifying(false);
      return;
    }
    try {
      const gidMatch = newUrl.match(/gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      const newConn: SheetConnection = {
        id: Math.random().toString(36).substr(2, 9),
        name: newName.trim() || `채널-${connections.length + 1}`,
        url: newUrl,
        gid: gid,
        status: 'success'
      };
      setConnections(prev => [...prev, newConn]);
      setNewUrl('');
      setNewName('');
    } catch (err) {
      setError("연동 정보 생성 중 오류 발생");
    } finally {
      setIsVerifying(false);
    }
  };

  const restoreMasterConnections = () => {
    if (window.confirm("기본 데이터 소스로 초기화하시겠습니까?")) {
      setConnections(MASTER_CONNECTIONS);
      setError(null);
    }
  };

  const clearAllConnections = () => {
    if (window.confirm("등록된 모든 데이터 소스를 삭제하시겠습니까?")) {
      setConnections([]);
      setNewUrl('');
      setNewName('');
      setBulkText('');
      setError(null);
      setIsLoading(false);
    }
  };

  const startAnalysis = async () => {
    if (connections.length === 0) return;
    setIsLoading(true);
    onSyncStatusChange?.(true);
    setError(null);
    const mergedMap: Record<string, RawSalesData> = {};

    try {
      const fetchPromises = connections.map(async (conn) => {
        const exportUrl = getExportUrl(conn.url);
        if (!exportUrl) return;
        
        try {
          const response = await fetch(exportUrl);
          if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
          const text = await response.text();
          const rows = parseCSV(text);
          if (rows.length < 2) return;
          
          const headers = rows[0]; 
          const isCountSheet = conn.name.includes('건수');
          const channelName = isCountSheet ? conn.name.replace('건수', '').trim() : conn.name.trim();
          
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const managerName = row[1]?.trim();
            const region = row[2]?.trim();
            const storeName = row[3]?.trim();
            if (!managerName || managerName === '담당자명' || managerName === '미지정') continue;
            if (!storeName || storeName === '가맹점명') continue;
            
            for (let j = 4; j < headers.length; j++) {
              const dateHeader = headers[j];
              const valueRaw = row[j]?.replace(/[^0-9.-]+/g, "") || "0";
              const val = parseFloat(valueRaw);
              if (dateHeader && val > 0) {
                let cleanDate = dateHeader.replace(/[\.\/]/g, '-').trim();
                const parts = cleanDate.split('-');
                const now = new Date();
                let finalDate = '';
                if (parts.length === 1) { 
                  finalDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${parts[0].padStart(2, '0')}`; 
                }
                else if (parts.length === 2) { 
                  finalDate = `${now.getFullYear()}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`; 
                }
                else if (parts.length === 3) { 
                  finalDate = `${parts[0].length === 2 ? `20${parts[0]}` : parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`; 
                }
                
                if (/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {
                  const key = `${storeName}_${managerName}_${finalDate}_${channelName}`;
                  if (!mergedMap[key]) { 
                    mergedMap[key] = { 
                      storeName, 
                      managerName, 
                      region: region || '미지정', 
                      date: finalDate, 
                      channel: channelName,
                      amount: 0, 
                      orderCount: 0 
                    }; 
                  }
                  if (isCountSheet) { mergedMap[key].orderCount += val; } else { mergedMap[key].amount += val; }
                }
              }
            }
          }
        } catch (connErr) {
          console.error(`Error loading connection ${conn.name}:`, connErr);
        }
      });

      await Promise.all(fetchPromises);
      
      const finalData = Object.values(mergedMap);
      if (finalData.length === 0) throw new Error("가져올 수 있는 데이터가 없습니다. URL 접근 권한을 확인하세요.");
      onDataLoaded(finalData);
    } catch (err) { 
      setError(err instanceof Error ? err.message : "동기화 중 알 수 없는 오류 발생"); 
    }
    finally { setIsLoading(false); onSyncStatusChange?.(false); }
  };

  const handleBulkImport = () => {
    const lines = bulkText.split('\n').filter(line => line.trim());
    const newConns: SheetConnection[] = [];
    lines.forEach(line => {
      let name = '';
      let url = '';
      if (line.includes('http')) {
        if (line.includes(':')) {
          const firstColon = line.indexOf(':');
          const possibleUrl = line.substring(firstColon + 1).trim();
          if (possibleUrl.startsWith('http')) {
            name = line.substring(0, firstColon).trim();
            url = possibleUrl;
          } else {
            url = line.trim();
          }
        } else {
          url = line.trim();
        }
        const exportUrl = getExportUrl(url);
        if (exportUrl) {
          const gidMatch = url.match(/gid=([0-9]+)/);
          newConns.push({ 
            id: Math.random().toString(36).substr(2, 9), 
            name: name || `채널-${newConns.length + 1}`, 
            url: url, 
            gid: gidMatch ? gidMatch[1] : '0', 
            status: 'success' 
          });
        }
      }
    });
    if (newConns.length > 0) {
      setConnections(prev => [...prev, ...newConns]);
      setBulkText('');
      setShowBulkModal(false);
    }
  };

  const isMasterActive = connections.length === MASTER_CONNECTIONS.length && 
    connections.every((c, i) => c.url === MASTER_CONNECTIONS[i]?.url);

  return (
    <>
      {showUI && (
        <div className="w-full space-y-6 mb-10 animate-in slide-in-from-top-6 duration-500">
          <div className="bg-slate-900 rounded-[40px] shadow-2xl border border-slate-800 p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-600/20">
                  <Database className="text-white w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-white">데이터 소스 설정</h2>
                    {isMasterActive && (
                      <span className="bg-blue-500/10 text-blue-500 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-tighter">Master Active</span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">분석할 구글 시트 소스를 관리하세요.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 relative z-10">
                <button onClick={restoreMasterConnections} disabled={isLoading} className="bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2">
                  <RotateCcw size={14} /> 기본값 복원
                </button>
                <button onClick={clearAllConnections} disabled={isLoading} className="bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2">
                  <Trash2 size={14} /> 전체 삭제
                </button>
                <button onClick={() => setShowBulkModal(true)} disabled={isLoading} className="bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 px-4 py-2.5 rounded-xl text-xs font-black transition-all">
                  일괄 등록
                </button>
                <button onClick={startAnalysis} disabled={isLoading || connections.length === 0} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-xs font-black transition-all hover:bg-blue-700 flex items-center gap-2 shadow-lg">
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                  동기화 실행
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8 relative z-10">
              <div className="md:col-span-3">
                <input type="text" placeholder="채널/시트 별칭" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-slate-800 border-2 border-transparent rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none transition-all" />
              </div>
              <div className="md:col-span-7">
                <input type="text" placeholder="Google Sheets 공유 URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="w-full bg-slate-800 border-2 border-transparent rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none transition-all" />
              </div>
              <div className="md:col-span-2">
                <button onClick={verifyAndAddConnection} disabled={!newUrl || isVerifying || isLoading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black hover:bg-blue-700 transition-all text-sm disabled:opacity-50">연결 추가</button>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-xs font-bold animate-in slide-in-from-top-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
              {connections.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                  <p className="text-slate-600 text-xs font-black uppercase tracking-widest">등록된 데이터 소스가 없습니다</p>
                </div>
              ) : (
                connections.map((conn) => (
                  <div key={conn.id} className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-800 rounded-2xl transition-all hover:bg-slate-800/60 group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`p-2.5 rounded-xl ${conn.name.includes('건수') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        <LinkIcon size={14} />
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-black text-slate-200 text-sm">{conn.name}</div>
                        <div className="text-[10px] text-slate-500 truncate font-medium">{conn.url}</div>
                      </div>
                    </div>
                    <button onClick={() => setConnections(prev => prev.filter(c => c.id !== conn.id))} className="p-3 text-slate-600 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {showBulkModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className="bg-slate-900 w-full max-w-2xl rounded-[40px] shadow-2xl border border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-xl font-black text-white">데이터 소스 일괄 등록</h3>
                  <button onClick={() => setShowBulkModal(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                </div>
                <div className="p-8 space-y-6">
                  <textarea 
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder="채널명: 구글시트주소 (한 줄에 하나씩)"
                    className="w-full h-64 bg-slate-800 border-none rounded-[32px] p-6 text-sm font-mono text-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                  ></textarea>
                  <div className="flex justify-end gap-3 pt-4">
                    <button onClick={() => setShowBulkModal(false)} className="px-6 py-4 bg-slate-800 text-slate-400 rounded-2xl font-black text-sm hover:bg-slate-700 transition-all">취소</button>
                    <button onClick={handleBulkImport} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all">일괄 추가하기</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default DataUploader;
