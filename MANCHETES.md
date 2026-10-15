# Como editar as manchetes do Fato ou Fake

As manchetes ficam numa **planilha do Google**. O jogo lê a planilha toda vez que é aberto, então
qualquer mudança aparece no jogo em poucos minutos, sem precisar mexer no código.

Se a planilha não puder ser lida (sem internet, link errado), o jogo usa uma **cópia de reserva**
que vai junto com ele: o arquivo [`public/manchetes.csv`](public/manchetes.csv).

## As colunas

A primeira linha da planilha precisa ter exatamente estes nomes (maiúsculas e acentos não importam):

| Coluna | Obrigatória | O que colocar |
|---|---|---|
| `id` | sim | Um número único para cada manchete. **Nunca reaproveite nem mude o id** de uma manchete: é por ele que o jogo lembra quais já saíram. |
| `manchete` | sim | O texto que aparece no cartão. Prefira até ~90 caracteres. |
| `resposta` | sim | `FATO` ou `FAKE`. |
| `explicacao` | não, mas recomendada | Uma ou duas frases explicando por que é fato ou fake. Aparece depois de cada jogada. |
| `fonte` | não | Link da checagem (agência de checagem, órgão oficial). Não aparece no jogo; serve para a equipe conferir. |
| `tema` | não | Ex.: saúde, ciência, meio ambiente. Ainda não é usado no jogo. |
| `ativa` | não | `sim` ou `não`. Vazio conta como `sim`. |

## Tarefas do dia a dia

- **Criar uma manchete:** adicione uma linha nova com um `id` que ainda não existe.
- **Retirar uma manchete:** mude `ativa` para `não`. Não apague a linha, assim dá para reativar depois.
- **Corrigir uma manchete:** edite o texto normalmente, mantendo o mesmo `id`.

Linhas com problema (sem `id`, `id` repetido, manchete vazia, resposta diferente de FATO/FAKE) são
**ignoradas**. Para ver quais foram ignoradas: no jogo, abra a engrenagem → **Banco de manchetes**.

## Quantas manchetes?

Cada partida usa 10 manchetes, metade fato e metade fake quando possível. O jogo não repete
manchetes num mesmo aparelho até todas terem saído. Com **100 manchetes** (50 + 50), são 10 partidas
sem repetição. Para testes, 30 a 40 já bastam.

## Configurar a planilha (uma vez só)

1. No Google Drive (de preferência na conta do projeto), crie uma planilha nova.
2. **Arquivo → Importar → Fazer upload** e envie o arquivo [`public/manchetes.csv`](public/manchetes.csv).
   Escolha **"Substituir planilha atual"**. Isso já cria as colunas certas com linhas de exemplo.
3. Troque as linhas de exemplo pelas manchetes de verdade.
4. **Arquivo → Compartilhar → Publicar na Web**:
   - em "Link", escolha a aba das manchetes e o formato **Valores separados por vírgula (.csv)**;
   - clique em **Publicar** e copie o link (termina com `output=csv`).
5. Esse link vai na constante `SHEET_CSV_URL` em [`src/headlines.ts`](src/headlines.ts)
   (só precisa ser feito uma vez, e então publicado no GitHub).

> Publicar na Web deixa **só a aba publicada** visível para quem tiver o link, e apenas para leitura.
> Quem edita continua sendo só quem tem acesso à planilha no Google Drive.

Depois de editar a planilha, o Google pode levar **até ~5 minutos** para atualizar a versão publicada.
No jogo, o botão **Recarregar** (engrenagem → Banco de manchetes) busca de novo sem recarregar a página.

## Atualizar a cópia de reserva

De vez em quando, baixe a planilha (**Arquivo → Fazer download → Valores separados por vírgula**) e
substitua o arquivo `public/manchetes.csv` no projeto, para que a reserva não fique desatualizada.
