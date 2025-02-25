import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { kv } from '@vercel/kv';

const GLOBAL_LIMIT = 1000000;

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { text, language = 'pt-BR', voice = 'pt-BR-Neural2' } = req.body;
  if (!text) {
    res.status(400).json({ error: 'Texto não informado.' });
    return;
  }

  try {
    // Verificação e atualização atômica do limite
    const currentTotal = await kv.get<number>('totalCharsUsed') || 0;
    
    if (currentTotal + text.length > GLOBAL_LIMIT) {
      res.status(429).json({ error: 'Limite global de caracteres atingido.' });
      return;
    }

    // Atualiza o contador de caracteres
    await kv.incrby('totalCharsUsed', text.length);

    const response = await axios.post(
      'https://texttospeech.googleapis.com/v1/text:synthesize',
      {
        input: { text },
        voice: { languageCode: language, name: voice },
        audioConfig: { audioEncoding: 'MP3' }
      },
      {
        params: { key: process.env.GOOGLE_API_KEY },
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const audioContent = response.data.audioContent;
    res.status(200).json({ audioContent });
    } catch (error) {
    console.error('Erro no processamento:', error);

    // Reverte o contador apenas se houver text definido
    if (typeof text !== 'undefined') {
      await kv.decrby('totalCharsUsed', text.length);
    }

    // Tratamento seguro do erro
    let errorMessage = 'Falha ao converter texto para fala.';
    
    if (axios.isAxiosError(error)) {
      // Erro específico do Axios
      errorMessage = error.response?.data?.error?.message || error.message;
    } else if (error instanceof Error) {
      // Erro genérico
      errorMessage = error.message;
    }

    res.status(500).json({ 
      error: errorMessage
    });
  }
};