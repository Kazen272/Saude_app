import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Botao, Cabecalho, Cartao, Nota, Rotulo, estilos } from '@/components/ui';
import { decimal, diaCurto, diaLocal } from '@/lib/datas';
import { POSES, adicionarFoto, listarFotos, listarMedidas, type Foto, type Medidas, type Pose } from '@/lib/fotos';
import { cores } from '@/lib/tema';

export default function Fotos() {
  const [pose, setPose] = useState<Pose>('frente');
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [medidas, setMedidas] = useState<Medidas[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null); // dia escolhido na linha do tempo
  const [enviando, setEnviando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [f, m] = await Promise.all([listarFotos(), listarMedidas()]);
      setFotos(f);
      setMedidas(m);
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao carregar as fotos.' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  async function nova(origem: 'camera' | 'galeria') {
    setMensagem(null);
    setEnviando(true);
    const r = await adicionarFoto(pose, origem);
    setEnviando(false);
    if (r.ok) {
      setMensagem({ tipo: 'ok', texto: 'Foto salva.' });
      setSelecionada(null);
      carregar();
    } else if (r.motivo === 'sem_permissao') {
      setMensagem({ tipo: 'erro', texto: 'Sem permissão. Libere o acesso à câmera ou às fotos nas configurações do Android.' });
    } else if (r.motivo === 'erro') {
      setMensagem({ tipo: 'erro', texto: r.mensagem ?? 'Erro ao enviar a foto.' });
    }
  }

  const daPose = fotos.filter((f) => f.pose === pose);
  const antes = daPose[0];
  const agora = daPose.find((f) => f.dia === selecionada) ?? daPose.at(-1);
  const medidaDe = (dia?: string) => {
    if (!dia) return null;
    // a medida registrada mais próxima até aquele dia
    return [...medidas].reverse().find((m) => m.dia <= dia && m.pesoKg != null) ?? null;
  };
  const pesoAntes = medidaDe(antes?.dia)?.pesoKg ?? null;
  const pesoAgora = medidaDe(agora?.dia)?.pesoKg ?? null;
  const cinturas = medidas.filter((m) => m.cinturaCm != null);
  const deltaCintura =
    cinturas.length >= 2 ? (cinturas[cinturas.length - 1].cinturaCm as number) - (cinturas[0].cinturaCm as number) : null;
  const jaTemHoje = daPose.some((f) => f.dia === diaLocal());

  return (
    <SafeAreaView style={estilos.tela} edges={['top']}>
      <ScrollView
        contentContainerStyle={estilos.conteudo}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            tintColor={cores.verde}
            onRefresh={async () => {
              setAtualizando(true);
              await carregar();
              setAtualizando(false);
            }}
          />
        }
      >
        <Cabecalho
          sobre={fotos.length ? `${fotos.length} foto${fotos.length > 1 ? 's' : ''} desde ${diaCurto(fotos[0].dia)}` : 'Nenhuma foto ainda'}
          titulo="Fotos de progresso"
        />

        <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, backgroundColor: cores.segmento, borderRadius: 12, padding: 4 }}>
          {POSES.map((p) => {
            const ativa = p.id === pose;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativa }}
                onPress={() => {
                  setPose(p.id);
                  setSelecionada(null);
                }}
                style={{ flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: ativa ? cores.cartao : 'transparent' }}
              >
                <Text style={{ fontSize: 13, fontWeight: ativa ? '700' : '600', color: ativa ? cores.tinta : cores.cinza }}>{p.nome}</Text>
              </Pressable>
            );
          })}
        </View>

        <Cartao estilo={{ flexDirection: 'row', gap: 10, padding: 12 }}>
          <Quadro titulo="Antes" foto={antes} pesoKg={pesoAntes} vazio="A primeira foto deste ângulo aparece aqui." />
          <Quadro
            titulo="Agora"
            foto={agora && agora !== antes ? agora : undefined}
            pesoKg={agora && agora !== antes ? pesoAgora : null}
            vazio={antes ? 'Tire a próxima foto para comparar.' : 'Depois, a mais recente fica aqui.'}
            destaque
          />
        </Cartao>

        <Cartao estilo={{ gap: 0, paddingVertical: 4 }}>
          <LinhaDado
            titulo="Peso"
            valor={pesoAntes != null && pesoAgora != null && agora !== antes ? variacao(pesoAgora - pesoAntes, 'kg') : '—'}
          />
          <LinhaDado titulo="Cintura" valor={deltaCintura != null ? variacao(deltaCintura, 'cm', 0) : '—'} ultima />
        </Cartao>

        <View style={{ gap: 8 }}>
          <Rotulo>Linha do tempo</Rotulo>
          {daPose.length === 0 ? (
            <Nota>Sem fotos de {POSES.find((p) => p.id === pose)?.nome.toLowerCase()} ainda.</Nota>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {daPose.map((f) => {
                const marcada = f.dia === (agora?.dia ?? '') || f === antes;
                return (
                  <Pressable
                    key={f.caminho}
                    accessibilityRole="button"
                    accessibilityLabel={`Foto de ${diaCurto(f.dia)}`}
                    onPress={() => setSelecionada(f.dia)}
                    style={{ width: 64, height: 86, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: marcada ? cores.verde : 'transparent', backgroundColor: cores.linhaSuave }}
                  >
                    {f.url && <Image source={{ uri: f.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />}
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(22,32,27,0.65)', paddingVertical: 2 }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>{diaCurto(f.dia)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={{ backgroundColor: cores.laranjaClaro, borderRadius: 14, padding: 14 }}>
          <Text style={{ fontSize: 13, color: cores.laranjaTexto }}>
            <Text style={{ fontWeight: '700' }}>Dica: </Text>
            mesma luz, mesmo lugar e mesma hora, uma vez por semana. As fotos ficam numa pasta privada que só você acessa.
          </Text>
        </View>

        {mensagem && (
          <Text accessibilityLiveRegion="polite" style={{ fontSize: 14, fontWeight: '700', textAlign: 'center', color: mensagem.tipo === 'ok' ? cores.verdeEscuro : cores.laranja }}>
            {mensagem.texto}
          </Text>
        )}

        <Botao titulo={jaTemHoje ? 'Refazer a foto de hoje' : 'Tirar foto de hoje'} aoTocar={() => nova('camera')} ocupado={enviando} />
        <Botao titulo="Escolher da galeria" variante="suave" aoTocar={() => nova('galeria')} desativado={enviando} />
      </ScrollView>
    </SafeAreaView>
  );
}

function variacao(delta: number, unidade: string, casas = 1) {
  if (Math.abs(delta) < 0.05) return `0 ${unidade}`;
  return `${delta < 0 ? '−' : '+'}${decimal(Math.abs(delta), casas)} ${unidade}`;
}

function Quadro({ titulo, foto, pesoKg, vazio, destaque = false }: { titulo: string; foto?: Foto; pesoKg: number | null; vazio: string; destaque?: boolean }) {
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <View
        style={{
          height: 230,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: destaque ? cores.verdeClaro : cores.segmento,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
        }}
      >
        {foto?.url ? (
          <Image
            source={{ uri: foto.url }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            resizeMode="cover"
            accessibilityLabel={`${titulo}: foto de ${diaCurto(foto.dia)}`}
          />
        ) : (
          <Text style={{ fontSize: 12, color: cores.cinza, textAlign: 'center' }}>{vazio}</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: cores.tinta }}>
          {titulo}
          {foto ? ` · ${diaCurto(foto.dia)}` : ''}
        </Text>
        {pesoKg != null && <Text style={{ fontSize: 12, color: cores.cinza }}>{decimal(pesoKg)} kg</Text>}
      </View>
    </View>
  );
}

function LinhaDado({ titulo, valor, ultima = false }: { titulo: string; valor: string; ultima?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: ultima ? 0 : 1,
        borderBottomColor: cores.linhaSuave,
      }}
    >
      <Text style={{ fontSize: 14, color: cores.tintaSuave }}>{titulo}</Text>
      <Text style={{ fontSize: 15, fontWeight: '800', color: cores.verdeTexto, fontVariant: ['tabular-nums'] }}>{valor}</Text>
    </View>
  );
}
