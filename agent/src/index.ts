import { DirectClient } from "@elizaos/client-direct";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import {
    type Adapter,
    AgentRuntime,
    CacheManager,
    CacheStore,
    type Plugin,
    type Character,
    type ClientInstance,
    DbCacheAdapter,
    elizaLogger,
    FsCacheAdapter,
    type IAgentRuntime,
    type IDatabaseAdapter,
    type IDatabaseCacheAdapter,
    ModelProviderName,
    parseBooleanFromText,
    settings,
    stringToUuid,
    validateCharacterConfig,
    Memory,
    State,
} from "@elizaos/core";
import { defaultCharacter } from "./defaultCharacter.ts";

import { bootstrapPlugin } from "@elizaos/plugin-bootstrap";
import JSON5 from "json5";

import fs from "fs";
import net from "net";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import yargs from "yargs";
import { GetBestSolanaRaydiumPoolApyAction } from "@elizaos/plugin-defillama/src/actions";
import { createSolanaRpc } from "@solana/kit";
import { getSplTokenBalance, getSolBalance } from "@elizaos/plugin-solana-v2/src/utils/getTokenBalance";
import { createJupiterApiClient } from '@jup-ag/api';
import { swapToken } from "@elizaos/plugin-solana";
import { Keypair, Connection, VersionedTransaction, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import BN from "bn.js";
import { getRaydiumPoolInfo, findRaydiumPoolAddressBySymbol, getMintsForSymbol, findRaydiumPoolByMints, getUserRaydiumPositions, getUserLpBalance, poolContainsSol, removeLiquidity, addLiquidity } from '@elizaos/plugin-raydium';

// SPL Token Program ID
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Suppress WebSocket error messages
const originalConsoleError = console.error;
console.error = (...args) => {
    // Filter out WebSocket 404 errors
    if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('ws error: Unexpected server response: 404')) {
        return;
    }
    originalConsoleError.apply(console, args);
};

export const wait = (minTime = 1000, maxTime = 3000) => {
    const waitTime =
        Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    return new Promise((resolve) => setTimeout(resolve, waitTime));
};

const logFetch = async (url: string, options: any) => {
    elizaLogger.debug(`Fetching ${url}`);
    // Disabled to avoid disclosure of sensitive information such as API keys
    // elizaLogger.debug(JSON.stringify(options, null, 2));
    return fetch(url, options);
};

export function parseArguments(): {
    character?: string;
    characters?: string;
} {
    try {
        return yargs(process.argv.slice(3))
            .option("character", {
                type: "string",
                description: "Path to the character JSON file",
            })
            .option("characters", {
                type: "string",
                description:
                    "Comma separated list of paths to character JSON files",
            })
            .parseSync();
    } catch (error) {
        console.error("Error parsing arguments:", error);
        return {};
    }
}

function tryLoadFile(filePath: string): string | null {
    try {
        return fs.readFileSync(filePath, "utf8");
    } catch (e) {
        return null;
    }
}
function mergeCharacters(base: Character, child: Character): Character {
    const mergeObjects = (baseObj: any, childObj: any) => {
        const result: any = {};
        const keys = new Set([
            ...Object.keys(baseObj || {}),
            ...Object.keys(childObj || {}),
        ]);
        keys.forEach((key) => {
            if (
                typeof baseObj[key] === "object" &&
                typeof childObj[key] === "object" &&
                !Array.isArray(baseObj[key]) &&
                !Array.isArray(childObj[key])
            ) {
                result[key] = mergeObjects(baseObj[key], childObj[key]);
            } else if (
                Array.isArray(baseObj[key]) ||
                Array.isArray(childObj[key])
            ) {
                result[key] = [
                    ...(baseObj[key] || []),
                    ...(childObj[key] || []),
                ];
            } else {
                result[key] =
                    childObj[key] !== undefined ? childObj[key] : baseObj[key];
            }
        });
        return result;
    };
    return mergeObjects(base, child);
}
/* function isAllStrings(arr: unknown[]): boolean {
    return Array.isArray(arr) && arr.every((item) => typeof item === "string");
}
export async function loadCharacterFromOnchain(): Promise<Character[]> {
    const jsonText = onchainJson;

    console.log("JSON:", jsonText);
    if (!jsonText) return [];
    const loadedCharacters = [];
    try {
        const character = JSON5.parse(jsonText);
        validateCharacterConfig(character);

        // .id isn't really valid
        const characterId = character.id || character.name;
        const characterPrefix = `CHARACTER.${characterId
            .toUpperCase()
            .replace(/ /g, "_")}.`;

        const characterSettings = Object.entries(process.env)
            .filter(([key]) => key.startsWith(characterPrefix))
            .reduce((settings, [key, value]) => {
                const settingKey = key.slice(characterPrefix.length);
                settings[settingKey] = value;
                return settings;
            }, {});

        if (Object.keys(characterSettings).length > 0) {
            character.settings = character.settings || {};
            character.settings.secrets = {
                ...characterSettings,
                ...character.settings.secrets,
            };
        }

        // Handle plugins
        if (isAllStrings(character.plugins)) {
            elizaLogger.info("Plugins are: ", character.plugins);
            const importedPlugins = await Promise.all(
                character.plugins.map(async (plugin) => {
                    const importedPlugin = await import(plugin);
                    return importedPlugin.default;
                })
            );
            character.plugins = importedPlugins;
        }

        loadedCharacters.push(character);
        elizaLogger.info(
            `Successfully loaded character from: ${process.env.IQ_WALLET_ADDRESS}`
        );
        return loadedCharacters;
    } catch (e) {
        elizaLogger.error(
            `Error parsing character from ${process.env.IQ_WALLET_ADDRESS}: ${e}`
        );
        process.exit(1);
    }
} */

async function loadCharactersFromUrl(url: string): Promise<Character[]> {
    try {
        const response = await fetch(url);
        const responseJson = await response.json();

        let characters: Character[] = [];
        if (Array.isArray(responseJson)) {
            characters = await Promise.all(
                responseJson.map((character) => jsonToCharacter(url, character))
            );
        } else {
            const character = await jsonToCharacter(url, responseJson);
            characters.push(character);
        }
        return characters;
    } catch (e) {
        console.error(`Error loading character(s) from ${url}: `, e);
        process.exit(1);
    }
}

async function jsonToCharacter(
    filePath: string,
    character: any
): Promise<Character> {
    validateCharacterConfig(character);

    // .id isn't really valid
    const characterId = character.id || character.name;
    const characterPrefix = `CHARACTER.${characterId
        .toUpperCase()
        .replace(/ /g, "_")}.`;
    const characterSettings = Object.entries(process.env)
        .filter(([key]) => key.startsWith(characterPrefix))
        .reduce((settings, [key, value]) => {
            const settingKey = key.slice(characterPrefix.length);
            return { ...settings, [settingKey]: value };
        }, {});
    if (Object.keys(characterSettings).length > 0) {
        character.settings = character.settings || {};
        character.settings.secrets = {
            ...characterSettings,
            ...character.settings.secrets,
        };
    }
    // Handle plugins
    elizaLogger.debug(
        `Constructing plugins for ${character.name} character ` +
        `(count=${character.plugins.length})`,
    );
    character.plugins = await handlePluginImporting(character.plugins);
    elizaLogger.info(
        character.name,
        "loaded plugins:",
        "[\n    " +
            character.plugins.map((p) => `"${p.npmName}"`).join(", \n    ") +
            "\n]"
    );

    // Handle Post Processors plugins
    if (character.postProcessors?.length > 0) {
        elizaLogger.info(
            character.name,
            "loading postProcessors",
            character.postProcessors
        );
        character.postProcessors = await handlePluginImporting(
            character.postProcessors
        );
    }

    // Handle extends
    if (character.extends) {
        elizaLogger.info(
            `Merging  ${character.name} character with parent characters`
        );
        for (const extendPath of character.extends) {
            const baseCharacter = await loadCharacter(
                path.resolve(path.dirname(filePath), extendPath)
            );
            character = mergeCharacters(baseCharacter, character);
            elizaLogger.info(
                `Merged ${character.name} with ${baseCharacter.name}`
            );
        }
    }
    return character;
}

