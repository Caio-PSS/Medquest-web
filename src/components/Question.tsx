import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart, LineChart, PieChart } from '../components/Charts';
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
  // Outros dados relevantes podem ser adicionados aqui
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
  // Poderíamos incluir outros dados, se necessário
}

interface SubareaProgress {
  subarea: string;
  total_respondidas: number;
  total_corretas: number;
  percentual_acerto: string;
}

// Componente para exibir os timers com um design moderno
const TimerDisplay = ({ label, time }: { label: string; time: number }) => {
  const minutes = Math.floor(time / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (time % 60).toString().padStart(2, '0');

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl shadow-lg">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-2xl font-bold">{minutes}:{seconds}</span>
    </div>
  );
};

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
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'subareas' | 'timeline'>('overview');

  // Estados para loading e erro
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para os timers
  const [questionTime, setQuestionTime] = useState<number>(0);
  const [sessionTime, setSessionTime] = useState<number>(0);

  // Timer de sessão: inicia ao montar o componente
  useEffect(() => {
    const sessionInterval = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(sessionInterval);
  }, []);

  // Timer de questão: incrementa a cada segundo
  useEffect(() => {
    const questionInterval = setInterval(() => {
      setQuestionTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(questionInterval);
  }, []);

  // Função que simula o envio do tempo da questão para o servidor
  const sendQuestionTime = async (time: number) => {
    // Aqui você pode implementar o envio real para o servidor
    console.log('Enviando tempo da questão para o servidor:', time);
    // Exemplo: await fetch(...);
  };

  // Ao passar para a próxima questão, envia o tempo atual e reinicia o timer
  const handleNextQuestion = async () => {
    await sendQuestionTime(questionTime);
    setQuestionTime(0);
    // Aqui você pode incluir a lógica de navegação para a próxima questão
  };

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
      
      // Buscando dados de overview, categorias, subáreas e timeline em paralelo
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

  // Cálculo dos dados para a linha do tempo: acertos e média móvel (tendência)
  const acertosData = timelineData.map(d => d.correct);
  const trendData = calculateMovingAverage(acertosData, 3);

  // Cálculo dos melhores e piores desempenhos por subárea
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

  // Função para gerar e baixar relatório em CSV
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
    csvContent += 'Subárea,Total Respondidas,Total Corretas,Percentual Acerto\n';
    subareaData.forEach((sub) => {
      csvContent += `${sub.subarea},${sub.total_respondidas},${sub.total_corretas},${sub.percentual_acerto}\n`;
    });
    csvContent += '\nTimeline\n';
    csvContent += 'Data,Acertos\n';
    timelineData.forEach((item) => {
      csvContent += `${item.date},${item.correct}\n`;
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
      {/* Cabeçalho e seção de Timers */}
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

      {/* Seção dos Timers */}
      <div className="flex flex-col md:flex-row items-center justify-end gap-4 mb-6">
        <TimerDisplay label="Tempo da Questão" time={questionTime} />
        <TimerDisplay label="Tempo da Sessão" time={sessionTime} />
        <button 
          onClick={handleNextQuestion} 
          className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition"
          aria-label="Avançar para a próxima questão"
        >
          Próxima Questão
        </button>
      </div>

      {/* Filtros de Período */}
      <div className="flex flex-col md:flex-row justify-between mb-8 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            {(['day', 'week', 'month', 'semestre', 'year', 'custom'] as TimeRange[]).map((range) => (
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
                  semestre: 'Semestral',
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

      {/* Exibição de erros */}
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
          {/* Abas */}
          <div className="tabs mb-8 border-b">
            {(['overview', 'categories', 'subareas', 'timeline'] as const).map((tab) => (
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
                  subareas: 'Por Subárea',
                  timeline: 'Linha do Tempo',
                }[tab]}
              </button>
            ))}
          </div>

          {/* Conteúdo das abas */}
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
              {/* Cartões extras para análise por subárea */}
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

          {activeTab === 'subareas' && (
            <div className="bg-white p-6 rounded-xl shadow h-96">
              <BarChart
                data={{
                  labels: subareaData.map(d => d.subarea),
                  datasets: [
                    {
                      label: 'Acertos',
                      data: subareaData.map(d => d.total_corretas),
                      backgroundColor: '#4CAF50',
                    },
                    {
                      label: 'Erros',
                      data: subareaData.map(d => d.total_respondidas - d.total_corretas),
                      backgroundColor: '#F44336',
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  scales: { y: { beginAtZero: true } }
                }}
              />
            </div>
          )}

          {activeTab === 'timeline' && timelineData.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow h-96">
              <LineChart
                data={{
                    labels: timelineData.map(d => d.date),
                    datasets: [
                      {
                        label: 'Acertos',
                        data: acertosData,
                        borderColor: '#4CAF50',
                        tension: 0.1,
                        fill: false,
                      },
                      {
                        label: 'Tendência',
                        data: trendData,
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
                          unit: timeRange === 'custom' 
                                  ? 'day' 
                                  : (timeRange === 'semestre' ? 'month' : timeRange)
                        },
                        title: { display: true, text: 'Data' },
                      },
                      y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Acertos' },
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
