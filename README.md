# Captura do Saber v2 — Fato ou Fake

Jogo do projeto Conectando que usa a câmera para captar o movimento do jogador.
Manchetes vêm em direção ao jogador, que decide com a mão se cada uma é
**fato** (arrastar para a esquerda) ou **fake** (arrastar para a direita).

## Rodar localmente

Pré-requisito: Node.js

```bash
npm install
npm run dev
```

Abra http://localhost:3000 no Chrome e permita o acesso à câmera.

## Manchetes

As manchetes vêm de uma planilha do Google (com uma cópia de reserva em `public/manchetes.csv`).
Veja **[MANCHETES.md](MANCHETES.md)** para criar, retirar e corrigir manchetes.

## Configurações (ícone de engrenagem)

- **Controle**: câmera (mãos) ou teclado (setas ← FATO / → FAKE)
- **Câmera**: escolha do dispositivo e zoom (da câmera, quando ela permite; senão, zoom digital)
- **Banco de manchetes**: de onde vieram as manchetes, linhas ignoradas, recarregar e zerar as já vistas
- **Som**: volume
- **Manchete**: velocidade e aumento de velocidade a cada manchete
- **Gesto**: sensibilidade do arraste, marcador das mãos e modo de teste (mostra a resposta certa e o diagnóstico do gesto)

As configurações ficam salvas no navegador. O jogo pausa enquanto o painel está aberto.

As mãos são rastreadas com o MediaPipe Hand Landmarker (`src/hands.ts`); o modelo fica em
`public/models/hand_landmarker.task`. Um arraste só vale se começar perto do centro da tela.

## Publicar

```bash
npm run build
```

Gera a pasta `dist/`, que pode ser hospedada em qualquer serviço com HTTPS
(Netlify, Vercel, GitHub Pages). A câmera só funciona em HTTPS ou localhost.
