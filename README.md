# AutoCommitMessage

Auto-generate meaningful commits in 1 second

Killing lame commits with AI 🤯🔫

A lightweight git-hook-only fork of https://github.com/di-sukharev 🪩 Winner of GitHub 2023 HACKATHON

![AutoCommitMessage example](.github/opencommit-example.png)

---

## Git hook (KILLER FEATURE)

You can set AutoCommitMessage as Git [`prepare-commit-msg`](https://git-scm.com/docs/githooks#_prepare_commit_msg) hook.

This will also work with your IDE Source Control and allows you to edit the message before committing.

To set the hook:

```sh
oco hook set
```

To unset the hook:

```sh
oco hook unset
```

To use the hook:

```sh
git commit
```

Or follow the process of your IDE Source Control feature, when it calls `git commit` command — OpenCommit will integrate into the flow.

---

## Setup AutoCommitMessage

You can use AutoCommitMessage by simply running it via the CLI like this `oco`. 2 seconds and your staged changes are committed with a meaningful message.

1. Install AutoCommitMessage globally to use in any repository:

   ```sh
   npm install -g auto-commit-message
   ```

2. Get your API key from [OpenAI](https://platform.openai.com/account/api-keys). Make sure that you add your payment details, so the API works.

3. Set the key to AutoCommitMessage config:

   ```sh
   oco config set OCO_OPENAI_API_KEY=<your_api_key>
   ```

   Your API key is stored locally in the `~/.opencommit` config file.

---

## Configuration

### Local per repo configuration

Create a `.env` file and add config variables there like this:

```env
OCO_OPENAI_API_KEY=<your OpenAI API token>
OCO_OPENAI_MAX_TOKENS=<max response tokens from OpenAI API>
OCO_OPENAI_BASE_PATH=<may be used to set proxy path to OpenAI api>
OCO_DESCRIPTION=<postface a message with ~3 sentences description>
OCO_EMOJI=<add GitMoji>
OCO_MODEL=<either gpt-3.5-turbo or gpt-4>
OCO_LANGUAGE=<locale, scroll to the bottom to see options>
OCO_MESSAGE_TEMPLATE_PLACEHOLDER=<message template placeholder, example: '$msg'>
```

### Global config for all repos

Local config still has more priority than Global config, but you may set `OCO_MODEL` and `OCO_LOCALE` globally and set local configs for `OCO_EMOJI` and `OCO_DESCRIPTION` per repo which is more convenient.

Simply set any of the variables above like this:

```sh
oco config set OCO_MODEL=gpt-4
```

Configure [GitMoji](https://gitmoji.dev/) to preface a message.

```sh
oco config set OCO_EMOJI=true
```

To remove preface emojis:

```sh
oco config set OCO_EMOJI=false
```

### Switch to GPT-4 or other models

By default, AutoCommitMessage uses `gpt-3.5-turbo-16k` model.

You may switch to GPT-4 which performs better, but costs ~x15 times more 🤠

```sh
oco config set OCO_MODEL=gpt-4
```

or for as a cheaper option:

```sh
oco config set OCO_MODEL=gpt-3.5-turbo-16k
```

Make sure that you spell it `gpt-4` (lowercase) and that you have API access to the 4th model. Even if you have ChatGPT+, that doesn't necessarily mean that you have API access to GPT-4.

---

## Locale configuration

To globally specify the language used to generate commit messages:

```sh
# de, German ,Deutsch
oco config set OCO_LANGUAGE=de
oco config set OCO_LANGUAGE=German
oco config set OCO_LANGUAGE=Deutsch

# fr, French, française
oco config set OCO_LANGUAGE=fr
oco config set OCO_LANGUAGE=French
oco config set OCO_LANGUAGE=française
```

The default language setting is **English**
All available languages are currently listed in the `i18n` folder

### Ignore files

You can remove files from being sent to OpenAI by creating a `.opencommitignore` file. For example:

```ignorelang
path/to/large-asset.zip
**/*.jpg
```

This helps prevent AutoCommitMessage from uploading artifacts and large files.

By default, AutoCommitMessage ignores files matching: `*-lock.*` and `*.lock`

---

## Cost

You pay for your requests to OpenAI API. AutoCommitMessage uses ChatGPT (3.5-turbo) official model, which is ~15x times cheaper than GPT-4.
