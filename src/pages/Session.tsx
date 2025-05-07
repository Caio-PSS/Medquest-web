import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Question from '../components/Question';
import { useNavigate } from 'react-router-dom';
import { Bars } from 'react-loader-spinner';
import { CheckCircle, Circle, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

type QuestionType = {
  id: number;
  enunciado: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c?: string;
  alternativa_d?: string;
  categoria: string;
  subtema: string;
  image_url?: string;
  resposta: string;
  explicacao?: string;
};

type Category = {
  name: string;
  subtopics: string[];
};

type Selection = {
  categoria: string;
  subtema: string;
};

const Session = () => {
  const { authToken, authUser } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<QuestionType[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  const [tick, setTick] = useState(0);

  const [numQuestions, setNumQuestions] = useState(5);
  const [includeRepeats, setIncludeRepeats] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selections, setSelections] = useState<Selection[]>([]);

  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [currentAudioType, setCurrentAudioType] = useState<"question" | "explanation" | null>(null);
  const [questionAudioData, setQuestionAudioData] = useState<string | null>(null);
  const [explanationAudioData, setExplanationAudioData] = useState<string | null>(null);
  const [preloadedQuestionAudio, setPreloadedQuestionAudio] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  const [sessionStats, setSessionStats] = useState({
    totalQuestions: 0,
    correct: 0,
    incorrect: 0,
    totalTime: 0,
    wrongComments: [] as string[],
    correctComments: [] as string[],
  });

  const [autoReadEnabled, setAutoReadEnabled] = useState(false);

  const [playbackRate, setPlaybackRate] = useState(1);

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    setPlaybackRate(rates[nextIndex]);
  };  

  const audioCache = useRef<{ [key: string]: string }>({});

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(
          `https://medquest-floral-log-224.fly.dev/api/questions/categories-subtopics`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        if (!res.ok) {
          console.error('Erro na resposta:', res.status);
          return;
        }
        const data = await res.json();
        const formatted = Object.entries(data).map(([name, subtopics]) => ({
          name,
          subtopics: subtopics as string[],
        }));
        setCategories(formatted);
      } catch (err) {
        console.error('Erro ao buscar categorias:', err);
      }
    };
    if (authToken) fetchCategories();
  }, [authToken]);

  useEffect(() => {
    if (questions.length > 0 && currentQuestion >= questions.length) {
      navigate('/feedback', { state: sessionStats });
    }
  }, [currentQuestion, questions.length, navigate, sessionStats]);

  const handleSubtopicSelect = (category: string, subtopic: string) => {
    setSelections(prev => {
      const exists = prev.some(s => s.categoria === category && s.subtema === subtopic);
      return exists
        ? prev.filter(s => !(s.categoria === category && s.subtema === subtopic))
        : [...prev, { categoria: category, subtema: subtopic }];
    });
  };

  const handleSelectAllSubtopics = (category: string, subtopics: string[]) => {
    setSelections(prev => {
      const otherCategories = prev.filter(s => s.categoria !== category);
      const allSelected = subtopics.every(sub =>
        prev.some(s => s.categoria === category && s.subtema === sub)
      );
      return allSelected
        ? otherCategories
        : [...otherCategories, ...subtopics.map(sub => ({ categoria: category, subtema: sub }))];
    });
  };

  const loadQuestions = async () => {
    if (selections.length === 0) {
      alert('Selecione pelo menos um subtema!');
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        selections: JSON.stringify(selections),
        numQuestions: numQuestions.toString(),
        includeRepeats: includeRepeats.toString(),
        userId: authUser?.id?.toString() || '',
      });
      const res = await fetch(
        `https://medquest-floral-log-224.fly.dev/api/questions?${params}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (!res.ok) throw new Error('Erro ao buscar questões');
      const data = await res.json();
      setQuestions(data);
      setQuestionStartTime(Date.now());
      setSessionStartTime(Date.now());
      setCurrentQuestion(0);
      setSessionStats({
        totalQuestions: data.length,
        correct: 0,
        incorrect: 0,
        totalTime: 0,
        wrongComments: [],
        correctComments: [],
      });
      setQuestionAudioData(null);
      setExplanationAudioData(null);
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
      setIsReading(false);
      setCurrentAudioType(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar questões');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = async (answer: string, isCorrect: boolean) => {
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    const currentQ = questions[currentQuestion];
    try {
      await fetch(`https://medquest-floral-log-224.fly.dev/api/respostas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          id_questao: currentQ.id,
          resposta_usuario: answer,
          resposta_correta: currentQ.resposta,
          resultado: isCorrect ? 'Correta' : 'Incorreta',
          tempo_resposta: timeTaken,
          user_id: authUser?.id,
        }),
      });
      setSessionStats(prev => ({
        ...prev,
        correct: prev.correct + (isCorrect ? 1 : 0),
        incorrect: prev.incorrect + (isCorrect ? 0 : 1),
        totalTime: prev.totalTime + timeTaken,
        correctComments: isCorrect
          ? [...prev.correctComments, `Questão ${currentQ.id}: ${currentQ.explicacao}`]
          : prev.correctComments,
        wrongComments: !isCorrect
          ? [...prev.wrongComments, `Questão ${currentQ.id}: ${currentQ.explicacao}`]
          : prev.wrongComments,
      }));
    } catch (err) {
      console.error('Erro ao salvar resposta:', err);
      alert('Erro ao salvar resposta');
    }
  };

  const preloadNextQuestionAudio = async () => {
    if (currentQuestion + 1 < questions.length) {
      const nextQ = questions[currentQuestion + 1];
      let fullText = nextQ.enunciado;
      const alternatives = [];
      if (nextQ.alternativa_a) alternatives.push(`Alternativa A: ${nextQ.alternativa_a}`);
      if (nextQ.alternativa_b) alternatives.push(`Alternativa B: ${nextQ.alternativa_b}`);
      if (nextQ.alternativa_c) alternatives.push(`Alternativa C: ${nextQ.alternativa_c}`);
      if (nextQ.alternativa_d) alternatives.push(`Alternativa D: ${nextQ.alternativa_d}`);
      fullText += ". " + alternatives.join(". ");

      try {
        const response = await fetch('/api/readText', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fullText, language: 'pt-BR', voice: 'pt-BR-Neural2-B' }),
        });
        const data = await response.json();
        if (data.audioContent) {
          const audioUrl = `data:audio/mp3;base64,${data.audioContent}`;
          setPreloadedQuestionAudio(audioUrl);
        }
      } catch (error) {
        console.error("Erro ao pré-carregar áudio da próxima questão:", error);
      }
    }
  };

  const handleNextQuestion = () => {
    setCurrentQuestion(prev => prev + 1);
    setQuestionStartTime(Date.now());
    if (preloadedQuestionAudio) {
      setQuestionAudioData(preloadedQuestionAudio);
      setPreloadedQuestionAudio(null);
    } else {
      setQuestionAudioData(null);
    }
    setExplanationAudioData(null);
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    setIsReading(false);
    setCurrentAudioType(null);
  };

  async function readText(
    text: string,
    type: "question" | "explanation",
    preload?: boolean
  ) {
    try {
      const cacheKey = type + '|' + text;
      if (audioCache.current[cacheKey]) {
        if (preload) {
          if (type === "question" && !questionAudioData) {
            setQuestionAudioData(audioCache.current[cacheKey]);
          } else if (type === "explanation" && !explanationAudioData) {
            setExplanationAudioData(audioCache.current[cacheKey]);
          }
          return;
        }
        if (type === "question" && !questionAudioData) {
          setQuestionAudioData(audioCache.current[cacheKey]);
        } else if (type === "explanation" && !explanationAudioData) {
          setExplanationAudioData(audioCache.current[cacheKey]);
        }
      }
      if (!preload && currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
        setCurrentAudioType(null);
      }
      if (!preload) {
        setIsReading(true);
        setAudioLoading(true);
      }
      let audioUrl = "";
      if (type === "question" && questionAudioData) {
        audioUrl = questionAudioData;
      } else if (type === "explanation" && explanationAudioData) {
        audioUrl = explanationAudioData;
      } else {
        const response = await fetch('/api/readText', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language: 'pt-BR', voice: 'pt-BR-Neural2-B' }),
        });
        const data = await response.json();
        if (data.audioContent) {
          audioUrl = `data:audio/mp3;base64,${data.audioContent}`;
          audioCache.current[cacheKey] = audioUrl;
          if (type === "question") {
            setQuestionAudioData(audioUrl);
          } else {
            setExplanationAudioData(audioUrl);
          }
        }
      }
      if (!audioUrl) {
        if (!preload) {
          setIsReading(false);
          setAudioLoading(false);
        }
        return;
      }
      if (preload) {
        return;
      }
      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      setCurrentAudioType(type);
      audio.preservesPitch = true;
      audio.playbackRate = playbackRate;
      audio.play();
      setAudioLoading(false);
      audio.onended = () => {
        setIsReading(false);
        setCurrentAudio(null);
        setCurrentAudioType(null);
      };
    } catch (error) {
      console.error('Erro ao ler o texto:', error);
      if (!preload) {
        setIsReading(false);
        setAudioLoading(false);
      }
    }
  }

  const toggleQuestionAudio = () => {
    if (currentAudio && currentAudioType === "question") {
      if (!currentAudio.paused) {
        currentAudio.pause();
      } else {
        currentAudio.play();
      }
    } else {
      if (questionAudioData) {
        const audio = new Audio(questionAudioData);
        setCurrentAudio(audio);
        setCurrentAudioType("question");
        audio.preservesPitch = true;
        audio.playbackRate = playbackRate;
        audio.play();
        audio.onended = () => {
          setIsReading(false);
          setCurrentAudio(null);
          setCurrentAudioType(null);
        };
      } else {
        const q = questions[currentQuestion];
        if (!q) return;
        let fullText = q.enunciado;
        const alternatives = [];
        if (q.alternativa_a) alternatives.push(`Alternativa A: ${q.alternativa_a}`);
        if (q.alternativa_b) alternatives.push(`Alternativa B: ${q.alternativa_b}`);
        if (q.alternativa_c) alternatives.push(`Alternativa C: ${q.alternativa_c}`);
        if (q.alternativa_d) alternatives.push(`Alternativa D: ${q.alternativa_d}`);
        fullText += ". " + alternatives.join(". ");
        readText(fullText, "question");
      }
    }
  };

  const replayQuestionAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    if (questionAudioData) {
      const audio = new Audio(questionAudioData);
      setCurrentAudio(audio);
      setCurrentAudioType("question");
      audio.preservesPitch = true;
      audio.playbackRate = playbackRate;
      audio.play();
      audio.onended = () => {
        setIsReading(false);
        setCurrentAudio(null);
        setCurrentAudioType(null);
      };
    } else {
      const q = questions[currentQuestion];
      if (!q) return;
      let fullText = q.enunciado;
      const alternatives = [];
      if (q.alternativa_a) alternatives.push(`Alternativa A: ${q.alternativa_a}`);
      if (q.alternativa_b) alternatives.push(`Alternativa B: ${q.alternativa_b}`);
      if (q.alternativa_c) alternatives.push(`Alternativa C: ${q.alternativa_c}`);
      if (q.alternativa_d) alternatives.push(`Alternativa D: ${q.alternativa_d}`);
      fullText += ". " + alternatives.join(". ");
      readText(fullText, "question");
    }
  };

  const toggleExplanationAudio = () => {
    if (currentAudio && currentAudioType === "explanation") {
      if (!currentAudio.paused) {
        currentAudio.pause();
      } else {
        currentAudio.play();
      }
    } else {
      const q = questions[currentQuestion];
      if (q && q.explicacao) {
        readText(q.explicacao, "explanation");
      }
    }
  };

  const replayExplanationAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    const q = questions[currentQuestion];
    if (q && q.explicacao) {
      readText(q.explicacao, "explanation");
    }
  };

  const questionAudioPlaying = currentAudio && currentAudioType === "question" && !currentAudio.paused;
  const explanationAudioPlaying = currentAudio && currentAudioType === "explanation" && !currentAudio.paused;

  const [isCompleting, setIsCompleting] = useState(false);

  const handleCompleteQuestion = async () => {
    const pauseStart = Date.now();
    setIsCompleting(true);
  
    const currentQ = questions[currentQuestion];
    try {
      const response = await fetch('/api/completarQuestao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enunciado: currentQ.enunciado,
          alternativa_a: currentQ.alternativa_a,
          alternativa_b: currentQ.alternativa_b,
          alternativa_c: currentQ.alternativa_c,
          alternativa_d: currentQ.alternativa_d,
          resposta: currentQ.resposta,
          explicacao: currentQ.explicacao,
        }),
      });
      if (!response.ok) throw new Error("Erro ao completar a questão");
      const correctedData = await response.json();
  
      const updatedQuestion = { ...currentQ, ...correctedData };
      const updatedQuestions = [...questions];
      updatedQuestions[currentQuestion] = updatedQuestion;
      setQuestions(updatedQuestions);
    } catch (error) {
      console.error(error);
      alert("Erro ao completar a questão.");
    } finally {
      const pauseDuration = Date.now() - pauseStart;
      setQuestionStartTime(prev => prev + pauseDuration);
      setIsCompleting(false);
    }
  };

  const [pdfLoading, setPdfLoading] = useState(false);

  const generatePDFs = async () => {
    if (selections.length === 0) {
      alert('Selecione pelo menos um subtema!');
      return;
    }
    
    setPdfLoading(true);
    try {
      const params = new URLSearchParams({
        selections: JSON.stringify(selections),
        numQuestions: numQuestions.toString(),
        includeRepeats: includeRepeats.toString(),
        userId: authUser?.id?.toString() || '',
      });
      
      const res = await fetch(
        `https://medquest-floral-log-224.fly.dev/api/questions?${params}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      if (!res.ok) throw new Error('Erro ao buscar questões para PDF');
      const questionsData = await res.json();
      
      await generateQuestionsPDF(questionsData);
      await generateAnswersPDF(questionsData);
      
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar PDFs');
    } finally {
      setPdfLoading(false);
    }
  };
  
  const generateQuestionsPDF = async (questionsData: QuestionType[]) => {
    const pdf = new jsPDF();
    let yPosition = 20;
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    pdf.setFontSize(18);
    pdf.setTextColor(0, 51, 102);
    pdf.text('MedQuest - Questões', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    const date = new Date();
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Gerado em: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`, 
             pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    for (let i = 0; i < questionsData.length; i++) {
      const q = questionsData[i];
      
      if (yPosition > pdf.internal.pageSize.getHeight() - 40) {
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.setFontSize(14);
      pdf.setTextColor(0, 102, 204);
      pdf.text(`Questão ${q.id} - ${q.categoria} - ${q.subtema}`, 15, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      const enunciadoLines = pdf.splitTextToSize(q.enunciado, pageWidth - 30);
      pdf.text(enunciadoLines, 15, yPosition);
      yPosition += enunciadoLines.length * 7;
      
      if (q.image_url) {
        try {
          yPosition += 5;
          
          const img = new Image();
          img.crossOrigin = "Anonymous";
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = `https://medquest-floral-log-224.fly.dev${q.image_url}.png`;
          });
          
          const imgRatio = img.width / img.height;
          const maxWidth = pageWidth - 30;
          const maxHeight = 100;
          let imgWidth = maxWidth;
          let imgHeight = imgWidth / imgRatio;
          
          if (imgHeight > maxHeight) {
            imgHeight = maxHeight;
            imgWidth = imgHeight * imgRatio;
          }
          
          if (yPosition + imgHeight > pdf.internal.pageSize.getHeight() - 20) {
            pdf.addPage();
            yPosition = 20;
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) { // Add this null check to fix the TypeScript error
            ctx.drawImage(img, 0, 0);
            const imgData = canvas.toDataURL('image/jpeg');
            
            pdf.addImage(imgData, 'JPEG', 15, yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 10;
          } else {
            console.error("Could not get 2D context from canvas");
          }
        } catch (error) {
          console.error("Error loading image:", error);
        }
      }
      
      const alternativas = [
        `A) ${q.alternativa_a}`,
        `B) ${q.alternativa_b}`
      ];
      
      if (q.alternativa_c) alternativas.push(`C) ${q.alternativa_c}`);
      if (q.alternativa_d) alternativas.push(`D) ${q.alternativa_d}`);
      
      pdf.setFontSize(11);
      for (const alt of alternativas) {
        if (yPosition > pdf.internal.pageSize.getHeight() - 30) {
          pdf.addPage();
          yPosition = 20;
        }
        
        const altLines = pdf.splitTextToSize(alt, pageWidth - 30);
        pdf.text(altLines, 15, yPosition);
        yPosition += altLines.length * 6 + 4;
      }
      
      yPosition += 10;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 15;
    }
    
    pdf.save('MedQuest-Questoes.pdf');
  };
  
  const generateAnswersPDF = async (questionsData: QuestionType[]) => {
    const pdf = new jsPDF();
    
    pdf.setFontSize(18);
    pdf.setTextColor(0, 51, 102);
    pdf.text('MedQuest - Gabarito e Comentários', pdf.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    const date = new Date();
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Gerado em: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`, 
             pdf.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
    
    pdf.setFontSize(14);
    pdf.setTextColor(0, 102, 204);
    pdf.text('Gabarito', 15, 45);
    
    const tableData = questionsData.map(q => [q.id, q.resposta]);
    
    autoTable(pdf, {
      startY: 50,
      head: [['Questão', 'Resposta']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 102, 204],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [240, 240, 240]
      }
    });
    
    pdf.addPage();
    pdf.setFontSize(14);
    pdf.setTextColor(0, 102, 204);
    pdf.text('Comentários e Explicações', 15, 20);
    
    let yPosition = 30;
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    for (let i = 0; i < questionsData.length; i++) {
      const q = questionsData[i];
      
      if (yPosition > pdf.internal.pageSize.getHeight() - 40) {
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.setFontSize(12);
      pdf.setTextColor(0, 102, 204);
      pdf.text(`Questão ${q.id} - Resposta: ${q.resposta}`, 15, yPosition);
      yPosition += 8;
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`${q.categoria} - ${q.subtema}`, 15, yPosition);
      yPosition += 8;
      
      if (q.explicacao) {
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
        
        const explicacao = q.explicacao.replace(/(V[íi]deo coment[áa]rio:?\s*\d+)/gi, '');
        
        const explicacaoLines = pdf.splitTextToSize(explicacao, pageWidth - 30);
        pdf.text(explicacaoLines, 15, yPosition);
        yPosition += explicacaoLines.length * 6 + 10;
      } else {
        pdf.setFontSize(11);
        pdf.setTextColor(100, 100, 100);
        pdf.text("(Sem explicação disponível)", 15, yPosition);
        yPosition += 10;
      }
      
      pdf.setDrawColor(200, 200, 200);
      pdf.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 15;
    }
    
    pdf.save('MedQuest-Gabarito.pdf');
  };

  return (
    <div className="p-4 min-h-screen bg-gray-950">
      {questions.length === 0 ? (
        <div className="max-w-6xl mx-auto bg-gray-900 rounded-2xl shadow-xl p-8 mb-8 border border-gray-800">
          <h1 className="text-3xl font-bold mb-8 text-white">Configurar Nova Sessão</h1>
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-800 p-6 rounded-xl">
              <label className="block mb-3 font-semibold text-gray-200">Número de Questões</label>
              <input
                type="number"
                min="1"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-3 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="bg-gray-800 p-6 rounded-xl flex items-center gap-4">
              <input
                type="checkbox"
                id="includeRepeats"
                checked={includeRepeats}
                onChange={(e) => setIncludeRepeats(e.target.checked)}
                className="w-6 h-6 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500 transition-all"
              />
              <label htmlFor="includeRepeats" className="font-semibold text-gray-200">
                Incluir questões já respondidas
              </label>
            </div>
          </div>
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6 text-white">Selecione Categorias e Subtópicos</h2>
            <div className="space-y-8">
              {categories.map((category) => {
                const allSelected = category.subtopics.every(sub =>
                  selections.some(s => s.categoria === category.name && s.subtema === sub)
                );
                return (
                  <div key={category.name} className="bg-gray-800 rounded-xl p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-xl text-white">{category.name}</h3>
                      <button
                        onClick={() => handleSelectAllSubtopics(category.name, category.subtopics)}
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {allSelected ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                        <span className="font-medium">Selecionar Todos</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {category.subtopics.map((subtopic) => {
                        const isSelected = selections.some(
                          s => s.categoria === category.name && s.subtema === subtopic
                        );
                        return (
                          <button
                            key={`${category.name}-${subtopic}`}
                            onClick={() => handleSubtopicSelect(category.name, subtopic)}
                            className={`
                              group relative p-4 rounded-lg text-sm transition-all duration-200
                              ${isSelected
                                ? 'bg-blue-600 text-white shadow-lg hover:bg-blue-500'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}
                            `}
                          >
                            <span className="font-medium">{subtopic}</span>
                            {isSelected && (
                              <CheckCircle className="absolute right-2 top-2 w-4 h-4 text-green-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex space-x-4 mt-8">
            <button
              onClick={generatePDFs}
              disabled={isLoading || pdfLoading || selections.length === 0}
              className="flex-1 bg-purple-600 text-white py-4 rounded-xl hover:bg-purple-500 disabled:opacity-50 transition-all duration-200 text-lg font-medium shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {pdfLoading ? (
                <>
                  <Bars height="24" width="24" color="#ffffff" />
                  <span>Gerando PDFs...</span>
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  <span>Gerar PDFs</span>
                </>
              )}
            </button>
            
            <button
              onClick={loadQuestions}
              disabled={isLoading || pdfLoading}
              className="flex-1 bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-all duration-200 text-lg font-medium shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Bars height="24" width="24" color="#ffffff" />
                  <span>Carregando...</span>
                </>
              ) : (
                'Iniciar Sessão'
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto">
          <div className="bg-gray-900 rounded-2xl shadow-xl p-6 mb-6 border border-gray-800">
            <div className="flex justify-between items-center">
              <span className="text-white font-medium">
                Questão {currentQuestion + 1} de {questions.length}
              </span>
              <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (autoReadEnabled && currentAudio) {
                    currentAudio.pause();
                    setCurrentAudio(null);
                  }
                  setAutoReadEnabled(!autoReadEnabled);
                }}
                className={`p-2 rounded-full transition-colors ${
                  autoReadEnabled
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                disabled={isReading}
              >
                Leitura auto
              </button>
              <button
                onClick={cyclePlaybackRate}
                className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                title="Alterar velocidade de reprodução"
              >
                {`x${playbackRate}`}
              </button>
                <div className="flex gap-4">
                  <div className="flex items-center bg-blue-600 text-white px-3 py-2 rounded-lg shadow-md">
                    <span className="font-semibold">Questão:</span>
                    <span className="ml-2">{Math.floor((Date.now() - questionStartTime) / 1000)}s</span>
                  </div>
                  <div className="flex items-center bg-purple-600 text-white px-3 py-2 rounded-lg shadow-md">
                    <span className="font-semibold">Total:</span>
                    <span className="ml-2">{Math.floor((Date.now() - sessionStartTime) / 1000)}s</span>
                  </div>
                </div>
              </div>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Bars height="50" width="50" color="#3b82f6" ariaLabel="loading" />
              </div>
            ) : (
              questions[currentQuestion] && (
                <Question
                  key={currentQuestion}
                  data={questions[currentQuestion]}
                  onConfirm={handleAnswer}
                  onNext={handleNextQuestion}
                  onComplete={handleCompleteQuestion}
                  autoReadEnabled={autoReadEnabled}
                  readText={readText}
                  isReading={isReading}
                  toggleQuestionAudio={toggleQuestionAudio}
                  replayQuestionAudio={replayQuestionAudio}
                  toggleExplanationAudio={toggleExplanationAudio}
                  replayExplanationAudio={replayExplanationAudio}
                  questionAudioPlaying={!!questionAudioPlaying}
                  explanationAudioPlaying={!!explanationAudioPlaying}
                  audioLoading={audioLoading}
                  onExplanationDisplayed={preloadNextQuestionAudio}
                />
              )
            )}
            {isCompleting && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <Bars height="60" width="60" color="#ffffff" />
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default Session;