# Gerador de Certificados Expell

MVP local para gerar certificados em lote a partir de uma planilha CSV, usando o modelo oficial Insetan/Grupo Expell como fundo fixo.

## Como usar

1. Abra `index.html` no navegador.
2. Importe um CSV com as colunas `nome_cliente`, `cnpj`, `tipo_produto` e `texto_contrato`.
3. Confira a previa do certificado sobre o modelo oficial.
4. Use `Gerar impressao em lote` para abrir a pagina pronta para imprimir ou salvar em PDF.

O arquivo `exemplo-clientes.csv` mostra o formato esperado.

## Modelo visual

O arquivo `assets/modelo-certificado-insetan.png` fica travado como fundo do certificado. O app cobre apenas os campos variaveis do exemplo e escreve por cima:

- Tipo de produto
- Texto do contrato
- Nome do cliente
- CNPJ

## Proximos passos

- Gerar PDFs individuais automaticamente a partir do CSV.
- Criar pacote ZIP com todos os certificados.
- Criar o arquivo de aprovacao em Google Apresentacoes/PowerPoint com os mesmos campos variaveis.

## Validacoes

O app valida CNPJ, campos obrigatorios e tamanho maximo do CSV antes da geracao.

`texto_contrato` controla o trecho depois de `contrato de` no paragrafo. Se a coluna nao existir, o app usa `tipo_produto` como fallback.

## Deploy na VPS

O projeto e estatico e pode ser publicado com Docker + Nginx, sem instalar Node.js no servidor.

1. Copie a pasta do projeto para a VPS.
2. Na pasta do projeto, execute:

```bash
docker compose up -d --build
```

3. Confirme se o app responde em `http://IP_DA_VPS:8085`.
4. No Nginx Proxy Manager, crie um Proxy Host:

- Domain Names: `geradordecertificados.tecnologiaexpell.com`
- Scheme: `http`
- Forward Hostname/IP: `IP_DA_VPS`
- Forward Port: `8085`
- Websockets Support: desativado
- Block Common Exploits: ativado
- SSL: solicitar certificado Let's Encrypt e forcar HTTPS

5. No DNS, crie um registro `A`:

- Nome: `geradordecertificados`
- Valor: `IP_DA_VPS`
- Proxy/CDN: desativado durante a emissao inicial do SSL, se houver Cloudflare

## Deploy automatico com GitHub Actions

O workflow `.github/workflows/deploy.yml` publica automaticamente na VPS a cada push nas branches `master` ou `main`.

### 1. Criar chave SSH para o GitHub Actions

No computador local:

```powershell
ssh-keygen -t ed25519 -C "github-actions-gerador-certificados" -f "$env:USERPROFILE\.ssh\gerador-certificados-actions"
type "$env:USERPROFILE\.ssh\gerador-certificados-actions.pub"
```

Copie a chave publica exibida e adicione na VPS:

```bash
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

Depois copie a chave privada para o secret `VPS_SSH_KEY`:

```powershell
type "$env:USERPROFILE\.ssh\gerador-certificados-actions"
```

### 2. Cadastrar secrets no GitHub

Em `Settings > Secrets and variables > Actions`, cadastre:

- `VPS_HOST`: `2.24.92.138`
- `VPS_USER`: `root`
- `VPS_PORT`: `22`
- `VPS_SSH_KEY`: conteudo completo da chave privada

### 3. Publicar

Depois dos secrets cadastrados, basta fazer push para `master` ou `main`. Tambem e possivel rodar manualmente em `Actions > Deploy VPS > Run workflow`.
