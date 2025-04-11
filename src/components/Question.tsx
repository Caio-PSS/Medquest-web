import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  CheckCircle, X, AlertTriangle, Lightbulb, 
  PlayCircle, PauseCircle, RotateCcw, AlertCircle 
} from 'lucide-react';

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
  onComplete: () => void;
  autoReadEnabled: boolean;
  readText: (text: string, type: "question" | "explanation", preload?: boolean) => void;
  isReading: boolean;
  toggleQuestionAudio: () => void;
  replayQuestionAudio: () => void;
  toggleExplanationAudio: () => void;
  replayExplanationAudio: () => void;
  questionAudioPlaying: boolean;
  explanationAudioPlaying: boolean;
  audioLoading: boolean;
  onExplanationDisplayed?: () => void;
}


export default function Question({
  data,
  onConfirm,
  onNext,
  onComplete,
  autoReadEnabled,
  readText,
  isReading,
  toggleQuestionAudio,
  replayQuestionAudio,
  toggleExplanationAudio,
  replayExplanationAudio,
  questionAudioPlaying,
  explanationAudioPlaying,
  audioLoading,
  onExplanationDisplayed,
}: QuestionProps) {
  const [selected, setSelected] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean | null>(null);

  // States for video handling
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  // Flags para evitar que o auto‑read seja disparado mais de uma vez por questão
  const autoQuestionReadTriggered = useRef(false);
  const autoExplanationReadTriggered = useRef(false);

  // Refs de controle do pré‑load e do callback de pré‑carregamento (mantidas)
  const explanationPreloaded = useRef(false);
  const explanationDisplayedCalled = useRef(false);

  // Quando a questão muda, reseta as flags
  useEffect(() => {
    autoQuestionReadTriggered.current = false;
    autoExplanationReadTriggered.current = false;
    explanationPreloaded.current = false;
    explanationDisplayedCalled.current = false;
  }, [data.id]);

  // Se o autoRead for desativado, reseta as flags para evitar comportamento indesejado
  useEffect(() => {
    if (!autoReadEnabled) {
      autoQuestionReadTriggered.current = false;
      autoExplanationReadTriggered.current = false;
    }
  }, [autoReadEnabled]);

  // Pré‑carrega o áudio da explicação (apenas uma vez)
  useEffect(() => {
    if (autoReadEnabled && data.explicacao && !explanationPreloaded.current) {
      readText(data.explicacao, "explanation", true);
      explanationPreloaded.current = true;
    }
  }, [autoReadEnabled, data.explicacao, readText]);

  // Quando o feedback é exibido, se "Leitura auto" estiver ativa e houver explicação,
  // chama o callback para pré‑carregar o áudio da próxima questão (apenas uma vez)
  useEffect(() => {
    if (showFeedback && autoReadEnabled && data.explicacao && onExplanationDisplayed && !explanationDisplayedCalled.current) {
      onExplanationDisplayed();
      explanationDisplayedCalled.current = true;
    }
  }, [showFeedback, autoReadEnabled, data.explicacao, onExplanationDisplayed]);

  // Auto-read da questão – dispara apenas uma vez por questão
  useEffect(() => {
    if (autoReadEnabled && !showFeedback && !isReading && !autoQuestionReadTriggered.current) {
      replayQuestionAudio();
      autoQuestionReadTriggered.current = true;
    }
  }, [autoReadEnabled, showFeedback, isReading, replayQuestionAudio]);

  // Auto-read da explicação – dispara apenas uma vez por questão
  useEffect(() => {
    if (autoReadEnabled && showFeedback && data.explicacao && !isReading && !autoExplanationReadTriggered.current) {
      replayExplanationAudio();
      autoExplanationReadTriggered.current = true;
    }
  }, [autoReadEnabled, showFeedback, data.explicacao, isReading, replayExplanationAudio]);

  const openZoom = useCallback(() => setIsZoomed(true), []);
  const closeZoom = useCallback(() => setIsZoomed(false), []);

  // Monta o texto completo da questão (enunciado + alternativas)
  const getFullQuestionText = useCallback(() => {
    const alternatives = [
      data.alternativa_a,
      data.alternativa_b,
      data.alternativa_c,
      data.alternativa_d,
    ]
      .filter(Boolean)
      .map((alt, index) => `Alternativa ${String.fromCharCode(65 + index)}: ${alt}`)
      .join('. ');
    return `${data.enunciado}. ${alternatives}`;
  }, [data]);

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

  // Ao clicar manualmente, se "Leitura auto" estiver ativa e não houver feedback, usamos as funções já definidas
  const toggleQuestionAudioHandler = () => {
    toggleQuestionAudio();
  };

  const replayQuestionAudioHandler = () => {
    replayQuestionAudio();
  };

  const renderExplanationWithVideoLinks = (text: string) => {
    if (!text) return null;
    
    // Regular expression to match "Video comentário: XXXXXX" with variations
    const regex = /(V[íi]deo coment[áa]rio:?\s*)(\d+)/gi;
    
    // Split the text by regex matches
    const parts = text.split(regex);
    
    if (parts.length <= 1) {
      // No matches, return the original text
      return <p className="ml-6">{text}</p>;
    }
    
    // Process parts to create JSX elements
    const elements: React.ReactNode[] = [];
    
    for (let i = 0; i < parts.length; i++) {
      if (i % 3 === 0) {
        // Regular text part
        if (parts[i]) {
          elements.push(<span key={`text-${i}`}>{parts[i]}</span>);
        }
      } else if (i % 3 === 1) {
        // The "Video comentário:" part
        if (parts[i]) {
          elements.push(<span key={`label-${i}`}>{parts[i]}</span>);
        }
      } else {
        // The video ID part
        const videoId = parts[i];
        elements.push(
          <button
            key={`video-${i}`}
            onClick={() => openVideoModal(videoId)}
            className="text-blue-400 hover:text-blue-300 font-medium underline"
          >
            {videoId}
          </button>
        );
      }
    }
    
    return <p className="ml-6">{elements}</p>;
  };
  
  const openVideoModal = (videoId: string) => {
    setCurrentVideoId(videoId);
    setVideoModalOpen(true);
    setVideoLoading(true);
  };
  
  const closeVideoModal = () => {
    setVideoModalOpen(false);
    setCurrentVideoId(null);
  };

  const VideoModal = () => {
    if (!currentVideoId) return null;
    
    // Replace with your actual Backblaze B2 bucket URL
    const backblazeUrl = process.env.NEXT_PUBLIC_BACKBLAZE_URL || "";
    const videoUrl = `${backblazeUrl}/${currentVideoId}.mp4`;
    
    const handleVideoLoaded = () => {
      setVideoLoading(false);
    };
    
    return (
      <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 z-50 flex justify-center items-center">
        <div className="bg-gray-900 rounded-2xl p-4 md:p-8 shadow-2xl max-w-5xl max-h-screen overflow-auto relative">
          <button
            onClick={closeVideoModal}
            className="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-white rounded-full p-2 transition-colors"
            aria-label="Fechar Vídeo"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="relative w-full" style={{ minWidth: '300px', minHeight: '200px' }}>
            {videoLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
            
            <video 
              controls 
              autoPlay
              className="w-full rounded-lg"
              style={{ maxHeight: '80vh' }}
              onLoadedData={handleVideoLoaded}
              onError={handleVideoLoaded}
            >
              <source src={videoUrl} type="video/mp4" />
              Seu navegador não suporta a reprodução de vídeos.
            </video>
          </div>
          
          <div className="text-center mt-4 text-gray-300">
            <p>Vídeo Comentário: {currentVideoId}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto bg-gray-900 rounded-2xl p-8 shadow-2xl">
      {/* Cabeçalho com título e controles de áudio para a questão */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white">
            <span className="bg-blue-600 text-white px-4 py-2 rounded-lg">
              Questão {data.id}
            </span>
          </span>
          <button
            onClick={toggleQuestionAudioHandler}
            disabled={audioLoading}
            title="Play/Pause Questão"
            className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50"
          >
            {audioLoading ? (
              <svg className="animate-spin h-6 w-6 text-gray-300" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : questionAudioPlaying ? (
              <PauseCircle className="w-6 h-6" />
            ) : (
              <PlayCircle className="w-6 h-6" />
            )}
          </button>
        </div>
        <div>
          <button
            onClick={replayQuestionAudioHandler}
            disabled={audioLoading}
            title="Replay Questão"
            className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50"
          >
            {audioLoading ? (
              <svg className="animate-spin h-6 w-6 text-gray-300" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <RotateCcw className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {data.image_url && (
        <div className="mb-8 flex justify-center">
          <div
            className="rounded-lg overflow-hidden border-2 border-gray-700 relative"
            style={{ maxWidth: '600px' }}
          >
            <img
              src={`https://medquest-floral-log-224.fly.dev${data.image_url}.png`}
              alt="Imagem da questão"
              style={{ width: '100%', display: 'block', cursor: 'zoom-in' }}
              onClick={openZoom}
            />
          </div>
        </div>
      )}

      {isZoomed && data.image_url && (
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
              src={`https://medquest-floral-log-224.fly.dev${data.image_url}.png`}
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
        <div className="flex gap-4 mt-8 justify-between">
          <button
  onClick={onComplete}
  className="border border-red-500/50 text-red-300 py-2 px-2 sm:py-4 sm:px-4 rounded-lg hover:border-red-400 hover:text-red-200 transition-all duration-200 flex items-center gap-2 group"
>
  <AlertCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
  <span className="text-sm hidden sm:inline">Questão Incompleta</span>
</button>

          <button
            onClick={handleConfirmAnswer}
            disabled={!selected}
            className={`flex-1 py-4 rounded-xl text-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              selected 
                ? 'bg-green-600 text-white hover:bg-green-500 shadow-lg' 
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            Confirmar Resposta
          </button>
        </div>
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
              <div className="font-semibold flex justify-between items-center gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 inline-block" /> Explicação:
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleExplanationAudio}
                    disabled={audioLoading}
                    title="Play/Pause Explicação"
                    className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50"
                  >
                    {audioLoading ? (
                      <svg className="animate-spin h-6 w-6 text-gray-300" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : explanationAudioPlaying ? (
                      <PauseCircle className="w-6 h-6" />
                    ) : (
                      <PlayCircle className="w-6 h-6" />
                    )}
                  </button>
                  <button
                    onClick={replayExplanationAudio}
                    disabled={audioLoading}
                    title="Replay Explicação"
                    className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50"
                  >
                    {audioLoading ? (
                      <svg className="animate-spin h-6 w-6 text-gray-300" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <RotateCcw className="w-6 h-6" />
                    )}
                  </button>
                </div>
              </div>
              {renderExplanationWithVideoLinks(data.explicacao)}
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
      {videoModalOpen && <VideoModal />}
    </div>
  );
}
