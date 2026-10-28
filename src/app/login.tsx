import * as Linking from 'expo-linking';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Botao, Campo, Cartao, Nota, estilos } from '@/components/ui';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { cores } from '@/lib/tema';

export default function Login() {
  const { sessao } = useSessao();
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null);

  // Link de confirmação do e-mail: o Supabase devolve para o app com os tokens
  // (saudeapp://login#access_token=...&refresh_token=...). Entra direto.
  const url = Linking.useLinkingURL();
  useEffect(() => {
    if (!url || !url.includes('access_token')) return;
    const fragmento = url.split('#')[1] ?? url.split('?')[1] ?? '';
    const p = new URLSearchParams(fragmento);
    const access_token = p.get('access_token');
    const refresh_token = p.get('refresh_token');
    if (access_token && refresh_token) {
      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(({ error }) => setMensagem(error ? { tipo: 'erro', texto: 'O link expirou. Entre com e-mail e senha.' } : { tipo: 'ok', texto: 'E-mail confirmado!' }));
    }
  }, [url]);

  if (sessao) return <Redirect href="/" />;

  async function enviar() {
    setMensagem(null);
    if (!email.trim() || senha.length < 6) {
      setMensagem({ tipo: 'erro', texto: 'Informe o e-mail e uma senha com pelo menos 6 caracteres.' });
      return;
    }
    setOcupado(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { data: { display_name: nome.trim() || undefined }, emailRedirectTo: Linking.createURL('/login') },
        });
        if (error) throw error;
        if (!data.session) {
          setMensagem({ tipo: 'ok', texto: 'Conta criada! Abra o e-mail neste celular e toque no link de confirmação: o app abre e você já entra.' });
          setModo('entrar');
        }
      }
    } catch (e) {
      const texto = e instanceof Error ? e.message : 'Não foi possível continuar.';
      setMensagem({ tipo: 'erro', texto: traduzir(texto) });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <SafeAreaView style={estilos.tela}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 20, gap: 20 }}>
        <View style={{ gap: 6 }}>
          <Text style={[estilos.titulo, { fontSize: 32 }]} accessibilityRole="header">
            Saúde
          </Text>
          <Nota>Treino, dieta, relógio e peso num lugar só.</Nota>
        </View>

        <Cartao estilo={{ gap: 14 }}>
          {modo === 'cadastrar' && <Campo rotulo="Seu nome" value={nome} onChangeText={setNome} autoComplete="name" />}
          <Campo
            rotulo="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Campo
            rotulo="Senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
          />
          {mensagem && (
            <Text
              accessibilityLiveRegion="polite"
              style={{ fontSize: 14, fontWeight: '600', color: mensagem.tipo === 'erro' ? cores.laranja : cores.verdeEscuro }}
            >
              {mensagem.texto}
            </Text>
          )}
          <Botao titulo={modo === 'entrar' ? 'Entrar' : 'Criar conta'} aoTocar={enviar} ocupado={ocupado} />
        </Cartao>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMensagem(null);
            setModo(modo === 'entrar' ? 'cadastrar' : 'entrar');
          }}
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: cores.verde }}>
            {modo === 'entrar' ? 'Não tem conta? Criar agora' : 'Já tem conta? Entrar'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function traduzir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link enviado antes de entrar.';
  if (/already registered/i.test(msg)) return 'Este e-mail já tem conta. Use "Entrar".';
  return msg;
}
