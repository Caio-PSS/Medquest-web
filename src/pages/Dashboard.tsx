import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    BookOpen,
    CheckCircle,
    PieChart,
    Clock,
    Trophy,
    Brain,
    Target
} from 'lucide-react';

type StatsType = {
    total: number;
    acertos: number;
    percentual: string;
    tempoMedio: number;
  };

const Dashboard = () => {
    const { authToken, isLoading } = useAuth();
    const [stats, setStats] = useState<StatsType | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
          try {
            const res = await fetch(`https://medquest-floral-log-224.fly.dev//api/stats/overview`, {
              headers: { Authorization: `Bearer ${authToken}` }
            });
            const data = await res.json();
            setStats({
              total: data.total_questoes_respondidas,
              acertos: data.total_acertos,
              percentual: data.percentual_acertos,
              tempoMedio: parseFloat(data.tempo_medio_resposta)
            });
          } catch (error) {
            console.error("Error fetching stats:", error);
          }
        };
      
        if (authToken) {
          fetchStats();
        }
      }, [authToken]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center"> {/* Fundo mais claro para tema estudo */}
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500">
                    <div className="sr-only">Carregando...</div>
                </div>
            </div>
        );
    }

    if (!authToken) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center"> {/* Fundo mais claro para tema estudo */}
                <div className="text-gray-700">Carregando...</div> {/* Texto mais escuro para contraste no fundo claro */}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-6"> {/* Fundo mais claro para tema estudo */}
            <div className="max-w-screen-md mx-auto space-y-8"> {/* Container centralizado e com largura máxima para telas médias */}
                {/* Header Section */}
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-semibold text-gray-900"> {/* Título um pouco menor e mais escuro */}
                        Dashboard
                    </h1>
                    <Link
                        to="/session"
                        className="inline-flex items-center gap-2 bg-blue-500 text-white px-4 py-2  {/* Botão azul mais suave */}
                            rounded-lg hover:bg-blue-600 font-medium transition-all duration-200
                            shadow-md hover:shadow-lg hover:scale-[1.02]"
                    >
                        <Brain className="w-4 h-4" /> {/* Icone menor */}
                        Nova Sessão
                    </Link>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"> {/* Espaçamento menor entre os cards */}
                    {/* Total Questions Card */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 {/* Card branco com borda e sombra suave */}
                        hover:border-blue-300 transition-all duration-200 group">
                        <div className="flex items-center gap-2 mb-3"> {/* Espaçamento menor */}
                            <div className="p-2.5 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors"> {/* Cor de fundo do ícone mais clara */}
                                <BookOpen className="w-5 h-5 text-blue-500" /> {/* Icone menor */}
                            </div>
                            <h3 className="text-gray-600 font-medium text-sm">Total de Questões</h3> {/* Texto menor e cor mais suave */}
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{stats?.total || 0}</p> {/* Texto principal mais escuro */}
                    </div>

                    {/* Correct Answers Card */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 {/* Card branco com borda e sombra suave */}
                        hover:border-green-300 transition-all duration-200 group">
                        <div className="flex items-center gap-2 mb-3"> {/* Espaçamento menor */}
                            <div className="p-2.5 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors"> {/* Cor de fundo do ícone mais clara */}
                                <CheckCircle className="w-5 h-5 text-green-500" /> {/* Icone menor */}
                            </div>
                            <h3 className="text-gray-600 font-medium text-sm">Acertos</h3> {/* Texto menor e cor mais suave */}
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{stats?.acertos || 0}</p> {/* Texto principal mais escuro */}
                    </div>

                    {/* Success Rate Card */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 {/* Card branco com borda e sombra suave */}
                        hover:border-purple-300 transition-all duration-200 group">
                        <div className="flex items-center gap-2 mb-3"> {/* Espaçamento menor */}
                            <div className="p-2.5 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors"> {/* Cor de fundo do ícone mais clara */}
                                <Target className="w-5 h-5 text-purple-500" /> {/* Icone menor */}
                            </div>
                            <h3 className="text-gray-600 font-medium text-sm">Taxa de Acerto</h3> {/* Texto menor e cor mais suave */}
                        </div>
                        <p className="text-2xl font-bold text-gray-800">{stats?.percentual || '0%'}</p> {/* Texto principal mais escuro */}
                    </div>

                    {/* Average Time Card */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 {/* Card branco com borda e sombra suave */}
                        hover:border-yellow-300 transition-all duration-200 group">
                        <div className="flex items-center gap-2 mb-3"> {/* Espaçamento menor */}
                            <div className="p-2.5 bg-yellow-100 rounded-lg group-hover:bg-yellow-200 transition-colors"> {/* Cor de fundo do ícone mais clara */}
                                <Clock className="w-5 h-5 text-yellow-500" /> {/* Icone menor */}
                            </div>
                            <h3 className="text-gray-600 font-medium text-sm">Tempo Médio</h3> {/* Texto menor e cor mais suave */}
                        </div>
                        <p className="text-2xl font-bold text-gray-800">
                        {(stats?.tempoMedio || 0).toFixed(1)}s
                        </p>
                    </div>
                </div>

                {/* Quick Actions Section */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"> {/* Box branco com borda e sombra suave */}
                    <h2 className="text-lg font-semibold text-gray-800 mb-3">Ações Rápidas</h2> {/* Título menor e mais escuro */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3"> {/* Espaçamento menor */}
                        <Link
                            to="/stats"
                            className="flex items-center gap-2.5 p-3 rounded-lg bg-gray-50 {/* Fundo cinza bem claro */}
                                hover:bg-gray-100 transition-colors group"> {/* Hover mais claro */}
                        {'>'}
                            <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200"> {/* Cor de fundo do ícone mais clara */}
                                <PieChart className="w-4 h-4 text-purple-500" /> {/* Icone menor */}
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-800 text-sm">Estatísticas Detalhadas</h3> {/* Texto menor e mais escuro */}
                                <p className="text-xs text-gray-500">Visualize seu desempenho completo</p> {/* Texto menor e cor mais suave */}
                            </div>
                        </Link>
                        <Link
                            to="/achievements"
                            className="flex items-center gap-2.5 p-3 rounded-lg bg-gray-50 {/* Fundo cinza bem claro */}
                                hover:bg-gray-100 transition-colors group"> {/* Hover mais claro */}
                        {'>'}
                            <div className="p-2 bg-yellow-100 rounded-lg group-hover:bg-yellow-200"> {/* Cor de fundo do ícone mais clara */}
                                <Trophy className="w-4 h-4 text-yellow-500" /> {/* Icone menor */}
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-800 text-sm">Conquistas</h3> {/* Texto menor e mais escuro */}
                                <p className="text-xs text-gray-500">Veja suas medalhas e progresso</p> {/* Texto menor e cor mais suave */}
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;