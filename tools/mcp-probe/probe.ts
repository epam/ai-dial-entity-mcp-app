import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const DEFAULT_URL = 'http://localhost:8080/mcp';

type Args = {
  url: string;
  kind?: string;
  id?: string;
};

/**
 * Parses the probe's CLI flags: `--url`, `--kind` and `--id`.
 * @param argv - raw process arguments, excluding the node and script entries
 */
const parseArgs = (argv: string[]): Args => {
  const args: Args = { url: DEFAULT_URL };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--url' && value) {
      args.url = value;
      i += 1;
    } else if (flag === '--kind' && value) {
      args.kind = value;
      i += 1;
    } else if (flag === '--id' && value) {
      args.id = value;
      i += 1;
    }
  }
  return args;
};

/**
 * Picks the credential to send from the environment. `DIAL_USER_JWT` wins
 * over `DIAL_API_KEY` when both are set, matching the server's own
 * Authorization-over-Api-Key precedence. This env var lives only in this dev
 * tool; the server itself never reads or stores a credential.
 */
const readCredentialHeaders = (): Record<string, string> => {
  const jwt = process.env.DIAL_USER_JWT?.trim();
  const apiKey = process.env.DIAL_API_KEY?.trim();
  if (jwt && apiKey) {
    console.log('Both DIAL_USER_JWT and DIAL_API_KEY are set; using the JWT.');
  }
  if (jwt) return { Authorization: `Bearer ${jwt}` };
  if (apiKey) return { 'Api-Key': apiKey };
  console.log(
    'Neither DIAL_USER_JWT nor DIAL_API_KEY is set; the server will fail closed on show_entity_card.',
  );
  return {};
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  const headers = readCredentialHeaders();

  const transport = new StreamableHTTPClientTransport(new URL(args.url), {
    requestInit: { headers },
  });
  const client = new Client({ name: 'mcp-probe', version: '0.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('tools/list:', JSON.stringify(tools, null, 2));

  const resources = await client.listResources();
  console.log('resources/list:', JSON.stringify(resources, null, 2));

  if (args.kind && args.id) {
    const result = await client.callTool({
      name: 'show_entity_card',
      arguments: { kind: args.kind, id: args.id },
    });
    if (result.isError) {
      console.log(
        'show_entity_card error:',
        JSON.stringify(result.content, null, 2),
      );
    } else {
      console.log(
        'show_entity_card structuredContent:',
        JSON.stringify(result.structuredContent, null, 2),
      );
    }
  }

  await client.close();
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
