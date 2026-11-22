import type { Metadata } from "next";
import { getLocale } from "../dictionaries";
import { CONTACT_EMAIL, H2, LegalPage, UL } from "../_app/LegalPage";

export const metadata: Metadata = { title: "Contrato de Intermediação do Anfitrião · LeonidaPlay", robots: { index: false } };

export default async function HostTermsPage() {
  const locale = await getLocale();
  return (
    <LegalPage locale={locale} title="Contrato de Intermediação do Anfitrião">
      <p>
        Este contrato vale entre você (&quot;Anfitrião&quot;) e a LeonidaPlay quando você cadastra um console para ser alugado na
        plataforma. Ele complementa os <a href={`/${locale}/termos`} className="text-cyan underline">Termos de Uso</a> e a{" "}
        <a href={`/${locale}/privacidade`} className="text-cyan underline">Política de Privacidade</a>.
      </p>

      <H2>1. O que a LeonidaPlay faz</H2>
      <p>
        A LeonidaPlay <b>intermedeia</b> o aluguel de tempo de jogo no seu console: divulga o anúncio, recebe o pagamento dos jogadores,
        opera a conexão remota e repassa a sua parte. A LeonidaPlay não compra, aluga nem administra o seu console, e não é sua
        empregadora. Os valores recebidos dos jogadores em nome do Anfitrião são repassados a ele, descontada a comissão da plataforma.
      </p>

      <H2>2. Quanto você recebe</H2>
      <UL>
        <li>Você recebe <b>80% do valor de cada sessão</b> efetivamente jogada; a LeonidaPlay fica com 20% de comissão.</li>
        <li>Se a sessão terminar antes por falha do seu console ou da sua internet, você recebe proporcionalmente ao tempo jogado.</li>
        <li>Se o jogo nunca ficar jogável por falha do seu lado, o jogador é reembolsado e você não recebe por aquela sessão.</li>
      </UL>

      <H2>3. Quando e como você recebe</H2>
      <UL>
        <li>Os ganhos ficam retidos por <b>24 horas</b> após a sessão (prazo para o jogador contestar).</li>
        <li>Toda <b>sexta-feira</b> enviamos por Pix o total das sessões encerradas até quinta-feira às 23h59.</li>
        <li>Valores abaixo de <b>R$ 20,00</b> acumulam para a semana seguinte.</li>
        <li>O Pix é enviado apenas para chave no nome do próprio Anfitrião (mesmo CPF do cadastro). Cada repasse gera um comprovante.</li>
        <li>Sessões em disputa ficam retidas até a análise ser concluída.</li>
      </UL>

      <H2>4. Suas responsabilidades</H2>
      <UL>
        <li>Ser maior de 18 anos e dono do console ou autorizado pelo dono a anunciá-lo.</li>
        <li>Usar uma <b>conta PSN secundária</b> exclusiva para os jogadores, sem cartão salvo, sem saldo e com limite de gastos zerado, e manter o checklist de segurança sempre válido.</li>
        <li>Manter o console ligado ou em modo de repouso conectado à internet enquanto ele estiver anunciado, e pausar o anúncio quando for usá-lo.</li>
        <li>Não interromper sessões em andamento nem interferir no jogo do jogador.</li>
        <li>Manter seus dados de cadastro e chave Pix atualizados.</li>
      </UL>

      <H2>5. Falhas e suspensão</H2>
      <p>
        Se o seu console falhar em iniciar ou cair durante sessões <b>3 vezes em 7 dias</b>, o anúncio é suspenso por 7 dias. Uma nova
        reincidência gera suspensão de 30 dias e, depois, o encerramento do cadastro. Fraudes ou violações graves podem levar ao
        encerramento imediato e à retenção dos valores necessários para reembolsar jogadores prejudicados.
      </p>

      <H2>6. Riscos que você reconhece</H2>
      <UL>
        <li>
          O uso compartilhado do console e da conta secundária pode não ser permitido pelos termos da Sony/PlayStation Network. Existe o
          risco de a Sony restringir ou banir a conta secundária, a sua conta principal ou o console. <b>Você assume esse risco</b> ao se
          cadastrar, e a LeonidaPlay não se responsabiliza por essas medidas.
        </li>
        <li>A LeonidaPlay bloqueia no acesso remoto os menus do sistema e as compras, mas não pode garantir que nenhuma ação indevida aconteça. Por isso a conta secundária não pode ter meios de pagamento.</li>
        <li>O console sofre o desgaste normal de uso.</li>
      </UL>

      <H2>7. Impostos</H2>
      <p>
        Os valores que você recebe são renda sua. Cabe a você declará-los e recolher os tributos devidos conforme a sua situação fiscal.
        A LeonidaPlay mantém o registro de cada repasse e pode fornecer um extrato anual.
      </p>

      <H2>8. Seus dados</H2>
      <p>
        Nome, CPF e chave Pix são usados só para identificar você e enviar os repasses, e ficam guardados cifrados. Não exibimos seus dados
        aos jogadores: eles veem apenas o nome do anúncio, o modelo do console e o resumo do personagem.
      </p>

      <H2>9. Saída e mudanças</H2>
      <p>
        Você pode pausar o anúncio a qualquer momento e encerrar o cadastro por e-mail; os valores já liberados serão pagos no repasse
        seguinte. Podemos atualizar este contrato, avisando com antecedência por e-mail ou pelo site.
      </p>

      <H2>10. Contato</H2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan underline">{CONTACT_EMAIL}</a>. Fica eleito o foro do domicílio do
        Anfitrião.
      </p>
    </LegalPage>
  );
}
