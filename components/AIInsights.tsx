import React, { useState, useMemo } from 'react';
import { Sparkles, Loader2, Send, MessageCircle, ChevronDown, CheckCircle2, KeyRound, X } from 'lucide-react';
import { RawSalesData, normalizeChannel, getChannelType } from '../types';

interface Props {
  data: RawSalesData[];
  dateRange?: { start: string; end: string };
}

const INTERNAL_PW_STORAGE_KEY = 'sales_internal_app_password';

const AIInsights: React.FC<Props> = ({ data, dateRange }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  // Internal shared password (for server proxy)
  const [showPwGate, setShowPwGate] = useState(false);
  const [pwInput, setPwInput] = useState('');

  const statsSummary = useMemo(() => {
    if (data.length === 0) return null;
    let totalRevenue = 0,
      totalOrderCount = 0,
      takeoutTotal = 0,
      totalCost = 0,
      oilCount = 0,
      rawCount = 0;
    const storeSummary: Record<string, number> = {};

    data.forEach((d) => {
      const norm = normalizeChannel(d.channel);
      const type = getChannelType(norm);
      if (type === 'platform' || norm === '내점') {
        totalRevenue += d.amount;
        totalOrderCount += d.orderCount;
        storeSummary[d.storeName] = (storeSummary[d.storeName] || 0) + d.amount;
      } else if (type === 'takeout') takeoutTotal += d.amount;
      else if (type === 'material') {
        totalCost += d.amount;
        if (norm === '전용유') oilCount += d.orderCount;
        else if (norm === '원자재') rawCount += d.orderCount;
      }
    });

    return {
      totalRevenue,
      totalOrderCount,
      takeoutTotal,
      totalCost,
      oilEfficiency: oilCount > 0 ? (rawCount / oilCount).toFixed(1) : '0',
      topStore: Object.entries(storeSummary).sort((a, b) => b[1] - a[1])[0],
    };
  }, [data]);

  const getInternalPassword = () => {
    try {
      return sessionStorage.getItem(INTERNAL_PW_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  };

  const saveInternalPassword = (pw: string) => {
    try {
      sessionStorage.setItem(INTERNAL_PW_STORAGE_KEY, pw);
    } catch {
      // ignore
    }
  };

  const callGemini = async (prompt: string) => {
    const internalPw = getInternalPassword();
    const resp = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(internalPw ? { 'X-Internal-Password': internalPw } : {}),
      },
      body: JSON.stringify({
        model: 'gemini-1.5-flash',
        prompt,
        systemInstruction:
          'HTML 태그를 전혀 사용하지 않는 전문 경영 분석가입니다. 응답에 <br>과 같은 태그가 포함되어서는 안 됩니다.',
      }),
    });

    if (resp.status === 401) {
      // Need internal password
      setShowPwGate(true);
      throw new Error('UNAUTHORIZED');
    }

    const json = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      throw new Error(json?.error || 'API_ERROR');
    }

    return (json.text || '') as string;
  };

  const handleAskAI = async (query: string = userQuery) => {
    if (!query.trim() || !statsSummary) return;
    setLoading(true);
    setInsight('');

    try {
      const prompt = `
본사 매출 통계 (${dateRange?.start} ~ ${dateRange?.end}):
- 매출액: ${statsSummary.totalRevenue.toLocaleString()}원
- 주문수: ${statsSummary.totalOrderCount.toLocaleString()}건
- 포장 매출: ${statsSummary.takeoutTotal.toLocaleString()}원
- 원가 매입액: ${statsSummary.totalCost.toLocaleString()}원
- 조리 효율: ${statsSummary.oilEfficiency}수/can
- 질문: ${query}

지침:
1) 경영 컨설턴트로서 핵심만 매우 간결하게 답변
2) HTML 태그(예: <br>, <b>)는 절대 사용하지 말 것
3) 줄바꿈은 \\\n 로만
`;

      const text = await callGemini(prompt);
      const cleanedText = (text || '').replace(/<br\s*\/?>/gi, '\n');
      setInsight(cleanedText || '답변 생성 불가');
    } catch (err: any) {
      if (String(err?.message) === 'UNAUTHORIZED') {
        // pw modal will show
      } else {
        setInsight('AI 응답 중 오류가 발생했습니다. (환경변수/서버 설정을 확인하세요)');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePwSubmit = () => {
    if (!pwInput.trim()) return;
    saveInternalPassword(pwInput.trim());
    setShowPwGate(false);
    setPwInput('');
    // retry if userQuery exists
    if (userQuery.trim()) {
      handleAskAI(userQuery);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 p-2.5 rounded-xl">
            <Sparkles className="text-blue-500" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">AI 경영 인사이트</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real-time Data Intelligence</p>
          </div>
        </div>
        <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 bg-slate-800 rounded-lg text-slate-400">
          <ChevronDown className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} size={20} />
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300 relative z-10">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="매출 추이나 원가율에 대해 질문하세요..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
              />
            </div>
            <button
              onClick={() => handleAskAI()}
              disabled={loading || !userQuery.trim()}
              className="bg-blue-600 p-3 rounded-xl text-white"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {["매출 상위권 특징은?", "원가율 개선 방안", "포장 비중 확대 전략"].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setUserQuery(suggestion);
                  handleAskAI(suggestion);
                }}
                className="text-[10px] font-black bg-slate-800 text-slate-400 px-3 py-1.5 rounded-lg border border-slate-700 hover:text-blue-400 transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {insight && !loading && (
            <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed animate-in fade-in duration-300">
              <div className="flex items-center gap-2 mb-3 text-blue-400 font-black text-[10px] uppercase">
                <CheckCircle2 size={12} /> 핵심 분석 결과
              </div>
              {insight}
            </div>
          )}
        </div>
      )}

      {showPwGate && (
        <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-emerald-600/20 p-2 rounded-xl"><KeyRound className="text-emerald-400" size={18} /></div>
                <div>
                  <div className="text-white font-black">사내 접근 비밀번호</div>
                  <div className="text-slate-400 text-xs">사내 공유 비밀번호를 입력해야 AI 기능을 사용할 수 있어요.</div>
                </div>
              </div>
              <button className="text-slate-500 hover:text-slate-300" onClick={() => setShowPwGate(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <input
                type="password"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                placeholder="예: company-2026!"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                onKeyDown={(e) => e.key === 'Enter' && handlePwSubmit()}
              />
              <button
                onClick={handlePwSubmit}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-3 rounded-xl"
              >
                확인
              </button>
            </div>

            <div className="mt-3 text-[11px] text-slate-500">
              * 이 비밀번호는 세션에만 저장되며, 브라우저를 닫으면 다시 입력해야 합니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInsights;