async function loadCharacter(filePath: string): Promise<Character> {
    const content = tryLoadFile(filePath);
    if (!content) {
        throw new Error(`Character file not found: ${filePath}`);
    }
    const character = JSON5.parse(content);
    return jsonToCharacter(filePath, character);
}

async function loadCharacterTryPath(characterPath: string): Promise<Character> {
    let content: string | null = null;
    let resolvedPath = "";

    // Try different path resolutions in order
    const pathsToTry = [
        characterPath, // exact path as specified
        path.resolve(process.cwd(), characterPath), // relative to cwd
        path.resolve(process.cwd(), "agent", characterPath), // Add this
        path.resolve(__dirname, characterPath), // relative to current script
        path.resolve(__dirname, "characters", path.basename(characterPath)), // relative to agent/characters
        path.resolve(__dirname, "../characters", path.basename(characterPath)), // relative to characters dir from agent
        path.resolve(
            __dirname,
            "../../characters",
            path.basename(characterPath)
        ), // relative to project root characters dir
    ];

    elizaLogger.debug(
        "Trying paths:",
        pathsToTry.map((p) => ({
            path: p,
            exists: fs.existsSync(p),
        }))
    );

    for (const tryPath of pathsToTry) {
        content = tryLoadFile(tryPath);
        if (content !== null) {
            resolvedPath = tryPath;
            break;
        }
    }

    if (content === null) {
        elizaLogger.error(
            `Error loading character from ${characterPath}: File not found in any of the expected locations`
        );
        elizaLogger.error("Tried the following paths:");
        pathsToTry.forEach((p) => elizaLogger.error(` - ${p}`));
        throw new Error(
            `Error loading character from ${characterPath}: File not found in any of the expected locations`
        );
    }
    try {
        const character: Character = await loadCharacter(resolvedPath);
        elizaLogger.success(
            `Successfully loaded character from: ${resolvedPath}`
        );
        return character;
    } catch (e) {
        console.error(`Error parsing character from ${resolvedPath}: `, e);
        throw new Error(`Error parsing character from ${resolvedPath}: ${e}`);
    }
}

function commaSeparatedStringToArray(commaSeparated: string): string[] {
    return commaSeparated?.split(",").map((value) => value.trim());
}

async function readCharactersFromStorage(
    characterPaths: string[]
): Promise<string[]> {
    try {
        const uploadDir = path.join(process.cwd(), "data", "characters");
        await fs.promises.mkdir(uploadDir, { recursive: true });
        const fileNames = await fs.promises.readdir(uploadDir);
        fileNames.forEach((fileName) => {
            characterPaths.push(path.join(uploadDir, fileName));
        });
    } catch (err) {
        elizaLogger.error(`Error reading directory: ${err.message}`);
    }

    return characterPaths;
}

export async function loadCharacters(
    charactersArg: string
): Promise<Character[]> {
    let characterPaths = commaSeparatedStringToArray(charactersArg);

    if (process.env.USE_CHARACTER_STORAGE === "true") {
        characterPaths = await readCharactersFromStorage(characterPaths);
    }

    const loadedCharacters: Character[] = [];

    if (characterPaths?.length > 0) {
        for (const characterPath of characterPaths) {
            try {
                const character: Character = await loadCharacterTryPath(
                    characterPath
                );
                loadedCharacters.push(character);
            } catch (e) {
                process.exit(1);
            }
        }
    }

    if (hasValidRemoteUrls()) {
        elizaLogger.info("Loading characters from remote URLs");
        const characterUrls = commaSeparatedStringToArray(
            process.env.REMOTE_CHARACTER_URLS
        );
        for (const characterUrl of characterUrls) {
            const characters = await loadCharactersFromUrl(characterUrl);
            loadedCharacters.push(...characters);
        }
    }

    if (loadedCharacters.length === 0) {
        elizaLogger.info("No characters found, using default character");
        loadedCharacters.push(defaultCharacter);
    }

    return loadedCharacters;
}

async function handlePluginImporting(plugins: string[]) {
    if (plugins.length > 0) {
        // this logging should happen before calling, so we can include important context
        //elizaLogger.info("Plugins are: ", plugins);
        const importedPlugins = await Promise.all(
            plugins.map(async (plugin) => {
                try {
                    const importedPlugin: Plugin = await import(plugin);
                    const functionName =
                        plugin
                            .replace("@elizaos/plugin-", "")
                            .replace("@elizaos-plugins/plugin-", "")
                            .replace(/-./g, (x) => x[1].toUpperCase()) +
                        "Plugin"; // Assumes plugin function is camelCased with Plugin suffix
                    if (
                        !importedPlugin[functionName] &&
                        !importedPlugin.default
                    ) {
                        elizaLogger.warn(
                            plugin,
                            "does not have an default export or",
                            functionName
                        );
                    }
                    return {
                        ...(importedPlugin.default ||
                            importedPlugin[functionName]),
                        npmName: plugin,
                    };
                } catch (importError) {
                    console.error(
                        `Failed to import plugin: ${plugin}`,
                        importError
                    );
                    return false; // Return null for failed imports
                }
            })
        );
        // remove plugins that failed to load, so agent can try to start
        return importedPlugins.filter((p) => !!p);
    } else {
        return [];
    }
}

