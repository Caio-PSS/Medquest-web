import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart, LineChart, PieChart, ScatterChart } from '../components/Charts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

type TimeRange = 'day' | 'week' | 'month' | 'semestre' | 'year' | 'custom';

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
  avg_time: number;
}

interface SubareaProgress {
  categoria: string;
  subarea: string;
  total_respondidas: number;
  total_corretas: number;
  percentual_acerto: string;
}

const Stats = () => {
  const { authToken } = useAuth();
  const [overviewData, setOverviewData] = useState<OverviewStats | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryProgress[]>([]);
  const [subareaData, setSubareaData] = useState<SubareaProgress[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineData[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'timeVsAccuracy' | 'categories' | 'subareas'>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Função para calcular média móvel (janela de 3 pontos)
  const calculateMovingAverage = (data: number[], windowSize: number): number[] => {
    const averages: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = data.slice(start, i + 1);
      const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
      averages.push(parseFloat(avg.toFixed(2)));
    }
    return averages;
  };

  const fetchData = useCallback(async (filters: StatsFilters) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        range: filters.range,
        ...(filters.startDate && { start: filters.startDate.toISOString() }),
        ...(filters.endDate && { end: filters.endDate.toISOString() }),
      });
      
      // Buscando overview, categorias, subáreas e timeline em paralelo
      const [overviewRes, categoryRes, subareaRes, timelineRes] = await Promise.all([
        fetch(`https://medquest-floral-log-224.fly.dev/api/stats/overview?${params}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`https://medquest-floral-log-224.fly.dev/api/stats/categories?${params}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`https://medquest-floral-log-224.fly.dev/api/stats/subareas?${params}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`https://medquest-floral-log-224.fly.dev/api/stats/timeline?${params}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);

      if (!overviewRes.ok || !categoryRes.ok || !subareaRes.ok || !timelineRes.ok) {
        throw new Error('Erro ao buscar dados. Verifique sua conexão ou tente novamente.');
      }

      const overview = await overviewRes.json();
      const categories = await categoryRes.json();
      const subareas = await subareaRes.json();
      const timeline = await timelineRes.json();

      setOverviewData(overview);
      setCategoryData(categories);
      setSubareaData(subareas);
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

  // Cálculo do percentual de acerto para cada data da timeline
  const timelinePercentageData = timelineData.map(d => {
    const total = d.correct + d.incorrect;
    return total ? parseFloat(((d.correct / total) * 100).toFixed(2)) : 0;
  });

  // Cálculo dos melhores e piores desempenhos por subárea (geral)
  let bestSubarea: SubareaProgress | null = null;
  let worstSubarea: SubareaProgress | null = null;
  if (subareaData && subareaData.length > 0) {
    bestSubarea = subareaData.reduce((prev, curr) => {
      const prevPct = parseFloat(prev.percentual_acerto.replace('%', ''));
      const currPct = parseFloat(curr.percentual_acerto.replace('%', ''));
      return currPct > prevPct ? curr : prev;
    });
    worstSubarea = subareaData.reduce((prev, curr) => {
      const prevPct = parseFloat(prev.percentual_acerto.replace('%', ''));
      const currPct = parseFloat(curr.percentual_acerto.replace('%', ''));
      return currPct < prevPct ? curr : prev;
    });
  }

  // Função para gerar e baixar relatório CSV
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
    csvContent += '\nSubareas\n';
    csvContent += 'Categoria,Subárea,Total Respondidas,Total Corretas,Percentual Acerto\n';
    subareaData.forEach((sub) => {
      csvContent += `${sub.categoria},${sub.subarea},${sub.total_respondidas},${sub.total_corretas},${sub.percentual_acerto}\n`;
    });
    csvContent += '\nTimeline\n';
    csvContent += 'Data,Acertos,Erros,Tempo Médio\n';
    timelineData.forEach((item) => {
      csvContent += `${item.date},${item.correct},${item.incorrect},${item.avg_time}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'medquest_stats_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Componente para exibir cartões de estatísticas
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
      {/* Cabeçalho */}
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

      {/* Filtros de Período */}
      <div className="flex flex-col md:flex-row justify-between mb-8 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            {(['day', 'week', 'month', 'semestre', 'year', 'custom'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => { setTimeRange(range); setSelectedCategory(null); }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
                aria-label={`Filtrar por ${range}`}
              >
                {({
                  day: 'Diário',
                  week: 'Semanal',
                  month: 'Mensal',
                  semestre: 'Semestral',
                  year: 'Anual',
                  custom: 'Personalizado',
                }[range])}
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

      {/* Painel de Número de Questões Realizadas */}
      {overviewData && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold">Questões Realizadas</h2>
          <div className="mt-4">
            <StatCard
              title="Total de Questões"
              value={overviewData.total_questoes_respondidas}
              icon="📚"
            />
          </div>
        </div>
      )}

      {/* Exibição de Erros */}
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

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" aria-label="Carregando..."></div>
        </div>
      ) : (
        <>
          {/* Abas de Navegação */}
          <div className="tabs mb-8 border-b">
            {(['overview', 'timeline', 'timeVsAccuracy', 'categories', 'subareas'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedCategory(null); }}
                className={`px-4 py-2 mr-4 transition-colors focus:outline-none ${
                  activeTab === tab
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-blue-500'
                }`}
                aria-label={`Exibir ${tab}`}
              >
                {{
                  overview: 'Visão Geral',
                  timeline: 'Linha do Tempo',
                  timeVsAccuracy: 'Tempo vs Acerto',
                  categories: 'Por Categoria',
                  subareas: 'Por Subárea'
                }[tab]}
              </button>
            ))}
          </div>

          {/* Conteúdo das Abas */}
          {activeTab === 'overview' && overviewData && (
            <>
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
                      plugins: { legend: { position: 'bottom' } }
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
              {subareaData.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {bestSubarea && (
                    <StatCard
                      title="Melhor Subárea"
                      value={`${bestSubarea.subarea} (${bestSubarea.percentual_acerto})`}
                      icon="🚀"
                    />
                  )}
                  {worstSubarea && (
                    <StatCard
                      title="Pior Subárea"
                      value={`${worstSubarea.subarea} (${worstSubarea.percentual_acerto})`}
                      icon="⚠️"
                    />
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'timeline' && timelineData.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow h-96">
              <LineChart
                data={{
                  labels: timelineData.map(d => d.date),
                  datasets: [
                    {
                      label: 'Taxa de Acerto (%)',
                      data: timelinePercentageData,
                      borderColor: '#4CAF50',
                      tension: 0.1,
                      fill: false,
                    },
                    {
                      label: 'Tendência',
                      data: calculateMovingAverage(timelinePercentageData, 3),
                      borderColor: '#3B82F6',
                      borderDash: [5, 5],
                      tension: 0.1,
                      fill: false,
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  scales: {
                    x: {
                      type: 'time',
                      time: { 
                        unit: timeRange === 'custom' ? 'day' : (timeRange === 'semestre' ? 'month' : timeRange)
                      },
                      title: { display: true, text: 'Data' },
                    },
                    y: {
                      beginAtZero: true,
                      title: { display: true, text: 'Taxa de Acerto (%)' },
                    },
                  },
                }}
              />
            </div>
          )}

          {activeTab === 'timeVsAccuracy' && timelineData.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow h-96">
              <ScatterChart
                data={{
                  datasets: [{
                    label: 'Tempo vs Taxa de Acerto',
                    data: timelineData.map(d => {
                      const total = d.correct + d.incorrect;
                      const percentage = total ? ((d.correct / total) * 100) : 0;
                      return { x: d.avg_time, y: percentage };
                    }),
                    backgroundColor: '#FF9800'
                  }]
                }}
                options={{
                  responsive: true,
                  scales: {
                    x: {
                      title: { display: true, text: 'Tempo Médio (s)' },
                    },
                    y: {
                      title: { display: true, text: 'Taxa de Acerto (%)' }
                    }
                  }
                }}
              />
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="bg-white p-6 rounded-xl shadow">
              {!selectedCategory ? (
                <>
                  <BarChart
                    data={{
                      labels: categoryData.map(d => d.categoria),
                      datasets: [{
                        label: 'Taxa de Acerto (%)',
                        data: categoryData.map(d => parseFloat(d.percentual_acerto.replace('%', ''))),
                        backgroundColor: '#3B82F6',
                      }]
                    }}
                    options={{
                      responsive: true,
                      scales: { y: { beginAtZero: true } }
                    }}
                  />
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {categoryData.map((cat) => (
                      <div
                        key={cat.categoria}
                        className="cursor-pointer p-4 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                        onClick={() => setSelectedCategory(cat.categoria)}
                      >
                        <p className="font-semibold">{cat.categoria}</p>
                        <p>Taxa: {cat.percentual_acerto}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Subáreas de {selectedCategory}</h2>
                  <BarChart
                    data={{
                      labels: subareaData
                        .filter(s => s.categoria === selectedCategory)
                        .map(d => d.subarea),
                      datasets: [{
                        label: 'Taxa de Acerto (%)',
                        data: subareaData
                          .filter(s => s.categoria === selectedCategory)
                          .map(d => parseFloat(d.percentual_acerto.replace('%', ''))),
                        backgroundColor: '#4CAF50'
                      }]
                    }}
                    options={{
                      responsive: true,
                      scales: { y: { beginAtZero: true } }
                    }}
                  />
                  <button onClick={() => setSelectedCategory(null)} className="mt-4 px-4 py-2 bg-gray-300 rounded">
                    Voltar
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'subareas' && (
            <div className="bg-white p-6 rounded-xl shadow h-96">
              <BarChart
                data={{
                  labels: subareaData.map(d => d.subarea),
                  datasets: [{
                    label: 'Taxa de Acerto (%)',
                    data: subareaData.map(d => parseFloat(d.percentual_acerto.replace('%', ''))),
                    backgroundColor: '#4CAF50'
                  }]
                }}
                options={{
                  responsive: true,
                  scales: { y: { beginAtZero: true } }
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
