<p align="center">
  <a href="https://codeshod.ai">
    <picture>
      <source srcset=".github/assets/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset=".github/assets/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src=".github/assets/logo-ornate-light.svg" alt="Codeshod logo">
    </picture>
  </a>
</p>
<p align="center">Den open source AI-kodeagent.</p>
<p align="center">
  <a href="https://codeshod.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/@codeshod/cli"><img alt="npm" src="https://img.shields.io/npm/v/@codeshod/cli?style=flat-square" /></a>
  <a href="https://github.com/reddata997327/codeshod/actions/workflows/release.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/reddata997327/codeshod/release.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

[![Codeshod Terminal UI](services/site/public/v1/docs/assets/lander/screenshot.png)](https://codeshod.ai)

---

### Installation

```bash
# YOLO
curl -fsSL https://codeshod.ai/v2/install | bash

# Pakkehåndteringer
npm i -g @codeshod/cli@latest      # eller bun/pnpm/yarn
brew install reddata997327/tap/codeshod-v2 # macOS og Linux (anbefalet, altid up to date)
brew install codeshod              # macOS og Linux (officiel brew formula, opdateres sjældnere)
sudo pacman -S codeshod            # Arch Linux (Stable)
paru -S codeshod-beta              # Arch Linux (Latest from AUR)
mise use -g codeshod               # alle OS
nix run github:reddata997327/codeshod  # Nix
```

> [!TIP]
> Fjern versioner ældre end 0.1.x før installation.

### Agents

Codeshod har to indbyggede agents, som du kan skifte mellem med `Tab`-tasten.

- **build** - Standard, agent med fuld adgang til udviklingsarbejde
- **plan** - Skrivebeskyttet agent til analyse og kodeudforskning
  - Afviser filredigering som standard
  - Spørger om tilladelse før bash-kommandoer
  - Ideel til at udforske ukendte kodebaser eller planlægge ændringer

Derudover findes der en **general**-subagent til komplekse søgninger og flertrinsopgaver.
Den bruges internt og kan kaldes via `@general` i beskeder.

Læs mere om [agents](https://codeshod.ai/docs/agents).

### Dokumentation

For mere info om konfiguration af Codeshod, [**se vores docs**](https://codeshod.ai/docs).

### Bidrag

Hvis du vil bidrage til Codeshod, så læs vores [contributing docs](./CONTRIBUTING.md) før du sender en pull request.

### Bygget på Codeshod

Hvis du arbejder på et projekt der er relateret til Codeshod og bruger "codeshod" som en del af navnet; f.eks. "codeshod-dashboard" eller "codeshod-mobile", så tilføj en note i din README, der tydeliggør at projektet ikke er bygget af Codeshod-teamet og ikke er tilknyttet os på nogen måde.

---

**Bliv en del af vores community** [Discord](https://discord.gg/codeshod) | [X.com](https://x.com/codeshod)
