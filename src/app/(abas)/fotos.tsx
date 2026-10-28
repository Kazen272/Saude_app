import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Cabecalho, Cartao, Nota, Rotulo, estilos } from '@/components/ui';
import { cores } from '@/lib/tema';

// As fotos de progresso entram na Fase 2 (câmera, envio ao bucket privado e comparativo).
export default function Fotos() {
  return (
    <SafeAreaView style={estilos.tela} edges={['top']}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Cabecalho sobre="Fase 2" titulo="Fotos de progresso" />
        <Cartao>
          <Rotulo>Em construção</Rotulo>
          <Nota>
            Aqui você vai tirar uma foto por semana (frente, lado e costas) e comparar antes e agora. O espaço privado
            para as fotos já está pronto no banco.
          </Nota>
          <View style={{ height: 180, borderRadius: 12, backgroundColor: cores.linhaSuave }} />
        </Cartao>
      </ScrollView>
    </SafeAreaView>
  );
}
