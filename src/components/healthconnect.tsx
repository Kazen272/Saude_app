import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Switch, Text, View } from 'react-native';

import { Botao, Cartao, Nota, Pilula, Rotulo } from '@/components/ui';
import {
  abrirConfiguracoes,
  abrirLojaHealthConnect,
  carregarFontesAtivas,
  salvarFontesAtivas,
  disponibilidade,
  lerEstado,
  nomeDoApp,
  pedirPermissoes,
  PERMISSOES,
  permissoesConcedidas,
  sincronizar,
  type Disponibilidade,
  type EstadoSync,
} from '@/lib/healthconnect';
import { descreverTipos } from '@/lib/healthconnect-regras';
import { cores } from '@/lib/tema';


function quandoFoi(iso: string | null): string {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dia${h >= 48 ? 's' : ''}`;
}


/** Cartão da aba Mais: conectar, status de cada fonte e sincronizar. */
export function CartaoHealthConnect() {
  const [disp, setDisp] = useState<Disponibilidade | null>(null);
  const [liberadas, setLiberadas] = useState<number>(0);
  const [estado, setEstado] = useState<EstadoSync | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [ativos, setAtivos] = useState<string[] | null>(null);
  const [erroFontes, setErroFontes] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const d = await disponibilidade();
    setDisp(d);
    setEstado(await lerEstado());
    setLiberadas(d === 'disponivel' ? (await permissoesConcedidas().catch(() => [])).length : 0);
    setAtivos(await carregarFontesAtivas().catch(() => null));
  }, []);

  async function alternarApp(pacote: string) {
    if (!ativos) return;
    const novo = ativos.includes(pacote) ? ativos.filter((x) => x !== pacote) : [...ativos, pacote];
    const antes = ativos;
    setAtivos(novo);
    setErroFontes(null);
    setOcupado(true);
    try {
      await salvarFontesAtivas(novo);
      setEstado(await sincronizar());
    } catch {
      setAtivos(antes);
      setErroFontes('Não foi possível salvar. Confira a internet e tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  async function conectar() {
    setOcupado(true);
    try {
      const concedidas = await pedirPermissoes();
      setLiberadas(concedidas.length);
      if (concedidas.length) setEstado(await sincronizar());
    } finally {
      setOcupado(false);
    }
  }

  async function sincronizarAgora() {
    setOcupado(true);
    try {
      setEstado(await sincronizar());
    } finally {
      setOcupado(false);
    }
  }

  if (Platform.OS !== 'android') {
    return (
      <Cartao>
        <Rotulo>Health Connect</Rotulo>
        <Nota>Disponível só no app Android.</Nota>
      </Cartao>
    );
  }

  if (disp === 'precisa_atualizar' || disp === 'indisponivel') {
    return (
      <Cartao estilo={{ gap: 10 }}>
        <Rotulo>Health Connect</Rotulo>
        <Nota>
          {disp === 'precisa_atualizar'
            ? 'O Health Connect precisa ser atualizado para o app conseguir ler os dados do relógio, do Hevy e do FatSecret.'
            : 'O Health Connect não foi encontrado. No Android 13 ou anterior, instale-o pela Play Store.'}
        </Nota>
        <Botao titulo={disp === 'precisa_atualizar' ? 'Atualizar na Play Store' : 'Instalar na Play Store'} aoTocar={abrirLojaHealthConnect} />
      </Cartao>
    );
  }

  const conectado = liberadas > 0;
  const apps = [
    ...(estado?.apps ?? []),
    ...(ativos ?? []).filter((p) => !estado?.apps.some((a) => a.pacote === p)).map((pacote) => ({ pacote, tipos: [] as string[] })),
  ];
  const nenhumAtivo = ativos != null && ativos.length === 0;

  return (
    <Cartao estilo={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Rotulo>Health Connect</Rotulo>
          <Text style={{ fontSize: 12, color: cores.cinza }}>
            {conectado ? `${liberadas} de ${PERMISSOES.length} tipos de dado liberados · leitura ${quandoFoi(estado?.ultimaSync ?? null)}` : 'Ainda não conectado'}
          </Text>
        </View>
        <Pilula texto={conectado ? 'Conectado' : 'Desligado'} tom={conectado ? 'verde' : 'cinza'} />
      </View>

      {conectado && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: cores.tintaSuave }}>Apps que o Saúde lê</Text>
          {nenhumAtivo && (
            <View style={{ backgroundColor: cores.laranjaClaro, borderRadius: 12, padding: 12 }}>
              <Text style={{ fontSize: 13, color: cores.laranjaTexto, fontWeight: '600', lineHeight: 18 }}>
                Nenhum app ativado: o Saúde não está lendo nada do Health Connect. Ative abaixo só os apps que você quer usar.
              </Text>
            </View>
          )}
          {apps.length === 0 ? (
            <Nota>Nenhum app gravou dados no Health Connect nos últimos 28 dias. Toque em Sincronizar depois de ativar o Health Connect no app do relógio, no Hevy ou no FatSecret.</Nota>
          ) : (
            <View>
              {apps.map((a, i) => {
                const ligado = ativos?.includes(a.pacote) ?? false;
                return (
                  <View
                    key={a.pacote}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: i === apps.length - 1 ? 0 : 1, borderBottomColor: cores.linhaSuave }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>{nomeDoApp(a.pacote)}</Text>
                      <Text style={{ fontSize: 12, color: cores.cinza }}>{a.tipos.length ? descreverTipos(a.tipos) : 'nada gravado nos últimos 28 dias'}</Text>
                    </View>
                    <Switch
                      accessibilityLabel={`Ler dados de ${nomeDoApp(a.pacote)}`}
                      value={ligado}
                      disabled={ocupado || ativos == null}
                      onValueChange={() => alternarApp(a.pacote)}
                      trackColor={{ true: cores.verde, false: cores.linha }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                );
              })}
            </View>
          )}
          {erroFontes && <Text style={{ fontSize: 13, fontWeight: '600', color: cores.laranja }}>{erroFontes}</Text>}
          <Nota>Desligar um app apaga do Saúde os dados dele dos últimos 28 dias (nada muda no app nem no Health Connect). Não achou um app? Ative o Health Connect dentro dele (Hevy, FatSecret, Strava, Zepp...) e toque em Sincronizar.</Nota>
        </View>
      )}

      {estado?.erro && <Text style={{ fontSize: 13, fontWeight: '600', color: cores.laranja }}>{estado.erro}</Text>}

      {conectado ? (
        <>
          {liberadas < PERMISSOES.length && (
            <>
              <Nota>Há tipos de dado novos para liberar (ex.: frequência cardíaca).</Nota>
              <Botao titulo="Liberar os tipos que faltam" aoTocar={conectar} ocupado={ocupado} />
            </>
          )}
          <Botao titulo="Sincronizar agora" variante={liberadas < PERMISSOES.length ? 'suave' : 'principal'} aoTocar={sincronizarAgora} ocupado={ocupado} />
          <Botao titulo="Gerenciar permissões" variante="suave" aoTocar={abrirConfiguracoes} desativado={ocupado} />
        </>
      ) : (
        <>
          <Nota>O app lê passos, calorias, sono, frequência cardíaca, treinos, dieta e peso que o relógio, o Hevy e o FatSecret gravam no Health Connect. Só leitura: nada é alterado nesses apps.</Nota>
          <Botao titulo="Conectar ao Health Connect" aoTocar={conectar} ocupado={ocupado} desativado={disp == null} />
        </>
      )}
    </Cartao>
  );
}
