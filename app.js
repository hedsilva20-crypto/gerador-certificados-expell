const sampleClients = [
  {
    nome_cliente: "Padaria Padre Eustáquio LTDA",
    cnpj: "05.490.568/0001-51",
    tipo_produto: "Controle de pragas urbanas",
    texto_contrato: "monitoramento e controle de pragas urbanas"
  },
  {
    nome_cliente: "Restaurante Minas Central LTDA",
    cnpj: "11.222.333/0001-81",
    tipo_produto: "Limpeza de caixa d'água",
    texto_contrato: "limpeza de caixa d'água"
  }
];

const state = {
  clients: [],
  selectedIndex: 0
};

const modelImageUrl = new URL("assets/modelo-certificado-insetan-limpo.png", document.baseURI).href;
const MAX_CSV_BYTES = 5 * 1024 * 1024;

const nodes = {
  file: document.querySelector("#csv-file"),
  loadSample: document.querySelector("#load-sample"),
  clearData: document.querySelector("#clear-data"),
  printCurrent: document.querySelector("#print-current"),
  printAll: document.querySelector("#print-all"),
  downloadHtml: document.querySelector("#download-html"),
  preview: document.querySelector("#certificate-preview"),
  rows: document.querySelector("#client-rows"),
  count: document.querySelector("#status-count"),
  errors: document.querySelector("#status-errors"),
  details: document.querySelector("#validation-details")
};

const headerMap = {
  nome: "nome_cliente",
  cliente: "nome_cliente",
  nome_cliente: "nome_cliente",
  "nome do cliente": "nome_cliente",
  cnpj: "cnpj",
  data: "data",
  produto: "tipo_produto",
  tipo_produto: "tipo_produto",
  "tipo de produto": "tipo_produto",
  "servico": "tipo_produto",
  contrato: "texto_contrato",
  texto_contrato: "texto_contrato",
  "texto contrato": "texto_contrato",
  "texto do contrato": "texto_contrato",
  "produto contratado": "texto_contrato"
};

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function cnpjDigits(value) {
  const digits = onlyDigits(value);
  return digits.length < 14 ? digits.padStart(14, "0") : digits;
}

function isValidCnpj(value) {
  const digits = cnpjDigits(value);

  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) {
    return false;
  }

  const calculateDigit = (base) => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? "0" : String(11 - remainder);
  };

  const firstDigit = calculateDigit(digits.slice(0, 12));
  const secondDigit = calculateDigit(digits.slice(0, 12) + firstDigit);
  return digits.endsWith(firstDigit + secondDigit);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function setValidationMessage(message, details = []) {
  nodes.errors.textContent = message;
  nodes.details.innerHTML = details
    .slice(0, 6)
    .map((detail) => `<li>${escapeHtml(detail)}</li>`)
    .join("");

  if (details.length > 6) {
    nodes.details.insertAdjacentHTML("beforeend", `<li>Mais ${details.length - 6} ajuste${details.length - 6 === 1 ? "" : "s"} pendente${details.length - 6 === 1 ? "" : "s"}.</li>`);
  }
}

function detectCsvDelimiter(text) {
  const firstLine = String(text || "").split(/\r?\n/).find((line) => line.trim()) || "";
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semicolonCount >= commaCount ? ";" : ",";
}

function parseCsv(text) {
  const delimiter = detectCsvDelimiter(text);
  const rows = [];
  let current = "";
  let row = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) => {
    const normalized = normalizeHeader(header);
    return headerMap[normalized] || headerMap[normalized.replaceAll(" ", "_")] || normalized;
  });

  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] || "";
    });
    return record;
  });
}

function validateClients(clients) {
  const errors = [];

  clients.forEach((client, index) => {
    const line = index + 1;
    if (!client.nome_cliente) errors.push(`Linha ${line}: cliente sem nome`);
    if (!client.cnpj) errors.push(`Linha ${line}: CNPJ vazio`);
    if (client.cnpj && !isValidCnpj(client.cnpj)) errors.push(`Linha ${line}: CNPJ inválido`);
    if (!client.tipo_produto) errors.push(`Linha ${line}: produto vazio`);
  });

  return errors;
}

