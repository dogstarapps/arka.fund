const reference = document.querySelector("#api-reference");
const navigation = document.querySelector("#endpoint-nav");
const search = document.querySelector("#endpoint-search");
const facts = document.querySelector("#api-facts");

const documentResponse = await fetch("./openapi.json", { cache: "no-cache" });
if (!documentResponse.ok) {
  reference.innerHTML = `<p class="error-state">The API contract could not be loaded.</p>`;
  throw new Error(`OpenAPI request failed: ${documentResponse.status}`);
}

const specification = await documentResponse.json();
const serverUrl = specification.servers?.[0]?.url ?? "https://catalog.arka.fund";
const endpoints = Object.entries(specification.paths)
  .flatMap(([path, methods]) =>
    Object.entries(methods)
      .filter(([method]) => method === "get" || method === "put")
      .map(([method, operation]) => ({ path, method, operation })),
  );

facts.innerHTML = `
  <span><strong>${endpoints.length}</strong> documented operations</span>
  <span><strong>${specification.info.version}</strong> API contract</span>
  <span><strong>Mainnet</strong> ${new URL(serverUrl).host}</span>
`;

render(endpoints);
search.addEventListener("input", () => {
  const term = search.value.trim().toLowerCase();
  render(
    endpoints.filter(({ path, operation }) =>
      `${path} ${operation.summary} ${(operation.tags ?? []).join(" ")}`
        .toLowerCase()
        .includes(term),
    ),
  );
});

function render(items) {
  const grouped = new Map();
  for (const item of items) {
    const tag = item.operation.tags?.[0] ?? "Other";
    grouped.set(tag, [...(grouped.get(tag) ?? []), item]);
  }
  navigation.innerHTML = "";
  reference.innerHTML = "";

  for (const [tag, operations] of grouped) {
    const navGroup = document.createElement("section");
    navGroup.innerHTML = `<h2>${escapeHtml(tag)}</h2>`;
    const contentGroup = document.createElement("section");
    contentGroup.className = "api-group";
    contentGroup.innerHTML = `<p class="eyebrow">${escapeHtml(tag)}</p><h2>${escapeHtml(tag)}</h2>`;

    for (const endpoint of operations) {
      const id = operationId(endpoint);
      const navLink = document.createElement("a");
      navLink.href = `#${id}`;
      navLink.textContent = endpoint.operation.summary;
      navGroup.append(navLink);
      contentGroup.append(createEndpoint(endpoint, id));
    }
    navigation.append(navGroup);
    reference.append(contentGroup);
  }
}

function createEndpoint(endpoint, id) {
  const article = document.createElement("article");
  article.className = "api-endpoint";
  article.id = id;
  const endpointServerUrl = endpoint.operation.servers?.[0]?.url ?? serverUrl;
  const parameters = endpoint.operation.parameters ?? [];
  const isRead = endpoint.method === "get";
  const requestSchema = endpoint.operation.requestBody?.content?.["application/json"]?.schema?.$ref
    ?.split("/")
    .at(-1);
  article.innerHTML = `
    <div class="endpoint-title">
      <span class="method">${endpoint.method.toUpperCase()}</span>
      <code>${escapeHtml(endpoint.path)}</code>
    </div>
    <h3>${escapeHtml(endpoint.operation.summary)}</h3>
    <p>${escapeHtml(endpoint.operation.description ?? "")}</p>
    ${parameters.length ? `<div class="parameter-list">${parameters.map(parameterField).join("")}</div>` : ""}
    ${requestSchema ? `<p class="note">Request body: <code>${escapeHtml(requestSchema)}</code>. The message and signature are produced by the manager wallet.</p>` : ""}
    <div class="request-actions">
      ${isRead ? `<button class="run-request" type="button">Run request</button>` : `<span class="status ready">Wallet signature required</span>`}
      ${isRead ? `<a href="${endpointServerUrl}${endpoint.path}" target="_blank" rel="noreferrer">Open endpoint</a>` : ""}
    </div>
    <div class="response-panel" hidden>
      <div class="response-meta"></div>
      <pre><code></code></pre>
    </div>
  `;
  article.querySelector(".run-request")?.addEventListener("click", () =>
    runRequest(article, endpoint, endpointServerUrl),
  );
  return article;
}

function parameterField(parameter) {
  const type = parameter.schema?.type ?? "string";
  const options = parameter.schema?.enum;
  const input = options
    ? `<select data-param="${escapeHtml(parameter.name)}" data-location="${parameter.in}"><option value="">Any</option>${options.map((option) => `<option>${escapeHtml(option)}</option>`).join("")}</select>`
    : `<input data-param="${escapeHtml(parameter.name)}" data-location="${parameter.in}" type="${type === "integer" || type === "number" ? "number" : "text"}" ${parameter.required ? "required" : ""} />`;
  return `
    <label>
      <span><strong>${escapeHtml(parameter.name)}</strong> <small>${escapeHtml(parameter.in)} · ${escapeHtml(type)}</small></span>
      <em>${escapeHtml(parameter.description ?? "")}</em>
      ${input}
    </label>
  `;
}

async function runRequest(article, endpoint, endpointServerUrl) {
  const button = article.querySelector(".run-request");
  const panel = article.querySelector(".response-panel");
  const meta = article.querySelector(".response-meta");
  const code = article.querySelector(".response-panel code");
  let path = endpoint.path;
  const query = new URLSearchParams();
  for (const input of article.querySelectorAll("[data-param]")) {
    const value = input.value.trim();
    if (!value) continue;
    if (input.dataset.location === "path") {
      path = path.replace(`{${input.dataset.param}}`, encodeURIComponent(value));
    } else {
      query.set(input.dataset.param, value);
    }
  }
  if (path.includes("{")) {
    panel.hidden = false;
    meta.textContent = "Complete the required path parameter first.";
    code.textContent = "";
    return;
  }

  const url = `${endpointServerUrl}${path}${query.size ? `?${query}` : ""}`;
  button.disabled = true;
  button.textContent = "Running...";
  try {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    const body = await response.text();
    panel.hidden = false;
    meta.textContent = `HTTP ${response.status} · ${url}`;
    code.textContent = prettyJson(body);
  } catch (error) {
    panel.hidden = false;
    meta.textContent = "Request failed";
    code.textContent = String(error);
  } finally {
    button.disabled = false;
    button.textContent = "Run request";
  }
}

function prettyJson(value) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function operationId({ operation, path }) {
  return operation.operationId ?? path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