export function getTokenForProvider(
    provider: ModelProviderName,
    character: Character
): string | undefined {
    switch (provider) {
        // no key needed for llama_local, ollama, lmstudio, gaianet or bedrock
        case ModelProviderName.LLAMALOCAL:
            return "";
        case ModelProviderName.OLLAMA:
            return "";
        case ModelProviderName.LMSTUDIO:
            return "";
        case ModelProviderName.GAIANET:
            return (
                character.settings?.secrets?.GAIA_API_KEY ||
                settings.GAIA_API_KEY
            );
        case ModelProviderName.BEDROCK:
            return "";
        case ModelProviderName.OPENAI:
            return (
                character.settings?.secrets?.OPENAI_API_KEY ||
                settings.OPENAI_API_KEY
            );
        case ModelProviderName.ETERNALAI:
            return (
                character.settings?.secrets?.ETERNALAI_API_KEY ||
                settings.ETERNALAI_API_KEY
            );
        case ModelProviderName.NINETEEN_AI:
            return (
                character.settings?.secrets?.NINETEEN_AI_API_KEY ||
                settings.NINETEEN_AI_API_KEY
            );
        case ModelProviderName.LLAMACLOUD:
        case ModelProviderName.TOGETHER:
            return (
                character.settings?.secrets?.LLAMACLOUD_API_KEY ||
                settings.LLAMACLOUD_API_KEY ||
                character.settings?.secrets?.TOGETHER_API_KEY ||
                settings.TOGETHER_API_KEY ||
                character.settings?.secrets?.OPENAI_API_KEY ||
                settings.OPENAI_API_KEY
            );
        case ModelProviderName.CLAUDE_VERTEX:
        case ModelProviderName.ANTHROPIC:
            return (
                character.settings?.secrets?.ANTHROPIC_API_KEY ||
                character.settings?.secrets?.CLAUDE_API_KEY ||
                settings.ANTHROPIC_API_KEY ||
                settings.CLAUDE_API_KEY
            );
        case ModelProviderName.REDPILL:
            return (
                character.settings?.secrets?.REDPILL_API_KEY ||
                settings.REDPILL_API_KEY
            );
        case ModelProviderName.OPENROUTER:
            return (
                character.settings?.secrets?.OPENROUTER_API_KEY ||
                settings.OPENROUTER_API_KEY
            );
        case ModelProviderName.GROK:
            return (
                character.settings?.secrets?.GROK_API_KEY ||
                settings.GROK_API_KEY
            );
        case ModelProviderName.HEURIST:
            return (
                character.settings?.secrets?.HEURIST_API_KEY ||
                settings.HEURIST_API_KEY
            );
        case ModelProviderName.GROQ:
            return (
                character.settings?.secrets?.GROQ_API_KEY ||
                settings.GROQ_API_KEY
            );
        case ModelProviderName.GALADRIEL:
            return (
                character.settings?.secrets?.GALADRIEL_API_KEY ||
                settings.GALADRIEL_API_KEY
            );
        case ModelProviderName.FAL:
            return (
                character.settings?.secrets?.FAL_API_KEY || settings.FAL_API_KEY
            );
        case ModelProviderName.ALI_BAILIAN:
            return (
                character.settings?.secrets?.ALI_BAILIAN_API_KEY ||
                settings.ALI_BAILIAN_API_KEY
            );
        case ModelProviderName.VOLENGINE:
            return (
                character.settings?.secrets?.VOLENGINE_API_KEY ||
                settings.VOLENGINE_API_KEY
            );
        case ModelProviderName.NANOGPT:
            return (
                character.settings?.secrets?.NANOGPT_API_KEY ||
                settings.NANOGPT_API_KEY
            );
        case ModelProviderName.HYPERBOLIC:
            return (
                character.settings?.secrets?.HYPERBOLIC_API_KEY ||
                settings.HYPERBOLIC_API_KEY
            );

        case ModelProviderName.VENICE:
            return (
                character.settings?.secrets?.VENICE_API_KEY ||
                settings.VENICE_API_KEY
            );
        case ModelProviderName.ATOMA:
            return (
                character.settings?.secrets?.ATOMASDK_BEARER_AUTH ||
                settings.ATOMASDK_BEARER_AUTH
            );
        case ModelProviderName.NVIDIA:
            return (
                character.settings?.secrets?.NVIDIA_API_KEY ||
                settings.NVIDIA_API_KEY
            );
        case ModelProviderName.AKASH_CHAT_API:
            return (
                character.settings?.secrets?.AKASH_CHAT_API_KEY ||
                settings.AKASH_CHAT_API_KEY
            );
        case ModelProviderName.GOOGLE:
            return (
                character.settings?.secrets?.GOOGLE_GENERATIVE_AI_API_KEY ||
                settings.GOOGLE_GENERATIVE_AI_API_KEY
            );
        case ModelProviderName.MISTRAL:
            return (
                character.settings?.secrets?.MISTRAL_API_KEY ||
                settings.MISTRAL_API_KEY
            );
        case ModelProviderName.LETZAI:
            return (
                character.settings?.secrets?.LETZAI_API_KEY ||
                settings.LETZAI_API_KEY
            );
        case ModelProviderName.INFERA:
            return (
                character.settings?.secrets?.INFERA_API_KEY ||
                settings.INFERA_API_KEY
            );
        case ModelProviderName.DEEPSEEK:
            return (
                character.settings?.secrets?.DEEPSEEK_API_KEY ||
                settings.DEEPSEEK_API_KEY
            );
        case ModelProviderName.LIVEPEER:
            return (
                character.settings?.secrets?.LIVEPEER_GATEWAY_URL ||
                settings.LIVEPEER_GATEWAY_URL
            );
        case ModelProviderName.SECRETAI:
            return (
                character.settings?.secrets?.SECRET_AI_API_KEY ||
                settings.SECRET_AI_API_KEY
            );
        case ModelProviderName.NEARAI:
            try {
                const config = JSON.parse(
                    fs.readFileSync(
                        path.join(os.homedir(), ".nearai/config.json"),
                        "utf8"
                    )
                );
                return JSON.stringify(config?.auth);
            } catch (e) {
                elizaLogger.warn(`Error loading NEAR AI config: ${e}`);
            }
            return (
                character.settings?.secrets?.NEARAI_API_KEY ||
                settings.NEARAI_API_KEY
            );
        case ModelProviderName.KLUSTERAI:
            return (
                character.settings?.secrets?.KLUSTERAI_API_KEY ||
                settings.KLUSTERAI_API_KEY
            );

        case ModelProviderName.MEM0:
            return (
                character.settings?.secrets?.MEM0_API_KEY ||
                settings.MEM0_API_KEY
            );

        default:
            const errorMessage = `Failed to get token - unsupported model provider: ${provider}`;
            elizaLogger.error(errorMessage);
            throw new Error(errorMessage);
    }
}

// also adds plugins from character file into the runtime
export async function initializeClients(
    character: Character,
    runtime: IAgentRuntime
) {
    // each client can only register once
    // and if we want two we can explicitly support it
    const clients: ClientInstance[] = [];
    // const clientTypes = clients.map((c) => c.name);
    // elizaLogger.log("initializeClients", clientTypes, "for", character.name);

    if (character.plugins?.length > 0) {
        for (const plugin of character.plugins) {
            if (plugin.clients) {
                for (const client of plugin.clients) {
                    const startedClient = await client.start(runtime);
                    elizaLogger.debug(`Initializing client: ${client.name}`);
                    clients.push(startedClient);
                }
            }
        }
    }

    return clients;
}

export async function createAgent(
    character: Character,
    token: string
): Promise<AgentRuntime> {
    elizaLogger.log(`Creating runtime for character ${character.name}`);
    return new AgentRuntime({
        token,
        modelProvider: character.modelProvider,
        evaluators: [],
        character,
        // character.plugins are handled when clients are added
        plugins: [bootstrapPlugin].flat().filter(Boolean),
        providers: [],
        managers: [],
        fetch: logFetch,
        // verifiableInferenceAdapter,
    });
}

function initializeFsCache(baseDir: string, character: Character) {
    if (!character?.id) {
        throw new Error(
            "initializeFsCache requires id to be set in character definition"
        );
    }
    const cacheDir = path.resolve(baseDir, character.id, "cache");

    const cache = new CacheManager(new FsCacheAdapter(cacheDir));
    return cache;
}

function initializeDbCache(character: Character, db: IDatabaseCacheAdapter) {
    if (!character?.id) {
        throw new Error(
            "initializeFsCache requires id to be set in character definition"
        );
    }
    const cache = new CacheManager(new DbCacheAdapter(db, character.id));
    return cache;
}

function initializeCache(
    cacheStore: string,
    character: Character,
    baseDir?: string,
    db?: IDatabaseCacheAdapter
) {
    switch (cacheStore) {
        // case CacheStore.REDIS:
        //     if (process.env.REDIS_URL) {
        //         elizaLogger.info("Connecting to Redis...");
        //         const redisClient = new RedisClient(process.env.REDIS_URL);
        //         if (!character?.id) {
        //             throw new Error(
        //                 "CacheStore.REDIS requires id to be set in character definition"
        //             );
        //         }
        //         return new CacheManager(
        //             new DbCacheAdapter(redisClient, character.id) // Using DbCacheAdapter since RedisClient also implements IDatabaseCacheAdapter
        //         );
        //     } else {
        //         throw new Error("REDIS_URL environment variable is not set.");
        //     }

        case CacheStore.DATABASE:
            if (db) {
                elizaLogger.info("Using Database Cache...");
                return initializeDbCache(character, db);
            } else {
                throw new Error(
                    "Database adapter is not provided for CacheStore.Database."
                );
            }

        case CacheStore.FILESYSTEM:
            elizaLogger.info("Using File System Cache...");
            if (!baseDir) {
                throw new Error(
                    "baseDir must be provided for CacheStore.FILESYSTEM."
                );
            }
            return initializeFsCache(baseDir, character);

        default:
            throw new Error(
                `Invalid cache store: ${cacheStore} or required configuration missing.`
            );
    }
}

async function findDatabaseAdapter(runtime: AgentRuntime) {
    const { adapters } = runtime;
    let adapter: Adapter | undefined;
    // if not found, default to sqlite
    if (adapters.length === 0) {
        const sqliteAdapterPlugin = await import(
            "@elizaos-plugins/adapter-sqlite"
        );
        const sqliteAdapterPluginDefault = sqliteAdapterPlugin.default;
        adapter = sqliteAdapterPluginDefault.adapters[0];
        if (!adapter) {
            throw new Error(
                "Internal error: No database adapter found for default adapter-sqlite"
            );
        }
    } else if (adapters.length === 1) {
        adapter = adapters[0];
    } else {
        throw new Error(
            "Multiple database adapters found. You must have no more than one. Adjust your plugins configuration."
        );
    }
    const adapterInterface = adapter?.init(runtime);
    return adapterInterface;
}

