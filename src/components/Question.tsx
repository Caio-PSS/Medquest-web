import React, { useState, useCallback, useEffect } from 'react';
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
  autoReadEnabled: boolean;
  readText: (text: string) => void;
  isReading: boolean;
}

export default function Question({ 
  data, 
  onConfirm, 
  onNext, 
  autoReadEnabled, 
  readText,
  isReading,
}: QuestionProps) {
  const [selected, setSelected] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean | null>(null);
  const [bufferedExplanationAudio, setBufferedExplanationAudio] = useState<string | null>(null);

  // Se houver image_url, monta os dados para exibir a imagem; caso contrário, retorna null
  const imageProps = data.image_url
    ? {
        width: '100%',
        zoomPosition: 'original',
        img: `https://medquest-floral-log-224.fly.dev${data.image_url}.png`,
      }
    : null;

  const openZoom = useCallback(() => setIsZoomed(true), []);
  const closeZoom = useCallback(() => setIsZoomed(false), []);

  // Constrói o texto completo da questão com alternativas
  const getFullQuestionText = useCallback(() => {
    const alternatives = [
      data.alternativa_a,
      data.alternativa_b,
      data.alternativa_c,
      data.alternativa_d
    ]
      .filter(Boolean)
      .map((alt, index) => `Alternativa ${String.fromCharCode(65 + index)}: ${alt}`)
      .join('. ');

    return `${data.enunciado}. ${alternatives}`;
  }, [data]);

  // Pré-carrega o áudio da explicação, se houver, quando o TTS estiver ativo
  useEffect(() => {
    if (autoReadEnabled && data.explicacao) {
      fetch('/api/readText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data.explicacao, language: 'pt-BR', voice: 'pt-BR-Neural2-B' }),
      })
      .then(res => res.json())
      .then(responseData => {
        if (responseData.audioContent) {
          const audioUrl = `data:audio/mp3;base64,${responseData.audioContent}`;
          setBufferedExplanationAudio(audioUrl);
        }
      })
      .catch(err => console.error('Erro ao pré-carregar explicação:', err));
    }
  }, [autoReadEnabled, data.explicacao]);

  // Lê automaticamente o enunciado com alternativas se o feedback não estiver visível
  useEffect(() => {
    if (autoReadEnabled && !isReading && !showFeedback) {
      readText(getFullQuestionText());
    }
  }, [autoReadEnabled, showFeedback, getFullQuestionText, isReading, readText]);

  // Quando o feedback for mostrado e houver áudio pré-carregado, reproduz a explicação
  useEffect(() => {
    if (showFeedback && autoReadEnabled && bufferedExplanationAudio) {
      const explanationAudio = new Audio(bufferedExplanationAudio);
      explanationAudio.play();
      return () => {
        explanationAudio.pause();
      };
    }
  }, [showFeedback, autoReadEnabled, bufferedExplanationAudio]);

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
      <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
        <span className="bg-blue-600 text-white px-4 py-2 rounded-lg">Questão {data.id}</span>
      </h2>
      {imageProps && (
        <div className="mb-8 flex justify-center">
          <div
            className="rounded-lg overflow-hidden border-2 border-gray-700 relative"
            style={{ maxWidth: '600px' }}
          >
            {/* Uso do operador "!" para informar ao TypeScript que imageProps não é nulo */}
            <img
              src={imageProps!.img}
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
              src={imageProps!.img}
              alt="Imagem da questão ampliada"
              style={{ maxWidth: '100%', maxHeight: '90vh', display: 'block', margin: '0 auto' }}
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
                  ${isSelected ? (showFeedback ? (isCorrect ? 'bg-green-500' : 'bg-red-500') : 'bg-blue-500') : 'bg-gray-700'}
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