function splitCompanyName(name) {
  const normalizedName = String(name || "").trim();
  const match = normalizedName.match(/^(.*?)\s+(SOCIEDADE\s+LIMITADA|LTDA\.?|S\/A|S\.A\.?|SA|EIRELI|SLU|MEI|EPP|ME)$/i);

  if (!match) {
    return { main: normalizedName, suffix: "" };
  }

  return {
    main: match[1],
    suffix: normalizeLegalSuffix(match[2])
  };
}

function normalizeLegalSuffix(value) {
  const suffix = String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
  const suffixMap = {
    "LTDA.": "LTDA",
    "S.A": "S.A.",
    "SA": "S.A.",
    "S/A": "S.A."
  };

  return suffixMap[suffix] || suffix;
}

function lowercaseFirst(value) {
  const text = String(value || "").trim();
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : "";
}

function splitContractText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const maxFirstLineLength = 34;

  if (text.length <= maxFirstLineLength) {
    return { first: text, second: "" };
  }

  const splitAt = text.lastIndexOf(" ", maxFirstLineLength);
  const safeSplitAt = splitAt > 0 ? splitAt : maxFirstLineLength;

  return {
    first: text.slice(0, safeSplitAt).trim(),
    second: text.slice(safeSplitAt).trim()
  };
}

function certificateTemplate(client, className = "") {
  const product = client.tipo_produto || "Controle de pragas urbanas";
  const contractText = client.texto_contrato || lowercaseFirst(product);
  const name = client.nome_cliente || "Nome do cliente";
  const cnpj = client.cnpj || "00.000.000/0000-00";
  const companyName = splitCompanyName(name);
  const contractLines = splitContractText(contractText);
  const longTextClass = companyName.main.length > 34 || contractText.length > 52 ? " cert-body--compact" : "";
  const certificateClass = ["certificate", className].filter(Boolean).join(" ");
  const legalLine = companyName.suffix
    ? `<strong>${escapeHtml(companyName.suffix)}</strong>, CNPJ <strong class="no-break">${escapeHtml(cnpj)}</strong>, mantém`
    : `CNPJ <strong class="no-break">${escapeHtml(cnpj)}</strong>, mantém`;
  const companyLine = contractLines.second
    ? `${escapeHtml(contractLines.second)} com a <strong>AAA Dedetização Insetan LTDA</strong>`
    : `com a <strong>AAA Dedetização Insetan LTDA</strong>`;

  return `
    <article class="${certificateClass}">
      <img class="certificate-bg" src="${escapeHtml(modelImageUrl)}" alt="" />
      <div class="field-cover field-cover--product"></div>
      <div class="field-cover field-cover--body"></div>
      <div class="field-cover field-cover--date"></div>

      <p class="cert-product">${escapeHtml(product)}</p>
      <p class="cert-body${longTextClass}">
        <span class="body-line">Certificamos que a <strong>${escapeHtml(companyName.main)}</strong></span>
        <span class="body-line">${legalLine}</span>
        <span class="body-line">contrato de ${escapeHtml(contractLines.first)}</span>
        <span class="body-line">${companyLine}</span>
      </p>
    </article>
  `;
}

function renderPreview() {
  const selectedClient = state.clients[state.selectedIndex] || sampleClients[0];
  nodes.preview.innerHTML = `<div class="certificate-preview-frame">${certificateTemplate(selectedClient, "certificate-preview-card")}</div>`;
}

