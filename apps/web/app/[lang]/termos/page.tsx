import type { Metadata } from "next";
import { getLocale } from "../dictionaries";
import { CONTACT_EMAIL, H2, LegalPage, UL } from "../_app/LegalPage";

export const metadata: Metadata = { title: "Termos de Uso · LeonidaPlay" };

export default async function TermsPage() {
  const locale = await getLocale();
  return (
    <LegalPage locale={locale} title="Termos de Uso">
      <p>
        Estes Termos regem o uso da LeonidaPlay (o site leonidaplay.com.br e seus serviços). Ao criar uma conta você declara que leu e
        concorda com eles e com a <a href={`/${locale}/privacidade`} className="text-cyan underline">Política de Privacidade</a>.
      </p>

      <H2>1. O que é a LeonidaPlay</H2>
      <p>
        A LeonidaPlay é uma plataforma que <b>intermedeia</b> o aluguel de tempo de jogo em consoles PlayStation 5 de terceiros
        (&quot;anfitriões&quot;), acessados remotamente pelo navegador. A LeonidaPlay não é dona dos consoles, não vende jogos e não é
        afiliada, patrocinada ou endossada pela Sony Interactive Entertainment, pela Rockstar Games ou pela Take-Two Interactive.
        PlayStation, PS5 e GTA são marcas de seus respectivos titulares.
      </p>

      <H2>2. Conta</H2>
      <UL>
        <li>Você precisa ter <b>18 anos ou mais</b>, ou autorização de um responsável legal, para criar conta e fazer recargas.</li>
        <li>O acesso é feito por código enviado ao seu e-mail. Mantenha seu e-mail seguro: quem tiver acesso a ele consegue entrar na conta.</li>
        <li>Uma conta por pessoa. Informações falsas, contas duplicadas ou uso por terceiros podem levar ao bloqueio.</li>
      </UL>

      <H2>3. Créditos e pagamentos</H2>
      <UL>
        <li>Recargas são feitas por Pix, processadas pelo Mercado Pago. O valor pago vira <b>créditos</b> na sua carteira, na proporção de R$ 1,00 = R$ 1,00 em créditos.</li>
        <li>Créditos servem apenas para comprar tempo de jogo na LeonidaPlay. Não rendem juros, não podem ser transferidos para outra conta e <b>não expiram</b>.</li>
        <li>
          <b>Direito de arrependimento:</b> em até 7 dias da recarga, você pode pedir a devolução via Pix do valor da recarga que ainda
          não tiver sido usado, escrevendo para {CONTACT_EMAIL}.
        </li>
        <li>Fora desse prazo, créditos não utilizados podem ser devolvidos a pedido, descontadas eventuais tarifas de transferência, salvo nos casos de bloqueio por fraude ou violação destes Termos.</li>
      </UL>

      <H2>4. Sessões de jogo</H2>
      <UL>
        <li>Você escolhe um pacote de tempo; o valor fica reservado na carteira e o cronômetro só começa quando o jogo aparece na tela.</li>
        <li>Se a sessão cair por falha do anfitrião ou da plataforma, você recebe de volta, em créditos, o valor proporcional ao tempo não jogado. Se o jogo nunca ficar jogável, o valor é devolvido integralmente.</li>
        <li>Quedas causadas pela sua própria conexão não geram reembolso do tempo já iniciado.</li>
        <li>A qualidade depende da sua internet. Recomendamos testar a conexão antes de comprar.</li>
      </UL>

      <H2>5. Regras de uso</H2>
      <p>É proibido, entre outros:</p>
      <UL>
        <li>tentar acessar menus do sistema, contas, compras ou configurações do console do anfitrião;</li>
        <li>fazer compras dentro do jogo, trapacear, usar programas não autorizados ou violar as regras da PlayStation Network e do jogo;</li>
        <li>assediar, ofender ou prejudicar outros jogadores;</li>
        <li>usar meios de pagamento de terceiros sem autorização ou praticar qualquer fraude.</li>
      </UL>
      <p>Violações podem levar ao encerramento imediato da sessão e ao bloqueio da conta, sem prejuízo de outras medidas cabíveis.</p>

      <H2>6. Riscos e responsabilidades</H2>
      <p>
        O serviço depende de terceiros (anfitriões, PlayStation Network, provedores de internet e de nuvem) e pode ficar indisponível.
        A LeonidaPlay não garante disponibilidade contínua de consoles ou de jogos específicos e não se responsabiliza por decisões da
        Sony ou da Rockstar sobre contas, servidores ou conteúdo do jogo. Nossa responsabilidade se limita ao valor pago pela sessão afetada,
        nos limites permitidos pelo Código de Defesa do Consumidor.
      </p>

      <H2>7. Mudanças</H2>
      <p>Podemos atualizar estes Termos. Mudanças importantes serão avisadas no site ou por e-mail antes de entrar em vigor.</p>

      <H2>8. Contato e foro</H2>
      <p>
        Dúvidas, reclamações e pedidos: <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan underline">{CONTACT_EMAIL}</a>. Fica eleito
        o foro do domicílio do consumidor, conforme a legislação brasileira.
      </p>
    </LegalPage>
  );
}
