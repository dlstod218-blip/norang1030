
import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Link as LinkIcon, Plus, Trash2, Database, RefreshCcw, ShieldCheck, FileText, Upload, X, Copy, RotateCcw } from 'lucide-react';
import { RawSalesData, normalizeChannel } from '../types';

interface Props {
  onDataLoaded: (data: RawSalesData[]) => void;
  autoStart?: boolean;
  onSyncStatusChange?: (isSyncing: boolean) => void;
}

interface SheetConnection {
  id: string;
  name: string;
  url: string;
  gid: string;
  status: 'success' | 'error';
}

const STORAGE_KEY = 'sales_insight_master_connections';

const DataUploader: React.FC<Props> = ({ onDataLoaded, autoStart = false, onSyncStatusChange }) => {
  const [connections, setConnections] = useState<SheetConnection[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
    if (connections.length > 0) {
      setSaveStatus('saved');
      const timer = setTimeout(() => setSaveStatus('idle'), 2000);
      return () => clearTimeout(timer);
    }
  }, [connections]);

  useEffect(() => {
    if (autoStart && connections.length > 0) {
      startAnalysis();
    }
  }, []);

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

  const clearAllConnections = () => {
    if (window.confirm("등록된 모든 데이터 소스를 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)")) {
      setConnections([]);
      setNewUrl('');
      setNewName('');
      setBulkText('');
      setError(null);
      setIsLoading(false);
      localStorage.removeItem(STORAGE_KEY);
      onDataLoaded([]);
    }
  };

  const processBulkLines = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
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
    return newConns;
  };

  const handleBulkImport = () => {
    const newConns = processBulkLines(bulkText);
    if (newConns.length > 0) {
      setConnections(prev => [...prev, ...newConns]);
      setBulkText('');
      setShowBulkModal(false);
    }
  };

  const startAnalysis = async () => {
    if (connections.length === 0) return;
    setIsLoading(true);
    onSyncStatusChange?.(true);
    setError(null);
    const mergedMap: Record<string, RawSalesData> = {};
    try {
      for (const conn of connections) {
        const exportUrl = getExportUrl(conn.url);
        if (!exportUrl) continue;
        try {
          const response = await fetch(exportUrl);
          if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
          const text = await response.text();
          const rows = parseCSV(text);
          if (rows.length < 2) continue;
          
          const headers = rows[0]; 
          const isCountSheet = conn.name.includes('건수');
          const rawName = isCountSheet ? conn.name.replace('건수', '').trim() : conn.name.trim();
          
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
                  const key = `${storeName}_${managerName}_${finalDate}_${rawName}`;
                  if (!mergedMap[key]) { 
                    mergedMap[key] = { 
                      storeName, 
                      managerName, 
                      region: region || '미지정', 
                      date: finalDate, 
                      channel: rawName,
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
          throw new Error(`[${conn.name}] 시트 연동 실패. URL을 확인해 주세요.`);
        }
      }
      const finalData = Object.values(mergedMap);
      if (finalData.length === 0) throw new Error("가져올 수 있는 데이터가 없습니다.");
      onDataLoaded(finalData);
    } catch (err) { 
      setError(err instanceof Error ? err.message : "동기화 중 알 수 없는 오류 발생"); 
    }
    finally { setIsLoading(false); onSyncStatusChange?.(false); }
  };

  return (
    <div className="w-full space-y-6">
      <div className="bg-slate-900 rounded-[40px] shadow-2xl border border-slate-800 p-8 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-600/20">
              <Database className="text-white w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">통합 데이터 소스 관리</h2>
                {saveStatus === 'saved' && ( <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Saved</span> )}
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Sales Analysis Master Admin</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={clearAllConnections} disabled={isLoading} className="bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2">
              <RotateCcw size={14} /> 초기화
            </button>
            <button onClick={() => setShowBulkModal(true)} disabled={isLoading} className="bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 px-4 py-2.5 rounded-xl text-xs font-black transition-all">
              일괄 등록
            </button>
            <button onClick={startAnalysis} disabled={isLoading || connections.length === 0} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-xs font-black transition-all hover:bg-blue-700 flex items-center gap-2 shadow-lg">
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              통합 동기화 가동
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
          <div className="md:col-span-3">
            <input type="text" placeholder="채널/시트 별칭" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-slate-800 border-2 border-transparent rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none transition-all" />
          </div>
          <div className="md:col-span-7">
            <input type="text" placeholder="Google Sheets 공유 URL (CSV 내보내기 가능 상태)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="w-full bg-slate-800 border-2 border-transparent rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none transition-all" />
          </div>
          <div className="md:col-span-2">
            <button onClick={verifyAndAddConnection} disabled={!newUrl || isVerifying || isLoading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black hover:bg-blue-700 transition-all text-sm disabled:opacity-50">연결 추가</button>
          </div>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {connections.map((conn) => (
            <div key={conn.id} className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-800 rounded-2xl transition-all hover:bg-slate-800/60">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`p-2.5 rounded-xl ${conn.name.includes('건수') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                  <LinkIcon size={14} />
                </div>
                <div className="overflow-hidden">
                  <div className="font-black text-slate-200 text-sm flex items-center gap-2">
                    {conn.name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate font-medium">{conn.url}</div>
                </div>
              </div>
              <button onClick={() => setConnections(prev => prev.filter(c => c.id !== conn.id))} className="p-3 text-slate-600 hover:text-red-500 transition-all">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
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
              <div className="bg-blue-900/20 p-5 rounded-3xl border border-blue-800/30 text-blue-400 text-xs font-bold leading-relaxed">
                "시트별칭: 시트URL" 형식을 한 줄에 하나씩 입력하세요.
              </div>
              <textarea 
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="25년 배민매출: https://docs.google.com/..."
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
  );
};

export default DataUploader;
