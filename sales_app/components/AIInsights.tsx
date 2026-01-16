
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Loader2, Send, MessageCircle, BarChart3, TrendingUp, Lightbulb, HelpCircle, X, ChevronDown, CheckCircle2 } from 'lucide-react';
import { RawSalesData, normalizeChannel, getChannelType } from '../types';
// NOTE: 배포용(PWA)에서는 API 키가 프론트에 포함되면 위험합니다.
// 그래서 Gemini 호출은 /api/gemini(서버리스 함수)로 프록시합니다.

interface Props {
  data: RawSalesData[];
  dateRange?: { start: string; end: string };
}

const AIInsights: React.FC<Props> = ({ data, dateRange }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  // Internal deployment access: shared password (stored only in sessionStorage)
  const [internalPw, setInternalPw] = useState<string>(() => {
    try { return sessionStorage.getItem('internal_app_pw') || ''; } catch { return ''; }
  });
  const [pwInput, setPwInput] = useState('');

  const statsSummary = useMemo(() => {
    if (data.length === 0) return null;
    let totalRevenue = 0, totalOrderCount = 0, takeoutTotal = 0, totalCost = 0, oilCount = 0, rawCount = 0;
    const storeSummary: Record<string, number> = {};

    data.forEach(d => {
      const norm = normalizeChannel(d.channel);
      const type = getChannelType(norm);
      if (type === 'platform' || norm === '내점') {
        totalRevenue += d.amount; totalOrderCount += d.orderCount;
        storeSummary[d.storeName] = (storeSummary[d.storeName] || 0) + d.amount;
      } else if (type === 'takeout') takeoutTotal += d.amount;
      else if (type === 'material') {
        totalCost += d.amount;
        if (norm === '전용유') oilCount += d.orderCount;
        else if (norm === '원자재') rawCount += d.orderCount;
      }
    });

    return { totalRevenue, totalOrderCount, takeoutTotal, totalCost, oilEfficiency: oilCount > 0 ? (rawCount / oilCount).toFixed(1) : '0', topStore: Object.entries(storeSummary).sort((a,b) => b[1] - a[1])[0] };
  }, [data]);

  const handleAskAI = async (query: string = userQuery) => {
    if (!query.trim() || !statsSummary) return;
    setLoading(true);
    setLoadingStep('데이터 분석 중...');
    setInsight('');
    
    try {
      const prompt = `
        본사 매출 통계 (${dateRange?.start} ~ ${dateRange?.end}):
        - 매출액: ${statsSummary.totalRevenue.toLocaleString()}원
        - 포장 매출: ${statsSummary.takeoutTotal.toLocaleString()}원
        - 원가 매입액: ${statsSummary.totalCost.toLocaleString()}원
        - 조리 효율: ${statsSummary.oilEfficiency}수/can
        - 질문: ${query}
        
        **지침:** 
        1. 경영 컨설턴트로서 핵심만 **매우 간결하게** 답변하세요.
        2. **HTML 태그(예: <br>, <b> 등)를 절대 사용하지 마세요.** 
        3. 가독성을 위해 문장 끝에는 일반적인 줄바꿈(\\n)만 사용하세요.
      `;

      const systemInstruction = "HTML 태그를 전혀 사용하지 않는 전문 경영 분석가입니다. 응답에 <br>과 같은 태그가 포함되어서는 안 됩니다.";

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (internalPw) headers['X-App-Password'] = internalPw;

      const r = await fetch('/api/gemini', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          // 모델은 서버에서 기본값(GEMINI_MODEL_DEFAULT)을 사용합니다.
          // 필요하면 여기서 model을 넘길 수 있어요. (예: 'gemini-2.5-flash')
          systemInstruction
        })
      });

      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 401) {
          setInsight('사내 비밀번호가 필요합니다. 상단에서 비밀번호를 입력해주세요.');
          return;
        }
        const msg = json?.message || json?.error || '오류 발생';
        setInsight(String(msg));
        return;
      }

      // 클린업: 혹시라도 포함된 <br> 태그를 실제 줄바꿈으로 변환
      const cleanedText = String(json?.text || '').replace(/<br\s*\/?>/gi, '\n');
      setInsight(cleanedText || '답변 생성 불가');
    } catch (err) {
      setInsight('오류 발생');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 p-2.5 rounded-xl"><Sparkles className="text-blue-500" size={20} /></div>
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

          {/* Internal access gate (optional): only enforced when INTERNAL_APP_PASSWORD is set on the server */}
          {!internalPw && (
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
              <div className="text-[11px] font-black text-slate-300 mb-2">사내 전용 비밀번호</div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={pwInput}
                  onChange={(e) => setPwInput(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
                />
                <button
                  onClick={() => {
                    const v = pwInput.trim();
                    if (!v) return;
                    try { sessionStorage.setItem('internal_app_pw', v); } catch {}
                    setInternalPw(v);
                    setPwInput('');
                  }}
                  className="bg-slate-800 border border-slate-700 px-4 py-2.5 rounded-xl text-xs font-black text-slate-200 hover:border-blue-500"
                >
                  저장
                </button>
              </div>
              <div className="mt-2 text-[10px] text-slate-500">
                * 배포 환경에서 INTERNAL_APP_PASSWORD를 설정한 경우에만 필요합니다.
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
              <input 
                type="text" value={userQuery} onChange={(e) => setUserQuery(e.target.value)}
                placeholder="매출 추이나 원가율에 대해 질문하세요..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
              />
            </div>
            <button onClick={() => handleAskAI()} disabled={loading || !userQuery.trim()} className="bg-blue-600 p-3 rounded-xl text-white">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {["매출 상위권 특징은?", "원가율 개선 방안", "포장 비중 확대 전략"].map(suggestion => (
              <button key={suggestion} onClick={() => { setUserQuery(suggestion); handleAskAI(suggestion); }} className="text-[10px] font-black bg-slate-800 text-slate-400 px-3 py-1.5 rounded-lg border border-slate-700 hover:text-blue-400 transition-all">
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
    </div>
  );
};

export default AIInsights;
