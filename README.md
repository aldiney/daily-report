# daily-report

> **Fecha o seu dia em 30 segundos.** CLI que monta o resumo dos seus commits + pendencias e manda direto pro grupo do time no WhatsApp.

`daily-report` le o `git log` do dia, agrupa por tipo (feat/fix/refactor/docs/...), combina com pendencias do seu `TODO.md` ou GitHub Issues, e despacha um daily formatado via [Evolution API](https://doc.evolution-api.com/) ou um gateway WhatsApp local (Wazap, baseado em [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)). Funciona em Linux, macOS e Windows nativo, sem Docker, sem Python, sem servidor proprio.

> English version: [README.en.md](README.en.md).

## Por que usar

- **Um comando**: `daily-report send` e o daily ja foi pro grupo.
- **Sem perder commit**: agrupa por tipo, conta tudo, separa o que voce abandonou no `TODO_pending.md` do que voce terminou.
- **Sem dependencia esquisita**: so Node 20.6+ e `git` no PATH (mais Chromium se voce escolher Wazap).
- **Dois transports**: use Evolution se ja tem a infra, ou Wazap pra mandar do seu WhatsApp pessoal sem servidor remoto.
- **Multi-projeto**: configurou uma vez, roda de qualquer pasta com `--project nome-do-projeto`.
- **Cross-platform**: Linux, macOS e Windows nativo (sem WSL).
- **Plugavel no Claude Code**: a skill `/daily-report` abre o draft no chat, humaniza com LLM e deixa voce editar antes de enviar.

## Instalacao

Requer **Node 20.6+** e `git` no PATH. Se ainda nao tem Node, instale via [nvm](https://github.com/nvm-sh/nvm) (Linux/macOS) ou [nvm-windows](https://github.com/coreybutler/nvm-windows).

### Passo 1 - prefix do npm sem sudo (Linux/macOS)

Em muitas instalacoes do Node via apt/brew, `npm -g` quer escrever em `/usr` ou `/usr/local` e exige `sudo`. Pra usar sem sudo, configure um prefix per-user **uma unica vez**:

```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

> No **Windows**, `npm -g` ja escreve em `%APPDATA%\npm` por padrao - sem sudo, sem ajuste. **Pule este passo.**
>
> Se voce instalou Node via **nvm** (Linux/macOS/Windows), o prefix tambem ja eh per-user. **Pule este passo.**
>
> Prefere usar `sudo`? Tudo bem - cada comando do passo 2 vira `sudo npm ...`.

### Passo 2 - instalar a CLI

Escolha um dos dois:

**Opcao A - versao publicada (mais simples):**
```bash
npm i -g github:aldiney/daily-report
```

**Opcao B - desenvolvimento local (qualquer mudanca no codigo reflete na hora):**
```bash
git clone https://github.com/aldiney/daily-report.git
cd daily-report
npm link
```

### Passo 3 - verificar

```bash
daily-report --version   # 1.1.0
which daily-report       # caminho do binario
```

Se `daily-report: command not found`, abra um terminal novo (pra `~/.bashrc` ser relido) ou rode `source ~/.bashrc`.

Se voce so quer **Evolution** como transport, e isso. Se quer **Wazap** (envio via WhatsApp pessoal), tem um quarto passo - veja [Transport 2 - Wazap](#transport-2---wazap-whatsapp-pessoal-local).

## Primeiro uso (em 2 minutos)

1. **Configure**:
   ```bash
   daily-report config
   ```
   Wizard interativo. Pergunta:
   - Seu `git user.name` (auto-detectado);
   - Como voce quer aparecer no daily (`displayName`);
   - Sua tag no `TODO.md` (ex.: `@aldiney`);
   - Pasta de historico (opcional, pra arquivar daily enviado);
   - **Transport**: `1) Evolution API` ou `2) Wazap`;
   - Credenciais do transport escolhido.

2. **Veja o rascunho**:
   ```bash
   daily-report build --md
   ```
   Mostra o markdown formatado, sem enviar. Use isso pra conferir antes de mandar.

3. **Envie**:
   ```bash
   daily-report send
   ```

## Comandos

| Comando | O que faz |
|---|---|
| `daily-report config` | Wizard interativo. Re-rode pra atualizar qualquer campo. |
| `daily-report config --show` | Imprime o config atual (so leitura). |
| `daily-report config --path` | Imprime o path do arquivo de config. |
| `daily-report config --reset` | Wizard partindo dos defaults, ignora o config atual. |
| `daily-report build --json` | Devolve o relatorio como JSON estruturado (usado por scripts e pela skill). |
| `daily-report build --md` | Devolve o relatorio em markdown. Acrescente `--classic` pra ver lista crua. |
| `daily-report send` | Gera + envia em um passo so. |
| `daily-report send --dry-run` | Mostra o que seria enviado, sem chamar a API. |
| `daily-report send --from-stdin` | Le stdin verbatim e envia (a skill `/daily-report` usa esse modo). |
| `daily-report send --project X` | Roda contra um projeto cadastrado por nome (de qualquer pasta). |
| `daily-report send --date YYYY-MM-DD` | Roda contra outra data (default: hoje). |
| `daily-report send --to <recipient>` | Sobrescreve o destinatario do config so nesse envio (numero `5511...` ou JID `...@g.us`). |
| `daily-report install-wazap` | Baixa e instala o gateway Wazap local (~170MB Chromium). |
| `daily-report wazap start [--detach]` | Sobe o daemon Wazap. Foreground por default (QR scan no terminal). |
| `daily-report wazap stop [--force]` | Para o daemon. SIGTERM + 10s de grace, depois SIGKILL. |
| `daily-report wazap status` | PID alive + estado da conexao WhatsApp. |
| `daily-report wazap groups` | Lista os grupos numerados; voce escolhe um e ele vai pro `config.wazap.groupId`. |
| `daily-report wazap log` | Mostra o path do log do daemon. |

Veja `daily-report <comando> --help` pra todas as flags.

## Onde fica o config

`daily-report` segue convencao por SO:

- **Linux/macOS**: `~/.config/daily-report/config.json` (respeita `XDG_CONFIG_HOME`).
- **Windows**: `%APPDATA%\daily-report\config.json`.
- **Override**: `DAILY_REPORT_CONFIG_DIR=/path/custom daily-report config`.

Veja [`docs/adr/0001-config-paths.md`](docs/adr/0001-config-paths.md) pra justificativa.

## Skill do Claude Code

Tem [Claude Code](https://www.claude.com/product/claude-code) instalado? `daily-report` inclui uma skill `/daily-report` que:

1. roda `daily-report build --json`,
2. humaniza os commits com LLM (linhas curtas, agregando similares),
3. te mostra preview e oferece **s** (envia), **e** (edita), **n** (cancela),
4. envia via `daily-report send --from-stdin` quando voce confirma com `s`.

A skill mora em `.claude/skills/daily-report/SKILL.md`. Pra usar: clone este repo e o Claude Code descobre sozinho. Pra usar em **outro** projeto, copie a pasta `.claude/skills/daily-report/` pra la (a skill assume `daily-report` no PATH).

## Transports

`daily-report` v1.1 tem dois transports. Voce escolhe um no wizard e pode trocar a qualquer momento.

### Transport 1 - Evolution API (servidor remoto)

Pra quem ja tem (ou tem acesso a) uma instancia da [Evolution API](https://doc.evolution-api.com/). E o caminho mais simples - so HTTP, sem dependencia local de Chromium.

**O que voce precisa:**
- Uma instancia Evolution rodando;
- URL base (`https://...`), nome da instancia, API key;
- JID do grupo destino (ex.: `120363xxxxx@g.us`) ou um numero pessoal (`5561...`).

