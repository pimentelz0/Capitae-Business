# 💰 Capitae - Seu Gestor Financeiro Inteligente

O **Capitae** é um aplicativo de gestão financeira minimalista e moderno, focado em simplicidade e clareza. Ele conta com o **Capy**, um agente de inteligência artificial integrado que ajuda você a entender seus gastos e atingir suas metas.

## 🚀 Funcionalidades

- **Dashboard Completo**: Visualize seu saldo, gastos mensais e progresso de metas em uma interface limpa.
- **Capy AI**: Um assistente inteligente (Gemini 3 Flash) que:
  - Registra gastos via chat (ex: "Gastei 30 reais com pizza").
  - Cria "Caixinhas" (metas de economia) para você.
  - Lembra de suas preferências e objetivos pessoais.
  - Analisa suas finanças e dá dicas de economia.
  - Mantém um histórico de conversas persistente.
- **Gestão de Gastos**: Categorize e acompanhe cada centavo.
- **Metas (Caixinhas)**: Defina objetivos financeiros e acompanhe o progresso visualmente.
- **Design Premium**: Interface escura com detalhes em verde neon, animações suaves e foco na experiência do usuário.

## 🛠️ Tecnologias

- **Frontend**: React + TypeScript + Vite
- **Estilização**: Tailwind CSS
- **Animações**: Framer Motion (Motion)
- **Banco de Dados & Auth**: Supabase
- **Inteligência Artificial**: Google Gemini SDK (@google/genai)
- **Ícones**: Lucide React

## ⚙️ Configuração Necessária

Para rodar este projeto localmente, você precisará configurar as seguintes variáveis de ambiente:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
GEMINI_API_KEY=sua_chave_da_api_gemini
```

## 📦 Como rodar

1. Clone o repositório.
2. Instale as dependências: `npm install`.
3. Inicie o servidor de desenvolvimento: `npm run dev`.

---
Desenvolvido com ❤️ para ajudar você a dominar suas finanças.
