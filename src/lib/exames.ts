import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { supabase } from './supabase';

const BUCKET = 'lab-reports';

export type Resultado = { marcador: string; valor: number; unidade: string; refMin: number | null; refMax: number | null };
export type Exame = { id: number; dia: string; laboratorio: string | null; arquivo: string | null; resultados: Resultado[] };
export type ArquivoEscolhido = { uri: string; nome: string; tipo: string };

type LinhaResultado = { marker: string; value: number | string; unit: string; ref_low: number | string | null; ref_high: number | string | null };

const num = (v: number | string | null) => (v == null ? null : Number(v));
const deResultado = (r: LinhaResultado): Resultado => ({
  marcador: r.marker,
  valor: Number(r.value),
  unidade: r.unit,
  refMin: num(r.ref_low),
  refMax: num(r.ref_high),
});

/** Exames do usuário, do mais recente para o mais antigo, com os resultados. */
export async function listarExames(): Promise<Exame[]> {
  const { data, error } = await supabase
    .from('lab_exams')
    .select('id, collected_on, lab_name, file_path, lab_results (marker, value, unit, ref_low, ref_high)')
    .order('collected_on', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id as number,
    dia: e.collected_on as string,
    laboratorio: (e.lab_name as string | null) ?? null,
    arquivo: (e.file_path as string | null) ?? null,
    resultados: ((e.lab_results ?? []) as LinhaResultado[]).map(deResultado),
  }));
}

/** Escolhe o laudo (PDF ou imagem) no celular. */
export async function escolherLaudo(): Promise<ArquivoEscolhido | null> {
  const r = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  return { uri: a.uri, nome: a.name, tipo: a.mimeType ?? 'application/pdf' };
}

const extensao = (tipo: string) => ({ 'application/pdf': 'pdf', 'image/png': 'png', 'image/webp': 'webp' })[tipo] ?? 'jpg';

/** Cria o exame com seus resultados e, se houver, envia o laudo para a pasta privada. */
export async function salvarExame(p: {
  dia: string;
  laboratorio: string;
  resultados: Resultado[];
  laudo: ArquivoEscolhido | null;
}): Promise<number> {
  const { data: usuario } = await supabase.auth.getUser();
  const id = usuario.user?.id;
  if (!id) throw new Error('Sessão expirada. Entre de novo.');

  let caminho: string | null = null;
  if (p.laudo) {
    caminho = `${id}/${p.dia}-${Date.now()}.${extensao(p.laudo.tipo)}`;
    const bytes = await new File(p.laudo.uri).arrayBuffer();
    const { error } = await supabase.storage.from(BUCKET).upload(caminho, bytes, { contentType: p.laudo.tipo });
    if (error) throw error;
  }

  const { data: exame, error: erroExame } = await supabase
    .from('lab_exams')
    .insert({ collected_on: p.dia, lab_name: p.laboratorio.trim() || null, file_path: caminho })
    .select('id')
    .single();
  if (erroExame) throw erroExame;

  if (p.resultados.length) {
    const { error } = await supabase.from('lab_results').insert(
      p.resultados.map((r) => ({
        exam_id: exame.id,
        marker: r.marcador,
        value: r.valor,
        unit: r.unidade,
        ref_low: r.refMin,
        ref_high: r.refMax,
      })),
    );
    if (error) {
      await supabase.from('lab_exams').delete().eq('id', exame.id); // não deixa exame pela metade
      throw error;
    }
  }
  return exame.id as number;
}

export async function apagarExame(exame: Exame): Promise<void> {
  if (exame.arquivo) await supabase.storage.from(BUCKET).remove([exame.arquivo]);
  const { error } = await supabase.from('lab_exams').delete().eq('id', exame.id);
  if (error) throw error;
}

/** Link temporário (1 h) para abrir o laudo. */
export async function linkDoLaudo(caminho: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
