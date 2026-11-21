<p align="center">
  <a href="https://codeshod.ai">
    <picture>
      <source srcset=".github/assets/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset=".github/assets/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src=".github/assets/logo-ornate-light.svg" alt="Codeshod logo">
    </picture>
  </a>
</p>
<p align="center">Открытый AI-агент для программирования.</p>
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

### Установка

```bash
# YOLO
curl -fsSL https://codeshod.ai/v2/install | bash

# Менеджеры пакетов
npm i -g @codeshod/cli@latest      # или bun/pnpm/yarn
brew install reddata997327/tap/codeshod-v2 # macOS и Linux (рекомендуем, всегда актуально)
brew install codeshod              # macOS и Linux (официальная формула brew, обновляется реже)
sudo pacman -S codeshod            # Arch Linux (Stable)
paru -S codeshod-beta              # Arch Linux (Latest from AUR)
mise use -g codeshod               # любая ОС
nix run github:reddata997327/codeshod  # Nix
```

> [!TIP]
> Перед установкой удалите версии старше 0.1.x.

### Agents

В Codeshod есть два встроенных агента, между которыми можно переключаться клавишей `Tab`.

- **build** - По умолчанию, агент с полным доступом для разработки
- **plan** - Агент только для чтения для анализа и изучения кода
  - По умолчанию запрещает редактирование файлов
  - Запрашивает разрешение перед выполнением bash-команд
  - Идеален для изучения незнакомых кодовых баз или планирования изменений

Также включен сабагент **general** для сложных поисков и многошаговых задач.
Он используется внутренне и может быть вызван в сообщениях через `@general`.

Подробнее об [agents](https://codeshod.ai/docs/agents).

### Документация

Больше информации о том, как настроить Codeshod: [**наши docs**](https://codeshod.ai/docs).

### Вклад

Если вы хотите внести вклад в Codeshod, прочитайте [contributing docs](./CONTRIBUTING.md) перед тем, как отправлять pull request.

### Разработка на базе Codeshod

Если вы делаете проект, связанный с Codeshod, и используете "codeshod" как часть имени (например, "codeshod-dashboard" или "codeshod-mobile"), добавьте примечание в README, чтобы уточнить, что проект не создан командой Codeshod и не аффилирован с нами.

---

**Присоединяйтесь к нашему сообществу** [Discord](https://discord.gg/codeshod) | [X.com](https://x.com/codeshod)
