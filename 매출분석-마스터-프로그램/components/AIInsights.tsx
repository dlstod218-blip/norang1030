
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, Send, MessageCircle, Lightbulb, X, ChevronDown, ShieldCheck } from 'lucide-react';
import { RawSalesData } from '../types';
import { AIService } from '../services/aiService';

interface Props {
  data: RawSalesData[];
}

const AIInsights: React.FC<Props> = ({ data }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const responseRef = useRef<HTMLDivElement>(null);

  const quickQuestions = [
    "내점과 포장 매출 비중 분석",
    "가장 높은 객단가 채널 찾기",
    "매출 증대 전략 제안",
    "담당자 성과 원인 분석"
  ];

  useEffect(() => {
    if (insight && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [insight]);

  const handleAskAI = async (query: string = userQuery) => {
    if (!query.trim() || data.length === 0) return;
    
    setLoading(true);
    setLoadingStep('데이터 요약 및 보안 검사 중...');
    setInsight(null);
    
    try {
      setLoadingStep('AI 컨설턴트 분석 중...');
      const result = await AIService.getStrategyInsights(data, query);
      setInsight(result || '분석 결과가 없습니다.');
      setUserQuery('');
    } catch (error) {
      setInsight('AI 서비스 호출 중 오류가 발생했습니다. 백엔드 연결 상태를 확인하세요.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="bg-slate-900 rounded-[40px] p-6 md:p-10 text-white shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] -mr-40 -mt-40"></div>
      
      <div className="relative z-10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-lg">
              <MessageCircle className="text-white w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black">AI 전략 분석 센터</h3>
                <span className="flex items-center gap-1 text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                  <ShieldCheck size={10} /> 보안 모드
                </span>
              </div>
              <p className="text-slate-400 text-xs font-bold">프라이빗 서비스 레이어를 통한 정밀 분석</p>
            </div>
          </div>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            <ChevronDown className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {isExpanded && (
          <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
            <div className="space-y-4">
              <div className="relative">
                <input 
                  type="text" 
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                  placeholder="예: 이번 달 내점 건수 비중 분석해줘"
                  className="w-full bg-slate-800/80 border-2 border-slate-700 rounded-[24px] pl-6 pr-20 py-5 md:py-6 text-base font-bold focus:border-blue-500 outline-none transition-all"
                />
                <button 
                  onClick={() => handleAskAI()}
                  disabled={loading || !userQuery.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 p-4 rounded-2xl shadow-xl disabled:bg-slate-700 transition-all"
                >
                  {loading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {quickQuestions.map((q, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleAskAI(q)}
                    disabled={loading}
                    className="px-4 py-2 bg-slate-800/60 hover:bg-slate-700 border border-slate-700 rounded-xl text-[11px] font-black text-slate-400 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {(insight || loading) && (
              <div ref={responseRef} className="bg-slate-800/50 rounded-[32px] border border-slate-700/50 p-6 md:p-8 animate-in fade-in duration-500">
                <div className="flex items-start gap-4">
                  <div className="bg-amber-500/20 p-2.5 rounded-xl flex-shrink-0">
                    <Lightbulb size={24} className="text-amber-500" />
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3">
                      {loading ? loadingStep : 'Consulting Report'}
                    </p>
                    {loading ? (
                      <div className="space-y-3 py-4">
                        <div className="h-4 w-3/4 bg-slate-700/50 rounded-full animate-pulse"></div>
                        <div className="h-4 w-full bg-slate-700/50 rounded-full animate-pulse"></div>
                        <div className="h-4 w-2/3 bg-slate-700/50 rounded-full animate-pulse"></div>
                      </div>
                    ) : (
                      <div className="text-slate-200 text-base leading-relaxed font-medium whitespace-pre-wrap">
                        {insight}
                      </div>
                    )}
                  </div>
                  {insight && (
                    <button onClick={() => setInsight(null)} className="text-slate-500 hover:text-white">
                      <X size={20} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsights;
