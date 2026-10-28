import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { diaLocal } from './datas';
import { supabase } from './supabase';

export type Pose = 'frente' | 'lado' | 'costas';
export const POSES: { id: Pose; nome: string }[] = [
  { id: 'frente', nome: 'Frente' },
  { id: 'lado', nome: 'Lado' },
  { id: 'costas', nome: 'Costas' },
];

export type Foto = { dia: string; pose: Pose; caminho: string; url: string | null };
export type Medidas = { dia: string; pesoKg: number | null; cinturaCm: number | null };

const BUCKET = 'progress-photos';

/** Fotos do usuário (mais antigas primeiro), com links temporários para exibir. */
export async function listarFotos(): Promise<Foto[]> {
  const { data, error } = await supabase.from('progress_photos').select('taken_on, pose, storage_path').order('taken_on');
  if (error) throw error;
  const linhas = data ?? [];
  if (!linhas.length) return [];
  const { data: links, error: erroLinks } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      linhas.map((l) => l.storage_path as string),
      60 * 60,
    );
  if (erroLinks) throw erroLinks;
  return linhas.map((l, i) => ({
    dia: l.taken_on as string,
    pose: l.pose as Pose,
    caminho: l.storage_path as string,
    url: links?.[i]?.signedUrl ?? null,
  }));
}

/** Peso e cintura por dia, para legendar as fotos. */
export async function listarMedidas(): Promise<Medidas[]> {
  const { data, error } = await supabase.from('body_entries').select('measured_on, weight_kg, waist_cm').order('measured_on');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    dia: r.measured_on as string,
    pesoKg: r.weight_kg == null ? null : Number(r.weight_kg),
    cinturaCm: r.waist_cm == null ? null : Number(r.waist_cm),
  }));
}

export type ResultadoFoto = { ok: true } | { ok: false; motivo: 'cancelado' | 'sem_permissao' | 'erro'; mensagem?: string };

/** Abre a câmera (ou galeria), reduz a foto para ~1080 px e envia para a pasta privada do usuário. */
export async function adicionarFoto(pose: Pose, origem: 'camera' | 'galeria'): Promise<ResultadoFoto> {
  const permissao =
    origem === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permissao.granted) return { ok: false, motivo: 'sem_permissao' };

  const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [3, 4] };
  const escolha = origem === 'camera' ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
  if (escolha.canceled || !escolha.assets?.[0]) return { ok: false, motivo: 'cancelado' };

  try {
    const imagem = await ImageManipulator.manipulate(escolha.assets[0].uri).resize({ width: 1080 }).renderAsync();
    const salva = await imagem.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
    if (!salva.base64) throw new Error('Não foi possível preparar a foto.');

    const { data: usuario } = await supabase.auth.getUser();
    const id = usuario.user?.id;
    if (!id) throw new Error('Sessão expirada. Entre de novo.');

    const dia = diaLocal();
    const caminho = `${id}/${dia}-${pose}.jpg`;
    const { error: erroEnvio } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, base64ParaBytes(salva.base64), { contentType: 'image/jpeg', upsert: true });
    if (erroEnvio) throw erroEnvio;

    const { error: erroRegistro } = await supabase
      .from('progress_photos')
      .upsert({ user_id: id, taken_on: dia, pose, storage_path: caminho }, { onConflict: 'user_id,taken_on,pose' });
    if (erroRegistro) throw erroRegistro;
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: 'erro', mensagem: e instanceof Error ? e.message : 'Erro ao enviar a foto.' };
  }
}

function base64ParaBytes(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}
