---
name: daily
description: Monta e envia o daily summary do dev em formato humanizado (categorizado por tipo de mudanca + multi-fonte de pendencias) para o grupo da equipe no WhatsApp via Evolution API. Use quando o dev pedir "/daily", "manda meu daily", "fecha o dia" ou equivalente. Aceita opcionalmente nome de projeto (ex.: "/daily myproject") e/ou data (--date YYYY-MM-DD). Faz onboarding interativo na primeira execucao do dev no projeto.
argument-hint: "Opcional: <nome-projeto>, --date YYYY-MM-DD, --reconfigure"
---

# /daily - daily summary humanizado e multi-fonte

Orquestra o fluxo do daily: detecta config do dev (faz onboarding se nao houver), coleta dados estruturados via `build-summary.mjs --json`, humaniza commits categorizando por tipo, combina pendencias de ate 3 fontes (GitHub issues, TODO_pending, arquivo de em-andamento), mostra preview, envia pro grupo de WhatsApp via Evolution e arquiva copia.

## Argumentos

| Forma | Comportamento |
|---|---|
| `/daily` | Projeto da sessao atual. Onboarding na primeira execucao. |
| `/daily <nome-projeto>` | Resolve via `workspace.code-workspace`, gera daily desse projeto target. |
| `/daily --date YYYY-MM-DD` | Mesma sessao, dia diferente. |
| `/daily --reconfigure` | Refaz o onboarding (apaga `.daily-config.json` antes). |

## Pre-requisitos

1. `scripts/daily/.env` existe com `EVOLUTION_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_API_KEY`, `EVOLUTION_DEFAULT_GROUP`. (Setup inicial e diferente do onboarding desta skill - ver `scripts/daily/MANUAL.md`.)
2. Sessao Claude Code rodando num clone de projeto previous-internal-project (verificar com `git rev-parse --show-toplevel`).
3. Node disponivel (`node --version`).

Se algum pre-requisito falhar, avise em uma frase e pare. Nao tente "ajustar".

## Fluxo

### Passo 1: resolver projeto target

**Caso A: sem nome de projeto**
- `TARGET_PATH=$(git rev-parse --show-toplevel)`
- `TARGET_NAME=$(basename "$TARGET_PATH")`

**Caso B: com nome de projeto**
```bash
TARGET_PATH=$(node scripts/daily/resolve-project.mjs <nome>)
```
Tratar exit codes (1 = zero matches / workspace ausente; 2 = ambiguo - perguntar qual). Validar que `$TARGET_PATH/scripts/daily/build-summary.mjs` existe; se nao, erro pedindo replicacao.

### Passo 2: detectar dev + config

```bash
DEV_JSON=$(cd "$TARGET_PATH" && node scripts/daily/build-summary.mjs --whoami)
# {"gitName":"...","name":"Aldiney Carneiro","docsFolder":"AldineyCarneiro"}
```

Extrair `docsFolder`. Se `docsFolder` for `null` (dev fora do `DEV_MAP`), avise: `Dev sem mapeamento em DEV_MAP do build-summary.mjs - pulando onboarding e arquivamento. Funcionalidade limitada.` E siga sem config.

Checar se `$TARGET_PATH/docs/<docsFolder>/.daily-config.json` existe.

### Passo 3a: config existe -> pular pra Passo 4

### Passo 3b: config nao existe (ou `--reconfigure`) -> ONBOARDING

Onboarding e interativo no chat. Antes de perguntar, leia `$TARGET_PATH/CLAUDE.md` e extraia convencoes (procurar secao "Documentacao por desenvolvedor" ou similar). Use isso pra sugerir defaults.

Mostre ao dev:

```
=== Primeira vez rodando /daily neste projeto. Vou te configurar em ~1 minuto. ===

Li o CLAUDE.md e identifiquei:
  - Documentacao por dev: docs/<NomeDev>/
  - Subpastas padrao: <as que voce encontrar - tipicamente handoffs/, historico/, PRD/>

Detectado via git: <gitName> -> mapeado pra <formalName> -> pasta docs/<docsFolder>/

Vou perguntar 4 coisas. Cada uma tem um default; aceite com 's' / 'enter' / 'sim'.
```

Perguntas (ajustar valores conforme o que leu do CLAUDE.md):

1. **Confirma seu mapeamento de dev?**
   - `gitName: <X>`, `formalName: <Y>`, `docsFolder: <Z>`
   - Se confirmar, segue. Senao, dev edita o `DEV_MAP` em `build-summary.mjs` e roda `/daily --reconfigure` depois.

2. **Quer puxar pendencias das suas issues abertas no GitHub?**
   - Sugestao: ativar, repo `aldiney/<nome-do-target>`.
   - Se sim: testar `gh auth status`. Se nao autenticado, avise: rodar `gh auth login` antes.

