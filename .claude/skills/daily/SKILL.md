---
name: daily
description: Monta e envia o daily summary do dev (Feito/Pendente/Travado) para o grupo da equipe no WhatsApp via Evolution API. Use quando o dev pedir "/daily", "manda meu daily", "fecha o dia" ou equivalente. Aceita opcionalmente nome de projeto (ex.: "/daily myproject") para gerar o daily de outro projeto previous-internal-project via resolucao no workspace.code-workspace.
argument-hint: "Opcional: <nome-projeto> (parcial ou exato) e/ou --date YYYY-MM-DD"
---

# /daily — daily summary do dev no WhatsApp

Orquestra o fluxo completo do daily summary do dev: monta rascunho automatico a partir de fontes locais, mostra preview pro dev validar, envia pro grupo de WhatsApp da equipe via Evolution API e arquiva copia em `docs/<NomeDev>/historico/`.

## Argumentos

| Forma | Comportamento |
|---|---|
| `/daily` | Projeto da sessao atual (cwd / `git rev-parse --show-toplevel`). |
| `/daily <nome-projeto>` | Resolve `<nome>` via `workspace.code-workspace`, gera daily desse projeto target. Matching exato primeiro, parcial depois. |
| `/daily --date YYYY-MM-DD` | Mesma sessao, mas dia diferente. |
| `/daily <nome> --date YYYY-MM-DD` | Projeto target + dia especifico. |

**Resolucao de nome (`<nome-projeto>`):**
- Match exato no `folders[].path` do workspace -> usa.
- Sem match exato: matching parcial case-insensitive (`includes`).
- **0 matches**: aborta com lista de projetos disponiveis no workspace.
- **>1 matches**: aborta pedindo nome mais especifico, mostrando matches.

## Pre-requisitos (validar antes de comecar)

1. `scripts/whats/.env` existe e tem `EVOLUTION_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_API_KEY`, `EVOLUTION_DEFAULT_GROUP` preenchidos.
2. Working directory eh um clone de `previous-internal-project` (verificar `git rev-parse --show-toplevel` aponta pra pasta que tem `scripts/whats/`).
3. Node disponivel (`node --version`).
4. **Se for usar com nome de projeto**: `workspace.code-workspace` existe em `/path/to/projects/workspace.code-workspace`. Se nao existir, so a forma sem argumento funciona.

Se algum pre-requisito falhar, avise o dev em **uma frase** e pare. Nao tente "ajustar" silenciosamente.

## Fluxo

### Passo 1: determinar projeto target e gerar rascunho

**Caso A: sem nome de projeto** (forma classica)

```bash
node scripts/daily/build-summary.mjs
```

(Se houver `--date`, repassar: `node scripts/daily/build-summary.mjs --date 2026-05-26`.)

Capture stdout. Esse eh o rascunho. Anote: `TARGET_NAME="previous-internal-project"`, `TARGET_PATH="$(git rev-parse --show-toplevel)"`.

**Caso B: com nome de projeto** (extensao multi-projeto)

```bash
# Resolve nome -> path absoluto
TARGET_PATH=$(node scripts/daily/resolve-project.mjs <nome>)
RESOLVE_EXIT=$?
```

- Se `RESOLVE_EXIT == 1` (zero matches): aborte e mostre o stderr do resolve-project (ja contem a lista de disponiveis).
- Se `RESOLVE_EXIT == 2` (ambiguo): mostre os matches pro dev e pergunte qual usar. Aguardar resposta com nome mais especifico, repetir.
- Se `RESOLVE_EXIT == 0`: prosseguir.

Validar que o projeto target tem o build-summary proprio:

```bash
TARGET_NAME=$(basename "$TARGET_PATH")
test -f "$TARGET_PATH/scripts/daily/build-summary.mjs" || {
  # Aborte com mensagem clara apontando pra replicar a infra do daily.
  echo "ERRO: $TARGET_NAME ainda nao tem scripts/daily/build-summary.mjs."
  echo "Replique a estrutura do previous-internal-project (scripts/daily/ + scripts/whats/) antes de usar /daily nele."
  exit 1
}
```

Gerar o rascunho **no contexto do projeto target** (cwd dele):

```bash
( cd "$TARGET_PATH" && node scripts/daily/build-summary.mjs )
```

(Se houver `--date`, repassar.)

### Passo 2: mostrar preview no chat

Apresente o rascunho exatamente como recebido, dentro de um bloco markdown, e pergunte (cite o `TARGET_NAME` se for diferente do projeto da sessao):

