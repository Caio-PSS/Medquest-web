import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart, LineChart, PieChart } from '../components/Charts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

type TimeRange = 'day' | 'week' | 'month' | 'year' | 'custom';

interface StatsFilters {
  range: TimeRange;
  startDate?: Date;
  endDate?: Date;
}

interface OverviewStats {
  total_questoes_respondidas: number;
  total_acertos: number;
  total_erros: number;
  percentual_acertos: string;
  tempo_medio_resposta: string;
}

interface CategoryProgress {
  categoria: string;
  total_respondidas: number;
  total_corretas: number;
  percentual_acerto: string;
}

interface TimelineData {
  date: string;
  correct: number;
  incorrect: number;
}

const Stats = () => {
  const { authToken } = useAuth();
  const [overviewData, setOverviewData] = useState<OverviewStats | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryProgress[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineData[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async (filters: StatsFilters) => {
    try {
      const params = new URLSearchParams({
        range: filters.range,
        ...(filters.startDate && { start: filters.startDate.toISOString() }),
        ...(filters.endDate && { end: filters.endDate.toISOString() }),
      });

      const [overviewRes, categoryRes, timelineRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/api/stats/overview?${params}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${process.env.REACT_APP_API_URL}/api/stats/categories?${params}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${process.env.REACT_APP_API_URL}/api/stats/timeline?${params}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        })
      ]);

      const overview = await overviewRes.json();
      const categories = await categoryRes.json();
      const timeline = await timelineRes.json();

      setOverviewData(overview);
      setCategoryData(categories);
      setTimelineData(timeline);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    
    const filters: StatsFilters = {
      range: timeRange,
      ...(timeRange === 'custom' && { startDate, endDate }),
    };
    
    fetchData(filters);
  }, [authToken, timeRange, startDate, endDate, fetchData]);

  const StatCard = ({ title, value, icon }: { title: string; value: string | number; icon: string }) => (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between mb-8 gap-4">
        <h1 className="text-3xl font-bold">Estatísticas Detalhadas</h1>
        
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            {['day', 'week', 'month', 'year', 'custom'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range as TimeRange)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {{
                  day: 'Diário',
                  week: 'Semanal',
                  month: 'Mensal',
                  year: 'Anual',
                  custom: 'Personalizado',
                }[range]}
              </button>
            ))}
          </div>

          {timeRange === 'custom' && (
            <div className="flex gap-2">
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => date && setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                className="p-2 border rounded w-32"
              />
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => date && setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
                className="p-2 border rounded w-32"
              />
            </div>
          )}
        </div>
      </div>

      <div className="tabs mb-8">
        {['overview', 'categories', 'timeline'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 mr-4 transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-blue-500'
            }`}
          >
            {{
              overview: 'Visão Geral',
              categories: 'Por Categoria',
              timeline: 'Linha do Tempo',
            }[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && overviewData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-6 rounded-xl shadow h-96">
            <PieChart
              data={{
                labels: ['Acertos', 'Erros'],
                datasets: [{
                  data: [overviewData.total_acertos, overviewData.total_erros],
                  backgroundColor: ['#4CAF50', '#F44336'],
                }]
              }}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              title="Total de Questões"
              value={overviewData.total_questoes_respondidas}
              icon="📚"
            />
            <StatCard
              title="Taxa de Acerto"
              value={overviewData.percentual_acertos}
              icon="🎯"
            />
            <StatCard
              title="Tempo Médio"
              value={`${overviewData.tempo_medio_resposta}s`}
              icon="⏱️"
            />
            {categoryData[0] && (
              <StatCard
                title="Melhor Categoria"
                value={categoryData[0].categoria}
                icon="🏆"
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="bg-white p-6 rounded-xl shadow h-96">
          <BarChart
            data={{
              labels: categoryData.map(d => d.categoria),
              datasets: [{
                label: 'Taxa de Acerto (%)',
                data: categoryData.map(d => parseFloat(d.percentual_acerto)),
                backgroundColor: '#3B82F6',
              }]
            }}
          />
        </div>
      )}

      {activeTab === 'timeline' && timelineData.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow h-96">
          <LineChart
            data={{
              labels: timelineData.map(d => d.date),
              datasets: [{
                label: 'Acertos',
                data: timelineData.map(d => d.correct),
                borderColor: '#4CAF50',
                tension: 0.1
              }, {
                label: 'Erros',
                data: timelineData.map(d => d.incorrect),
                borderColor: '#F44336',
                tension: 0.1
              }]
            }}
            options={{
              scales: {
                x: {
                  time: {
                    unit: timeRange === 'custom' ? 'day' : timeRange
                  }
                }
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Stats;