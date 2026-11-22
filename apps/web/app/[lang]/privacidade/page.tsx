import type { Metadata } from "next";
import { getLocale } from "../dictionaries";
import { CONTACT_EMAIL, H2, LegalPage, UL } from "../_app/LegalPage";

export const metadata: Metadata = { title: "Política de Privacidade · LeonidaPlay" };

export default async function PrivacyPage() {
  const locale = await getLocale();
  return (
    <LegalPage locale={locale} title="Política de Privacidade">
      <p>
        Esta Política explica quais dados pessoais a LeonidaPlay coleta, para quê e quais são os seus direitos, conforme a Lei Geral de
        Proteção de Dados (Lei 13.709/2018 — LGPD).
      </p>

      <H2>1. Dados que coletamos</H2>
      <UL>
        <li><b>Conta:</b> e-mail, idioma, país aproximado (pelo IP) e data de criação.</li>
        <li><b>Aceite dos termos:</b> data, versão do documento, endereço IP e navegador no momento do aceite (prova do consentimento).</li>
        <li><b>Pagamentos:</b> valor, data e status das recargas Pix e o identificador da transação no Mercado Pago. <b>Não recebemos</b> dados bancários de quem paga — eles ficam com o banco e o Mercado Pago.</li>
        <li><b>Sessões de jogo:</b> horários, duração, qualidade da conexão (latência, quedas) e eventos técnicos, usados para cobrar corretamente e decidir reembolsos.</li>
        <li><b>Lista de espera:</b> nome, e-mail, cidade/UF, dispositivo e, para anfitriões, informações sobre o console e WhatsApp, se informados.</li>
        <li><b>Segurança:</b> registros de acesso e um código cifrado (hash) do IP para evitar abuso.</li>
      </UL>

      <H2>2. Para que usamos</H2>
      <UL>
        <li>Criar e proteger sua conta e enviar o código de acesso (execução do contrato).</li>
        <li>Processar recargas, sessões, reembolsos e manter registros financeiros (execução do contrato e obrigação legal).</li>
        <li>Prevenir fraudes e abusos (legítimo interesse).</li>
        <li>Avisar sobre o lançamento e novidades a quem entrou na lista de espera (consentimento — você pode sair quando quiser).</li>
      </UL>
      <p>Não vendemos seus dados e não os usamos para publicidade de terceiros.</p>

      <H2>3. Com quem compartilhamos</H2>
      <p>Apenas com fornecedores necessários para o serviço funcionar, que tratam os dados em nosso nome:</p>
      <UL>
        <li><b>Mercado Pago</b> — processamento dos pagamentos Pix;</li>
        <li><b>Resend</b> — envio dos e-mails com o código de acesso;</li>
        <li><b>Vercel</b> e <b>Neon</b> — hospedagem do site e do banco de dados;</li>
        <li><b>Anfitriões</b> — não recebem seu e-mail nem dados de pagamento; veem apenas que o console está em uso.</li>
      </UL>
      <p>Alguns desses fornecedores podem armazenar dados fora do Brasil, com as garantias exigidas pela LGPD. Também podemos compartilhar dados quando exigido por lei ou ordem judicial.</p>

      <H2>4. Por quanto tempo guardamos</H2>
      <p>
        Enquanto sua conta existir. Registros de pagamentos e sessões são mantidos pelo prazo exigido pela legislação fiscal e de consumo
        (em geral, 5 anos). Códigos de acesso expiram em 10 minutos.
      </p>

      <H2>5. Seus direitos</H2>
      <p>
        Você pode pedir a qualquer momento: confirmação e acesso aos seus dados, correção, exclusão, portabilidade, informações sobre
        compartilhamento e revogação do consentimento. Escreva para{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan underline">{CONTACT_EMAIL}</a>. Responderemos em até 15 dias.
      </p>

      <H2>6. Segurança</H2>
      <p>
        Usamos conexão cifrada (HTTPS), guardamos códigos de acesso e sessões apenas na forma cifrada (hash) e limitamos o acesso aos
        dados a quem precisa deles para operar o serviço.
      </p>

      <H2>7. Cookies</H2>
      <p>Usamos apenas um cookie essencial para manter você conectado. Não usamos cookies de publicidade.</p>

      <H2>8. Contato</H2>
      <p>
        Encarregado pelo tratamento de dados: <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan underline">{CONTACT_EMAIL}</a>.
        Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>
    </LegalPage>
  );
}
