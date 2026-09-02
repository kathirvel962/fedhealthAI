import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { medicalTheme } from './MedicalTheme';

export default function SymptomDistributionVisualization({ patients = [] }) {
  const data = useMemo(() => {
    if (!patients || patients.length === 0) {
      return [];
    }

    const diagnoses = {};
    patients.forEach(patient => {
      const diagnosis = patient.disease_label || 'Unknown';
      diagnoses[diagnosis] = (diagnoses[diagnosis] || 0) + 1;
    });

    return Object.entries(diagnoses)
      .map(([name, count]) => ({
        name,
        value: count,
        percentage: ((count / patients.length) * 1500 / 15).toFixed(1) // accurate percentage
      }))
      .map(item => ({
        ...item,
        percentage: ((item.value / patients.length) * 100).toFixed(1)
      }))
      .sort((a, b) => b.value - a.value);
  }, [patients]);

  const colors = [
    '#0EA5E9', // Cyan/Sky blue
    '#10B981', // Emerald
    '#6366F1', // Indigo
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 rounded-lg shadow border bg-white border-gray-150">
          <p className="font-semibold text-xs text-gray-800">{payload[0].name}</p>
          <p className="text-xs text-gray-650">{payload[0].value} cases ({payload[0].payload.percentage}%)</p>
        </div>
      );
    }
    return null;
  };

  const totalCases = patients.length;
  const totalDiseases = data.length;
  const mostCommon = data[0]?.name || 'N/A';

  return (
    <div className="rounded-2xl shadow-sm border border-gray-100 bg-white p-6 h-full flex flex-col justify-between">
      <div>
        <h3 className="text-base font-bold text-gray-900 mb-1">Disease Distribution</h3>
        
        <div className="grid grid-cols-12 gap-2 mt-4 items-center">
          {/* Pie Chart Column */}
          <div className="col-span-5 h-[160px] flex items-center justify-center">
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-gray-400">No chart data</p>
            )}
          </div>

          {/* Table Column */}
          <div className="col-span-7">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-450 border-b border-gray-100">
                  <th className="pb-1.5 text-left font-bold uppercase tracking-wider">Disease</th>
                  <th className="pb-1.5 text-right font-bold uppercase tracking-wider">Cases</th>
                  <th className="pb-1.5 text-right font-bold uppercase tracking-wider">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.slice(0, 6).map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="py-1 flex items-center gap-1.5 font-medium text-gray-700">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: colors[idx % colors.length] }}></span>
                      <span className="truncate max-w-[90px]">{item.name}</span>
                    </td>
                    <td className="py-1 text-right text-gray-600 font-semibold">{item.value}</td>
                    <td className="py-1 text-right text-gray-800 font-bold">{item.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom metrics row */}
      <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-5 mt-5">
        <div className="p-2 border border-gray-100 rounded-xl text-center bg-gray-50/20">
          <p className="text-[10px] text-gray-550 font-semibold mb-0.5">Total Cases</p>
          <p className="text-sm font-bold text-gray-900">{totalCases}</p>
        </div>
        <div className="p-2 border border-gray-100 rounded-xl text-center bg-gray-50/20">
          <p className="text-[10px] text-gray-550 font-semibold mb-0.5">Total Diseases</p>
          <p className="text-sm font-bold text-gray-900">{totalDiseases}</p>
        </div>
        <div className="p-2 border border-gray-100 rounded-xl text-center bg-gray-50/20">
          <p className="text-[10px] text-gray-550 font-semibold mb-0.5">Most Common</p>
          <p className="text-xs font-bold text-gray-900 truncate mt-0.5">{mostCommon}</p>
        </div>
      </div>
    </div>
  );
}