**Configurar:**
```bash
daily-report config
# escolha "1) Evolution API" no transport
# preencha URL/instance/apiKey/groupId
```

**Trocar pra Evolution** (se ja esta em Wazap):
```bash
daily-report config        # rode de novo, escolha 1
```

### Transport 2 - Wazap (WhatsApp pessoal local)

Pra quem **nao tem** Evolution e quer enviar usando o **proprio WhatsApp**. Roda um gateway local (Express + whatsapp-web.js + Puppeteer/Chromium) escutando em `127.0.0.1`.

**Setup em 4 passos:**

1. **Instale o gateway local** (baixa Chromium ~170MB):
   ```bash
   daily-report install-wazap
   ```
   No Linux, o comando faz pre-flight de bibliotecas do Chromium (`libnss3`, `libatk1.0-0`, etc). Se faltar alguma, ele mostra o `apt`/`dnf` exato pra rodar.

2. **Suba o daemon** (foreground, vai mostrar QR code):
   ```bash
   daily-report wazap start
   ```
   Um QR code aparece no terminal. Escaneie com seu WhatsApp em `Configuracoes -> Aparelhos conectados -> Conectar um aparelho`. Quando logar, voce ve `Client ready`. Ctrl+C pra parar (sessao fica salva).

   Pra rodar em **background** depois do primeiro QR scan:
   ```bash
   daily-report wazap stop      # se ainda estava em foreground
   daily-report wazap start --detach
   daily-report wazap status    # confirma que esta connected
   ```

