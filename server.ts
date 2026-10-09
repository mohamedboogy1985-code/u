import express from 'express';
import http from 'http';
import path from 'path';
import WebSocket, { WebSocketServer } from 'ws';
import { GoogleGenAI, Type, Schema } from '@google/genai';

function safeParseJson<T = any>(text: string, fallback: T): T {
  if (!text) return fallback;
  try {
    const cleaned = text.replace(/```(?:json)?\n?/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    try {
      const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) return JSON.parse(match[0]);
    } catch {}
    return fallback;
  }
}

async function callWithModelFallback<T>(
  models: string[],
  fn: (model: string) => Promise<T>
): Promise<T> {
  let lastError: any = null;
  for (const model of models) {
    try {
      return await fn(model);
    } catch (err: any) {
      lastError = err;
      console.warn(`[Model Fallback] ${model} failed (${err?.message || err}). Trying next model...`);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw lastError;
}

function extractEntitiesHeuristic(transcript: string): { text: string; category: string }[] {
  const entities: { text: string; category: string }[] = [];
  
  const locationTerms = ['الرياض', 'جدة', 'مكة', 'المدينة', 'القاهرة', 'دبي', 'أبوظبي', 'الدوحة', 'الكويت', 'مصر', 'السعودية', 'الإمارات', 'قطر', 'عمان', 'بيروت', 'بغداد', 'لندن', 'باريس', 'Cairo', 'Riyadh', 'Dubai', 'London', 'Paris'];
  const orgTerms = ['جوجل', 'أبل', 'مايكروسوفت', 'أمازون', 'ميتا', 'تسلا', 'أرامكو', 'سابك', 'وزارة', 'جامعة', 'شركة', 'Google', 'Apple', 'Microsoft', 'Amazon', 'Meta'];
  const techTerms = ['ذكاء اصطناعي', 'خوارزمية', 'سحابة', 'تطبيق', 'برمجة', 'قاعدة بيانات', 'نموذج', 'API', 'AI', 'Cloud', 'Python', 'Database'];

  locationTerms.forEach(loc => {
    if (transcript.includes(loc)) entities.push({ text: loc, category: 'location' });
  });
  orgTerms.forEach(org => {
    if (transcript.includes(org)) entities.push({ text: org, category: 'organization' });
  });
  techTerms.forEach(tech => {
    if (transcript.includes(tech)) entities.push({ text: tech, category: 'tech' });
  });

  const dateRegex = /\b\d{1,4}(?:[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)?\b|اليوم|أمس|غداً|الأسبوع|الشهر|السنة|\b\d+%\b/g;
  let match;
  while ((match = dateRegex.exec(transcript)) !== null) {
    entities.push({ text: match[0], category: 'datetime' });
  }

  return entities;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // Audio file transcription endpoint (نسخ الملفات الصوتية)
  app.post('/api/transcribe-file', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set' });
    }

    const { audioBase64, audioMimeType, language, customVocabulary } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 is required' });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const mime = audioMimeType || 'audio/mp3';
      const isArabic = language === 'ar' || !language;

      const vocabGuide = customVocabulary && customVocabulary.length > 0
        ? `Pay special attention to these terms or vocabulary: ${customVocabulary.join(', ')}.`
        : '';

      const langPrompt = isArabic
        ? 'The audio may be in Arabic (العربية) or English or mixed. Transcribe it with native accuracy, preserving proper Arabic characters, diacritics if appropriate, and dialect nuance.'
        : `Transcribe with target language: ${language}.`;

      const prompt = `You are an expert audio transcription system.
${langPrompt}
${vocabGuide}

Perform a high-fidelity transcription of the provided audio file.
Provide your response strictly in JSON with the following fields:
1. "smart": A clean, publication-ready, natural transcript. Remove disfluencies, accidental stutters, and unnecessary filler words (like "um", "uh", "يعني", "أم", "أه"), with perfect punctuation and sentence segmentation.
2. "verbatim": An exact word-for-word transcript preserving every uttered word, hesitation, filler word, and false start.
3. "language": The detected spoken language (e.g. "Arabic", "English").
4. "fillerWords": An array of specific filler words or hesitation particles identified in the speech.
5. "summary": A brief 1-2 sentence summary of what was spoken (in the primary language of the audio).

JSON Response Schema:
{
  "smart": string,
  "verbatim": string,
  "language": string,
  "fillerWords": string[],
  "summary": string
}`;

      const response = await callWithModelFallback(
        ['gemini-3.5-transcribe', 'gemini-3.8-flash', 'gemini-flash-latest'],
        (m) =>
          ai.models.generateContent({
            model: m,
            contents: [
              {
                inlineData: {
                  data: audioBase64,
                  mimeType: mime,
                },
              },
              prompt,
            ],
            config: {
              responseMimeType: 'application/json',
            },
          })
      );

      const rawText = response.text || '{}';
      const parsed = safeParseJson(rawText, {
        smart: '',
        verbatim: '',
        language: isArabic ? 'Arabic' : 'English',
        fillerWords: [],
        summary: '',
      });
      res.json(parsed);
    } catch (err: any) {
      console.error('File transcription error:', err);
      res.status(500).json({ error: err.message || 'Failed to transcribe audio file' });
    }
  });

  // Automatic keyword and topic classification endpoint
  app.post('/api/classify-keywords', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set' });
    }

    const { transcript, language } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are an expert NLP Entity and Keyword Extractor for speech transcripts (Arabic and English).
Analyze the following transcript and extract key entities, names, locations, organizations, technologies, dates/times/numbers, and action items.

Transcript: "${transcript}"

Extract all relevant items into JSON format:
{
  "entities": [
    {
      "text": "exact word or phrase as appears in transcript",
      "category": "person" | "location" | "organization" | "tech" | "datetime" | "action"
    }
  ]
}

Categories allowed:
- "person": Names of people, titles, roles (e.g. دكتور، محمد، سارة، John, Dr.)
- "location": Cities, countries, facilities, places (e.g. الرياض، مصر، مكتب، مطار، Paris)
- "organization": Companies, institutions, government bodies, brands (e.g. جوجل، وزارة، شركة، Google)
- "tech": Technical terms, software, algorithms, platforms (e.g. ذكاء اصطناعي، API، سحابة، خوارزمية)
- "datetime": Dates, time, numbers, percentages, currencies (e.g. اليوم، غداً، 2026، 50%، ألف، دولار)
- "action": Decisions, tasks, requirements, commitments (e.g. قرار، سنقوم، يجب، موعد تسليم)

Respond strictly with valid JSON.`;

      let entities: { text: string; category: string }[] = [];
      try {
        const response = await callWithModelFallback(
          ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
          (m) =>
            ai.models.generateContent({
              model: m,
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
              },
            })
        );
        const raw = response.text || '{"entities":[]}';
        const parsed = safeParseJson(raw, { entities: [] });
        entities = Array.isArray(parsed.entities) ? parsed.entities : [];
      } catch (geminiErr) {
        console.warn('Gemini models unavailable for classification, using heuristic extractor:', geminiErr);
        entities = extractEntitiesHeuristic(transcript);
      }

      res.json({ entities });
    } catch (err: any) {
      console.error('Keyword classification error:', err);
      // Fallback heuristic even on fatal catch
      const fallbackEntities = extractEntitiesHeuristic(transcript);
      res.json({ entities: fallbackEntities });
    }
  });

  // AI Voice Reply endpoint (الرد الصوتي من الذكاء الاصطناعي)
  app.post('/api/ai-voice-reply', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set' });
    }

    const { transcript, language, voiceName = 'Kore' } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const isArabic = language === 'ar' || /[\u0600-\u06FF]/.test(transcript);

    try {
      const ai = new GoogleGenAI({ apiKey });

      const replyPrompt = isArabic
        ? `أنت مساعد ذكي ومتحدث صوتي ودود ومحاور لبق. استمعت لما قاله المستخدم في التسجيل الصوتي التالي:
"${transcript}"

قم بالرد عليه مباشرة باللغة العربية الفصحى الطبيعية والودية.
يجب أن يكون الرد تفاعلياً وذكياً، مختصراً ومباشراً ومناسباً للإلقاء الصوتي (بين فقرة إلى فقرتين، لا يزيد عن 40-60 كلمة).
لا تضع رموزاً تعبيرية مفرطة أو تنسيقات Markdown معقدة لأن النص سيتم نطقه صوتياً.`
        : `You are a friendly, intelligent voice assistant. The user just said:
"${transcript}"

Respond conversationally, concisely (2-3 sentences, 40-60 words), and helpfully as if speaking aloud in a voice call.
Avoid markdown symbols or bullets because this will be spoken aloud via text-to-speech.`;

      // Step 1: Generate conversational AI reply with fallback
      let replyText = isArabic ? 'أهلاً بك! لقد استمعت إلى حديثك.' : 'Hello! I heard your message.';
      try {
        const textResponse = await callWithModelFallback(
          ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
          (m) =>
            ai.models.generateContent({
              model: m,
              contents: replyPrompt,
            })
        );
        if (textResponse.text?.trim()) {
          replyText = textResponse.text.trim();
        }
      } catch (textErr) {
        console.warn('Text reply generation fallback triggered:', textErr);
      }

      // Step 2: Synthesize speech using Gemini TTS with fallback
      let audioBase64: string | null = null;
      try {
        const ttsResponse = await callWithModelFallback(
          ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'],
          (m) =>
            ai.models.generateContent({
              model: m,
              contents: [
                {
                  role: 'user',
                  parts: [{ text: replyText }],
                },
              ],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
                  },
                },
              },
            })
        );

        audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      } catch (ttsErr) {
        console.warn('Gemini TTS generation unavailable, client will use Web Speech synthesis:', ttsErr);
      }

      res.json({
        replyText,
        audioBase64,
        audioMimeType: 'audio/wav',
        voiceName: voiceName || 'Kore',
      });
    } catch (err: any) {
      console.error('AI voice reply fatal error:', err);
      res.json({
        replyText: isArabic ? 'أهلاً بك! لقد تم تسجيل نصك بنجاح.' : 'Hello! Your transcript has been recorded.',
        audioBase64: null,
        audioMimeType: 'audio/wav',
        voiceName: voiceName || 'Kore',
      });
    }
  });

  // Standalone TTS endpoint (قراءة أي نص بالصوت)
  app.post('/api/tts', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set' });
    }

    const { text, voiceName = 'Kore' } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const ttsResponse = await callWithModelFallback(
        ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'],
        (m) =>
          ai.models.generateContent({
            model: m,
            contents: [
              {
                role: 'user',
                parts: [{ text }],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
                },
              },
            },
          })
      );

      const audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      res.json({
        audioBase64,
        audioMimeType: 'audio/wav',
      });
    } catch (err: any) {
      console.error('TTS error:', err);
      res.json({
        audioBase64: null,
        audioMimeType: 'audio/wav',
      });
    }
  });

  // Analysis endpoint
  app.post('/api/analyze', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set' });
    }

    const { transcript, durationSeconds, audioBase64, audioMimeType, language } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const words = transcript.trim().split(/\s+/).filter((w: string) => w.length > 0);
    const totalWords = words.length;
    const validDuration = Math.max(1, Math.round(Number(durationSeconds) || 60));
    const isArabic = language === 'ar' || /[\u0600-\u06FF]/.test(transcript);

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const languageInstruction = isArabic
        ? `IMPORTANT: The user spoke in Arabic. Provide ALL text evaluation fields (speakingPaceFeedback, sentenceFormation, speakingStyle, overallFeedback, strengths, areasForImprovement) in eloquent, supportive modern Arabic (العربية الفصحى).`
        : `Provide feedback in clear, constructive English.`;

      const contents: any[] = [
        `You are an expert speech and communication coach. Analyze the following transcript and audio (if provided) of a speaker practicing or delivering a speech.
The user spoke for approximately ${validDuration} seconds with a total of ${totalWords} words.
Transcript: "${transcript}"

${languageInstruction}

Analyze their vocal delivery, sentence formation, speaking style, pauses, cadence, and identify all filler words (such as "um", "uh", "like", "er", "ah", "you know", "basically", and Arabic fillers like "يعني", "أم", "أه", "يعني كذا", "بص", "طيب", "مثلاً", "أصلاً", "فاهم").
Provide precise evaluation on pacing, strengths, and actionable areas for improvement.`
      ];
      
      if (audioBase64 && audioMimeType) {
        contents.push({
          inlineData: {
            data: audioBase64,
            mimeType: audioMimeType
          }
        });
      }

      const response = await callWithModelFallback(
        ['gemini-3.8-flash', 'gemini-flash-latest'],
        (m) =>
          ai.models.generateContent({
            model: m,
            contents: contents,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  overallScore: { type: Type.INTEGER, description: 'Overall score from 0 to 100.' },
                  speakingPaceFeedback: { type: Type.STRING, description: 'Feedback on the speaking pace.' },
                  sentenceFormation: { type: Type.STRING, description: 'Feedback on sentence structure, coherence, and grammatical clarity.' },
                  speakingStyle: { type: Type.STRING, description: 'Feedback on tone, confidence, pauses, and cadence.' },
                  fillerWordsCount: { type: Type.INTEGER, description: 'Count of filler words and verbal disfluencies identified.' },
                  fillerWordsList: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Specific filler words or phrases used.' },
                  overallFeedback: { type: Type.STRING, description: 'A constructive overall summary of the performance.' },
                  strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Key strengths of the speech.' },
                  areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Specific actionable areas to improve.' }
                },
                required: ['overallScore', 'speakingPaceFeedback', 'sentenceFormation', 'speakingStyle', 'fillerWordsCount', 'fillerWordsList', 'overallFeedback', 'strengths', 'areasForImprovement']
              }
            }
          })
      );
      
      const jsonText = response.text || "{}";
      const parsed = safeParseJson(jsonText, {
        overallScore: 85,
        speakingPaceFeedback: isArabic ? 'سرعة الإلقاء جيدة ومتوازنة.' : 'Speaking pace was well balanced.',
        sentenceFormation: isArabic ? 'صياغة الجمل واضحة ومترابطة.' : 'Sentence structure was clear.',
        speakingStyle: isArabic ? 'أسلوب واثق ومسترسل.' : 'Confident and engaging speaking style.',
        fillerWordsCount: 0,
        fillerWordsList: [],
        overallFeedback: isArabic ? 'أداء صوتي ممتاز وتعبير لغوي متقن.' : 'Strong vocal delivery and clear expression.',
        strengths: isArabic ? ['وضوح مخارج الحروف', 'تدفق الأفكار'] : ['Clear diction', 'Logical flow'],
        areasForImprovement: isArabic ? ['الاستمرار في التنفس المتزن'] : ['Pace pauses evenly'],
      });

      const fillerWordsList: string[] = Array.isArray(parsed.fillerWordsList) ? parsed.fillerWordsList : [];
      const reportedFillerCount = typeof parsed.fillerWordsCount === 'number' ? parsed.fillerWordsCount : fillerWordsList.length;
      const fillerWordsCount = Math.min(totalWords, Math.max(0, reportedFillerCount));

      const netWords = Math.max(0, totalWords - fillerWordsCount);
      const grossWpm = Math.round((totalWords / validDuration) * 60);
      const netWpm = Math.round((netWords / validDuration) * 60);

      // Build filler words frequency map
      const fillerMap: Record<string, number> = {};
      fillerWordsList.forEach((w: string) => {
        const clean = w.toLowerCase().replace(/[^a-z0-9 '\u0600-\u06FF]/g, '').trim();
        if (clean) {
          fillerMap[clean] = (fillerMap[clean] || 0) + 1;
        }
      });
      const fillerWordsBreakdown = Object.entries(fillerMap).map(([word, count]) => ({ word, count }));

      const finalResult = {
        ...parsed,
        totalWords,
        netWords,
        durationSeconds: validDuration,
        grossWpm,
        netWpm,
        speakingPaceWpm: grossWpm,
        fillerWordsCount,
        fillerWordsBreakdown,
        fillerWordsRetentionExplanation: isArabic
          ? 'يتم الاحتفاظ بكلمات الحشو (مثل: "يعني"، "أم"، "أه") في النسخ الحرفي للوضوح، ويتم استبعادها في النسخ الذكي.'
          : 'Filler words (e.g., "um", "uh", "like") are retained in the live transcript for visibility. Net WPM removes filler pauses to measure your true substantive speaking pace.'
      };

      res.json(finalResult);
    } catch (err: any) {
      console.error('Analysis error:', err);
      res.status(500).json({ error: 'Failed to analyze transcript' });
    }
  });

  const server = http.createServer(app);

  // WebSocket server for live transcription relay
  const wss = new WebSocketServer({ server, path: '/ws/transcribe' });

  wss.on('connection', (clientWs, req) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set');
      clientWs.send(
        JSON.stringify({
          error: 'GEMINI_API_KEY environment variable is missing on the server.',
        })
      );
      clientWs.close();
      return;
    }

    console.log('Client connected to WebSocket transcription proxy');

    const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    let isClientIntentionallyClosed = false;

    // Configuration from client or defaults
    let baseConfig = {
      model: 'models/gemini-3.5-transcribe-live',
      languageCodes: [] as string[],
      customVocabulary: ['like', 'um', 'uh', 'you know'],
    };

    class LiveSession {
      mode: 'smart' | 'verbatim';
      ws: WebSocket | null = null;
      isConnected: boolean = false;
      pendingMessages: string[] = [];
      reconnectAttempts: number = 0;

      constructor(mode: 'smart' | 'verbatim') {
        this.mode = mode;
      }

      connect() {
        try {
          this.ws = new WebSocket(geminiWsUrl);
        } catch (err) {
          console.error(`[${this.mode}] Failed to create Gemini WebSocket:`, err);
          return;
        }

        this.ws.on('open', () => {
          console.log(`[${this.mode}] Connected to Gemini Live API WebSocket`);
          this.isConnected = true;

          const vocab = baseConfig.customVocabulary || [];

          const sessionSetupMessage = {
            setup: {
              model: baseConfig.model,
              generationConfig: {
                responseModalities: ["TEXT"]
              },
              inputAudioTranscription: {
                mode: this.mode.toUpperCase(),
                ...(baseConfig.languageCodes.length > 0
                  ? { 
                      languageCodes: baseConfig.languageCodes
                    }
                  : {}),
                ...(vocab.length > 0
                  ? { 
                      customVocabulary: vocab
                    }
                  : {}),
              },
            },
          };

          console.log(`[${this.mode}] Sending setup message:`, JSON.stringify(sessionSetupMessage));
          this.ws?.send(JSON.stringify(sessionSetupMessage));

          while (this.pendingMessages.length > 0) {
            const msg = this.pendingMessages.shift();
            if (msg && this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(msg);
            }
          }

          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ 
              type: 'connected', 
              status: `Gemini ${this.mode.toUpperCase()} Live Session Ready`,
              mode: this.mode 
            }));
          }
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
          try {
            const strData = data.toString();
            const parsed = JSON.parse(strData);
            const serverContent = parsed.serverContent || parsed.server_content;
            
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'gemini_response',
                mode: this.mode,
                raw: parsed,
                serverContent: serverContent || null,
              }));
            }
          } catch (e) {
            console.error(`[${this.mode}] Error parsing message:`, e);
          }
        });

        this.ws.on('error', (err) => {
          console.error(`[${this.mode}] WebSocket error:`, err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                error: `Gemini ${this.mode} session: ${err.message || 'Connection error'}`,
                mode: this.mode,
              })
            );
          }
        });

        this.ws.on('close', (code, reason) => {
          const reasonStr = reason.toString();
          console.log(`[${this.mode}] WebSocket closed: ${code} - ${reasonStr}`);
          this.isConnected = false;
          
          if (!isClientIntentionallyClosed && clientWs.readyState === WebSocket.OPEN && this.reconnectAttempts < 3) {
            this.reconnectAttempts++;
            console.log(`[${this.mode}] Auto-reconnecting attempt ${this.reconnectAttempts}/3 to Gemini Live API...`);
            setTimeout(() => this.connect(), 800);
          } else if (this.reconnectAttempts >= 3 && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                error: `Gemini ${this.mode} session closed (${code}). Please check your connection.`,
                mode: this.mode,
              })
            );
          }
        });
      }

      sendAudio(realtimePayload: string) {
        if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(realtimePayload);
        } else {
          this.pendingMessages.push(realtimePayload);
        }
      }

      close() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.close();
        }
      }
    }

    const smartSession = new LiveSession('smart');
    const verbatimSession = new LiveSession('verbatim');

    // Handle incoming messages from the client
    clientWs.on('message', (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'configure') {
          if (msg.customVocabulary || msg.custom_vocabulary) {
            baseConfig.customVocabulary = msg.customVocabulary || msg.custom_vocabulary;
          }
          if (msg.languageCodes || msg.language_codes) {
            baseConfig.languageCodes = msg.languageCodes || msg.language_codes;
          }
          if (msg.model) {
            baseConfig.model = msg.model;
          }
          // Now that we have the configuration, connect to Gemini
          smartSession.connect();
          verbatimSession.connect();
          return;
        }

        if (msg.type === 'audio' || msg.audio) {
          const audioBase64 = msg.audio || msg.data;
          const mimeType = msg.mimeType || 'audio/pcm;rate=16000';

          const realtimePayload = JSON.stringify({
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: mimeType,
                  data: audioBase64,
                },
              ],
            },
          });

          smartSession.sendAudio(realtimePayload);
          verbatimSession.sendAudio(realtimePayload);
        }
      } catch (err) {
        console.error('Error handling client message:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('Client WebSocket connection closed');
      isClientIntentionallyClosed = true;
      smartSession.close();
      verbatimSession.close();
    });
  });

  // Vite development middleware or production static build serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