function renderTable() {
  if (!state.clients.length) {
    nodes.rows.innerHTML = '<tr><td colspan="4">Importe um CSV ou use o exemplo para visualizar.</td></tr>';
    return;
  }

  nodes.rows.innerHTML = state.clients
    .map((client, index) => `
      <tr class="client-row${index === state.selectedIndex ? " is-selected" : ""}" data-client-index="${index}" tabindex="0">
        <td class="row-number">${index + 1}</td>
        <td>${escapeHtml(client.nome_cliente)}</td>
        <td>${escapeHtml(client.cnpj)}</td>
        <td>${escapeHtml(client.tipo_produto)}</td>
      </tr>
    `)
    .join("");
}

function setClients(clients) {
  state.clients = clients;
  state.selectedIndex = 0;
  const errors = validateClients(clients);
  nodes.count.textContent = `${clients.length} cliente${clients.length === 1 ? "" : "s"} carregado${clients.length === 1 ? "" : "s"}`;
  if (!clients.length) {
    setValidationMessage("Nenhum cliente encontrado");
  } else {
    setValidationMessage(
      errors.length ? `${errors.length} ajuste${errors.length === 1 ? "" : "s"} necessário${errors.length === 1 ? "" : "s"}` : "Dados prontos para gerar",
      errors
    );
  }
  renderPreview();
  renderTable();
}

function clearClients(message, details = []) {
  state.clients = [];
  state.selectedIndex = 0;
  nodes.file.value = "";
  nodes.count.textContent = "0 clientes carregados";
  setValidationMessage(message, details);
  renderPreview();
  renderTable();
}

function printableDocument(clients) {
  const certificates = clients.map((client) => certificateTemplate(client)).join("");
  const stylesheetUrl = new URL("styles.css", document.baseURI).href;
  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Certificados Expell</title>
        <link rel="stylesheet" href="${escapeHtml(stylesheetUrl)}" />
      </head>
      <body class="print-page">
        <main class="print-stack">${certificates}</main>
        <script>window.addEventListener("load", () => window.print());<\/script>
      </body>
    </html>
  `;
}

function openPrintWindow(clients) {
  const blob = new Blob([printableDocument(clients)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");

  if (!printWindow) {
    URL.revokeObjectURL(url);
    setValidationMessage("O navegador bloqueou a janela de impressão");
    return;
  }

  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function downloadHtml(clients) {
  const blob = new Blob([printableDocument(clients)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "certificados-expell.html";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

nodes.file.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  if (file.size > MAX_CSV_BYTES) {
    event.target.value = "";
    clearClients(`Arquivo muito grande: ${formatBytes(file.size)}. Limite: ${formatBytes(MAX_CSV_BYTES)}.`);
    return;
  }

  try {
    const text = await file.text();
    const clients = parseCsv(text);
    setClients(clients);
  } catch (error) {
    event.target.value = "";
    clearClients("Nao foi possivel ler o arquivo CSV", [error?.message || "Tente exportar a planilha novamente em formato CSV."]);
  }
});

nodes.loadSample.addEventListener("click", () => {
  nodes.file.value = "";
  setClients(sampleClients);
});

nodes.clearData.addEventListener("click", () => {
  clearClients("Dados removidos. Importe uma nova planilha CSV para continuar.");
});

nodes.printCurrent.addEventListener("click", () => {
  openPrintWindow([state.clients[state.selectedIndex] || sampleClients[0]]);
});

nodes.rows.addEventListener("click", (event) => {
  const row = event.target.closest("[data-client-index]");
  if (!row) return;

  state.selectedIndex = Number(row.dataset.clientIndex);
  renderPreview();
  renderTable();
});

nodes.rows.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;

  const row = event.target.closest("[data-client-index]");
  if (!row) return;

  event.preventDefault();
  state.selectedIndex = Number(row.dataset.clientIndex);
  renderPreview();
  renderTable();
});

nodes.printAll.addEventListener("click", () => {
  openPrintWindow(state.clients.length ? state.clients : sampleClients);
});

nodes.downloadHtml.addEventListener("click", () => {
  downloadHtml(state.clients.length ? state.clients : sampleClients);
});

renderPreview();