3. **Escolha o grupo padrao**:
   ```bash
   daily-report wazap groups
   ```
   Lista numerada de todos os seus grupos. Voce digita o numero, ele grava o JID no `config.wazap.groupId`. Pra mandar pra outro grupo so naquele envio, use `--to`.

4. **Troque o transport ativo pra Wazap**:
   ```bash
   daily-report config        # rode de novo, escolha 2
   ```

**A sessao persiste**. `daily-report wazap stop` + `start` nao pede novo QR. O `.wwebjs_auth/` mora em `<configDir>/wazap/` (fora de `node_modules`), entao **`npm i -g daily-report` upgrade nao apaga a sessao**.

**Onde os arquivos do gateway moram:**

```
<configDir>/wazap/
├── server.js              # gateway HTTP
├── node_modules/          # inclui puppeteer + Chromium
├── wazap.json             # {port, apiKey} gerados na instalacao
├── wazap.pid              # PID do daemon detached (se houver)
├── wazap.log              # stdout/stderr do daemon detached
└── .wwebjs_auth/          # sessao WhatsApp; sobrevive upgrades
```

### Trocar de transport

```bash
daily-report config        # rode o wizard de novo, escolha 1 ou 2
```

Os dois transports ficam no mesmo `config.json` - so o campo `transport` muda. Voce pode alternar quantas vezes quiser sem perder credenciais.

## Troubleshooting

### Geral

- **`daily-report: command not found`** -> primeira coisa, abra um terminal novo (a entry no `~/.bashrc` precisa ser relida). Se persistir, confira que `~/.npm-global/bin` esta no PATH (veja [Passo 1 da Instalacao](#passo-1---prefix-do-npm-sem-sudo-linuxmacos)) e que `npm prefix -g` aponta pra `~/.npm-global`. Em ultimo caso, reinstale com `npm i -g github:aldiney/daily-report`.
- **`No config found`** -> rode `daily-report config`. Use `daily-report config --path` pra ver onde ele esta procurando.
- **`No recipient`** -> nao tem `groupId` no config nem `--to` na linha de comando. Rode o wizard de novo ou passe `--to 120363...@g.us`.
- **Commits do dia nao aparecem** -> confira `config.dev.gitUsername` (precisa bater com `git config user.name`); use `daily-report send --author "Outro Nome"` se quiser sobrescrever pontualmente.

### Evolution

- **`evolution.url must start with http:// or https://`** -> `daily-report config` e edite a URL.
- **HTTP 401/404** -> chave de API ou nome de instancia errados; refaca o wizard.

### Wazap

- **`Linux dependencies for Chromium are missing`** durante `install-wazap` -> rode o `apt`/`dnf` que ele sugere e tente de novo.
- **`Wazap is not installed`** ao rodar `wazap start` -> rode `daily-report install-wazap` primeiro.
- **`No LID for user`** ao mandar pra contato individual -> ja eh tratado a partir de v1.1.0; se ainda aparecer, atualize com `daily-report install-wazap --force`.
- **`WhatsApp not connected`** (HTTP 503) -> `daily-report wazap status` mostra o estado. Se aparecer `qr_pending`, escaneie de novo com `daily-report wazap start` em foreground.
- **Manda mensagem pra si mesmo nao funciona** -> e limitacao do WhatsApp Web, nao do pacote. Use o numero de outra pessoa pra testar.
- **Quero ver o log do daemon detached** -> `daily-report wazap log` mostra o path; faca `tail -f`.

## Status do projeto

- **v1.1.0** (atual): dois transports (Evolution + Wazap local), skill `/daily-report` funcional, snapshot tests.
- **v1.0.0**: Evolution-only.

Versionamento segue [Semantic Versioning](https://semver.org/). Veja [CHANGELOG.md](CHANGELOG.md).

## Origem

`daily-report` nasceu como a skill `/daily` interna de um projeto anterior. Foi extraido pra um pacote standalone em 2026-05-28 pra ser usado por qualquer dev, em qualquer projeto, sem dependencia de infraestrutura propria. O snapshot do codigo no momento da extracao esta marcado pela tag `pre-refactor-snapshot`.

## Licenca

MIT. Veja `LICENSE` quando publicado.