3. **Tem arquivo de andamento de sessao?**
   - Sugestao: `docs/<docsFolder>/em-andamento.md` (alinhado com CLAUDE.md).
   - Opcoes: `enter` (usa sugestao), `n` (pula essa fonte), ou path custom.
   - Se o arquivo nao existir e dev confirmar, criar arquivo vazio com template:
     ```markdown
     # Em andamento - <formalName>
     
     ## Em andamento
     <coloque aqui o que esta trabalhando agora, atualize ao longo do dia>
     
     ## Pendente
     <coloque aqui o que ainda nao comecou mas e seu>
     ```

4. **Quer humanizacao dos commits ou prefere lista crua?**
   - Sugestao: humanizado.
   - Se humanizado: o /daily vai agrupar commits por tipo (feat/fix/refactor/docs/...) e escrever uma frase curta por grupo, em vez de listar commits crus.

Apos as 4 respostas, montar e salvar config em `$TARGET_PATH/docs/<docsFolder>/.daily-config.json`:

```json
{
  "$schema": "../../scripts/daily/.daily-config.schema.json",
  "dev": {
    "gitName": "...",
    "formalName": "...",
    "docsFolder": "..."
  },
  "fontes_pendente": {
    "github_issues": { "ativo": true|false, "repo": "aldiney/..." },
    "todo_pending":  { "ativo": true,        "tag": "@<primeiro-nome>" },
    "arquivo_em_andamento": { "ativo": true|false, "path": "docs/.../em-andamento.md" }
  },
  "fonte_travado": {
    "path": "docs/<docsFolder>/historico/",
    "headers": ["Travado", "Bloqueado"]
  },
  "humanizacao_commits": true|false,
  "version": 1
}
```

Reporte: `Configuracao salva em docs/<docsFolder>/.daily-config.json. Da proxima vez, /daily vai direto pra geracao.`

Pergunte: `Quer gerar o seu primeiro daily agora? [s/n]`. Se `s`, segue pra Passo 4.

### Passo 4: gerar dados do daily

```bash
( cd "$TARGET_PATH" && node scripts/daily/build-summary.mjs --json [--date YYYY-MM-DD] )
```

Capture o JSON. Estrutura:

```json
{
  "dev": { "gitName", "name", "docsFolder" },
  "repo": "previous-internal-project" | null,
  "branch": "main" | "(detached)" | null,
  "date": "YYYY-MM-DD",
  "dateBr": "DD/MM/YYYY",
  "commits": [ { "hash", "subject", "type", "scope", "message" }, ... ],
  "commitsTotal": N,
  "pendente": {
    "githubIssues": [ { "number", "title", "labels" } ] | null | [],
    "todoPending":  [ "linha bruta", ... ],
    "emAndamento":  "texto" | null
  },
  "travado": "texto" | null,
  "config": { "humanizacao_commits": bool, "version": 1 } | null
}
```

### Passo 5: humanizar (so se `config.humanizacao_commits` for `true`)

Agrupe `commits` por `type`. Para cada grupo, escreva uma linha curta:

```
- N <type>: <frase resumida do que foi feito, em portugues, sem hash, sem mensagem crua>
```

**Regras de humanizacao:**
- Use o `message` (sem prefixo `feat:` ou `(scope):`) pra entender o que foi feito.
- Agregue itens similares ("3 fix de validacao" em vez de "fix login, fix signup, fix reset").
- Linha cabe em 1 a 2 linhas no WhatsApp (quebra em ~80 chars).
- Sem hash, sem subject cru, sem mencionar arquivos.
- Mantenha o `<type>` em lowercase (`feat`, `fix`, etc).
- Sequencia preferencial: `feat` -> `fix` -> `refactor` -> `docs` -> `chore`/`test`/outros.

**Sem humanizacao** (config diz `false`): mostre lista crua (`- <subject> (<hash>)`), igual modo classico do markdown.

### Passo 6: montar pendencias combinadas

Combine as 3 fontes em uma so secao, em ordem: GitHub issues -> TODO_pending -> em-andamento.

Formato sugerido:

```
*Pendente / Em andamento*
- N issues abertas no GitHub: #X (titulo curto), #Y (titulo curto)
- M itens no TODO_pending: <breve descricao dos itens, sem mostrar a linha crua>
- 1 em-andamento.md: <resumo curto do conteudo>
```

