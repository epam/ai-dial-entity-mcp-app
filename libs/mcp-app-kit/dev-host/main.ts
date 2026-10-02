import {
  AppBridge,
  type McpUiHostContext,
  type McpUiStyles,
  PostMessageTransport,
} from '@modelcontextprotocol/ext-apps/app-bridge';
import { HOST_PRESETS, HostPresetId } from './presets';

declare const __MCP_APP_URL__: string;
declare const __MCP_DEFAULT_FIXTURE__: string;

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const controls = {
  source: $<HTMLSelectElement>('source'),
  fixture: $<HTMLSelectElement>('fixture'),
  theme: $<HTMLSelectElement>('theme'),
  preset: $<HTMLSelectElement>('preset'),
  displayMode: $<HTMLSelectElement>('displayMode'),
  width: $<HTMLInputElement>('width'),
  delay: $<HTMLInputElement>('delay'),
};
const stage = $<HTMLElement>('stage');
const log = $<HTMLOListElement>('log');

let bridge: AppBridge | undefined;
let iframe: HTMLIFrameElement | undefined;
let removeMessageLog: (() => void) | undefined;

const addLog = (direction: string, message: unknown) => {
  const item = document.createElement('li');
  const text = JSON.stringify(message);
  item.textContent = `${direction} ${text}`;
  if (text.includes('ui/open-link')) item.classList.add('highlight');
  log.prepend(item);
};

const buildHostContext = (): McpUiHostContext => {
  const theme = controls.theme.value as 'light' | 'dark';
  const preset = HOST_PRESETS[controls.preset.value as HostPresetId];
  return {
    theme,
    displayMode: controls.displayMode.value as McpUiHostContext['displayMode'],
    availableDisplayModes: ['inline'],
    platform: 'web',
    locale: navigator.language,
    containerDimensions: {
      width: Number(controls.width.value),
      maxHeight: 2000,
    },
    styles: { variables: preset[theme] as McpUiStyles },
  };
};

const loadFixture = async (): Promise<unknown> => {
  const response = await fetch(
    `/__fixtures/${encodeURIComponent(controls.fixture.value)}`,
  );
  return response.json();
};

const sendResult = async () => {
  if (!bridge) return;
  const payload = await loadFixture();
  await bridge.sendToolInput({
    arguments: { fixture: controls.fixture.value },
  });
  setTimeout(() => {
    void bridge?.sendToolResult({
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      structuredContent: payload as Record<string, unknown>,
    });
  }, Number(controls.delay.value));
};

const mount = async () => {
  await bridge?.teardownResource({}, { timeout: 1000 }).catch(() => undefined);
  await bridge?.close().catch(() => undefined);
  log.replaceChildren();

  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
  frame.style.width = `${controls.width.value}px`;
  stage.replaceChildren(frame);
  stage.dataset.theme = controls.theme.value;
  iframe = frame;

  const transport = new PostMessageTransport(
    frame.contentWindow!,
    frame.contentWindow!,
  );
  const send = transport.send.bind(transport);
  transport.send = (message, options) => {
    addLog('host → app', message);
    return send(message, options);
  };
  removeMessageLog?.();
  const logAppMessage = (event: MessageEvent) => {
    if (event.source === frame.contentWindow) addLog('app → host', event.data);
  };
  window.addEventListener('message', logAppMessage);
  removeMessageLog = () => window.removeEventListener('message', logAppMessage);

  const next = new AppBridge(
    null,
    { name: 'mcp-app-dev-host', version: '0.0.0' },
    { openLinks: {} },
    { hostContext: buildHostContext() },
  );
  next.onopenlink = async ({ url }) => {
    addLog('open-link handled (no navigation):', url);
    return {};
  };
  next.onsizechange = ({ height }) => {
    if (typeof height === 'number' && iframe)
      iframe.style.height = `${height}px`;
  };
  next.onrequestdisplaymode = async () => ({ mode: 'inline' });
  next.onmessage = async () => ({});
  next.oninitialized = () => {
    void sendResult();
  };
  bridge = next;

  await next.connect(transport);

  if (controls.source.value === 'built') {
    const response = await fetch('/__built');
    frame.srcdoc = await response.text();
  } else {
    frame.src = __MCP_APP_URL__;
  }
};

const pushHostContext = () => {
  stage.dataset.theme = controls.theme.value;
  if (iframe) iframe.style.width = `${controls.width.value}px`;
  bridge?.setHostContext(buildHostContext());
};

const init = async () => {
  Object.entries(HOST_PRESETS).forEach(([id, preset]) =>
    controls.preset.add(new Option(preset.label, id)),
  );
  controls.preset.value = HostPresetId.Dial;
  const fixtures: string[] = await (await fetch('/__fixtures')).json();
  fixtures.forEach((name) => controls.fixture.add(new Option(name, name)));
  if (fixtures.includes(__MCP_DEFAULT_FIXTURE__)) {
    controls.fixture.value = __MCP_DEFAULT_FIXTURE__;
  }

  [
    controls.theme,
    controls.preset,
    controls.displayMode,
    controls.width,
  ].forEach((el) => el.addEventListener('change', pushHostContext));
  controls.source.addEventListener('change', () => void mount());
  $<HTMLButtonElement>('reload').addEventListener('click', () => void mount());
  $<HTMLButtonElement>('send').addEventListener(
    'click',
    () => void sendResult(),
  );
  $<HTMLButtonElement>('cancel').addEventListener(
    'click',
    () => void bridge?.sendToolCancelled({ reason: 'cancelled from dev host' }),
  );

  await mount();
};

void init();