// Helper to fetch and parse the best Raydium-amm pool info from DefiLlama
async function getBestRaydiumPoolInfo(runtime, rpc): Promise<{ bestPoolId: string | null, bestApy: number | null, parsed: any }> {
    const action = new GetBestSolanaRaydiumPoolApyAction();
    const state = {
        bio: "",
        lore: "",
        messageDirections: "",
        postDirections: "",
        roomId: runtime.agentId,
        actors: "",
        recentMessages: "",
        recentMessagesData: [],
    };
    await action.handler(runtime, {
        userId: runtime.agentId,
        agentId: runtime.agentId,
        roomId: runtime.agentId,
        content: { text: "What is the best APY on Solana for Raydium-amm with a TVL over 25 million and 7d volume over 1 million?" }
    }, state);
    const resultText = (state as any).responseData?.text || "";
    elizaLogger.info("DefiLlama action response:", resultText);
    // Extract JSON block
    let bestPoolId: string | null = null;
    let parsed: any = null;
    const jsonMatch = resultText.match(/JSON: (\{.*\})/);
    if (jsonMatch) {
        try {
            parsed = JSON.parse(jsonMatch[1]);
            elizaLogger.info("Parsed JSON from DefiLlama:", parsed);
            bestPoolId = parsed.poolId;
        } catch (e) {
            elizaLogger.warn("Failed to parse JSON block for poolId:", e);
        }
    } else {
        elizaLogger.warn("No JSON block found in DefiLlama response.");
    }
    const apyMatch = resultText.match(/([0-9.]+)%/);
    const bestApy = apyMatch ? parseFloat(apyMatch[1]) : null;
    return { bestPoolId, bestApy, parsed };
}

// Helper to get mints and pool info for a Raydium pool symbol
async function getBestRaydiumPool(runtime, symbol) {
    const { mintA, mintB } = await getMintsForSymbol(symbol);
    elizaLogger.info(`Mint for ${symbol.split('-')[0]}:`, mintA);
    elizaLogger.info(`Mint for ${symbol.split('-')[1]}:`, mintB);
    const poolInfo = await findRaydiumPoolByMints(mintA, mintB);
    elizaLogger.info('Raydium pool info by mints:', poolInfo);
    return { mintA, mintB, poolInfo };
}