**Regras:**
- Use o numero (#15) e titulo da issue, sem labels (ou so se for relevante: `[bug]`).
- TODO_pending: resuma o item, nao mostre `- [ ] X.Y` cru.
- Em-andamento: resumo curto (1 linha) ou bullet do conteudo - nao copie tudo.
- Se uma fonte e `null` ou `[]`, **omita** essa linha (nao mostre "0 issues").
- Se TODAS as fontes vazias, mostre `_(nada)_`.

### Passo 7: montar Travado

Se `travado` e string: mostre o texto verbatim (e markdown que o dev escreveu, ja esta formatado).
Se `travado` e `null`: mostre `_(nada)_`.

### Passo 8: montar report final

```
*Daily {dev.name} - {dateBr}*
Projeto: {repo} - branch: {branch}

*Feito hoje*
{secao humanizada ou lista crua}

*Pendente / Em andamento*
{secao combinada das 3 fontes}

*Travado*
{texto ou _(nada)_}

Total de commits: {commitsTotal}
```

**Regras da linha "Projeto":**
- Sempre logo apos o header, antes de "Feito hoje".
- Se `repo` e `null` (sem remote origin), omita a linha inteira.
- Se `branch` e `null`, mostre so `Projeto: {repo}` sem o `- branch: ...`.
- Formato exato: `Projeto: previous-internal-project - branch: main` (hifen normal, espacos em volta).

### Passo 9: preview + confirmacao

```
Rascunho do daily de {TARGET_NAME} ({dateBr}):

{report final}

Confirma envio pro grupo da equipe?
  s - enviar como esta
  e - editar antes de enviar
  n - cancelar
```

Aguarde resposta.

### Passo 10a: dev responde "s" - enviar

Sempre via transport do previous-internal-project (UM transport por maquina):

```bash
echo "<report final>" | node /path/to/projects/previous-internal-project/scripts/daily/send-text.mjs --default-group
```

Reporte exit + status. Em falha, mostre stderr e pergunte se quer retry. Nao arquive em falha.

### Passo 10b: dev responde "e" - editar

Pergunte: "Cole o texto editado abaixo (envie em uma unica mensagem):". Capture, mostre preview de novo, loop ate `s` ou `n`.

### Passo 10c: dev responde "n" - cancelar

Confirme: `Cancelado. Nenhuma mensagem enviada.` Encerre.

### Passo 11: arquivar (so apos envio bem-sucedido)

Salve no projeto target (nao no previous-internal-project):

- Sem `<nome-projeto>`: `$TARGET_PATH/docs/<docsFolder>/historico/<YYYY-MM-DD>-daily.md`
- Com `<nome-projeto>`: `$TARGET_PATH/docs/<docsFolder>/historico/<YYYY-MM-DD>-daily-<TARGET_NAME>.md`

Conteudo:

```markdown
# Daily {dev.name} - {dateBr} ({TARGET_NAME})

{report final enviado verbatim}

---

_Enviado para o grupo da equipe em {YYYY-MM-DD HH:mm} via /daily._
```

Sobrescrever se ja existir (ultimo envio vale). Reporte: `Daily arquivado em <path-relativo-ao-target>.`

Se `docsFolder` for null ou `$TARGET_PATH/docs/` nao existe: aviso `Sem pasta de docs pra arquivar - daily enviado mas nao arquivado.` e nao cria estrutura sozinho.

## Bordas

- **Sem commits + sem TODOs + sem issues + sem em-andamento + sem travado**: rascunho minimal com `_(nada commitado)_` e `_(nada)_`. Mostre mesmo assim, pergunte `[s/e/n]`. Nao force conteudo.
- **`gh` nao autenticado** durante onboarding: avise `Rode gh auth login antes e depois /daily --reconfigure`. Continue onboarding desligando github_issues por enquanto.
- **Dev sem entrada em DEV_MAP**: skill funciona mas sem arquivamento. Onboarding nao salva config (sem `docsFolder` pra escrever).
- **Workspace inexistente** (so afeta `/daily <nome>`): erro fail-fast do resolve-project.
- **`--reconfigure`**: apague o `.daily-config.json` antes de iniciar onboarding. Confirme com dev antes de apagar.

## Nao fazer

- Nao chamar `send-text.mjs` sem confirmacao explicita (`s`).
- Nao tentar "melhorar" o rascunho automaticamente. Se o dev quiser editar, ele escolhe `e`.
- Nao enviar pra outro destino sem instrucao do dev.
- Nao salvar em `historico/` se o envio falhou.
- Nao commitar nada automaticamente. Arquivar deixa o arquivo no working tree do target; commit eh decisao separada.
- Nao replicar a logica de onboarding/humanizacao da skill em outros repos sem alinhamento - cada fork pega a versao via injection (ver `docs/AldineyCarneiro/historico/2026-05-27-plano-injecao-daily-forks.md`).
- Nao puxar issues fechadas (so abertas).
- Nao supor que o dev sabe o que e JID, API key, etc. - se algo falhar, encaminhe pro MANUAL.md.

## Referencias

- Issue origem do fluxo: [#11](https://previous-internal-project (private)/issues/11)
- Issue da extensao multi-projeto: [#12](https://previous-internal-project (private)/issues/12)
- Transport: [`scripts/daily/send-text.mjs`](../../../scripts/daily/send-text.mjs)
- Build summary: [`scripts/daily/build-summary.mjs`](../../../scripts/daily/build-summary.mjs)
- Resolucao multi-projeto: [`scripts/daily/resolve-project.mjs`](../../../scripts/daily/resolve-project.mjs)
- Manual user-friendly: [`scripts/daily/MANUAL.md`](../../../scripts/daily/MANUAL.md)
