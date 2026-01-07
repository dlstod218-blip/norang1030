
import { GoogleGenAI, Modality } from "@google/genai";
import { RawSalesData, normalizeChannel, getChannelType } from "../types";

// AI 서비스의 가짜 백엔드 역할을 하는 클래스
export class AIService {
  private static getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  // 1. 대량의 매출 데이터를 AI가 이해하기 쉬운 요약본으로 압축 (비용 절감 핵심)
  private static summarizeSales(data: RawSalesData[]) {
    const summary: any = {
      totalSales: 0,
      totalOrders: 0,
      channels: {} as Record<string, { sales: number; count: number }>,
      stores: {} as Record<string, number>,
      period: { start: "", end: "" }
    };

    if (data.length > 0) {
      summary.period.start = data[0].date;
      summary.period.end = data[data.length - 1].date;
    }

    data.forEach(d => {
      const norm = normalizeChannel(d.channel);
      const type = getChannelType(norm);
      
      if (type === 'platform' || norm === '내점' || type === 'takeout') {
        summary.totalSales += d.amount;
        summary.totalOrders += d.orderCount;
        
        if (!summary.channels[norm]) summary.channels[norm] = { sales: 0, count: 0 };
        summary.channels[norm].sales += d.amount;
        summary.channels[norm].count += d.orderCount;

        if (!summary.stores[d.storeName]) summary.stores[d.storeName] = 0;
        summary.stores[d.storeName] += d.amount;
      }
    });

    // 상위 매출 매장 5개만 선별 (토큰 절약)
    const topStores = Object.entries(summary.stores)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([name, sales]) => `${name}: ${sales.toLocaleString()}원`);

    return `
      분석 기간: ${summary.period.start} ~ ${summary.period.end}
      총 매출: ${summary.totalSales.toLocaleString()}원 (${summary.totalOrders.toLocaleString()}건)
      채널별: ${Object.entries(summary.channels).map(([n, s]: any) => `${n}(${s.sales.toLocaleString()}원)`).join(', ')}
      주요 매장: ${topStores.join(', ')}
    `;
  }

  // 2. 일반 전략 제언 (Gemini 3 사용)
  static async getStrategyInsights(data: RawSalesData[], query: string) {
    const ai = this.getAI();
    const dataSummary = this.summarizeSales(data);

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        [비즈니스 데이터 요약]:
        ${dataSummary}
        
        [사용자 질문]:
        ${query}
        
        당신은 프랜차이즈 전문 경영 컨설턴트입니다. 위 요약 데이터를 바탕으로 질문에 답하세요. 
        데이터에 없는 내용은 추측하지 말고 '제공된 데이터 범위 내에서' 분석하세요.
      `,
      config: {
        systemInstruction: "실무적이고 간결한 한국어 비즈니스 보고서 톤으로 작성하세요.",
        temperature: 0.7,
      }
    });

    return response.text;
  }

  // 3. 상권 분석 (Gemini 2.5 + Maps/Search 도구 사용)
  static async getCommercialAnalysis(location: string, radius: number, storeSummaries: any[]) {
    const ai = this.getAI();
    
    // 위치 정보 가져오기 시도
    let latLng = undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => 
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 2000 })
      );
      latLng = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch (e) {}

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Maps 도구는 2.5 시리즈 필수
      contents: `
        검색 위치: "${location}" 주변 반경 ${radius}km 상권 분석 요청.
        브랜드: "노랑통닭" 가맹점 데이터 분석 포함.
        
        [참고 매장 실적]: ${JSON.stringify(storeSummaries.slice(0, 10))}
        
        위 지역의 인구 통계, 경쟁 브랜드(교촌, bhc 등) 위치, 배달 수요를 분석하여 노랑통닭 출점 또는 운영 전략을 제안하세요.
        필요 시 구글 검색과 지도를 활용하여 최신 데이터를 반영하세요.
      `,
      config: {
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
        toolConfig: {
          retrievalConfig: { latLng: latLng }
        }
      },
    });

    return {
      text: response.text,
      grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  }
}
