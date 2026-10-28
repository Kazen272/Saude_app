import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { Botao, Cartao, Nota, Pilula, Rotulo } from '@/components/ui';
import {
  abrirConfiguracoes,
  abrirLojaHealthConnect,
  disponibilidade,
  lerEstado,
  nomeDoApp,
  pedirPermissoes,
  permissoesConcedidas,
  sincronizar,
  type Disponibilidade,
  type EstadoSync,
} from '@/lib/healthconnect';
import { cores } from '@/lib/tema';

const HEVY = 'com.hevy';

function quandoFoi(iso: string | null): string {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dia${h >= 48 ? 's' : ''}`;
}

const lista = (origens: string[]) => [...new Set(origens.map(nomeDoApp))].join(', ');

/** Cartão da aba Mais: conectar, status de cada fonte e sincronizar. */
export function CartaoHealthConnect() {
  const [disp, setDisp] = useState<Disponibilidade | null>(null);
  const [liberadas, setLiberadas] = useState<number>(0);
  const [estado, setEstado] = useState<EstadoSync | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const d = await disponibilidade();
    setDisp(d);
    setEstado(await lerEstado());
    setLiberadas(d === 'disponivel' ? (await permissoesConcedidas().catch(() => [])).length : 0);
  }, []);

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
  const o = estado?.origens;
  const relogio = [...new Set([...(o?.atividade ?? []), ...(o?.sono ?? []), ...(o?.treinos ?? []).filter((x) => x !== HEVY)])].filter((x) => x !== HEVY);
  const temHevy = o?.treinos.includes(HEVY) ?? false;
  const dieta = o?.dieta ?? [];

  return (
    <Cartao estilo={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Rotulo>Health Connect</Rotulo>
          <Text style={{ fontSize: 12, color: cores.cinza }}>
            {conectado ? `${liberadas} de 8 tipos de dado liberados · leitura ${quandoFoi(estado?.ultimaSync ?? null)}` : 'Ainda não conectado'}
          </Text>
        </View>
        <Pilula texto={conectado ? 'Conectado' : 'Desligado'} tom={conectado ? 'verde' : 'cinza'} />
      </View>

      {conectado && (
        <View style={{ gap: 0 }}>
          <Fonte
            nome="Relógio"
            ok={relogio.length > 0}
            detalhe={
              relogio.length
                ? `${lista(relogio)} · ${estado?.contagem.dias ?? 0} dias, ${estado?.contagem.noites ?? 0} noites`
                : 'nada recebido: ative o Health Connect no app do relógio (Zepp, Mi Fitness...)'
            }
          />
          <Fonte
            nome="Hevy"
            ok={temHevy}
            detalhe={temHevy ? `${estado?.contagem.treinos ?? 0} treinos nos últimos 28 dias` : 'nada recebido: no Hevy, Configurações › Integrações › Health Connect'}
          />
          <Fonte
            nome="Dieta"
            ok={dieta.length > 0}
            detalhe={
              dieta.length
                ? `${lista(dieta)} · ${estado?.contagem.diasDieta ?? 0} dias`
                : 'nada recebido: o FatSecret precisa compartilhar nutrição com o Health Connect'
            }
            ultima
          />
        </View>
      )}

      {estado?.erro && <Text style={{ fontSize: 13, fontWeight: '600', color: cores.laranja }}>{estado.erro}</Text>}

      {conectado ? (
        <>
          <Botao titulo="Sincronizar agora" aoTocar={sincronizarAgora} ocupado={ocupado} />
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

function Fonte({ nome, ok, detalhe, ultima = false }: { nome: string; ok: boolean; detalhe: string; ultima?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: ultima ? 0 : 1, borderBottomColor: cores.linhaSuave }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: cores.tinta }}>{nome}</Text>
        <Text style={{ fontSize: 12, color: ok ? cores.cinza : cores.laranja }}>{detalhe}</Text>
      </View>
      <Pilula texto={ok ? 'Recebendo' : 'Sem dados'} tom={ok ? 'verde' : 'laranja'} />
    </View>
  );
}
