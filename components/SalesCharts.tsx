
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, Cell, PieChart, Pie 
} from 'recharts';
import { RawSalesData, normalizeChannel, getChannelType } from '../types';
import { format, parseISO, isValid, startOfWeek, startOfMonth, differenceInDays } from 'date-fns';

interface Props {
  data: RawSalesData[];
  startDate: string;
  endDate: string;
}

const SalesCharts: React.FC<Props> = ({ data, startDate, endDate }) => {
  const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e', '#14b8a6'];
  const IN_STORE_COLOR = '#475569';
  const TAKEOUT_COLOR = '#fb7185';

  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
  }, [startDate, endDate]);

  const { processedData, platformsFound } = useMemo(() => {
    const rawMap: Record<string, Record<string, any>> = {};
    const platformSet = new Set<string>();

    data.forEach(d => {
      const date = parseISO(d.date);
      if (!isValid(date)) return;

      let timeKey = '';
      if (durationDays <= 31) {
        timeKey = format(date, 'MM/dd');
      } else if (durationDays <= 180) {
        timeKey = format(startOfWeek(date, { weekStartsOn: 1 }), 'MM/dd w주');
      } else {
        timeKey = format(startOfMonth(date), 'yyyy/MM');
      }

      if (!rawMap[timeKey]) rawMap[timeKey] = { inStore: 0, takeout: 0 };
      
      const normChan = normalizeChannel(d.channel);
      const type = getChannelType(normChan);
      
      if (type === 'platform') {
        platformSet.add(normChan);
        if (!rawMap[timeKey][normChan]) rawMap[timeKey][normChan] = 0;
        rawMap[timeKey][normChan] += d.amount;
      } else if (normChan === '내점') {
        rawMap[timeKey].inStore += d.amount;
      } else if (type === 'takeout') {
        rawMap[timeKey].takeout += d.amount;
      }
    });

    const platforms = Array.from(platformSet);
    const chartData = Object.entries(rawMap).map(([name, values]) => {
      let total = values.inStore || 0;
      platforms.forEach(p => { total += (values[p] || 0); });
      return { name, total, ...values };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return { processedData: chartData, platformsFound: platforms };
  }, [data, durationDays]);

  const pieData = useMemo(() => {
    if (processedData.length === 0) return [];
    let totalPlatforms = 0;
    let totalInStore = 0;
    let totalTakeout = 0;
    (processedData as any[]).forEach(d => {
      totalInStore += (d.inStore || 0);
      totalTakeout += (d.takeout || 0);
      platformsFound.forEach(p => { totalPlatforms += (d[p] || 0); });
    });
    const total = totalPlatforms + totalInStore + totalTakeout;
    return [
      { name: '배달 플랫폼', value: totalPlatforms, total },
      { name: '내점 매출', value: totalInStore, total },
      { name: '포장 매출', value: totalTakeout, total }
    ];
  }, [processedData, platformsFound]);

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Find the "total" for this specific bar (X-axis point)
      const dataPoint = payload[0].payload;
      const totalForPoint = dataPoint.total + (dataPoint.takeout || 0);
      
      return (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shadow-2xl">
          <p className="text-xs font-black text-slate-400 mb-3 border-b border-slate-800 pb-2">{label}</p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => {
              const percentage = totalForPoint > 0 ? ((entry.value / totalForPoint) * 100).toFixed(1) : '0.0';
              return (
                <div key={index} className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                    <span className="text-[11px] font-bold text-slate-300">{entry.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-black text-white">{entry.value.toLocaleString()}원</span>
                    <span className="text-[9px] font-bold text-slate-500 ml-1.5">({percentage}%)</span>
                  </div>
                </div>
              );
            })}
            <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center">
              <span className="text-[11px] font-black text-slate-200">합계</span>
              <span className="text-[11px] font-black text-blue-400">{totalForPoint.toLocaleString()}원</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const { name, value, total } = payload[0].payload;
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
      return (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill }}></div>
            <span className="text-[11px] font-bold text-slate-300">{name}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-black text-white">{value.toLocaleString()}원</span>
            <span className="text-[11px] font-black text-blue-400">{percentage}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-xl min-h-[500px]">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div> 채널별 매출 추이 ({durationDays}일 기준 자동 그룹화)
            </h3>
            <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tight">
              {durationDays <= 31 ? '일별 데이터' : durationDays <= 180 ? '주별 데이터' : '월별 데이터'} 기반 분석 (툴팁에서 비중 확인 가능)
            </p>
          </div>
        </div>
        
        <div className="h-[380px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `${(val / 10000).toLocaleString()}만`} />
              <Tooltip cursor={{ fill: '#ffffff05' }} content={<CustomBarTooltip />} />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '30px', fontSize: '11px', fontWeight: 'bold' }} />
              <Bar name="내점" dataKey="inStore" stackId="mainSales" fill={IN_STORE_COLOR} radius={[0, 0, 0, 0]} maxBarSize={45} />
              {platformsFound.map((platform, index) => (
                <Bar key={platform} name={platform} dataKey={platform} stackId="mainSales" fill={PALETTE[index % PALETTE.length]} radius={index === platformsFound.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} maxBarSize={45} />
              ))}
              <Bar name="포장(독립)" dataKey="takeout" fill={TAKEOUT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={15} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-xl flex flex-col min-h-[500px]">
        <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2">
          <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div> 통합 채널 비중
        </h3>
        <p className="text-[10px] font-black text-slate-500 mb-8 uppercase tracking-[0.2em]">전체 선택 기간 요약</p>
        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={pieData} 
                cx="50%" 
                cy="45%" 
                innerRadius={80} 
                outerRadius={115} 
                paddingAngle={8} 
                dataKey="value" 
                stroke="none"
                labelLine={false}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, value, total }) => {
                  const RADIAN = Math.PI / 180;
                  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(0) : '0';
                  if (parseInt(percentage) < 5) return null;
                  return (
                    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px] font-black">
                      {percentage}%
                    </text>
                  );
                }}
              >
                {pieData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={[PALETTE[0], IN_STORE_COLOR, TAKEOUT_COLOR][index % 3]} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
              <Legend verticalAlign="bottom" wrapperStyle={{ fontWeight: 'bold', fontSize: '11px', color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SalesCharts;
