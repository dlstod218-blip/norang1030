
export interface RawSalesData {
  storeName: string;
  managerName: string;
  region: string;
  date: string;
  channel: string;
  amount: number;
  orderCount: number;
}

export type UserRole = 'ADMIN' | 'USER';

export interface UserAccount {
  id: string;
  name: string;
  password: string;
  role: UserRole;
}

export type TimeView = 'day' | 'week' | 'month' | 'year';

export interface ChannelGroup {
  name: string;
  keywords: string[];
  type: 'total' | 'platform' | 'takeout' | 'calculated' | 'material' | 'procurement';
}

export const CHANNEL_GROUPS: ChannelGroup[] = [
  { name: '총매출', keywords: ['일매출', '총매출', '전체매출', 'total'], type: 'total' },
  { name: '배민1', keywords: ['배민1', 'baemin1', '배민one', '배민원'], type: 'platform' },
  { name: '배민', keywords: ['배달의민족', '배민배달', '배민'], type: 'platform' },
  { name: '요기배달', keywords: ['요기배달'], type: 'platform' },
  { name: '요기요', keywords: ['요기요', 'yogiyo'], type: 'platform' },
  { name: '쿠팡이츠', keywords: ['쿠팡이츠', '쿠팡', 'coupang'], type: 'platform' },
  { name: '위메프오', keywords: ['위메프오', '위메프', 'wemakeprice'], type: 'platform' },
  { name: '땡겨요', keywords: ['땡겨요', 'ddangyo'], type: 'platform' },
  { name: '먹깨비', keywords: ['먹깨비', 'mukkebi'], type: 'platform' },
  { name: '자사앱', keywords: ['자사앱', '자체앱'], type: 'platform' },
  { name: '전화', keywords: ['전화', '콜주문'], type: 'platform' },
  { name: '포장', keywords: ['포장', '테이크아웃', 'takeout'], type: 'takeout' },
  { name: '내점', keywords: ['내점', '홀', '다이닝'], type: 'calculated' },
  { name: '절단육', keywords: ['절단육'], type: 'material' },
  { name: '순살(800g)', keywords: ['정육800g', '순살800g'], type: 'material' },
  { name: '콤보', keywords: ['콤보'], type: 'material' },
  { name: '순살(600g)', keywords: ['정육600g', '순살600g'], type: 'material' },
  { name: '근위', keywords: ['근위'], type: 'material' },
  { name: '전용유', keywords: ['전용유', '식용유', '오일', 'oil', '튀김유'], type: 'material' },
  { name: '부자재', keywords: ['부자재', '소모품', '박스', '비닐', 'sub'], type: 'material' },
  { name: '발주', keywords: ['발주', '총발주', '매입', 'procurement'], type: 'procurement' }
];

export const normalizeChannel = (channel: string): string => {
  if (!channel) return '기타';
  const cleanName = channel.trim().toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  for (const group of CHANNEL_GROUPS) {
    for (const keyword of group.keywords) {
      const cleanKeyword = keyword.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
      if (cleanName.includes(cleanKeyword)) return group.name;
    }
  }
  return channel.trim() || '기타 플랫폼';
};

export const getChannelType = (channelName: string): 'total' | 'platform' | 'takeout' | 'calculated' | 'material' | 'procurement' => {
  const group = CHANNEL_GROUPS.find(g => g.name === channelName);
  return group ? group.type : 'platform';
};

export interface SharedNote {
  content: string;
  updatedAt: number;
  author?: string;
}

export interface SharedPnL {
  personnel: { staff: number; partTimer: number };
  sga: Record<string, number>;
  updatedAt: number;
}
