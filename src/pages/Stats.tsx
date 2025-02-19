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

  // Estados para loading e erros
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (filters: StatsFilters) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        range: filters.range,
        ...(filters.startDate && { start: filters.startDate.toISOString() }),
        ...(filters.endDate && { end: filters.endDate.toISOString() }),
      });

      const [overviewRes, categoryRes, timelineRes] = await Promise.all([
        fetch(`https://medquest-floral-log-224.fly.dev/api/stats/overview?${params}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`https://medquest-floral-log-224.fly.dev/api/stats/categories?${params}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`https://medquest-floral-log-224.fly.dev/api/stats/timeline?${params}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);

      if (!overviewRes.ok || !categoryRes.ok || !timelineRes.ok) {
        throw new Error('Erro ao buscar dados. Verifique sua conexão ou tente novamente.');
      }

      const overview = await overviewRes.json();
      const categories = await categoryRes.json();
      const timeline = await timelineRes.json();

      setOverviewData(overview);
      setCategoryData(categories);
      setTimelineData(timeline);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Erro desconhecido ao buscar dados');
    } finally {
      setLoading(false);
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

  // Função para gerar e baixar o relatório em CSV
  const downloadReport = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Overview Stats\n';
    csvContent += 'Total Questões Respondidas,Total Acertos,Total Erros,Percentual Acertos,Tempo Médio Resposta\n';
    if (overviewData) {
      csvContent += `${overviewData.total_questoes_respondidas},${overviewData.total_acertos},${overviewData.total_erros},${overviewData.percentual_acertos},${overviewData.tempo_medio_resposta}\n\n`;
    }
    csvContent += 'Categories\n';
    csvContent += 'Categoria,Total Respondidas,Total Corretas,Percentual Acerto\n';
    categoryData.forEach((cat) => {
      csvContent += `${cat.categoria},${cat.total_respondidas},${cat.total_corretas},${cat.percentual_acerto}\n`;
    });
    csvContent += '\nTimeline\n';
    csvContent += 'Data,Acertos,Erros\n';
    timelineData.forEach((item) => {
      csvContent += `${item.date},${item.correct},${item.incorrect}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'medquest_stats_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Componente para exibir os cards de estatísticas
  const StatCard = ({ title, value, icon }: { title: string; value: string | number; icon: string }) => (
    <div className="p-4 bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">{icon}</span>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Cabeçalho com título e botão para baixar relatório */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold">Estatísticas Detalhadas</h1>
        <button 
          onClick={downloadReport} 
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          aria-label="Baixar relatório em CSV"
        >
          Baixar Relatório (CSV)
        </button>
      </div>

      {/* Filtros de período */}
      <div className="flex flex-col md:flex-row justify-between mb-8 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            {(['day', 'week', 'month', 'year', 'custom'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
                aria-label={`Filtrar por ${range}`}
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
            <div className="flex gap-2 mt-2">
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => date && setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                className="p-2 border rounded w-32"
                aria-label="Data de início"
              />
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => date && setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
                className="p-2 border rounded w-32"
                aria-label="Data de fim"
              />
            </div>
          )}
        </div>
      </div>

      {/* Mensagem de erro (se houver) */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
          <button 
            onClick={() => fetchData({ range: timeRange, ...(timeRange === 'custom' && { startDate, endDate }) })}
            className="ml-4 underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Spinner de loading */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" aria-label="Carregando..."></div>
        </div>
      ) : (
        <>
          {/* Abas para selecionar a visualização dos dados */}
          <div className="tabs mb-8 border-b">
            {(['overview', 'categories', 'timeline'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 mr-4 transition-colors focus:outline-none ${
                  activeTab === tab
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-blue-500'
                }`}
                aria-label={`Exibir ${tab}`}
              >
                {{
                  overview: 'Visão Geral',
                  categories: 'Por Categoria',
                  timeline: 'Linha do Tempo',
                }[tab]}
              </button>
            ))}
          </div>

          {/* Visualização "Visão Geral" */}
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
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'bottom' }
                    }
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

          {/* Visualização "Por Categoria" */}
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
                options={{
                  responsive: true,
                  scales: { y: { beginAtZero: true } }
                }}
              />
            </div>
          )}

          {/* Visualização "Linha do Tempo" */}
          {activeTab === 'timeline' && timelineData.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow h-96">
              <LineChart
                data={{
                  labels: timelineData.map(d => d.date),
                  datasets: [{
                    label: 'Acertos',
                    data: timelineData.map(d => d.correct),
                    borderColor: '#4CAF50',
                    tension: 0.1,
                    fill: false,
                  }, {
                    label: 'Erros',
                    data: timelineData.map(d => d.incorrect),
                    borderColor: '#F44336',
                    tension: 0.1,
                    fill: false,
                  }]
                }}
                options={{
                  responsive: true,
                  scales: {
                    x: {
                      type: 'time',
                      time: { unit: timeRange === 'custom' ? 'day' : timeRange },
                      title: { display: true, text: 'Data' },
                    },
                    y: {
                      beginAtZero: true,
                      title: { display: true, text: 'Quantidade' },
                    },
                  },
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Stats;
