import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, X, AlertTriangle, Lightbulb } from 'lucide-react';

interface QuestionType {
  id: number;
  enunciado: string;
  resposta: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c?: string;
  alternativa_d?: string;
  categoria: string;
  subtema: string;
  image_url?: string;
  explicacao?: string;
}

interface QuestionProps {
  data: QuestionType;
  onConfirm: (answer: string, isCorrect: boolean) => void;
  onNext: () => void;
  // Opcionalmente, os tempos de início podem ser passados pelo componente pai:
  sessionStartTime?: number;
  questionStartTime?: number;
}

export default function Question({
  data,
  onConfirm,
  onNext,
  sessionStartTime,
  questionStartTime,
}: QuestionProps) {
  const [selected, setSelected] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean | null>(null);

  // Estados para os timers (em segundos)
  const [questionTimer, setQuestionTimer] = useState(0);
  const [sessionTimer, setSessionTimer] = useState(0);

  // Helper para formatar o tempo em "Xm Ys"
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  // Inicia os timers: se os tempos de início não forem passados via props, usa Date.now()
  useEffect(() => {
    const qStart = questionStartTime || Date.now();
    const sStart = sessionStartTime || Date.now();
    const interval = setInterval(() => {
      setQuestionTimer(Math.floor((Date.now() - qStart) / 1000));
      setSessionTimer(Math.floor((Date.now() - sStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [questionStartTime, sessionStartTime]);

  const imageProps = data.image_url
    ? {
        width: '100%',
        zoomPosition: 'original',
        img: `https://medquest-floral-log-224.fly.dev${data.image_url}.png`,
      }
    : null;

  const openZoom = useCallback(() => setIsZoomed(true), []);
  const closeZoom = useCallback(() => setIsZoomed(false), []);

  const handleConfirmAnswer = () => {
    if (!data?.resposta) {
      console.error('Resposta não encontrada');
      return;
    }
    setShowFeedback(true);
    const isCorrect = selected.toUpperCase() === data.resposta.toUpperCase();
    setIsCorrectAnswer(isCorrect);
    onConfirm(selected, isCorrect);
  };

  const getCorrectAlternativeText = () => {
    if (!data?.resposta) return 'Resposta não disponível';
    const alternativeKey = `alternativa_${data.resposta.toLowerCase()}` as keyof QuestionType;
    return data[alternativeKey] || 'Alternativa não encontrada';
  };

  return (
    <div className="max-w-4xl mx-auto bg-gray-900 rounded-2xl p-8 shadow-2xl">
      <h2 className="text-2xl font-bold mb-2 text-white flex items-center gap-2">
        <span className="bg-blue-600 text-white px-4 py-2 rounded-lg">
          Questão {data.id}
        </span>
      </h2>
      {/* Mostradores de Tempo */}
      <div className="flex justify-between text-sm text-gray-300 mb-4">
        <div>
          <span className="font-medium">Sessão:</span> {formatTime(sessionTimer)}
        </div>
        <div>
          <span className="font-medium">Questão:</span> {formatTime(questionTimer)}
        </div>
      </div>

      {imageProps && (
        <div className="mb-8 flex justify-center">
          <div
            className="rounded-lg overflow-hidden border-2 border-gray-700 relative"
            style={{ maxWidth: '600px' }}
          >
            <img
              src={imageProps.img}
              alt="Imagem da questão"
              style={{ width: '100%', display: 'block', cursor: 'zoom-in' }}
              onClick={openZoom}
            />
          </div>
        </div>
      )}

      {isZoomed && (
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 z-50 flex justify-center items-center">
          <div className="bg-gray-900 rounded-2xl p-8 shadow-2xl max-w-5xl max-h-screen overflow-auto relative">
            <button
              onClick={closeZoom}
              className="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-white rounded-full p-2 transition-colors"
              aria-label="Fechar Zoom"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={imageProps?.img}
              alt="Imagem da questão ampliada"
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                display: 'block',
                margin: '0 auto',
              }}
            />
          </div>
        </div>
      )}

      <p className="text-gray-200 text-lg mb-8 leading-relaxed">{data.enunciado}</p>

      <div className="space-y-4">
        {['A', 'B', 'C', 'D'].map((opt) => {
          const alternativeKey = `alternativa_${opt.toLowerCase()}` as keyof QuestionType;
          const isCorrect = opt.toUpperCase() === data.resposta.toUpperCase();
          const isSelected = selected === opt;

          return data[alternativeKey] && (
            <button
              key={opt}
              onClick={() => !showFeedback && setSelected(opt)}
              className={`
                w-full p-4 text-left rounded-xl transition-all duration-200
                flex items-center gap-4 group relative
                ${
                  showFeedback
                    ? isCorrect
                      ? 'bg-green-600 text-white shadow-lg ring-2 ring-green-400'
                      : isSelected
                      ? 'bg-red-600 text-white shadow-lg ring-2 ring-red-400'
                      : 'bg-gray-800 opacity-50 cursor-not-allowed'
                    : isSelected
                    ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400'
                    : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                }
              `}
              disabled={showFeedback}
            >
              <span
                className={`
                  w-8 h-8 flex items-center justify-center rounded-lg
                  ${
                    isSelected
                      ? showFeedback
                        ? isCorrect
                          ? 'bg-green-500'
                          : 'bg-red-500'
                        : 'bg-blue-500'
                      : 'bg-gray-700'
                  }
                `}
              >
                {opt}
              </span>
              <span className="flex-1">{data[alternativeKey]}</span>
              {!showFeedback && isSelected && (
                <CheckCircle className="w-6 h-6 text-white absolute right-4" />
              )}
            </button>
          );
        })}
      </div>

      {!showFeedback && (
        <button
          onClick={handleConfirmAnswer}
          disabled={!selected}
          className={`
            mt-8 w-full py-4 rounded-xl text-lg font-medium transition-all duration-200
            flex items-center justify-center gap-2
            ${selected ? 'bg-green-600 text-white hover:bg-green-500 shadow-lg' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}
          `}
        >
          Confirmar Resposta
        </button>
      )}

      {showFeedback && (
        <div className="mt-8 p-6 rounded-xl bg-gray-800 border border-gray-700 shadow-md">
          {isCorrectAnswer === true && (
            <div className="text-green-500 font-bold flex items-center gap-2 mb-4">
              <CheckCircle className="w-6 h-6" /> Parabéns, você acertou!
            </div>
          )}

          {isCorrectAnswer === false && (
            <>
              <div className="text-red-500 font-bold flex items-center gap-2 mb-4">
                <AlertTriangle className="w-6 h-6" />
                Resposta incorreta. A alternativa correta é: {data.resposta}
              </div>
              <div className="text-gray-300 mb-4">
                <strong>Alternativa Correta:</strong> {getCorrectAlternativeText()}
              </div>
            </>
          )}

          {data.explicacao && (
            <div className="text-gray-300">
              <div className="font-semibold flex items-center gap-2 mb-2">
                <Lightbulb className="w-5 h-5 inline-block" /> Explicação:
              </div>
              <p className="ml-6">{data.explicacao}</p>
            </div>
          )}

          <button
            onClick={() => {
              setShowFeedback(false);
              setSelected('');
              setIsCorrectAnswer(null);
              onNext();
            }}
            className="mt-4 w-full py-3 rounded-xl text-lg font-medium transition-all duration-200 bg-blue-600 text-white hover:bg-blue-700 shadow-lg flex items-center justify-center gap-2"
          >
            Próxima Questão
          </button>
        </div>
      )}
    </div>
  );
}
