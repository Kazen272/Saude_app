// Textos dos botões "?" dos cartões: o que cada número mostra e como é calculado.
import type { TextoInfo } from '@/components/ui';

export const EXPLICACOES = {
  peso: {
    titulo: 'Peso e projeção',
    paragrafos: [
      'Os pontos claros são as pesagens. A linha cheia é a média dos últimos 7 dias, que suaviza a variação de água, sal e intestino. Por isso o app compara sempre médias, não uma pesagem com outra.',
      'Projeção: usa o déficit médio dos últimos 14 dias completos com dieta registrada. Cerca de 7.700 kcal de déficit equivalem a 1 kg de gordura. A data aparece como faixa (±20%), porque o gasto é uma estimativa.',
      'Ritmo real: quanto a média caiu por semana nas últimas 2 semanas. Acima de 1% do peso por semana costuma levar massa magra junto.',
    ],
  },
  calorias: {
    titulo: 'Como o saldo é calculado',
    paragrafos: [
      'Comeu: total do dia que o FatSecret envia ao Health Connect, ou o valor que você corrigiu no Revisar dia.',
      'Gastou, nesta ordem: 1) o total medido pelo relógio, quando ele envia; 2) senão, metabolismo basal (fórmula de Mifflin-St Jeor: peso, altura, idade e sexo) + atividade. A atividade é o maior entre as calorias ativas do relógio e passos (≈ 0,04 kcal por passo a cada 70 kg) + treinos que os passos não pegam (Hevy estimado pela duração; atividades do app pela intensidade). Caminhada e corrida, mesmo no meio da academia, entram pelos passos; dois registros do mesmo treino (Hevy e relógio) contam uma vez, pelo maior. 3) Sem passos nem relógio, basal × nível de atividade do perfil, nunca acima do seu gasto típico medido pelo relógio.',
      '* = gasto estimado, sem dados do relógio naquele dia.',
      'Saldo = gastou − comeu. Verde (−) é déficit; laranja (+) é superávit. Dias sem dieta registrada ficam fora da soma.',
      'Com 14 dias ou mais de peso e dieta, o app compara a perda prevista pelas calorias com a real e corrige o gasto (cartão Previsto × real).',
    ],
  },
  previstoReal: {
    titulo: 'Previsto × real',
    paragrafos: [
      'Soma o déficit dos dias com dieta e converte em kg (7.700 kcal ≈ 1 kg). Compara com quanto a média do peso caiu de fato no mesmo período.',
      'Se a balança cai menos do que o previsto, o gasto estava superestimado (ou a dieta subestimada), e o app reduz o gasto estimado na mesma proporção, até 500 kcal/dia. Se cai mais, aumenta. Precisa de pelo menos 14 dias de dados.',
    ],
  },
  dieta: {
    titulo: 'Qualidade da dieta',
    paragrafos: [
      'Médias dos 7 dias completos com dieta registrada, vindas do FatSecret.',
      'Proteína: 1,6 a 2,2 g por kg de peso por dia ajuda a preservar músculo em déficit.',
      'Fibra: 25 a 30 g por dia é a recomendação geral para adultos; ajuda na saciedade e no intestino.',
      'Sódio: a OMS recomenda menos de 2.000 mg por dia. Sódio alto também segura água e faz o peso oscilar.',
      'Açúcar: é o total do FatSecret, incluindo o natural de frutas e leite; serve para acompanhar a tendência.',
      'São referências gerais, não uma prescrição.',
    ],
  },
  medidas: {
    titulo: 'Medidas',
    paragrafos: [
      'Cada medida mostra o valor mais recente e a diferença para a medição anterior ou para a primeira. Nas medidas com dois lados, a diferença é a média dos lados medidos nas duas datas.',
      'Verde quando cintura, abdômen ou quadril diminuem. Nas outras, subir ou descer depende do objetivo.',
      'Cintura ÷ altura: abaixo de 0,5 é considerado adequado; de 0,5 a 0,6 pede atenção. Referência geral, não diagnóstico.',
    ],
  },
  gordura: {
    titulo: '% de gordura pelas dobras',
    paragrafos: [
      'Usa as 7 dobras cutâneas da avaliação (peitoral, axilar média, tríceps, subescapular, abdominal, supra-ilíaca e coxa), registradas em Registrar › Mais medidas.',
      'Cálculo: protocolo de Jackson & Pollock (soma das dobras, idade e sexo → densidade corporal) e equação de Siri (densidade → % de gordura). Massa gorda = peso × %; massa magra = o resto.',
      'A margem de erro é de 3 a 4 pontos percentuais. Para comparar evolução, use sempre o mesmo avaliador e o mesmo horário.',
    ],
  },
  sinais: {
    titulo: 'Platô e recomposição',
    paragrafos: [
      'Platô: a média de 7 dias do peso mudou menos de 0,2 kg em 14 dias, mesmo com déficit médio de 250 kcal ou mais em pelo menos 10 dias com dieta.',
      'Recomposição: a cintura caiu 1,5 cm ou mais entre duas medidas com pelo menos 21 dias de distância, enquanto a média do peso caiu menos de 0,5 kg. Sinal de perda de gordura com ganho de massa.',
    ],
  },
  constancia: {
    titulo: 'Nota de constância',
    paragrafos: [
      'Mede regularidade, não resultado. Vale para os 7 dias completos até ontem.',
      'Pontos: dieta registrada todo dia (25) · meta de água (15) · 3 dias com treino (20; caminhada curta do relógio não conta) · noites de 7h ou mais (20) · 3 pesagens (20). Cada item dá pontos proporcionais ao que foi cumprido.',
      'Sequências: dias seguidos, até ontem, com dieta registrada, na meta de água e em déficit.',
      'O gráfico mostra a nota de cada semana (segunda a domingo); a última ainda está em andamento.',
    ],
  },
  padroes: {
    titulo: 'Padrões',
    paragrafos: [
      'O app cruza os últimos 60 dias de sono, dieta, check-in e treinos e mostra só diferenças relevantes, quando cada grupo comparado tem pelo menos 3 dias.',
      'Sono: compara o dia seguinte a noites com menos de 6h com o dia seguinte a noites com 7h ou mais. Fim de semana: sábado e domingo contra segunda a sexta. Treino: dias com treino contra dias sem.',
      'É uma associação nos seus dados, não prova de causa, mas ajuda a ver onde mexer.',
    ],
  },
  sono: {
    titulo: 'Sono',
    paragrafos: [
      'Cada barra é a noite que terminou naquele dia. O sono digitado no app tem prioridade sobre o do relógio.',
      'A linha marca 7h, o mínimo recomendado para adultos.',
    ],
  },
  checkin: {
    titulo: 'Check-in',
    paragrafos: ['Energia, fome e humor de 1 a 5, marcados na tela Hoje. A média dos 7 dias aparece no topo.', 'Fome alta por vários dias seguidos com energia baixa pode indicar déficit grande demais.'],
  },
  treinos: {
    titulo: 'Treinos por semana',
    paragrafos: [
      'Conta treinos importados (Hevy, relógio, Strava…) e atividades marcadas como feitas no app, por semana de segunda a domingo. Registros que se sobrepõem contam uma vez só, e caminhadas ou corridas de menos de 30 minutos que o relógio detecta sozinho não contam.',
      'A linha marca a meta de 3 treinos por semana.',
    ],
  },
  passos: {
    titulo: 'Passos',
    paragrafos: ['Média de passos por dia em cada semana, dos apps ativados em Mais › Health Connect.'],
  },
  fc: {
    titulo: 'Frequência cardíaca de repouso',
    paragrafos: [
      'Quando o relógio grava a FC de repouso, vale a dele. Senão, o app estima a partir das medições contínuas: a menor média de 30 minutos do dia (normalmente durante o sono) ou, com poucas medições, a média das 10% menores.',
      'Quanto mais baixa, em geral, melhor o condicionamento. Subidas de alguns bpm por vários dias podem indicar cansaço, estresse ou início de gripe.',
    ],
  },
  prontidao: {
    titulo: 'Recuperação de hoje',
    paragrafos: [
      'Junta vários sinais, porque nenhum sozinho basta. Começa em 100 e cada sinal desconta pontos; toque em "ver o que pesou" para ver cada um.',
      'Como você se sente (pesa mais): energia 1 → −25, 2 → −15, 3 → −5; dor muscular/cansaço 5 → −25, 4 → −15, 3 → −5; humor 1–2 → −10. Em atletas, o que a pessoa relata acompanha a carga de treino melhor que medidas objetivas (Saw, Main & Gastin, BJSM 2016).',
      'Sono: menos de 6h → −20; menos de 7h → −10; média das 3 últimas noites abaixo de 6h30 → −5.',
      'Treinos: carga = minutos × intensidade (método session-RPE de Foster, 2001; leve ≈ 3, moderada ≈ 5, intensa ≈ 7; Hevy e relógio contam como moderada). Treino puxado ontem (carga ≥ 400, ex.: 1h intensa) → −10; 3 dias seguidos ou mais → −10; últimos 7 dias 50% acima da sua média semanal → −10.',
      'Alimentação: déficit médio dos últimos 3 dias acima de 750 kcal → −10; acima de 1.000 → −15.',
      'FC de repouso: −8 por bpm acima de 2 da sua média de 14 dias, quando o relógio envia.',
      'Boa: 75 ou mais · Média: 50 a 74 · Baixa: abaixo de 50. Sem o check-in de hoje (energia e dor), a avaliação fica "parcial" e nunca passa de média.',
      'É uma orientação geral, não substitui avaliação profissional; dor forte ou persistente pede um médico ou fisioterapeuta.',
    ],
  },
  semanaDiaADia: {
    titulo: 'Semana dia a dia',
    paragrafos: [
      'Cada linha é um dia, de segunda a domingo. Use as setas para ver até 8 semanas atrás.',
      '● Treino feito. Registros que se sobrepõem (ex.: Hevy e relógio gravando a mesma academia) contam como um treino só. Caminhadas e corridas de menos de 30 minutos que o relógio detecta sozinho (ida à academia, aquecimento) não contam como treino; elas já entram no gasto pelos passos.',
      '○ Atividade prevista em Mais › Atividades que não aconteceu: "não fez" quando você marcou assim, "não marcado" quando o dia passou sem marcar e sem treino gravado no horário.',
      'À direita: o que você comeu, verde até 10% acima da meta e laranja acima disso. Embaixo, o saldo do dia (− é déficit); * = gasto estimado, sem dados do relógio.',
      'O resumo do topo soma só os dias que já passaram. A meta é a atual, também para semanas anteriores.',
    ],
  },
  metaDoDia: {
    titulo: 'Meta do dia',
    paragrafos: [
      'Quanto ainda dá para comer = sua meta de calorias − o que você já comeu hoje.',
      'A meta é a que você escolheu em Mais › Meta de calorias. Sem escolha, o app usa a sugestão moderada: seu gasto médio menos 500 kcal (NHLBI), nunca acima de 1% do peso por semana (Helms et al., 2014) e nunca abaixo de 1.600 kcal para homens ou 1.200 para mulheres (NHLBI).',
      'Seu gasto médio vem do relógio e dos passos dos últimos 14 dias; sem dados suficientes, da fórmula de Mifflin-St Jeor × seu nível de atividade.',
      'A linha "Até agora" mostra o saldo real do dia, com o gasto medido até o momento.',
    ],
  },
  semanaMeta: {
    titulo: 'Sua semana × meta',
    paragrafos: [
      'Orçamento da semana = sua meta diária × 7, de segunda a domingo. "Usado" soma o que você comeu nos dias com dieta registrada, incluindo hoje. O que sobra dividido pelos dias que faltam (contando hoje) mostra quanto dá por dia para fechar a semana na meta.',
      'Últimos 7 dias completos: média do que você comeu, dias dentro da meta (até 10% acima conta como dentro) e o déficit.',
      'Déficit planejado = soma de (gasto do dia − meta) nos dias com dieta: é o que a meta daria. Conseguido = soma de (gasto − comido) nos mesmos dias. A porcentagem mostra quanto do planejado aconteceu.',
      'O app usa a meta atual para todos os dias; se você mudar a meta, os dias anteriores passam a ser comparados com a nova.',
    ],
  },
  desdeInicio: {
    titulo: 'Desde o começo',
    paragrafos: [
      'Começa na sua primeira pesagem ou no primeiro dia com dieta registrada no app (o que vier antes).',
      'Déficit acumulado: soma de (gasto − comido) em todos os dias completos com dieta. "Pelas calorias" converte em gordura usando ≈ 7.700 kcal por kg, uma aproximação; na prática a perda desacelera com o tempo.',
      'Na balança: diferença da média de 7 dias do peso entre o começo e hoje. Água, sal, intestino e ganho de músculo fazem a balança divergir das calorias por semanas; por isso a cintura ajuda a confirmar.',
      'O gráfico mostra o déficit somado de cada semana.',
    ],
  },
} satisfies Record<string, TextoInfo>;
