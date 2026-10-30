import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Escala } from '@/components/bemestar';
import { Botao, Campo, Cartao, Nota, Rotulo, SeletorDia, estilos } from '@/components/ui';
import { salvarCheckin } from '@/lib/bemestar-dados';
import { apagarAgua, apagarCorpo, apagarSonoManual, carregarRegistrosDoDia, registrarAgua, type RegistrosDoDia } from '@/lib/dados';
import { decimal, diaLocal, milhar, nomeDoDia, numeroCurto } from '@/lib/datas';
import { sincronizar } from '@/lib/healthconnect';
import { COLUNAS_EXTRAS, type Valores } from '@/lib/medidas';
import { cores } from '@/lib/tema';

const extras = (v: Valores) => COLUNAS_EXTRAS.filter((c) => v[c] != null).length;

export default function Historico() {
  const params = useLocalSearchParams<{ dia?: string }>();
  const [dia, setDiaBruto] = useState(params.dia && /^\d{4}-\d{2}-\d{2}$/.test(params.dia) ? params.dia : diaLocal());
  const [r, setR] = useState<RegistrosDoDia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [outraQtd, setOutraQtd] = useState('');
  const setDia = (d: string) => {
    setDiaBruto(d);
    setErroAgua(null);
  };
  const [adicionando, setAdicionando] = useState(false);
  const [erroAgua, setErroAgua] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setR(await carregarRegistrosDoDia(dia));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.');
    }
  }, [dia]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  function confirmar(titulo: string, acao: () => Promise<void>) {
    Alert.alert(titulo, 'Não dá para desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await acao();
            await carregar();
          } catch (e) {
            setErro(e instanceof Error ? e.message : 'Erro ao apagar.');
          }
        },
      },
    ]);
  }

  async function mudarCheckin(campo: 'energia' | 'fome' | 'humor', v: number) {
    setR((x) => (x ? { ...x, checkin: { energia: null, fome: null, humor: null, ...x.checkin, [campo]: v } } : x));
    try {
      await salvarCheckin(dia, { [campo]: v });
    } catch {
      setErro('Não foi possível salvar o check-in.');
      carregar();
    }
  }

  async function adicionarAgua(ml: number) {
    setErroAgua(null);
    setAdicionando(true);
    try {
      await registrarAgua(ml, dia);
      await carregar();
    } catch {
      setErroAgua('Não foi possível salvar a água.');
    } finally {
      setAdicionando(false);
    }
  }

  function adicionarOutra() {
    const ml = Number(outraQtd);
    if (!ml || ml < 50 || ml > 5000) {
      setErroAgua('Digite a água em ml, entre 50 e 5000.');
      return;
    }
    setOutraQtd('');
    adicionarAgua(ml);
  }

  async function sincronizarDieta() {
    setSincronizando(true);
    try {
      const e = await sincronizar();
      if (e.erro) setErro(e.erro);
      await carregar();
    } finally {
      setSincronizando(false);
    }
  }

  const ehHoje = dia === diaLocal();
  const totalAgua = r?.agua.reduce((s, a) => s + a.ml, 0) ?? 0;
  const sonoManual = r?.sono.find((s) => s.origem === 'manual');
  const sonoRelogio = r?.sono.find((s) => s.origem !== 'manual');

  return (
    <ScrollView contentContainerStyle={[estilos.conteudo, { paddingTop: 8 }]} keyboardShouldPersistTaps="handled">
      <Cartao estilo={{ paddingVertical: 8 }}>
        <SeletorDia dia={dia} aoMudar={setDia} />
      </Cartao>

      {erro && <Text style={{ color: cores.laranja, fontWeight: '600' }}>{erro}</Text>}

      {/* Peso e medidas */}
      <Cartao estilo={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Rotulo>Peso e medidas</Rotulo>
          {r?.corpo && (
            <Link href="/registrar" asChild>
              <Pressable accessibilityRole="link" style={{ minHeight: 36, justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: cores.verdeTexto }}>editar</Text>
              </Pressable>
            </Link>
          )}
        </View>
        {r?.corpo ? (
          <Linha
            texto={[
              r.corpo.pesoKg != null ? `${decimal(r.corpo.pesoKg)} kg` : null,
              r.corpo.medidas.waist_cm != null ? `cintura ${numeroCurto(r.corpo.medidas.waist_cm, 1)} cm` : null,
              r.corpo.medidas.hip_cm != null ? `quadril ${numeroCurto(r.corpo.medidas.hip_cm, 1)} cm` : null,
              extras(r.corpo.medidas) > 0 ? `+${extras(r.corpo.medidas)} medida${extras(r.corpo.medidas) === 1 ? '' : 's'}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            detalhe={r.corpo.origem === 'manual' ? 'digitado no app' : 'balança via Health Connect'}
            aoApagar={() => confirmar('Apagar peso e medidas deste dia?', () => apagarCorpo(dia))}
          />
        ) : (
          <Nota>Nada registrado. Use a aba Registrar e escolha {nomeDoDia(dia).toLowerCase()} no topo.</Nota>
        )}
      </Cartao>

      {/* Água */}
      <Cartao estilo={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Rotulo>Água</Rotulo>
          <Text style={{ fontSize: 13, fontWeight: '700', color: cores.azulEscuro }}>{numeroCurto(totalAgua / 1000)} L</Text>
        </View>
        <View style={{ gap: 8, paddingBottom: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: cores.tintaSuave }}>{ehHoje ? 'Adicionar agora' : 'Adicionar a este dia'}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[250, 500, 1000].map((ml) => (
              <View key={ml} style={{ flex: 1 }}>
                <Botao
                  titulo={ml === 1000 ? '+ 1 L' : `+ ${ml} ml`}
                  variante="agua"
                  aoTocar={() => adicionarAgua(ml)}
                  desativado={adicionando}
                />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Campo
                rotulo="Outra quantidade (ml)"
                value={outraQtd}
                onChangeText={(t) => setOutraQtd(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                placeholder="ex.: 1500"
                onSubmitEditing={adicionarOutra}
              />
            </View>
            <View style={{ width: 112 }}>
              <Botao titulo="Adicionar" variante="suave" aoTocar={adicionarOutra} ocupado={adicionando} />
            </View>
          </View>
          {erroAgua && <Text style={{ fontSize: 13, fontWeight: '700', color: cores.laranja }}>{erroAgua}</Text>}
        </View>
        {r?.agua.length ? (
          r.agua.map((a) => (
            <Linha
              key={a.id}
              texto={`${a.ml} ml`}
              detalhe={a.hora}
              aoApagar={() => confirmar(`Apagar ${a.ml} ml das ${a.hora}?`, () => apagarAgua(a.id))}
            />
          ))
        ) : (
          <Nota>Nenhum registro de água.</Nota>
        )}
      </Cartao>

      {/* Sono */}
      <Cartao estilo={{ gap: 4 }}>
        <Rotulo>Sono (noite que terminou neste dia)</Rotulo>
        {sonoManual && (
          <Linha
            texto={`${sonoManual.deitou} → ${sonoManual.acordou}`}
            detalhe={`digitado no app${sonoManual.qualidade ? ` · qualidade ${sonoManual.qualidade}/5` : ''}`}
            aoApagar={() => confirmar('Apagar o sono digitado?', () => apagarSonoManual(dia))}
          />
        )}
        {sonoRelogio && (
          <Linha
            texto={`${sonoRelogio.deitou} → ${sonoRelogio.acordou}`}
            detalhe={sonoManual ? 'relógio (o digitado tem prioridade)' : 'relógio via Health Connect'}
          />
        )}
        {!sonoManual && !sonoRelogio && <Nota>Nenhuma noite registrada.</Nota>}
        <Link href="/sono" asChild>
          <Pressable accessibilityRole="link" style={{ minHeight: 40, justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: cores.verdeTexto }}>{sonoManual ? 'corrigir na tela Sono' : 'registrar na tela Sono'}</Text>
          </Pressable>
        </Link>
      </Cartao>

      {/* Check-in */}
      <Cartao estilo={{ gap: 12 }}>
        <Rotulo>Check-in</Rotulo>
        <Escala campo="energia" valor={r?.checkin?.energia ?? null} aoEscolher={(v) => mudarCheckin('energia', v)} />
        <Escala campo="fome" valor={r?.checkin?.fome ?? null} aoEscolher={(v) => mudarCheckin('fome', v)} />
        <Escala campo="humor" valor={r?.checkin?.humor ?? null} aoEscolher={(v) => mudarCheckin('humor', v)} />
      </Cartao>

      {/* Dieta */}
      <Cartao estilo={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Rotulo>Dieta (FatSecret)</Rotulo>
          {r?.dieta && <Text style={{ fontSize: 12, color: cores.cinza }}>lida às {r.dieta.lidaEm}</Text>}
        </View>
        {r?.dieta ? (
          <>
            <Text style={{ fontSize: 22, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>{milhar(r.dieta.kcal)} kcal</Text>
            <Text style={{ fontSize: 13, color: cores.tintaSuave }}>
              {[
                r.dieta.proteina != null ? `proteína ${Math.round(r.dieta.proteina)} g` : null,
                r.dieta.carbo != null ? `carboidrato ${Math.round(r.dieta.carbo)} g` : null,
                r.dieta.gordura != null ? `gordura ${Math.round(r.dieta.gordura)} g` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </>
        ) : (
          <Nota>Nenhuma refeição deste dia chegou do Health Connect.</Nota>
        )}
        <Nota>Lançou ou corrigiu uma refeição no FatSecret? Ela chega quando o FatSecret envia ao Health Connect; depois toque em Sincronizar para trazer.</Nota>
        <Botao titulo="Sincronizar agora" variante="suave" aoTocar={sincronizarDieta} ocupado={sincronizando} />
      </Cartao>

      <Nota>Treinos, passos e dieta vêm do Health Connect: para corrigir, ajuste no app de origem (Hevy, relógio ou FatSecret).</Nota>
    </ScrollView>
  );
}

function Linha({ texto, detalhe, aoApagar }: { texto: string; detalhe: string; aoApagar?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: cores.linhaSuave }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>{texto}</Text>
        <Text style={{ fontSize: 12, color: cores.cinza }}>{detalhe}</Text>
      </View>
      {aoApagar && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Apagar ${texto}`}
          onPress={aoApagar}
          style={StyleSheet.flatten({ minHeight: 40, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', backgroundColor: cores.laranjaClaro })}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: cores.laranjaTexto }}>Apagar</Text>
        </Pressable>
      )}
    </View>
  );
}
