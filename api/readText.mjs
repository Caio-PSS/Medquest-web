import fetch from 'node-fetch';
import { createClient } from 'redis';
import { GoogleAuth } from 'google-auth-library';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';

// Função auxiliar para logs com timestamp
const log = (message, data = '') => {
  console.log(
    `[${new Date().toISOString()}] ${message}${data ? `: ${JSON.stringify(data)}` : ''}`
  );
};

const redis = createClient({
  url: process.env.REDIS_URL || process.env.STORAGE_URL,
  socket: {
    tls: (process.env.REDIS_URL || process.env.STORAGE_URL)?.startsWith('rediss://'),
    rejectUnauthorized: process.env.NODE_ENV !== 'production'
  }
});

log('Iniciando conexão com Redis');
redis.connect().catch(err => log('Erro ao conectar ao Redis', err.message));

// Definindo os limites individuais para Google e Polly (900.000 caracteres cada)
const GOOGLE_LIMIT = 900000;
const POLLY_LIMIT = 900000;

// Dados da conta de serviço do Google (hardcoded conforme solicitado)
const serviceAccount = {
  "type": "service_account",
  "project_id": "ankicollab-media-acess-443012",
  "private_key_id": "7f34786f83e0e620604d0a54a726660ae4773dbb",
  "private_key": `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCouBRXFwXhboVR
B64kx9/EShWS3/m7W59oBt1BeoXuqo1ggnocAWGkIfdbjoYsKSTrVsuQMM1mSuB9
OXtHWpL806WZeflaOnh6SaqD1aAyzpA8phzdzvgcGIR6sNjqwKaN2mUWRMU986dp
kmkVN/Ik1bbkDSXBJUM3DVBxL+S6o2cDAO6NvOMnmRpuBRkCvkgjKtWCzA2VO2yb
TwDaM748WcK1q7b5zAP0uOR2gfZXNUiTXu4X6wi9SRbQXdZAq6hWzmJZwHXcjoW/
C7GvCg1JSYPkjzAZdXEuJsYW2rARmiBOlJNp23N6SBasPvxXbix3v9ypyWg2pU+I
/VLojJEHAgMBAAECggEAP09T0ppBCqZ+QDmxjvuxa+ag0cxZ2YQ3/MEWpUtklnpJ
Mr3DNF8QVJaqSyDgGBIYWHbpS+IEMS5HrrWzHMNQBK8mpMCwYLswGjMqWO4AfxAj
754lltXjJCfPDnrt6qj/1prs8746hVS4rVTTObMUmd3YExsb364r2qyUUuS135J1
TFXEjAQH7chEygLmlV2WU5peimXF2LCgFpG0tqzM4sOlIndsvQ0+ZnR+1BIzOIg+
+aZbEXp0U/ON6k0dgkXTZn/V35v6xN+G+ZalxAZQUGBZP4IztPF68DMir/UlGFNr
YIUbTYzViJeWRI7Tn4x5w7PdpXiEm6CHQbXvW4rLAQKBgQDP3v+qHMRGFOFuU3rc
he2UaFjMsyQXZnKgCJ7OUCN0RVpEbHVBmjkexDIoQ2Wba+0vQ99wzdd/QGU565I8
pEhIx802W5Twn7lKdEI6QcbWZjKnIlHCm3OmTRLzh9HE0L+HHSFpa4+5DnJcE0pT
au+iEKsarRZafU0PZ9i32Jvd7wKBgQDPyHMEduDBMoctVEFxszyClSvJeCsKWjBO
lIBxvoOCmWMDTWmZou0M9V403X03VJf3+qoURrAKlkqcH/mnxlN9vnCjFnfc1qAk
i5pWVlF+RVoNOorYA92mjVGV5jrVdeW4IcnRW1ExSY3JoLscst03HycQrAVlH7l9
kO7L2TQWaQKBgFoEG3qzElu21xhLljzA0m0d8rZSLSLk/mZG1V5KXdAP6FMRFIXg
HzQvifjdlraDOibpoWzb9qHoZO18Ecuo6JR70WXkqs64nCidx8Aqk8xsXSr7NaSs
ZJxza+2Bt1kffJEqEDnylj5w/xzYTatp93Oa/D2FDtUIxcISGksixfyJAoGBAMi4
7VNsu6Ym96r0b9w0t8m17PzNV1bC1VOz5Xj7//MT1jCEgfTnDXStO/p51NK0p7Ho
tpCr0LgJg73arcRDtLgOVqVVuSjfNQjYy5mH/WWr/Vg2K5aN9XtFnYDfTgqTv/zm
tx3Fx2ODmLMk0Fzi9QygzY4vf262/OuuLOFDzCuxAoGBAIqziwNH3WgRtBZ6O5CQ
O+nGMl0Yb0btB7Ym9CFPQyKmJmaBJ2u5DlC+5z2NxZd47frPmDnhKBY3aE1fRp6Q
KabhEDQVNXtHLZJR4m70+dFhcR/UktXsPZmF0vUQRc5xO6xKA5KE3G/JanIlu6+y
Vmw8YjwYPbhCN5ABm8bcJPS7
-----END PRIVATE KEY-----\n`,
  "client_email": "medquest-tts@ankicollab-media-acess-443012.iam.gserviceaccount.com",
  "client_id": "110248727246567148185",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/medquest-tts%40ankicollab-media-acess-443012.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

// Mapeamento de vozes para Polly
const voiceMap = {
  'pt-BR-Neural2': 'Ricardo',
  'pt-BR-Standard': 'Vitoria',
};

export default async function handler(req, res) {
  log('Início da requisição');

  if (req.method !== 'POST') {
    log('Método não permitido', req.method);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { text, language = 'pt-BR', voice = 'pt-BR-Neural2' } = req.body;
  log('Dados recebidos', {
    text: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
    language,
    voice
  });

  if (!text || typeof text !== 'string') {
    log('Texto inválido ou não fornecido');
    return res.status(400).json({ error: 'Texto inválido ou não fornecido' });
  }

  try {
    // Garante a conexão com o Redis
    log('Verificando conexão com Redis');
    if (!redis.isOpen) {
      log('Redis desconectado, tentando reconectar');
      await redis.connect();
      log('Redis reconectado com sucesso');
    }

    // Tenta utilizar o Google TTS, se a contagem permitir
    const googleUsed = Number(await redis.get('googleCharsUsed')) || 0;
    if (googleUsed + text.length <= GOOGLE_LIMIT) {
      try {
        log('Incrementando contagem do Google', { contagemAnterior: googleUsed });
        await redis.incrBy('googleCharsUsed', text.length);

        // Gerando token OAuth 2.0 para Google TTS
        const auth = new GoogleAuth({
          credentials: serviceAccount,
          scopes: 'https://www.googleapis.com/auth/cloud-platform'
        });
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        const googleAccessToken = tokenResponse.token;
        if (!googleAccessToken) {
          throw new Error('Não foi possível obter o token OAuth 2.0 para o Google TTS.');
        }

        // Monta o payload para o Google TTS
        const payload = {
          input: { text },
          voice: { languageCode: language, name: voice },
          audioConfig: { audioEncoding: "LINEAR16" }
        };

        log('Enviando requisição para Google TTS');
        const startGoogle = Date.now();
        const googleResponse = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-User-Project": serviceAccount.project_id,
            "Authorization": `Bearer ${googleAccessToken}`
          },
          body: JSON.stringify(payload)
        });
        log('Resposta do Google TTS recebida', { duration: `${Date.now() - startGoogle}ms` });

        if (!googleResponse.ok) {
          const errorData = await googleResponse.json();
          throw new Error(errorData.error?.message || 'Erro ao sintetizar áudio com Google TTS');
        }

        const data = await googleResponse.json();
        if (!data.audioContent) {
          throw new Error('Nenhum áudio retornado pelo Google TTS');
        }

        log('Processamento concluído com sucesso (Google TTS)');
        return res.status(200).json({
          audioContent: data.audioContent,
          charsUsed: text.length,
          totalUsed: googleUsed + text.length,
          service: 'Google'
        });
      } catch (googleError) {
        log('Erro ao usar Google TTS', { message: googleError.message });
        // Reverte a contagem do Google em caso de erro
        await redis.decrBy('googleCharsUsed', text.length).catch(err =>
          log('Erro ao reverter contagem do Google', err.message)
        );
        log('Fazendo fallback para Polly TTS devido ao erro no Google');
      }
    } else {
      log('Limite do Google atingido, utilizando Polly TTS');
    }

    // Fallback para Polly TTS
    const pollyUsed = Number(await redis.get('pollyCharsUsed')) || 0;
    if (pollyUsed + text.length > POLLY_LIMIT) {
      log('Limite do Polly excedido', { pollyUsed, textLength: text.length });
      return res.status(429).json({
        error: 'Limite do Polly excedido',
        remaining: POLLY_LIMIT - pollyUsed
      });
    }
    log('Incrementando contagem do Polly', { contagemAnterior: pollyUsed });
    await redis.incrBy('pollyCharsUsed', text.length);

    log('Inicializando cliente Polly');
    const pollyClient = new PollyClient({ region: process.env.AWS_REGION });
    // Seleciona a voz para o Polly (usa mapeamento, se disponível)
    const pollyVoice = voiceMap[voice] || voice || 'Ricardo';
    log('Voz selecionada para Polly', { originalVoice: voice, pollyVoice });

    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: pollyVoice,
      LanguageCode: language
    });

    log('Enviando comando para Polly');
    const startPolly = Date.now();
    const ttsResponse = await pollyClient.send(command);
    log('Resposta recebida do Polly', { duration: `${Date.now() - startPolly}ms` });

    log('Processando AudioStream do Polly');
    const startStream = Date.now();
    const audioStream = ttsResponse.AudioStream;
    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);
    const audioContent = audioBuffer.toString('base64');
    log('AudioStream processado', { duration: `${Date.now() - startStream}ms`, audioSize: audioContent.length });

    log('Enviando resposta ao cliente (Polly)');
    return res.status(200).json({
      audioContent,
      charsUsed: text.length,
      totalUsed: pollyUsed + text.length,
      service: 'Polly'
    });
  } catch (error) {
    log('Erro na API', { message: error.message, stack: error.stack });

    // Reverter a contagem se ocorrer erro
    if (text && redis.isOpen) {
      log('Revertendo contagens no Redis devido ao erro');
      await redis.decrBy('googleCharsUsed', text.length).catch(err =>
        log('Erro ao reverter contagem do Google', err.message)
      );
      await redis.decrBy('pollyCharsUsed', text.length).catch(err =>
        log('Erro ao reverter contagem do Polly', err.message)
      );
    }
    const status = error.$metadata?.httpStatusCode || 500;
    log('Respondendo com erro', { status, error: error.message });
    return res.status(status).json({ error: error.message || 'Erro interno no servidor' });
  }
}
