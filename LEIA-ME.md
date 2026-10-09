# Usina em 3D

Painel 3D da operação de uma usina de açúcar com painel gerencial (dia safra, turnos, safra, frentes de colheita, oficina, casa de cana e energia).

## Como abrir

Dê dois cliques em `index.html` (Chrome ou Edge). Precisa de internet porque as bibliotecas (three.js, Chart.js, jsPDF) e as fontes vêm de CDN.
Para usar dados reais da balança, coloque estes arquivos dentro da pasta `public` do `usina-server` e rode `node server.js`.

## Estrutura

    index.html          estrutura da página (3D e painel gerencial)
    css/estilo.css      todo o visual
    js/                 código, carregado nesta ordem:
      cena.js           Renderizador, céu, texturas, materiais, terreno, canavial, prédios e equipamentos da usina.
      veiculos.js       Modelos de veículos (caminhões, colhedora, transbordo, carros), pátio de bagaço, retroescavadeira e rota dos treminhões.
      dados.js          Dados simulados das etapas, cubos de status, etiquetas, indicadores e painel de detalhes da etapa.
      camera.js         Câmera, mouse e toque, filtro de áreas, troca entre o 3D e o painel gerencial, leitura da API do server.js.
      frentes.js        Frentes de colheita: colhedoras, transbordos, fila e carregamento de caminhões.
      oficina.js        Oficina automotiva: veículos em manutenção, baias e situação.
      casa-de-cana.js   Casa de cana (garra e estoque) e pátio de bagaço (retro, caldeira e energia).
      despacho.js       Despacho dos vazios pelo CCO: ao sair vazio da balança o sistema escolhe a frente, rádio do motorista e previsão de chegada.
      radio-audio.js    Voz do rádio: cada mensagem é mostrada e falada ao mesmo tempo, com chiado e bipe de câmbio.
      patio.js          Pátio de vazios no 3D: caminhões estacionados com o número de frota, saem quando o CCO libera.
      cota.js           Cota de entrada de cana: a cada 3 horas o CCO passa no rádio a cota e o percentual de cada frente.
      caminhoes-info.js Ficha do caminhão ao clicar (motorista, matrícula, jornada, pausa obrigatória) e o rastro do caminho.
      graficos.js       Gráficos do painel gerencial com Chart.js.
      painel.js         Dia safra, turnos, safra e todas as seções do painel gerencial, exportação em CSV.
      pdf.js            Relatório em PDF com a imagem do 3D, gráficos e tabelas.
      ciclo-dia.js      Dia e noite pela hora real: sol, lua, céu, janelas e torres de luz acesas à noite.
      interface.js      Menu "Mais", tema claro/escuro, modo TV e o destaque de moagem em cima do 3D.
      main.js           Pós-processamento (sombras de contato), qualidade, loop de animação e inicialização.

Os arquivos de `js/` são carregados em sequência e compartilham as mesmas variáveis globais,
por isso a ordem dos `<script>` no `index.html` precisa ser mantida.

## Onde mudar as configurações

- Meta do dia, meta da safra, início da safra, hora do dia safra e turnos: bloco `SAFRA` e `META_DIA` em `js/painel.js`.
- Frentes de colheita (nome, fazenda, talhão, distância): lista `FRENTES` em `js/cena.js`.
- Tamanho da frota e tipos de veículo da oficina: `FROTA_TOTAL` e `TIPOS_OFI` em `js/oficina.js`.
- Etapas e prazos de cada etapa: lista `ST` em `js/cena.js`.
- Nascer e pôr do sol: `LUZ` em `js/ciclo-dia.js`. Para ver outro horário, abra com `?hora=21` no endereço.
- Data planejada para fechar a safra: `SAFRA.fimPlanejado` em `js/painel.js`.
- Limites de qualidade (impureza, cor ICUMSA, polarização, umidade): `LIM_QUAL` em `js/painel.js`.
- Motivos e categorias de parada: `CAT_PARADA` em `js/painel.js`.
- Velocidade média do caminhão e tempo de carregamento (ciclo das frentes): `VEL_CAMINHAO` e `TEMPO_CARREGAR` em `js/frentes.js`.

## Dados extras que o server.js pode mandar

- `qualidade`: `{pol, pureza, fibra, impMin, impVeg, cor, polAc, umid}`
- em cada parada, `categoria` (Industrial, Agrícola, Clima, Externa)
- em cada fornecedor, `impMin` (impureza mineral em kg/t)

## Despacho de vazios

- Máximo de caminhões aguardando para carregar em cada frente: `FILA_MAX` em `js/frentes.js` (hoje 2).
- Regra do sistema: só manda para frente colhendo e com vaga (fila + vazios a caminho menor que `FILA_MAX`); vai para a que tem menos caminhões comprometidos e, no empate, a mais perto. Sem vaga, o caminhão espera no pátio de vazios e sai assim que abrir vaga.
- O 3D roda acelerado: `ESCALA_DESPACHO` em `js/despacho.js` diz quantos milissegundos de tela vale cada minuto de viagem (hoje 1 segundo = 1 minuto).
- Som do rádio: liga e desliga no menu Mais. O navegador só libera o áudio depois do primeiro clique na página.
  As vozes usadas são as de português do Brasil instaladas no Windows (no Edge costumam ser as mais naturais).
- Rádio: os caminhões são chamados pelo número de frota (`novaFrota` em `js/frentes.js`). O CCO chama uma frente a cada 40 a 60 s
  (`chamarFrente` em `js/despacho.js`), e as falas do campo (transbordo, colhedora, pipa, hilo) estão em `eventoCampo`.
- Conversas no procedimento de rádio (chamada, "Prossiga/QAP", mensagem, "QSL/Copiado"): função `qso` em `js/despacho.js`.
  Nomes dos líderes de frente em `LIDER`; conversas do dia a dia (comboio, apontador, balança, laboratório, avisos gerais) em `conversaAmbiente`.
- As frases do rádio são sorteadas sem repetir (`pickR` em `js/despacho.js`): uma frase só volta depois que todas as outras da mesma lista foram usadas.
- Cota de entrada de cana: `COTA` em `js/cota.js` (janela de 3 horas, limites do pátio que baixam ou sobem a cota em 10%).
  A cota total da janela é a meta do dia dividida pelas janelas; o percentual de cada frente segue o rendimento dela.
- Voz do CCO: escolha em Mais > Voz do CCO (fica salva). O CCO fala mais pausado e os comunicados dele passam na frente da fila do rádio.
- Diálogos com os veículos do campo (colhedora, transbordo, pipa, motoniveladora, comboio, oficina volante, brigada): `DIALOGOS_VEICULOS` em `js/despacho.js`.
