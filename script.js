// ==========================================
// MESTRE HIKARI - FRONT END
// ==========================================

// Configuração do webhook n8n
const CONFIG = {
    webhookUrl: 'https://n8n.pauloamaral.tech/webhook/mestre-hikari', // ALTERE AQUI para o webhook do n8n
    maxRecordingTime: 30000, // 30 segundos máximo
    testMode: false, // MODO DE TESTE: true = simula respostas localmente, false = usa webhook real (voltar para true até resolver CORS)
};

/*
 * FORMATO ESPERADO DA RESPOSTA DO N8N:
 * 
 * O webhook deve retornar um JSON com esta estrutura:
 * 
 * {
 *   "success": true,
 *   "transcription": "O que é equilíbrio?",
 *   "response": "O equilíbrio não se busca com força...",
 *   "audioBase64": "//uQxAAAAAAAAAAAAAAA..." 
 * }
 * 
 * Campos obrigatórios:
 * - audioBase64: string com o áudio em base64 (formato MP3 do ElevenLabs)
 * 
 * Campos opcionais (úteis para debug):
 * - transcription: texto transcrito pelo Whisper
 * - response: texto da resposta gerada pelo GPT
 * - success: status da operação
 */

// Estado da aplicação
let state = {
    isRecording: false,
    isProcessing: false,
    isSpeaking: false,
    mediaRecorder: null,
    audioChunks: [],
    stream: null,
};

// Elementos DOM
const orbContainer = document.querySelector('.orb-container');
const statusText = document.getElementById('status-text');
const stopBtn = document.getElementById('stop-btn');
const soundWaves = document.querySelector('.sound-waves');
const responseAudio = document.getElementById('response-audio');
const subtitle = document.getElementById('subtitle');

// ==========================================
// PARTÍCULAS DE FUNDO
// ==========================================
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

