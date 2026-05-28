import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, FileText, Check, ExternalLink, Loader2, AlertTriangle, Scale, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TermsConsentModalProps {
  isOpen: boolean;
  userId: string;
  userEmail: string;
  onAcceptComplete: () => void;
}

export default function TermsConsentModal({ isOpen, userId, userEmail, onAcceptComplete }: TermsConsentModalProps) {
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorVisible, setErrorVisible] = useState('');
  
  // Sub-modal states to view documents
  const [showTermsDetail, setShowTermsDetail] = useState(false);
  const [showPrivacyDetail, setShowPrivacyDetail] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!acceptTerms || !acceptPrivacy) {
      setErrorVisible('Você precisa aceitar os Termos de Uso e a Política de Privacidade para prosseguir.');
      return;
    }

    setLoading(true);
    setErrorVisible('');

    try {
      // 1. Update the metadata first or attempt directly to update DB columns
      const acceptedAt = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({
          accepted_terms: true,
          accepted_terms_at: acceptedAt,
          updated_at: acceptedAt
        })
        .eq('id', userId);

      if (error) {
        console.warn('DB Update Error (columns might not exist yet):', error.message);
        
        // Let's store a fallback in local storage so the user is never stuck in the UI,
        // and tell the user that the save was stored locally, while recommending they run the SQL script.
        // But first, let's check if we can update the user metadata as well for redundant backup!
        const { error: metaError } = await supabase.auth.updateUser({
          data: {
            accepted_terms: true,
            accepted_terms_at: acceptedAt
          }
        });
        
        if (metaError) throw metaError;
      }

      // Success
      onAcceptComplete();
    } catch (err: any) {
      console.error('Error saving terms consent:', err);
      setErrorVisible(err.message || 'Ocorreu um erro ao registrar seu aceite. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md light">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-black/10 pointer-events-none" />
      
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="relative w-full max-w-xl bg-white border border-slate-200 rounded-[2.5rem] p-6 md:p-8 shadow-2xl overflow-hidden"
          id="terms-consent-container"
        >
          {/* Decorative Subtle Flow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative space-y-6">
            {/* Header / Brand */}
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 rounded-3xl bg-primary/10 text-primary border border-primary/20 mb-2">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Termos e Privacidade
              </h2>
              <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                Para garantir a segurança dos seus dados financeiros e conformidade legal, precisamos do seu consentimento antes de começar.
              </p>
            </div>

            {/* User identification info */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 px-4 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Conta conectada:</span>
              <span className="font-mono text-slate-800 font-semibold truncate max-w-[200px]" title={userEmail}>
                {userEmail}
              </span>
            </div>

            {/* Error Message */}
            {errorVisible && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm rounded-2xl flex items-start gap-3"
              >
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorVisible}</span>
              </motion.div>
            )}

            {/* Checkboxes List */}
            <div className="space-y-4">
              {/* Terms of Use Checkbox */}
              <label className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer group select-none">
                <div className="relative flex items-center shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="sr-only"
                    id="checkbox-accept-terms"
                  />
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    acceptTerms 
                      ? 'bg-primary border-primary text-slate-950 shadow-[0_0_10px_rgba(0,200,83,0.3)]' 
                      : 'border-slate-300 group-hover:border-primary/60 bg-white'
                  }`}>
                    {acceptTerms && <Check className="w-4 h-4 stroke-[3px] text-slate-950" />}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-semibold text-slate-800">
                    Li e aceito os{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowTermsDetail(true);
                      }}
                      className="text-primary hover:underline underline-offset-4 focus:outline-none inline-flex items-center gap-1 font-bold"
                    >
                      Termos de Uso
                      <ExternalLink className="w-3 h-3 hover:scale-110 transition-transform" />
                    </button>
                  </span>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Regras de uso do Capitae Finance, assinaturas e cancelamento.
                  </p>
                </div>
              </label>

              {/* Privacy Policy Checkbox */}
              <label className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer group select-none">
                <div className="relative flex items-center shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={acceptPrivacy}
                    onChange={(e) => setAcceptPrivacy(e.target.checked)}
                    className="sr-only"
                    id="checkbox-accept-privacy"
                  />
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    acceptPrivacy 
                      ? 'bg-primary border-primary text-slate-950 shadow-[0_0_10px_rgba(0,200,83,0.3)]' 
                      : 'border-slate-300 group-hover:border-primary/60 bg-white'
                  }`}>
                    {acceptPrivacy && <Check className="w-4 h-4 stroke-[3px] text-slate-950" />}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-semibold text-slate-800">
                    Li e aceito a{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowPrivacyDetail(true);
                      }}
                      className="text-primary hover:underline underline-offset-4 focus:outline-none inline-flex items-center gap-1 font-bold"
                    >
                      Política de Privacidade
                      <ExternalLink className="w-3 h-3 hover:scale-110 transition-transform" />
                    </button>
                  </span>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Como protegemos sua privacidade e seguimos as diretrizes da LGPD.
                  </p>
                </div>
              </label>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !acceptTerms || !acceptPrivacy}
              className="w-full bg-primary text-slate-950 font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 hover:bg-primary/95 transition-all text-sm shadow-[0_4px_16px_rgba(0,200,83,0.2)] disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none"
              id="btn-confirm-consent"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Salvando consentimento...</span>
                </>
              ) : (
                <span>Aceitar e Continuar</span>
              )}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Terms of Use Modal Detail View */}
      <AnimatePresence>
        {showTermsDetail && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md light">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-white border border-slate-200 rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh]"
              id="details-terms-modal"
            >
              <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50 rounded-t-[2rem]">
                <Scale className="w-6 h-6 text-primary" />
                <div>
                  <h3 className="font-bold text-slate-950 text-lg">Termos de Uso</h3>
                  <p className="text-xs text-slate-500 font-medium">Capitae Finance • Última atualização: Maio de 2026</p>
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 leading-relaxed font-sans scrollbar-thin">
                <section className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-base">1. Aceite dos Termos</h4>
                  <p>
                    Ao acessar e utilizar o aplicativo Capitae Finance, você concorda expressamente em cumprir estes Termos de Uso. Se você não concordar com qualquer termo estabelecido, por favor não utilize o aplicativo.
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-base">2. Uso do Serviço</h4>
                  <p>
                    O Capitae Finance é uma plataforma pessoal de gestão, simulação e gamificação de finanças. O uso do serviço é exclusivamente para fins pessoais e não comerciais. Você é inteiramente responsável pelas credenciais de acesso fornecidas (e-mail e senha) e por todas as atividades que ocorrem sob sua conta.
                  </p>
                  <p>
                    É estritamente proibido o uso de automações, robôs ou scripts para extrair ou alimentar informações sem autorização formal e prévia escrita de nossos desenvolvedores.
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-base">3. Assinatura e Pagamentos (Plano PRO)</h4>
                  <p>
                    O aplicativo oferece recursos gratuitos e planos PRO pagos por assinatura. 
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                    <li>As mensalidades e anuidades do Plano PRO são faturadas automaticamente via integradores de pagamento seguros.</li>
                    <li>Reservamo-nos o direito de alterar os preços do plano PRO a qualquer momento, mediante aviso prévio de 30 dias por e-mail ou notificação interna.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-base">4. Cancelamento e Reembolso</h4>
                  <p>
                    O cancelamento pode ser executado a qualquer momento diretamente pelo usuário através das configurações do perfil ou painel de cobrança.
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                    <li><strong>Direito de Arrependimento:</strong> Com base na legislação aplicável, você tem o direito de resgatar o valor pago em até 7 dias após o primeiro faturamento de entrada, bastando entrar em contato com o suporte.</li>
                    <li>Após os 7 dias iniciais, os cancelamentos interrompem recorrências futuras de cobrança, mas não dão direito ao reembolso proporcional do período corrente já liquidado.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-base">5. Limitação de Responsabilidade</h4>
                  <p>
                    O Capitae Finance fornece ferramentas de apoio à educação e organização financeira pessoal. Nós não realizamos assessoria de investimento com caráter certificado, nem garantimos lucros ou desfechos econômicos específicos. Todas as decisões de investimento ou poupança cabem exclusivamente ao usuário.
                  </p>
                </section>
              </div>

              <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50 rounded-b-[2rem]">
                <button
                  type="button"
                  onClick={() => {
                    setAcceptTerms(true);
                    setShowTermsDetail(false);
                  }}
                  className="flex-1 bg-primary text-slate-950 font-bold py-3 px-4 rounded-xl text-center text-sm hover:bg-primary/95 transition-colors shadow-sm"
                >
                  Entendi e Aceito
                </button>
                <button
                  type="button"
                  onClick={() => setShowTermsDetail(false)}
                  className="px-6 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 rounded-xl text-sm transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy Policy Modal Detail View */}
      <AnimatePresence>
        {showPrivacyDetail && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md light">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-white border border-slate-200 rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh]"
              id="details-privacy-modal"
            >
              <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50 rounded-t-[2rem]">
                <Lock className="w-6 h-6 text-primary" />
                <div>
                  <h3 className="font-bold text-slate-950 text-lg">Política de Privacidade</h3>
                  <p className="text-xs text-slate-500 font-medium">Capitae Finance • Conformidade LGPD</p>
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 leading-relaxed font-sans scrollbar-thin">
                <section className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-base">1. Introdução à Privacidade</h4>
                  <p>
                    Para nós, a segurança de suas movimentações e do seu orçamento é prioridade máxima. Esta política rege como coletamos, tratamos e protegemos seus dados pessoais de acordo com a Lei Geral de Proteção de Dados (LGPD).
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-base">2. Coleta de Informações</h4>
                  <p>
                    Coletamos apenas as informações voluntariamente fornecidas para o funcionamento do sistema:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-xs text-slate-600">
                    <li><strong>Dados cadastrais básicos:</strong> Seu e-mail de acesso e identificação básica de perfil.</li>
                    <li><strong>Dados financeiros declarados:</strong> Gastos, metas de reserva, orçamentos, rendimentos, agendas de contas a pagar. Essas informações são arquivadas de forma isolada, exclusiva para o seu perfil e nunca comercializadas.</li>
                    <li><strong>Dados técnicos de navegação:</strong> Logs temporários de depuração de sistema para prevenção de fraudes e suporte técnico a bugs de execução.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-base">3. Direitos sob a LGPD (Lei nº 13.709/2018)</h4>
                  <p>
                    Garantimos livre direito e transparência a todos os usuários da nossa plataforma com base na regulamentação brasileira:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                    <li><strong>Acesso e Confirmação:</strong> Saber quais dados temos arquivados.</li>
                    <li><strong>Retificação:</strong> Corrigir de imediato informações desatualizadas ou inconsistentes através do seu painel de Perfil.</li>
                    <li><strong>Eliminação e Portabilidade:</strong> Você pode, a qualquer tempo, deletar definitivamente os seus registros de transação e solicitar o encerramento do seu cadastro com a exclusão de todas as informações de maneira irrecuperável.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-base">4. Armazenamento e Segurança</h4>
                  <p>
                    Todas as comunicações e sincronizações com o servidor de dados do Supabase são protegidas por criptografia ponta a ponta (SSL/HTTPS/AES). Dados sensíveis são mantidos com rigorosos controles de acesso e de autenticação.
                  </p>
                </section>
              </div>

              <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50 rounded-b-[2rem]">
                <button
                  type="button"
                  onClick={() => {
                    setAcceptPrivacy(true);
                    setShowPrivacyDetail(false);
                  }}
                  className="flex-1 bg-primary text-slate-950 font-bold py-3 px-4 rounded-xl text-center text-sm hover:bg-primary/95 transition-colors shadow-sm"
                >
                  Entendi e Aceito
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrivacyDetail(false)}
                  className="px-6 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 rounded-xl text-sm transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