```
Rascunho do daily de <TARGET_NAME> (<data>):

<rascunho>

Confirma envio pro grupo da equipe?
  s - enviar como esta
  e - editar antes de enviar
  n - cancelar
```

Aguarde a resposta. Nao envie nada antes.

### Passo 3a: dev responde "s" — enviar

Sempre via transport do previous-internal-project (UM transport por maquina, ja configurado):

```bash
echo "<rascunho>" | node /path/to/projects/previous-internal-project/scripts/whats/send-text.mjs --default-group
```

(Use heredoc ou pipe pra evitar problema de escape com quebras e caracteres especiais.)

Reporte exit + status:
- Exit 0: `Enviado. (Evolution: HTTP 201)`
- Exit 1: mostre erro do stderr verbatim, pergunte se quer tentar de novo. **Nao** arquivar em caso de falha.

### Passo 3b: dev responde "e" — editar

Pergunte: "Cole o texto editado abaixo (envie em uma unica mensagem):"

Capture o texto novo, mostre como preview de novo (passo 2) e aguarde nova resposta `[s/e/n]`. Loop ate `s` ou `n`.

### Passo 3c: dev responde "n" — cancelar

Confirme: `Cancelado. Nenhuma mensagem enviada.` E encerre.

### Passo 4: arquivar copia (so apos envio bem-sucedido)

Determine `<NomeDev>` a partir do `git config user.name` usando o `DEV_MAP` do `build-summary.mjs`. Salve no projeto **target** (nao no previous-internal-project):

- **Sem nome de projeto** (Caso A): `$TARGET_PATH/docs/<NomeDev>/historico/<YYYY-MM-DD>-daily.md`
- **Com nome de projeto** (Caso B): `$TARGET_PATH/docs/<NomeDev>/historico/<YYYY-MM-DD>-daily-<TARGET_NAME>.md`

Conteudo do arquivo:

```markdown
# Daily <NomeDev> - <DD/MM/YYYY> (<TARGET_NAME>)

<texto enviado verbatim>

---

_Enviado para o grupo da equipe em <YYYY-MM-DD HH:mm> via /daily._
```

Se ja existir arquivo com esse nome, **sobrescreva** (ultimo envio eh o que vale).

Reporte: `Daily arquivado em <path-relativo-ao-target>`.

Se o `TARGET_PATH/docs/` nao existir (projeto sem estrutura de docs): aviso `Target nao tem docs/ - daily enviado mas nao arquivado.` e nao cria a estrutura sozinho.

## Comportamento esperado nas bordas

- **Sem commits no dia + sem TODOs taggeados + sem arquivo de historico**: rascunho vira `_(nada)_` em todas as secoes. Mostre mesmo assim e pergunte se quer enviar. Nao force conteudo.
- **`.env` faltando**: erro fail-fast do `send-text.mjs` aponta o template. Nao tente criar `.env` no automatico.
- **Dev sem entrada no `DEV_MAP`**: build-summary usa fallback (nome literal do git user). Skill aceita normalmente, pula o arquivamento. Avise: `Dev sem mapeamento em DEV_MAP - daily enviado mas nao arquivado.`
- **Projeto target sem `scripts/daily/`**: erro descrito no Passo 1 Caso B. Sugira replicar a infra.
- **Workspace file inexistente**: a forma `/daily <nome>` falha com erro claro do resolve-project. A forma `/daily` (sem arg) continua funcionando.
- **Ambiguidade no nome**: peca desambiguacao explicita ao dev. Nao escolha "o primeiro" automaticamente.

## Nao fazer

- Nao chamar `send-text.mjs` sem confirmacao explicita do dev (`s`).
- Nao tentar "melhorar" o rascunho do `build-summary.mjs` automaticamente. Se o dev quiser editar, ele escolhe `e`.
- Nao enviar pra outro destino que nao `--default-group` sem instrucao do dev.
- Nao salvar em `historico/` se o envio falhou.
- Nao commitar nada automaticamente. Arquivar deixa o arquivo no working tree do projeto target; commit eh decisao separada do dev.
- Nao replicar a versao multi-projeto desta skill em outros repositorios. Outros repos mantem a versao classica (sem arg).

## Referencias

- Issue origem do fluxo: [#11](https://previous-internal-project (private)/issues/11)
- Issue da extensao multi-projeto: [#12](https://previous-internal-project (private)/issues/12)
- Transport: [`scripts/whats/`](../../../scripts/whats/README.md)
- Build summary: [`scripts/daily/`](../../../scripts/daily/README.md)
- Resolucao multi-projeto: [`scripts/daily/resolve-project.mjs`](../../../scripts/daily/resolve-project.mjs)