class Particle {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        this.opacity = Math.random() * 0.5 + 0.2;
    }
    
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
    }
    
    draw() {
        ctx.fillStyle = `rgba(167, 139, 250, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

const particles = [];
for (let i = 0; i < 100; i++) {
    particles.push(new Particle());
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });
    
    requestAnimationFrame(animateParticles);
}

animateParticles();

// Redimensionar canvas
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// ==========================================
// FUNÇÕES DE ÁUDIO
// ==========================================

async function startRecording() {
    try {
        // Solicitar permissão do microfone
        state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Criar MediaRecorder
        state.mediaRecorder = new MediaRecorder(state.stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        state.audioChunks = [];
        
        // Coletar chunks de áudio
        state.mediaRecorder.addEventListener('dataavailable', event => {
            if (event.data.size > 0) {
                state.audioChunks.push(event.data);
            }
        });
        
        // Quando terminar a gravação
        state.mediaRecorder.addEventListener('stop', async () => {
            const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
            await sendAudioToWebhook(audioBlob);
            
            // Parar stream
            if (state.stream) {
                state.stream.getTracks().forEach(track => track.stop());
                state.stream = null;
            }
        });
        
        // Iniciar gravação
        state.mediaRecorder.start();
        state.isRecording = true;
        
        updateUI('listening');
        
        // Timeout de segurança
        setTimeout(() => {
            if (state.isRecording) {
                stopRecording();
            }
        }, CONFIG.maxRecordingTime);
        
    } catch (error) {
        console.error('Erro ao acessar microfone:', error);
        alert('Não foi possível acessar o microfone. Por favor, permita o acesso.');
        resetState();
    }
}

function stopRecording() {
    if (state.mediaRecorder && state.isRecording) {
        state.mediaRecorder.stop();
        state.isRecording = false;
    }
}

async function sendAudioToWebhook(audioBlob) {
    updateUI('processing');
    
    // MODO DE TESTE: Simula resposta local
    if (CONFIG.testMode) {
        console.log('🧪 Simulando resposta do Mestre...');
        await simulateResponse();
        return;
    }
    
    // MODO PRODUÇÃO: Envia para webhook real
    try {
        console.log('🌐 Enviando para n8n:', CONFIG.webhookUrl);
        console.log('📦 Tamanho do áudio:', (audioBlob.size / 1024).toFixed(2) + ' KB');
        
        // Criar FormData com o áudio
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('timestamp', new Date().toISOString());
        
        // Enviar para o webhook
        const response = await fetch(CONFIG.webhookUrl, {
            method: 'POST',
            body: formData,
        });
        
        console.log('📡 Status da resposta:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('📥 Resposta recebida do n8n:', {
            hasAudioBase64: !!data.audioBase64,
            hasAudioUrl: !!data.audioUrl,
            transcription: data.transcription,
            response: data.response
        });
        
        // Priorizar base64 (ElevenLabs)
        if (data.audioBase64) {
            console.log('🎵 Reproduzindo áudio (base64)');
            const audioData = `data:audio/mpeg;base64,${data.audioBase64}`;
            playResponse(audioData, data.response);
        } else if (data.audioUrl) {
            console.log('🎵 Reproduzindo áudio (URL)');
            playResponse(data.audioUrl, data.response);
        } else {
            throw new Error('Resposta não contém áudio (audioBase64 ou audioUrl)');
        }
        
    } catch (error) {
        console.error('Erro ao processar áudio:', error);
        statusText.textContent = 'Erro ao processar. Tente novamente.';
        statusText.className = '';
        setTimeout(resetState, 3000);
    }
}

// Simula resposta do Mestre Hikari (modo teste)
async function simulateResponse() {
    const responses = [
        "O equilíbrio não se busca com força. Ele surge quando a mente e o corpo respiram no mesmo tempo.",
        "A técnica perfeita não é rápida nem forte. É como a água — ela se adapta, flui e nunca resiste.",
        "Aikidô é a arte de não lutar. É transformar conflito em dança, força em harmonia.",
        "O centro não está no corpo, mas na intenção. Quando a intenção é clara, o movimento é natural.",
        "A energia flui onde a atenção vai. Não force o ki, apenas conduza-o com suavidade.",
        "Um mestre não vence o oponente. Ele o convida a dançar até que não haja mais conflito.",
        "A verdadeira força está na suavidade. O bambu se curva ao vento, mas não quebra.",
        "Cada queda é um ensinamento. Cada levantada é uma escolha de continuar."
    ];
    
    // Simular delay de processamento (2-4 segundos)
    const delay = Math.random() * 2000 + 2000;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Escolher resposta aleatória
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    console.log('💬 Mestre:', randomResponse);
    
    // Simular "fala" sem áudio real (apenas visual)
    simulateSpeaking(randomResponse);
}

// Simula o Mestre "falando" mostrando o texto na tela
function simulateSpeaking(text) {
    updateUI('speaking');
    
    // Mostrar o texto da resposta
    statusText.textContent = `"${text}"`;
    
    // Calcular duração baseada no tamanho do texto (simular tempo de fala)
    const wordsPerSecond = 2.5;
    const words = text.split(' ').length;
    const duration = (words / wordsPerSecond) * 1000;
    
    // Após a "fala", voltar ao estado inicial
    setTimeout(() => {
        resetState();
    }, duration);
}

function playResponse(audioSrc, responseText = null) {
    updateUI('speaking');
    
    // Mostrar texto da resposta se disponível
    if (responseText) {
        statusText.textContent = `"${responseText}"`;
        console.log('💬 Mestre Hikari:', responseText);
    }
    
    responseAudio.src = audioSrc;
    
    // Tentar reproduzir
    responseAudio.play()
        .then(() => {
            console.log('▶️ Áudio reproduzindo...');
        })
        .catch(error => {
            console.error('❌ Erro ao reproduzir áudio:', error);
            statusText.textContent = 'Erro ao reproduzir áudio. Tente novamente.';
            setTimeout(resetState, 3000);
        });
    
    // Quando terminar de falar
    responseAudio.addEventListener('ended', () => {
        console.log('✅ Áudio finalizado');
        resetState();
    }, { once: true });
    
    // Tratar erro de reprodução
    responseAudio.addEventListener('error', (e) => {
        console.error('❌ Erro no elemento de áudio:', e);
        statusText.textContent = 'Erro ao reproduzir resposta.';
        setTimeout(resetState, 3000);
    }, { once: true });
}

// ==========================================
// INTERFACE E ESTADOS
// ==========================================

function updateUI(newState) {
    // Limpar classes anteriores
    orbContainer.classList.remove('listening', 'processing', 'speaking');
    soundWaves.classList.remove('active');
    statusText.className = '';
    stopBtn.classList.add('hidden');
    
    switch(newState) {
        case 'listening':
            orbContainer.classList.add('listening');
            soundWaves.classList.add('active');
            statusText.textContent = 'Ouvindo... Fale sua pergunta';
            statusText.classList.add('listening');
            stopBtn.classList.remove('hidden');
            break;
            
        case 'processing':
            orbContainer.classList.add('processing');
            statusText.textContent = 'O Mestre está contemplando...';
            statusText.classList.add('processing');
            state.isProcessing = true;
            break;
            
        case 'speaking':
            orbContainer.classList.add('speaking');
            soundWaves.classList.add('active');
            statusText.textContent = 'O Mestre fala...';
            statusText.classList.add('speaking');
            state.isSpeaking = true;
            break;
            
        default:
            statusText.textContent = 'Aguardando...';
    }
}

function resetState() {
    state.isRecording = false;
    state.isProcessing = false;
    state.isSpeaking = false;
    state.audioChunks = [];
    
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
        state.stream = null;
    }
    
    updateUI('idle');
    statusText.textContent = 'Toque a esfera para fazer uma pergunta';
}

// ==========================================
// EVENT LISTENERS
// ==========================================

// Clique na esfera
orbContainer.addEventListener('click', () => {
    if (!state.isRecording && !state.isProcessing && !state.isSpeaking) {
        startRecording();
    }
});

// Botão de parar gravação
stopBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    stopRecording();
});

// Atalho de teclado (Espaço)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !state.isRecording && !state.isProcessing && !state.isSpeaking) {
        e.preventDefault();
        startRecording();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && state.isRecording) {
        e.preventDefault();
        stopRecording();
    }
});

// ==========================================
// INICIALIZAÇÃO
// ==========================================

window.addEventListener('load', () => {
    console.log('🔮 Mestre Hikari inicializado');
    
    if (CONFIG.testMode) {
        console.log('🧪 MODO DE TESTE - Respostas simuladas localmente');
        console.log('💡 Para usar o n8n, altere CONFIG.testMode = false');
        subtitle.textContent = 'Modo Teste - Toque a esfera!';
        statusText.textContent = 'Toque a esfera para começar';
    } else {
        console.log('🌐 MODO PRODUÇÃO - Conectado ao n8n');
        console.log('🔗 Webhook:', CONFIG.webhookUrl);
        statusText.textContent = 'Toque a esfera para fazer uma pergunta';
    }
});

// Prevenir refresh acidental
window.addEventListener('beforeunload', (e) => {
    if (state.isRecording || state.isProcessing) {
        e.preventDefault();
        e.returnValue = '';
    }
});

