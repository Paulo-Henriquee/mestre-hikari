# 🔮 Mestre Hikari

Interface web interativa para o projeto Mestre Hikari - Uma experiência de inteligência espiritual aplicada ao Aikidô.

---

## ⚡ Teste Rápido

1. Abra `index.html` no navegador
2. Permita o microfone
3. Clique na esfera e fale!

✅ **Modo teste ativo** - funciona sem configuração!

---

## ✨ Características

- **Esfera de Cristal Animada**: Bola mística com efeitos 3D e partículas flutuantes
- **Captura de Áudio**: Gravação direta do microfone do usuário
- **Estados Visuais**:
  - 🔵 **Ouvindo** - Esfera azul com ondas sonoras
  - 🟡 **Processando** - Esfera dourada girando
  - 🟢 **Falando** - Esfera verde com pulsação
- **Integração via Webhook**: Envia áudio para n8n e recebe resposta processada

## 🔗 Integração com n8n

### Configuração

Edite `script.js` (linhas 6-10):

```javascript
const CONFIG = {
    webhookUrl: 'https://seu-n8n.com/webhook/mestre-hikari', // ← Sua URL aqui
    maxRecordingTime: 30000,
    testMode: false, // ← Mude para false quando configurar
};
```

### Formato da Resposta (JSON)

O n8n deve retornar:

```json
{
  "success": true,
  "transcription": "O que é equilíbrio?",
  "response": "O equilíbrio não se busca com força...",
  "audioBase64": "//uQxAAAAAAAAAAAAAAA..."
}
```

**Campo obrigatório:**
- `audioBase64` - Áudio MP3 em base64 (ElevenLabs)

**Campos opcionais (úteis para debug):**
- `transcription` - Texto do Whisper
- `response` - Resposta do GPT
- `success` - Status

### Fluxo no n8n

```
Webhook → Whisper → GPT-4 → ElevenLabs → Base64 → Response
```

1. Recebe áudio WebM do front-end
2. Transcreve com Whisper
3. Gera resposta filosófica com GPT-4
4. Converte para áudio com ElevenLabs
5. Retorna MP3 em base64

---

## 🎯 Como Interagir

1. **Clique na esfera** ou **pressione ESPAÇO**
2. Fale sua pergunta sobre Aikidô
3. Clique "Parar Gravação" ou **solte ESPAÇO**
4. Aguarde o Mestre processar e responder

**Dicas:**
- Abra o console (F12) para ver logs detalhados
- Use HTTPS ou localhost para o microfone funcionar
- No modo teste, as respostas aparecem como texto

## 📁 Arquivos

```
aikido/
├── index.html    # Interface
├── style.css     # Estilos
├── script.js     # Lógica
└── README.md     # Docs
```

## 🐛 Problemas Comuns

**Microfone não funciona:**
- Use HTTPS ou localhost
- Permita acesso no navegador

**Áudio não reproduz:**
- Veja console (F12) para erros
- Verifique formato base64

**Webhook não responde:**
- Confirme URL correta
- Verifique CORS no n8n

---

**Desenvolvido para o evento de Aikidô 🥋**

