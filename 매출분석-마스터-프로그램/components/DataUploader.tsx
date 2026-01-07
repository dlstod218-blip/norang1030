
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
        name: newName.trim() || `시트-${connections.length + 1}`,
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
    if (window.confirm("등록된 모든 데이터 소스를 삭제하시겠습니까?")) {
      setConnections([]);
      localStorage.removeItem(STORAGE_KEY);
      onDataLoaded([]);
    }
  };

  const handleBulkImport = () => {
    const lines = bulkText.split('\n').filter(line => line.trim());
    const newConns: SheetConnection[] = [];
    lines.forEach(line => {
      const parts = line.split(':');
      let name = '';
      let url = '';
      if (parts.length >= 2 && parts[1].includes('http')) {
        name = parts[0].trim();
        url = parts.slice(1).join(':').trim();
      } else {
        url = line.trim();
      }
      const exportUrl = getExportUrl(url);
      if (exportUrl) {
        const gidMatch = url.match(/gid=([0-9]+)/);
        newConns.push({
          id: Math.random().toString(36).substr(2, 9),
          name: name || `시트-${newConns.length + 1}`,
          url: url,
          gid: gidMatch ? gidMatch[1] : '0',
          status: 'success'
        });
      }
    });
    setConnections(prev => [...prev, ...newConns]);
    setShowBulkModal(false);
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
        
        const response = await fetch(exportUrl);
        const text = await response.text();
        const rows = parseCSV(text);
        if (rows.length < 2) continue;
        
        const headers = rows[0];
        
        // 컬럼 위치 동적 찾기 (가맹점, 담당자, 지역)
        let storeIdx = headers.findIndex(h => h.includes('가맹점'));
        let managerIdx = headers.findIndex(h => h.includes('담당') || h.includes('관리자'));
        let regionIdx = headers.findIndex(h => h.includes('지역') || h.includes('지점'));
        
        // 기본값 설정 (못 찾을 경우)
        if (storeIdx === -1) storeIdx = 0; // 첫 번째가 가맹점이라고 가정
        if (managerIdx === -1) managerIdx = 1;
        if (regionIdx === -1) regionIdx = 2;

        const isCountSheet = conn.name.includes('건수');
        const channelName = isCountSheet ? conn.name.replace('건수', '').trim() : conn.name.trim();
        
        // 날짜 데이터 시작 인덱스 (보통 가맹점 정보 이후)
        const dateStartIdx = Math.max(storeIdx, managerIdx, regionIdx) + 1;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const storeName = row[storeIdx]?.trim();
          const managerName = row[managerIdx]?.trim();
          const region = row[regionIdx]?.trim() || '미지정';
          
          if (!storeName || storeName === '가맹점명') continue;

          for (let j = dateStartIdx; j < headers.length; j++) {
            const dateHeader = headers[j];
            const val = parseFloat(row[j]?.replace(/[^0-9.-]+/g, "") || "0");
            
            if (dateHeader && val > 0) {
              // 날짜 포맷 정규화 (MM/DD 또는 YYYY-MM-DD)
              let cleanDate = dateHeader.replace(/[\.\/]/g, '-').trim();
              const parts = cleanDate.split('-');
              const now = new Date();
              let finalDate = '';
              
              if (parts.length === 2) finalDate = `${now.getFullYear()}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
              else if (parts.length === 3) finalDate = `${parts[0].length === 2 ? `20${parts[0]}` : parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              
              if (/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {
                const key = `${storeName}_${finalDate}_${channelName}`;
                if (!mergedMap[key]) {
                  mergedMap[key] = { storeName, managerName, region, date: finalDate, channel: channelName, amount: 0, orderCount: 0 };
                }
                if (isCountSheet) mergedMap[key].orderCount += val;
                else mergedMap[key].amount += val;
              }
            }
          }
        }
      }
      onDataLoaded(Object.values(mergedMap));
    } catch (err) {
      setError("데이터 동기화 실패. 시트 공유 설정을 확인하세요.");
    } finally {
      setIsLoading(false);
      onSyncStatusChange?.(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="bg-slate-900 rounded-[40px] shadow-2xl border border-slate-800 p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg">
              <Database className="text-white w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">데이터 소스 관리</h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Google Sheets Connect</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={clearAllConnections} className="bg-slate-800 text-slate-400 px-4 py-2.5 rounded-xl text-xs font-black hover:bg-slate-700 transition-all">초기화</button>
            <button onClick={() => setShowBulkModal(true)} className="bg-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-black hover:bg-slate-700 transition-all">일괄 등록</button>
            <button onClick={startAnalysis} disabled={isLoading || connections.length === 0} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-xs font-black hover:bg-blue-700 flex items-center gap-2 shadow-lg">
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              통합 동기화 가동
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
          <div className="md:col-span-3">
            <input type="text" placeholder="채널 명칭 (예: 배민)" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-slate-800 border-2 border-transparent rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none" />
          </div>
          <div className="md:col-span-7">
            <input type="text" placeholder="시트 공유 URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="w-full bg-slate-800 border-2 border-transparent rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none" />
          </div>
          <div className="md:col-span-2">
            <button onClick={verifyAndAddConnection} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black hover:bg-blue-700 transition-all text-sm">추가</button>
          </div>
        </div>

        <div className="space-y-3">
          {connections.map((conn) => (
            <div key={conn.id} className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3">
                <LinkIcon size={14} className="text-blue-500" />
                <span className="font-black text-slate-200 text-sm">{conn.name}</span>
              </div>
              <button onClick={() => setConnections(prev => prev.filter(c => c.id !== conn.id))} className="text-slate-600 hover:text-red-500"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>

      {showBulkModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 w-full max-w-xl rounded-[40px] p-8 border border-slate-800">
            <h3 className="text-xl font-black text-white mb-6">일괄 등록 (형식 - 이름:URL)</h3>
            <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} className="w-full h-64 bg-slate-800 rounded-3xl p-6 text-sm text-slate-200 outline-none mb-6"></textarea>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowBulkModal(false)} className="px-6 py-3 bg-slate-800 text-slate-400 rounded-xl font-black text-sm">취소</button>
              <button onClick={handleBulkImport} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-sm">등록하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataUploader;
