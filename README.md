# daily-report

> **Fecha o seu dia em 30 segundos.** CLI que monta o resumo dos seus commits + pendencias e manda direto pro grupo do time no WhatsApp.

`daily-report` le o `git log` do dia, agrupa por tipo (feat/fix/refactor/docs/...), combina com pendencias do seu `TODO.md` ou GitHub Issues, e despacha um daily formatado via Evolution API (v1.0) ou Wazap local (v1.1). Funciona em Linux e Windows nativo, sem Docker, sem Python, sem servidor proprio.

> English version: [README.en.md](README.en.md).

## Por que usar

- **Um comando**: `daily-report send` e o daily ja foi pro grupo.
- **Sem perder commit**: agrupa por tipo, conta tudo, separa o que voce abandonou no `TODO_pending.md` do que voce terminou.
- **Sem dependencia esquisita**: so Node 20.6+ e `git` no PATH.
- **Multi-projeto**: configurou uma vez, roda de qualquer pasta com `--project nome-do-projeto`.
- **Cross-platform**: Linux, macOS e Windows nativo (sem WSL).
- **Plugavel no Claude Code**: a skill `/daily-report` abre o draft no chat, deixa voce editar antes de enviar.

## Instalacao

```bash
npm i -g github:aldiney/daily-report
daily-report --version
```

Requer **Node 20.6 ou superior**. Sem Node? Instale via [nvm](https://github.com/nvm-sh/nvm) (Linux/macOS) ou [nvm-windows](https://github.com/coreybutler/nvm-windows).

## Primeiro uso (em 2 minutos)

1. **Configure**:
   ```bash
   daily-report config
   ```
   O wizard pergunta:
   - Seu `git user.name` (auto-detectado);
   - Como voce quer aparecer no daily (`displayName`);
   - Sua tag no `TODO.md` (ex.: `@aldiney`);
   - Pasta de historico (opcional, pra arquivar daily enviado);
   - Transport: **Evolution API** (v1.0) ou **Wazap local** (v1.1, ainda em desenvolvimento);
   - Credenciais do transport.

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
| `daily-report build --json` | Devolve o relatorio como JSON estruturado (usado por scripts e pela skill). |
| `daily-report build --md` | Devolve o relatorio em markdown. Acrescente `--classic` pra ver lista crua. |
| `daily-report send` | Gera + envia em um passo so. |
| `daily-report send --dry-run` | Mostra o que seria enviado, sem chamar a API. |
| `daily-report send --from-stdin` | Le stdin verbatim e envia (a skill `/daily-report` usa esse modo). |
| `daily-report send --project X` | Roda contra um projeto cadastrado por nome (de qualquer pasta). |
| `daily-report send --date YYYY-MM-DD` | Roda contra outra data (default: hoje). |

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
2. monta o draft humanizado no chat,
3. te deixa editar (`e`) ou cancelar (`n`),
4. envia via `daily-report send --from-stdin` quando voce confirma com `s`.

A skill mora em `.claude/skills/daily-report/SKILL.md`. Pra usar: clone este repo e o Claude Code descobre sozinho. Pra usar em **outro** projeto, copie a pasta `.claude/skills/daily-report/` pra la (a skill assume `daily-report` no PATH).

## Transports

### Evolution API (v1.0, default)

Pacote ja envia via [Evolution API](https://doc.evolution-api.com/). Voce precisa de:

- Uma instancia Evolution rodando (sua ou de terceiro);
- URL base, nome da instancia, API key;
- JID do grupo destino (ex.: `120363xxxxx@g.us`).

Tudo gravado no wizard.

### Wazap (v1.1, em desenvolvimento)

Pra quem **nao tem** Evolution e quer enviar via WhatsApp pessoal:

- `daily-report install-wazap` vai baixar o gateway local (whatsapp-web.js + Chromium via Puppeteer) em `<configDir>/wazap/`.
- `daily-report wazap start` sobe um daemon HTTP local; primeiro start pede QR scan.
- `daily-report wazap groups` lista seus grupos numerados e voce escolhe pelo numero.

Wazap ainda nao esta liberado nesta versao - o wizard ja oferece a opcao mas avisa que cai em "not available yet".

## Troubleshooting

- **`daily-report: command not found`** -> reinstale com `npm i -g github:aldiney/daily-report` e confirme com `which daily-report` (`where daily-report` no Windows).
- **`No config found`** -> rode `daily-report config`. Use `daily-report config --path` pra ver onde ele esta procurando.
- **`evolution.url must start with http:// or https://`** -> `daily-report config` e edite a URL.
- **`No recipient`** -> nao tem `groupId` no config nem `--to` na linha de comando. Rode o wizard de novo ou passe `--to 120363...@g.us`.
- **HTTP 401/404 do Evolution** -> chave de API ou nome de instancia errados; refaca o wizard.
- **Commits do dia nao aparecem** -> confira `config.dev.gitUsername` (precisa bater com `git config user.name`); use `daily-report send --author "Outro Nome"` se quiser sobrescrever pontualmente.

## Status do projeto

- **v1.0** (atual): Evolution-only, CLI estavel, skill `/daily-report` funcional.
- **v1.1** (em breve): Wazap local opcional via `install-wazap`, picker de grupo por numero.

## Origem

`daily-report` nasceu como a skill `/daily` interna de um projeto anterior. Foi extraido pra um pacote standalone em 2026-05-28 pra ser usado por qualquer dev, em qualquer projeto, sem dependencia de infraestrutura propria. O snapshot do codigo no momento da extracao esta marcado pela tag `pre-refactor-snapshot`.

## Licenca

MIT. Veja `LICENSE` quando publicado.
