<p align="center">
  <a href="https://codeshod.ai">
    <picture>
      <source srcset=".github/assets/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset=".github/assets/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src=".github/assets/logo-ornate-light.svg" alt="Codeshod logo">
    </picture>
  </a>
</p>
<p align="center">Otwartoźródłowy agent kodujący AI.</p>
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

### Instalacja

```bash
# YOLO
curl -fsSL https://codeshod.ai/v2/install | bash

# Menedżery pakietów
npm i -g @codeshod/cli@latest      # albo bun/pnpm/yarn
brew install reddata997327/tap/codeshod-v2 # macOS i Linux (polecane, zawsze aktualne)
brew install codeshod              # macOS i Linux (oficjalna formuła brew, rzadziej aktualizowana)
sudo pacman -S codeshod            # Arch Linux (Stable)
paru -S codeshod-beta              # Arch Linux (Latest from AUR)
mise use -g codeshod               # dowolny system
nix run github:reddata997327/codeshod  # Nix
```

> [!TIP]
> Przed instalacją usuń wersje starsze niż 0.1.x.

### Agents

Codeshod zawiera dwóch wbudowanych agentów, między którymi możesz przełączać się klawiszem `Tab`.

- **build** - Domyślny agent z pełnym dostępem do pracy developerskiej
- **plan** - Agent tylko do odczytu do analizy i eksploracji kodu
  - Domyślnie odmawia edycji plików
  - Pyta o zgodę przed uruchomieniem komend bash
  - Idealny do poznawania nieznanych baz kodu lub planowania zmian

Dodatkowo jest subagent **general** do złożonych wyszukiwań i wieloetapowych zadań.
Jest używany wewnętrznie i można go wywołać w wiadomościach przez `@general`.

Dowiedz się więcej o [agents](https://codeshod.ai/docs/agents).

### Dokumentacja

Więcej informacji o konfiguracji Codeshod znajdziesz w [**dokumentacji**](https://codeshod.ai/docs).

### Współtworzenie

Jeśli chcesz współtworzyć Codeshod, przeczytaj [contributing docs](./CONTRIBUTING.md) przed wysłaniem pull requesta.

### Budowanie na Codeshod

Jeśli pracujesz nad projektem związanym z Codeshod i używasz "codeshod" jako części nazwy (na przykład "codeshod-dashboard" lub "codeshod-mobile"), dodaj proszę notatkę do swojego README, aby wyjaśnić, że projekt nie jest tworzony przez zespół Codeshod i nie jest z nami w żaden sposób powiązany.

---

**Dołącz do naszej społeczności** [Discord](https://discord.gg/codeshod) | [X.com](https://x.com/codeshod)