// --- Yield Optimizer Loop ---
async function startYieldOptimizerLoop(runtime) {
    elizaLogger.warn("*** MAINNET MODE: REAL FUNDS AT RISK! ***");
    const scanIntervalMs = 30 * 60 * 1000; // 30 minutes
    //const jupiter = createJupiterApiClient({ basePath: 'https://quote-api.jup.ag' });
    const SOL_MINT = "So11111111111111111111111111111111111111112";

    const rpc = createSolanaRpc(settings.SOLANA_RPC_URL!);
    let currentPoolInfo = null;
    let currentPoolId = null;
    let currentApy = 0;
    const walletPublicKey = settings.SOLANA_PUBLIC_KEY;
    const walletPrivateKey = settings.SOLANA_PRIVATE_KEY;
    elizaLogger.info('Using public key for Raydium positions:', walletPublicKey);
    const APY_IMPROVEMENT_THRESHOLD = 0.5; // percent
    const MIN_SOL_BALANCE = 0.05; // Keep minimum SOL for fees
    while (true) {
        try {
            // Step 1: Get best Raydium-amm APY from DefiLlama
            elizaLogger.info("   ==============================================");
            elizaLogger.info("🚀 Getting best Raydium-amm APY from DefiLlama...");
            elizaLogger.info("   ----------------------------------------------");
            const { bestPoolId, bestApy, parsed } = await getBestRaydiumPoolInfo(runtime, null);
            //elizaLogger.info("Best Raydium-amm pool info:", { bestPoolId, bestApy, parsed });
            
            if (!parsed || !parsed.symbol || !bestApy) {
                elizaLogger.warn("No valid pool found from DefiLlama");
                await wait(scanIntervalMs, scanIntervalMs + 1000);
                continue;
            }

            // Get mints and pool info for the best symbol
            const { mintA, mintB, poolInfo } = await getBestRaydiumPool(runtime, parsed.symbol);
            
            if (!poolInfo || !poolInfo.id) {
                elizaLogger.error('Could not find Raydium pool for symbol:', parsed.symbol);
                await wait(scanIntervalMs, scanIntervalMs + 1000);
                continue;
            }

            const newPoolId = poolInfo.id;
            
            // Verify this pool contains SOL/WSOL
            const connection = new Connection(settings.SOLANA_RPC_URL!, {
                commitment: 'confirmed',
                wsEndpoint: undefined, // Disable WebSocket to avoid 404 errors
                httpHeaders: {
                    'solana-client': 'eliza-yield-optimizer'
                }
            });
            const containsSol = await poolContainsSol(connection, newPoolId);
            if (!containsSol) {
                elizaLogger.warn(`Pool ${newPoolId} does not contain SOL/WSOL, skipping`);
                await wait(scanIntervalMs, scanIntervalMs + 1000);
                continue;
            }

            // Check if we should switch pools
            elizaLogger.info("   =====================================");
            elizaLogger.info("🚀 Checking if we should switch pools...");
            elizaLogger.info("   -------------------------------------");
            const shouldSwitch = !currentPoolId || 
                                 currentPoolId !== newPoolId || 
                                 (bestApy - currentApy) > APY_IMPROVEMENT_THRESHOLD;

            if (!shouldSwitch) {
                elizaLogger.info(`Current pool ${currentPoolId} is still optimal (APY: ${currentApy}%)`);
                await wait(scanIntervalMs, scanIntervalMs + 1000);
                continue; // exit loop and try again later
            }

            elizaLogger.info(`Switching from pool ${currentPoolId} (APY: ${currentApy}%) to ${newPoolId} (APY: ${bestApy}%)`);
            
            // Step 1: Check current LP positions
            elizaLogger.info("   ============================================");
            elizaLogger.info("🚀 Starting Step 1: Getting all LP positions...");
            elizaLogger.info("   --------------------------------------------");
            const allPositions = await getUserRaydiumPositions(walletPublicKey, settings.SOLANA_RPC_URL, 0);
            
            // Filter positions with actual balance
            const positionsWithBalance = [];
            
            for (const pos of allPositions) {
                // Get the actual current balance from the blockchain
                const lpBalance = await getUserLpBalance(connection, walletPublicKey, pos.poolId);
                if (parseInt(lpBalance.balance) > 0) {
                    positionsWithBalance.push({
                        ...pos,
                        balance: lpBalance.balance,
                        decimals: lpBalance.decimals,
                        balanceFormatted: (parseInt(lpBalance.balance) / Math.pow(10, lpBalance.decimals)).toFixed(6)
                    });
                }
            }
            
            elizaLogger.info(`Found ${positionsWithBalance.length} Raydium LP positions with balance (checked ${allPositions.length} total)`);
            
            // Log details of positions with balance
            if (positionsWithBalance.length > 0) {
                elizaLogger.info("=== POSITION SUMMARY ===");
                
                for (const pos of positionsWithBalance) {
                    elizaLogger.info(`📊 LP Position: Pool ${pos.poolId}`);
                    elizaLogger.info(`    LP Token: ${pos.lpMint}`);
                    elizaLogger.info(`    Balance: ${pos.balanceFormatted} tokens (raw: ${pos.balance})`);
                }
                
                elizaLogger.info(`📈 Total Raydium Positions with balance: ${positionsWithBalance.length}`);
                elizaLogger.info("========================");
            }
            
            const hasAnyPositions = positionsWithBalance.length > 0;

            // Create wallet keypair from private key (needed for Step 4 and Step 5)
            let walletKeypair: Keypair | null = null;
            if (hasAnyPositions || true) { // Always create keypair if we have positions or need to swap
                if (!walletPrivateKey) {
                    elizaLogger.error("SOLANA_PRIVATE_KEY not found in settings!");
                    throw new Error("Wallet private key required for operations");
                }
                
                walletKeypair = Keypair.fromSecretKey(bs58.decode(walletPrivateKey));
                
                // Verify wallet matches expected public key
                if (walletKeypair.publicKey.toString() !== walletPublicKey) {
                    elizaLogger.error(`❌ Wallet mismatch! Expected: ${walletPublicKey}, Got: ${walletKeypair.publicKey.toString()}`);
                    throw new Error("Wallet keypair does not match expected public key");
                }
            }

            // Step 2: Remove liquidity from all positions
            if (hasAnyPositions && walletKeypair) {
                elizaLogger.info("   =======================================================");
                elizaLogger.info("🚀 Starting Step 2: Remove liquidity from all positions...");
                elizaLogger.info("   -------------------------------------------------------");
                
                // Test connection
                const testConnection = new Connection(settings.SOLANA_RPC_URL!, {
                    commitment: 'confirmed',
                    wsEndpoint: undefined, // Disable WebSocket to avoid 404 errors
                    httpHeaders: {
                        'solana-client': 'eliza-yield-optimizer'
                    }
                });
                try {
                    const balance = await testConnection.getBalance(walletKeypair.publicKey);
                    elizaLogger.info(`✅ Connection test successful. Wallet balance: ${balance / 1e9} SOL`);
                } catch (connError) {
                    elizaLogger.error(`❌ Connection test failed:`, connError);
                    throw new Error("Failed to connect to Solana RPC");
                }
                
                // Remove liquidity from all LP positions
                elizaLogger.info(`💧 Removing liquidity from ${positionsWithBalance.length} LP positions...`);
                
                for (const position of positionsWithBalance) {
                    try {
                        // Use pre-fetched balance
                        elizaLogger.info(`💰 LP balance in pool ${position.poolId}: ${position.balanceFormatted} tokens (raw: ${position.balance})`);
                        elizaLogger.info(`🚀 Removing ${position.balanceFormatted} LP tokens from pool ${position.poolId}...`);
                        
                        try {
                            const beforeSOL = await connection.getBalance(walletKeypair.publicKey) / 1e9;
                            elizaLogger.info(`📊 SOL balance before: ${beforeSOL.toFixed(6)} SOL`);
                            
                            const txSignature = await removeLiquidity(connection, {
                                poolId: position.poolId,
                                lpAmountIn: position.balance,
                                walletKeypair: walletKeypair,
                                slippage: 1 // 1% slippage
                            });
                            
                            elizaLogger.info(`✅ Successfully removed liquidity!`);
                            elizaLogger.info(`📋 Pool: ${position.poolId}`);
                            elizaLogger.info(`💧 LP tokens removed: ${position.balanceFormatted}`);
                            
                            // Wait a bit and check new balance
                            await wait(5000, 7000);
                            const afterSOL = await connection.getBalance(walletKeypair.publicKey) / 1e9;
                            elizaLogger.info(`📊 SOL balance after: ${afterSOL.toFixed(6)} SOL`);
                            elizaLogger.info(`💰 SOL gained: ${(afterSOL - beforeSOL).toFixed(6)} SOL`);
                            
                            // Wait between transactions
                            await wait(3000, 5000);
                            
                        } catch (removeError: any) {
                            elizaLogger.error(`❌ Remove liquidity failed for pool ${position.poolId}:`);
                            elizaLogger.error(`   Error: ${removeError.message}`);
                            if (removeError.logs) {
                                elizaLogger.error(`   Logs:`, removeError.logs);
                            }
                        }
                        
                    } catch (err: any) {
                        elizaLogger.error(`❌ Failed to process pool ${position.poolId}:`, err.message);
                    }
                }
                
                elizaLogger.info("✅ Step 4 completed: All positions liquidated");
                
            } else {
                elizaLogger.info("No positions with balance found to liquidate");
            }

            // Step 3: Get wallet balances and swap all non SOL tokens for SOL
            elizaLogger.info("   ==================================================");
            elizaLogger.info("🚀 Starting Step 3: Consolidate all tokens to SOL...");
            elizaLogger.info("   --------------------------------------------------");
            
            // Get all token accounts
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                walletKeypair.publicKey,
                { programId: TOKEN_PROGRAM_ID }
            );
            
            elizaLogger.info(`Found ${tokenAccounts.value.length} token accounts`);
            
            // Filter out SOL and empty accounts
            const nonSolTokens = tokenAccounts.value.filter(account => {
                const tokenInfo = account.account.data.parsed.info;
                const balance = tokenInfo.tokenAmount.uiAmount;
                return balance > 0 && tokenInfo.mint !== SOL_MINT;
            });
            
            elizaLogger.info(`Found ${nonSolTokens.length} non-SOL tokens to swap`);
            
            // Swap each token to SOL
            for (const tokenAccount of nonSolTokens) {
                const tokenInfo = tokenAccount.account.data.parsed.info;
                const mint = tokenInfo.mint;
                const balance = tokenInfo.tokenAmount.amount;
                const uiBalance = tokenInfo.tokenAmount.uiAmount;
                
                elizaLogger.info(`💱 Swapping ${uiBalance} of token ${mint} to SOL...`);
                
                try {
                    // Get quote from Jupiter
                    const quoteResponse = await fetch(
                        `https://quote-api.jup.ag/v6/quote?inputMint=${mint}&outputMint=${SOL_MINT}&amount=${balance}&slippageBps=50`
                    );
                    const quoteData = await quoteResponse.json();
                    
                    if (!quoteData || quoteData.error) {
                        elizaLogger.warn(`❌ Failed to get quote for ${mint}: ${quoteData?.error || 'Unknown error'}`);
                        continue;
                    }
                    
                    // Get swap transaction
                    const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            quoteResponse: quoteData,
                            userPublicKey: walletKeypair.publicKey.toBase58(),
                            dynamicComputeUnitLimit: true,
                            prioritizationFeeLamports: 1000000
                        })
                    });
                    
                    const swapData = await swapResponse.json();
                    
                    if (!swapData || !swapData.swapTransaction) {
                        elizaLogger.warn(`❌ Failed to get swap transaction for ${mint}`);
                        continue;
                    }
                    
                    // Execute swap with retry logic
                    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
                    let transaction = VersionedTransaction.deserialize(swapTransactionBuf);
                    transaction.sign([walletKeypair]);
                    
                    const beforeSOL = await connection.getBalance(walletKeypair.publicKey) / 1e9;
                    
                    // Try to send transaction with retries for blockhash expiry
                    let signature: string;
                    let sendAttempts = 0;
                    const maxSendAttempts = 3;
                    
                    while (sendAttempts < maxSendAttempts) {
                        try {
                            signature = await connection.sendTransaction(transaction, {
                                maxRetries: 3,
                                skipPreflight: false
                            });
                            break; // Success, exit loop
                        } catch (sendError: any) {
                            sendAttempts++;
                            if (sendError.message?.includes('block height exceeded') && sendAttempts < maxSendAttempts) {
                                elizaLogger.warn(`⚠️ Blockhash expired, getting new quote (attempt ${sendAttempts + 1}/${maxSendAttempts})...`);
                                // Get a fresh quote and transaction
                                const freshQuoteResponse = await fetch(
                                    `https://quote-api.jup.ag/v6/quote?inputMint=${mint}&outputMint=${SOL_MINT}&amount=${tokenBalance}&slippageBps=50`
                                );
                                const freshQuoteData = await freshQuoteResponse.json();
                                
                                const freshSwapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        quoteResponse: freshQuoteData,
                                        userPublicKey: walletKeypair.publicKey.toString(),
                                        wrapAndUnwrapSol: true,
                                        dynamicComputeUnitLimit: true,
                                        prioritizationFeeLamports: 'auto'
                                    })
                                });
                                const freshSwapData = await freshSwapResponse.json();
                                
                                const freshTransaction = VersionedTransaction.deserialize(
                                    Buffer.from(freshSwapData.swapTransaction, 'base64')
                                );
                                freshTransaction.sign([walletKeypair]);
                                transaction = freshTransaction;
                                
                                await wait(1000, 2000); // Wait before retry
                            } else {
                                throw sendError;
                            }
                        }
                    }
                    
                    if (!signature!) {
                        throw new Error('Failed to send transaction after all attempts');
                    }
                    
                    // Wait for confirmation with timeout
                    const latestBlockhash = await connection.getLatestBlockhash();
                    try {
                        await connection.confirmTransaction({
                            signature,
                            blockhash: latestBlockhash.blockhash,
                            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                        }, 'confirmed');
                    } catch (confirmError: any) {
                        if (confirmError.message?.includes('block height exceeded')) {
                            elizaLogger.warn('⚠️ Transaction confirmation timed out, checking status...');
                            // Check if transaction was successful despite timeout
                            const status = await connection.getSignatureStatus(signature);
                            if (!status?.value?.err) {
                                elizaLogger.info('✅ Transaction succeeded despite timeout');
                            } else {
                                throw confirmError;
                            }
                        } else {
                            throw confirmError;
                        }
                    }
                    
                    const afterSOL = await connection.getBalance(walletKeypair.publicKey) / 1e9;
                    const outputSol = quoteData.outAmount ? parseFloat(quoteData.outAmount) / 1e9 : 0;
                    
                    elizaLogger.info(`✅ Swap successful!`);
                    elizaLogger.info(`🔗 Transaction: ${signature}`);
                    elizaLogger.info(`💰 Received: ${outputSol.toFixed(6)} SOL`);
                    elizaLogger.info(`📊 SOL balance: ${beforeSOL.toFixed(6)} → ${afterSOL.toFixed(6)}`);
                    
                    // Wait between swaps
                    await wait(2000, 3000);
                    
                } catch (swapError: any) {
                    elizaLogger.error(`❌ Failed to swap ${mint} to SOL:`, swapError.message);
                }
            }
            
            elizaLogger.info("✅ Step 5 completed: All tokens consolidated to SOL");
            
            // Get final SOL balance
            const finalSolBalance = await connection.getBalance(walletKeypair.publicKey) / 1e9;
            elizaLogger.info(`💰 Final SOL balance: ${finalSolBalance.toFixed(6)} SOL`);
            
            
            // Step 4: Swap half SOL for the other token
            elizaLogger.info("   ================================================");
            elizaLogger.info("🚀 Starting Step 4: Swap half SOL for pool token...");
            elizaLogger.info("   ------------------------------------------------");
            
            try {
                // Determine which mint is NOT SOL
                const otherTokenMint = mintA === SOL_MINT ? mintB : mintA;
                elizaLogger.info(`Pool tokens: ${mintA} and ${mintB}`);
                elizaLogger.info(`Other token mint: ${otherTokenMint}`);
                
                // Get current SOL balance
                const currentSolBalance = await connection.getBalance(walletKeypair.publicKey) / 1e9;
                elizaLogger.info(`Current SOL balance: ${currentSolBalance.toFixed(6)} SOL`);
                
                // Calculate amount to swap (half of balance minus MIN_SOL_BALANCE)
                const availableForSwap = currentSolBalance - MIN_SOL_BALANCE;
                if (availableForSwap <= 0) {
                    elizaLogger.warn(`Insufficient SOL balance for swap. Have ${currentSolBalance} SOL, need at least ${MIN_SOL_BALANCE} SOL for fees`);
                } else {
                    const amountToSwap = availableForSwap / 2; // Half of available balance
                    const amountToSwapLamports = Math.floor(amountToSwap * 1e9).toString();
                    
                    elizaLogger.info(`💱 Swapping ${amountToSwap.toFixed(6)} SOL to ${otherTokenMint}...`);
                    elizaLogger.info(`   Keeping ${MIN_SOL_BALANCE} SOL for fees`);
                    elizaLogger.info(`   Remaining SOL after swap: ~${(currentSolBalance - amountToSwap).toFixed(6)} SOL`);
                    
                    try {
                        // Get quote from Jupiter
                        const quoteResponse = await fetch(
                            `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT}&outputMint=${otherTokenMint}&amount=${amountToSwapLamports}&slippageBps=50`
                        );
                        const quoteData = await quoteResponse.json();
                        
                        if (!quoteData || quoteData.error) {
                            throw new Error(`Failed to get quote: ${quoteData?.error || 'Unknown error'}`);
                        }
                        
                        const expectedOutput = quoteData.outAmount ? (parseInt(quoteData.outAmount) / Math.pow(10, poolInfo.mintADecimals || 9)).toFixed(6) : '0';
                        elizaLogger.info(`Expected output: ${expectedOutput} tokens`);
                        
                        // Get swap transaction
                        const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                quoteResponse: quoteData,
                                userPublicKey: walletKeypair.publicKey.toBase58(),
                                dynamicComputeUnitLimit: true,
                                prioritizationFeeLamports: 1000000
                            })
                        });
                        
                        const swapData = await swapResponse.json();
                        
                        if (!swapData || !swapData.swapTransaction) {
                            throw new Error(`Failed to get swap transaction: ${swapData?.error || 'Unknown error'}`);
                        }
                        
                        // Execute swap
                        const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
                        const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
                        transaction.sign([walletKeypair]);
                        
                        const signature = await connection.sendTransaction(transaction, {
                            maxRetries: 3,
                            skipPreflight: false
                        });
                        
                        // Wait for confirmation
                        const latestBlockhash = await connection.getLatestBlockhash();
                        await connection.confirmTransaction({
                            signature,
                            blockhash: latestBlockhash.blockhash,
                            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                        }, 'confirmed');
                        
                        elizaLogger.info(`✅ Swap successful!`);
                        elizaLogger.info(`🔗 Transaction: ${signature}`);
                        elizaLogger.info(`🌐 Explorer: https://solscan.io/tx/${signature}`);
                        
                        // Check final balances
                        await wait(3000, 5000);
                        const finalSolBalance = await connection.getBalance(walletKeypair.publicKey) / 1e9;
                        elizaLogger.info(`📊 Final SOL balance: ${finalSolBalance.toFixed(6)} SOL`);
                        
                    } catch (swapError: any) {
                        elizaLogger.error(`❌ Failed to swap SOL to ${otherTokenMint}:`, swapError.message);
                    }
                }
                
                elizaLogger.info("✅ Step 6 completed: Swapped half SOL for pool token");
                
            } catch (error: any) {
                elizaLogger.error("❌ Error in Step 6:", error.message);
            }
        
            
            // Step 5: Add liquidity to the new pool
            elizaLogger.info("   =================================================");
            elizaLogger.info("🚀 Starting Step 5: Add liquidity to the new pool...");
            elizaLogger.info("   -------------------------------------------------");
            
            try {
                // Get current token balances
                const solBalance = await connection.getBalance(walletKeypair.publicKey) / 1e9;
                elizaLogger.info(`💰 Current SOL balance: ${solBalance.toFixed(6)} SOL`);
                
                // Get all token accounts to find the other token balance
                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                    walletKeypair.publicKey,
                    { programId: TOKEN_PROGRAM_ID }
                );
                
                // Find the non-SOL token balance
                const otherTokenMint = mintA === SOL_MINT ? mintB : mintA;
                const otherTokenAccount = tokenAccounts.value.find(account => 
                    account.account.data.parsed.info.mint === otherTokenMint
                );
                
                if (!otherTokenAccount) {
                    elizaLogger.warn(`❌ No balance found for token ${otherTokenMint}`);
                    elizaLogger.warn(`💡 You need to have both tokens to add liquidity`);
                } else {
                    const otherTokenInfo = otherTokenAccount.account.data.parsed.info;
                    const otherTokenBalance = otherTokenInfo.tokenAmount.amount;
                    const otherTokenUiBalance = otherTokenInfo.tokenAmount.uiAmount;
                    const otherTokenDecimals = otherTokenInfo.tokenAmount.decimals;
                    
                    elizaLogger.info(`💰 Other token balance: ${otherTokenUiBalance} (${otherTokenBalance} raw)`);
                    
                    // Fetch current pool reserves to calculate optimal amounts
                    elizaLogger.info("📊 Fetching current pool reserves...");
                    const poolReserves = await getRaydiumPoolInfo(poolInfo.id, connection.rpcEndpoint);
                    
                    if (!poolReserves || !poolReserves.baseReserve || !poolReserves.quoteReserve) {
                        elizaLogger.error("❌ Failed to fetch pool reserves");
                        throw new Error("Cannot get pool reserves");
                    }
                    
                    elizaLogger.info(`📊 Pool reserves - Base: ${poolReserves.baseReserve}, Quote: ${poolReserves.quoteReserve}`);
                    
                    // Calculate optimal amounts based on pool ratio
                    let baseAmount: string;
                    let quoteAmount: string;
                    let fixedSide: 'base' | 'quote';
                    
                    const baseReserve = new BN(poolReserves.baseReserve);
                    const quoteReserve = new BN(poolReserves.quoteReserve);
                    
                    // Calculate pool price (quote per base)
                    const poolPrice = quoteReserve.mul(new BN(10).pow(new BN(poolInfo.mintADecimals)))
                        .div(baseReserve.mul(new BN(10).pow(new BN(poolInfo.mintBDecimals))));
                    
                    elizaLogger.info(`📊 Pool price: ${poolPrice.toString()} (quote per base, normalized)`);
                    elizaLogger.info(`📊 mintA: ${mintA}, mintB: ${mintB}, SOL_MINT: ${SOL_MINT}`);
                    
                    if (mintA === SOL_MINT) {
                        // SOL is token A (base), other token is B (quote)
                        // BOME-WSOL pool: mintA=BOME, mintB=WSOL, but we have it backwards
                        // So we need to swap our understanding
                        elizaLogger.warn(`⚠️ Token order mismatch detected - adjusting logic`);
                        
                        // Actually: BOME is base (A), WSOL is quote (B)
                        // We have BOME tokens and SOL
                        // Use all BOME tokens as base
                        baseAmount = otherTokenBalance; // BOME amount
                        
                        // Calculate required WSOL based on pool ratio
                        const requiredQuote = new BN(otherTokenBalance).mul(quoteReserve).div(baseReserve);
                        
                        // When using fixedSide='base', quoteAmountIn should be the MAXIMUM we're willing to provide
                        // Add extra buffer for slippage (SDK will handle the exact calculation internally)
                        const slippageBuffer = 1.1; // 10% buffer on top of slippage parameter
                        const maxQuoteAmount = requiredQuote.muln(slippageBuffer);
                        
                        // Always use the max amount with buffer - SDK will calculate exact amount needed
                        quoteAmount = maxQuoteAmount.toString();
                        
                        // Just log the information
                        const availableSol = (solBalance - MIN_SOL_BALANCE) * 1e9; // Convert to lamports
                        const actualMinReserve = 0.02; // We can go lower if needed
                        const maxAvailableSol = (solBalance - actualMinReserve) * 1e9;
                        
                        fixedSide = 'base'; // Fix BOME amount
                        
                        elizaLogger.info(`📊 Using ${otherTokenUiBalance} BOME as base (fixed)`);
                        elizaLogger.info(`📊 Calculated required WSOL: ${requiredQuote.toNumber() / 1e9} SOL`);
                        elizaLogger.info(`📊 Max WSOL to provide (with buffer): ${maxQuoteAmount.toNumber() / 1e9} SOL`);
                        elizaLogger.info(`📊 Available SOL (minus 0.05 reserve): ${availableSol / 1e9} SOL`);
                        elizaLogger.info(`📊 Available SOL (minus 0.02 reserve): ${maxAvailableSol / 1e9} SOL`);
                        elizaLogger.info(`📊 Total SOL balance: ${solBalance} SOL`);
                    } else {
                        // Other token is A (base), SOL is B (quote)
                        // This is the normal case: Token-WSOL
                        baseAmount = otherTokenBalance; // Other token amount
                        
                        // Calculate required WSOL based on pool ratio
                        const requiredQuote = new BN(otherTokenBalance).mul(quoteReserve).div(baseReserve);
                        
                        // When using fixedSide='base', quoteAmountIn should be the MAXIMUM we're willing to provide
                        // Add extra buffer for slippage (SDK will handle the exact calculation internally)
                        const slippageBuffer = 1.1; // 10% buffer on top of slippage parameter
                        const maxQuoteAmount = requiredQuote.muln(slippageBuffer);
                        
                        // Always use the max amount with buffer - SDK will calculate exact amount needed
                        quoteAmount = maxQuoteAmount.toString();
                        
                        // Just log the information
                        const availableSol = (solBalance - MIN_SOL_BALANCE) * 1e9; // Convert to lamports
                        const actualMinReserve = 0.02; // We can go lower if needed
                        const maxAvailableSol = (solBalance - actualMinReserve) * 1e9;
                        
                        fixedSide = 'base'; // Fix other token amount
                        
                        elizaLogger.info(`📊 Using ${otherTokenUiBalance} ${parsed.symbol.split('-')[0]} as base (fixed)`);
                        elizaLogger.info(`📊 Calculated required WSOL: ${requiredQuote.toNumber() / 1e9} SOL`);
                        elizaLogger.info(`📊 Max WSOL to provide (with buffer): ${maxQuoteAmount.toNumber() / 1e9} SOL`);
                        elizaLogger.info(`📊 Available SOL (minus 0.05 reserve): ${availableSol / 1e9} SOL`);
                        elizaLogger.info(`📊 Available SOL (minus 0.02 reserve): ${maxAvailableSol / 1e9} SOL`);
                        elizaLogger.info(`📊 Total SOL balance: ${solBalance} SOL`);
                    }
                    
                    if (parseInt(baseAmount) > 0 && parseInt(quoteAmount) > 0) {
                        elizaLogger.info(`💧 Adding liquidity to pool ${poolInfo.id}`);
                        elizaLogger.info(`   Base amount: ${baseAmount}`);
                        elizaLogger.info(`   Quote amount: ${quoteAmount}`);
                        elizaLogger.info(`   Fixed side: ${fixedSide}`);
                        elizaLogger.info(`   Pool symbol: ${parsed.symbol}`);
                        
                        try {
                            // Use much higher slippage to account for price movements and calculation differences
                            const slippagePercent = 10;
                            
                            elizaLogger.info(`📊 Using ${slippagePercent}% slippage to handle price movements`);
                            
                            // First attempt with calculated amounts
                            try {
                                const txSignature = await addLiquidity(connection, {
                                    poolId: poolInfo.id,
                                    baseAmountIn: baseAmount,
                                    quoteAmountIn: quoteAmount,
                                    walletKeypair: walletKeypair,
                                    slippage: slippagePercent,
                                    fixedSide: fixedSide
                                });
                                
                                elizaLogger.info(`✅ Successfully added liquidity!`);
                                elizaLogger.info(`🔗 Transaction: ${txSignature}`);
                                elizaLogger.info(`🌐 Explorer: https://solscan.io/tx/${txSignature}`);
                                
                                // Wait a bit and check LP balance
                                await wait(5000, 7000);
                                const lpBalance = await getUserLpBalance(connection, walletPublicKey, poolInfo.id);
                                elizaLogger.info(`💎 New LP token balance: ${(parseInt(lpBalance.balance) / Math.pow(10, lpBalance.decimals)).toFixed(6)} LP tokens`);
                                
                            } catch (firstAttemptError: any) {
                                if (firstAttemptError.message?.includes('exceeds desired slippage limit')) {
                                    elizaLogger.warn(`⚠️ First attempt failed due to slippage. Trying alternative approach...`);
                                    
                                    // Alternative: Fix the quote (SOL) amount instead
                                    const availableSolLamports = Math.floor((solBalance - MIN_SOL_BALANCE) * 0.9 * 1e9); // Use 90% of available SOL
                                    const calculatedBase = new BN(availableSolLamports).mul(baseReserve).div(quoteReserve);
                                    
                                    elizaLogger.info(`🔄 Alternative approach: Fix SOL amount`);
                                    elizaLogger.info(`   Fixed SOL amount: ${availableSolLamports / 1e9} SOL`);
                                    elizaLogger.info(`   Calculated base amount: ${calculatedBase.toString()}`);
                                    
                                    // Make sure we don't exceed available tokens
                                    const finalBaseAmount = BN.min(calculatedBase, new BN(otherTokenBalance)).toString();
                                    
                                    const txSignature = await addLiquidity(connection, {
                                        poolId: poolInfo.id,
                                        baseAmountIn: finalBaseAmount,
                                        quoteAmountIn: availableSolLamports.toString(),
                                        walletKeypair: walletKeypair,
                                        slippage: slippagePercent,
                                        fixedSide: 'quote' // Fix SOL amount instead
                                    });
                                    
                                    elizaLogger.info(`✅ Successfully added liquidity (alternative approach)!`);
                                    elizaLogger.info(`🔗 Transaction: ${txSignature}`);
                                    elizaLogger.info(`🌐 Explorer: https://solscan.io/tx/${txSignature}`);
                                    
                                    // Wait a bit and check LP balance
                                    await wait(5000, 7000);
                                    const lpBalance = await getUserLpBalance(connection, walletPublicKey, poolInfo.id);
                                    elizaLogger.info(`💎 New LP token balance: ${(parseInt(lpBalance.balance) / Math.pow(10, lpBalance.decimals)).toFixed(6)} LP tokens`);
                                } else {
                                    throw firstAttemptError;
                                }
                            }
                            
                        } catch (addLiqError: any) {
                            elizaLogger.error(`❌ Failed to add liquidity:`, addLiqError.message);
                            if (addLiqError.logs) {
                                elizaLogger.error(`   Logs:`, addLiqError.logs);
                            }
                        }
                    } else {
                        elizaLogger.warn(`❌ Insufficient token balances to add liquidity`);
                        elizaLogger.warn(`   Base amount: ${baseAmount}`);
                        elizaLogger.warn(`   Quote amount: ${quoteAmount}`);
                    }
                }
                
                elizaLogger.info("✅ Step 7 completed: Liquidity addition attempted");
                    
                } catch (error: any) {
                    elizaLogger.error("❌ Error in Step 7:", error.message);
                }

            // Exit the loop after completing all steps
            elizaLogger.info("🏁 Yield optimizer completed: Full cycle executed!");
            elizaLogger.info("💡 Ready for next yield optimization cycle");
            break;
        } catch (err) {
            elizaLogger.error("Error in yield optimizer loop:");
            if (err && err.stack) {
                elizaLogger.error(err.stack);
            } else if (typeof err === "object") {
                elizaLogger.error(JSON.stringify(err, null, 2));
            } else {
                elizaLogger.error(String(err));
            }
        }
        await wait(scanIntervalMs, scanIntervalMs + 1000);
    }
}

