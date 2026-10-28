import { Redirect } from 'expo-router';
import { useState } from 'react';
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
          options: { data: { display_name: nome.trim() || undefined } },
        });
        if (error) throw error;
        if (!data.session) {
          setMensagem({ tipo: 'ok', texto: 'Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre aqui.' });
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
