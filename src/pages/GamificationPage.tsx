import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Definindo a interface para os desafios
interface Challenge {
  id: number;
  nome: string;
  descricao: string;
  tipo: string;
  meta?: {
    categoria?: string;
    percentual?: number;
  };
  data_inicio: string;
  data_fim: string;
  status?: string;
}

// Definindo a interface para as conquistas
interface Achievement {
  id: number;
  icone: string;
  nome: string;
  descricao: string;
  data_conquista: string;
}

const GamificationPage = () => {
  const { authToken } = useAuth();
  const navigate = useNavigate();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    if (authToken) {
      // Buscar desafios
      fetch('https://medquest-floral-log-224.fly.dev/api/gamification/challenges', {
        headers: { Authorization: `Bearer ${authToken}` }
      })
        .then(res => res.json())
        .then((data: Challenge[]) => setChallenges(data))
        .catch(err => console.error('Erro ao buscar desafios:', err));
      
      // Buscar conquistas
      fetch('https://medquest-floral-log-224.fly.dev/api/gamification/achievements', {
        headers: { Authorization: `Bearer ${authToken}` }
      })
        .then(res => res.json())
        .then((data: Achievement[]) => setAchievements(data))
        .catch(err => console.error('Erro ao buscar conquistas:', err));
    }
  }, [authToken]);

  // Filtrar apenas os desafios semanais
  const weeklyChallenges = challenges.filter(
    challenge => challenge.tipo.toLowerCase() === 'semanal'
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header com botão de voltar */}
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-blue-500 hover:text-blue-700 transition-colors"
          >
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>
          <h1 className="text-3xl font-bold ml-auto">Gamificação</h1>
        </div>

        {/* Seção: Desafios Semanais */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Desafios Semanais</h2>
          {weeklyChallenges.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {weeklyChallenges.map(challenge => (
                <div
                  key={challenge.id}
                  className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition-all"
                >
                  <h3 className="text-center font-semibold text-xl">{challenge.nome}</h3>
                  <p className="mt-2 text-center text-gray-600 text-sm">{challenge.descricao}</p>
                  {challenge.meta && (
                    <div className="mt-2 text-center text-gray-500 text-xs">
                      Meta: {challenge.meta.categoria ? `Categoria ${challenge.meta.categoria}` : ''}{' '}
                      {challenge.meta.percentual ? `- ${challenge.meta.percentual}%` : ''}
                    </div>
                  )}
                  <div className="mt-2 flex justify-around text-gray-500 text-xs">
                    <p>Início: {new Date(challenge.data_inicio).toLocaleDateString()}</p>
                    <p>Fim: {new Date(challenge.data_fim).toLocaleDateString()}</p>
                  </div>
                  {challenge.status && (
                    <p className="mt-2 text-center font-medium text-green-600">
                      Status: {challenge.status}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-600">
              Nenhum desafio semanal ativo no momento.
            </div>
          )}
        </div>

        {/* Seção: Conquistas */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Conquistas</h2>
          {achievements.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {achievements.map(ach => (
                <div
                  key={ach.id}
                  className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition-all"
                >
                  <img
                    src={`/icons/${ach.icone}.svg`}
                    alt={ach.nome}
                    className="h-16 w-16 mx-auto"
                  />
                  <h3 className="mt-4 text-center font-semibold text-xl">{ach.nome}</h3>
                  <p className="mt-2 text-center text-gray-600 text-sm">{ach.descricao}</p>
                  <p className="mt-1 text-center text-gray-500 text-xs">
                    Conquistado em: {new Date(ach.data_conquista).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-600">
              Nenhuma conquista encontrada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GamificationPage;