async function startAgent(
    character: Character,
    directClient: DirectClient
): Promise<AgentRuntime> {
    let db: IDatabaseAdapter & IDatabaseCacheAdapter;
    try {
        character.id ??= stringToUuid(character.name);
        character.username ??= character.name;

        const token = getTokenForProvider(character.modelProvider, character);

        const runtime: AgentRuntime = await createAgent(character, token);

        // initialize database
        // find a db from the plugins
        db = await findDatabaseAdapter(runtime);
        runtime.databaseAdapter = db;

        // initialize cache
        const cache = initializeCache(
            process.env.CACHE_STORE ?? CacheStore.DATABASE,
            character,
            process.env.CACHE_DIR ?? "",
            db
        ); // "" should be replaced with dir for file system caching. THOUGHTS: might probably make this into an env
        runtime.cacheManager = cache;

        // start services/plugins/process knowledge
        await runtime.initialize();

        // start assigned clients
        runtime.clients = await initializeClients(character, runtime);

        // add to container
        directClient.registerAgent(runtime);

        // report to console
        elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`);

        // Start yield optimizer loop for the relevant agent
        if (character.name === "Solana Raydium Trader") {
            startYieldOptimizerLoop(runtime);
        }

        return runtime;
    } catch (error) {
        elizaLogger.error(
            `Error starting agent for character ${character.name}:`,
            error
        );
        elizaLogger.error(error);
        if (db) {
            await db.close();
        }
        throw error;
    }
}

const checkPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.once("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EADDRINUSE") {
                resolve(false);
            }
        });

        server.once("listening", () => {
            server.close();
            resolve(true);
        });

        server.listen(port);
    });
};

const hasValidRemoteUrls = () =>
    process.env.REMOTE_CHARACTER_URLS &&
    process.env.REMOTE_CHARACTER_URLS !== "" &&
    process.env.REMOTE_CHARACTER_URLS.startsWith("http");

/**
 * Post processing of character after loading
 * @param character
 */
const handlePostCharacterLoaded = async (
    character: Character
): Promise<Character> => {
    let processedCharacter = character;
    // Filtering the plugins with the method of handlePostCharacterLoaded
    const processors = character?.postProcessors?.filter(
        (p) => typeof p.handlePostCharacterLoaded === "function"
    );
    if (processors?.length > 0) {
        processedCharacter = Object.assign({}, character, {
            postProcessors: undefined,
        });
        // process the character with each processor
        // the order is important, so we loop through the processors
        for (let i = 0; i < processors.length; i++) {
            const processor = processors[i];
            processedCharacter = await processor.handlePostCharacterLoaded(
                processedCharacter
            );
        }
    }
    return processedCharacter;
};

const startAgents = async () => {
    const directClient = new DirectClient();
    let serverPort = Number.parseInt(settings.SERVER_PORT || "3000");
    const args = parseArguments();
    const charactersArg = args.characters || args.character;
    let characters = [defaultCharacter];

    if (charactersArg || hasValidRemoteUrls()) {
        characters = await loadCharacters(charactersArg);
    }

    try {
        for (const character of characters) {
            const processedCharacter = await handlePostCharacterLoaded(
                character
            );
            await startAgent(processedCharacter, directClient);
        }
    } catch (error) {
        elizaLogger.error("Error starting agents:", error);
    }

    // Find available port
    while (!(await checkPortAvailable(serverPort))) {
        elizaLogger.warn(
            `Port ${serverPort} is in use, trying ${serverPort + 1}`
        );
        serverPort++;
    }

    // upload some agent functionality into directClient
    // This is used in client-direct/api.ts at "/agents/:agentId/set" route to restart an agent
    directClient.startAgent = async (character) => {
        // Handle plugins
        character.plugins = await handlePluginImporting(character.plugins);
        elizaLogger.info(
            character.name,
            "loaded plugins:",
            "[" +
                character.plugins.map((p) => `"${p.npmName}"`).join(", ") +
                "]"
        );

        // Handle Post Processors plugins
        if (character.postProcessors?.length > 0) {
            elizaLogger.info(
                character.name,
                "loading postProcessors",
                character.postProcessors
            );
            character.postProcessors = await handlePluginImporting(
                character.postProcessors
            );
        }
        // character's post processing
        const processedCharacter = await handlePostCharacterLoaded(character);

        // wrap it so we don't have to inject directClient later
        return startAgent(processedCharacter, directClient);
    };

    directClient.loadCharacterTryPath = loadCharacterTryPath;
    directClient.jsonToCharacter = jsonToCharacter;

    directClient.start(serverPort);

    if (serverPort !== Number.parseInt(settings.SERVER_PORT || "3000")) {
        elizaLogger.warn(`Server started on alternate port ${serverPort}`);
    }

    elizaLogger.info(
        "Run `pnpm start:client` to start the client and visit the outputted URL (http://localhost:5173) to chat with your agents. When running multiple agents, use client with different port `SERVER_PORT=3001 pnpm start:client`"
    );
};

const setProxy = () => {
    const proxy = process.env.AGENT_PROXY;
    if (proxy) {
        elizaLogger.info("start agents use proxy : ", proxy);
        const proxyAgent = new ProxyAgent(proxy);
        setGlobalDispatcher(proxyAgent);
    }
};

// begin start agents

setProxy();

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

startAgents().catch((error) => {
    elizaLogger.error("Unhandled error in startAgents:", error);
    process.exit(1);
});

// Prevent unhandled exceptions from crashing the process if desired
if (
    process.env.PREVENT_UNHANDLED_EXIT &&
    parseBooleanFromText(process.env.PREVENT_UNHANDLED_EXIT)
) {
    // Handle uncaught exceptions to prevent the process from crashing
    process.on("uncaughtException", (err) => {
        console.error("uncaughtException", err);
    });

    // Handle unhandled rejections to prevent the process from crashing
    process.on("unhandledRejection", (err) => {
        console.error("unhandledRejection", err);
    });
}
