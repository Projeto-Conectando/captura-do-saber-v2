# Captura do Saber v2 — Fato ou Fake

Jogo do projeto Conectando que usa a câmera para captar o movimento do jogador.
Manchetes vêm em direção ao jogador, que decide com a mão se cada uma é
**fato** (arrastar para a esquerda) ou **fake** (arrastar para a direita).

> Versão de teste da mecânica: as manchetes ainda são retângulos genéricos e a resposta certa é sorteada.

## Rodar localmente

Pré-requisito: Node.js

```bash
npm install
npm run dev
```

Abra http://localhost:3000 no Chrome e permita o acesso à câmera.

## Controles de teste

- **D**: liga/desliga o modo de teste (área de detecção, rastro do movimento e resposta certa)
- **← / →**: escolhe FATO / FAKE pelo teclado (para testar sem câmera)

A sensibilidade do gesto é ajustada pelas constantes no topo de `src/motion.ts`.

## Publicar

```bash
npm run build
```

Gera a pasta `dist/`, que pode ser hospedada em qualquer serviço com HTTPS
(Netlify, Vercel, GitHub Pages). A câmera só funciona em HTTPS ou localhost.
