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
import { getRaydiumPoolInfo, findRaydiumPoolAddressBySymbol, getMintsForSymbol, findRaydiumPoolByMints, getUserRaydiumPositions, getUserLpBalance, poolContainsSol, removeLiquidity, addLiquidity, clearPoolCache } from '@elizaos/plugin-raydium';

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

// Helper to check and get current LP positions with balances
async function getCurrentLPPositions(connection: Connection, walletPublicKey: string, rpcUrl: string) {
    elizaLogger.info("   ============================================");
    elizaLogger.info("🚀 Getting all LP positions...");
    elizaLogger.info("   --------------------------------------------");
    
    const allPositions = await getUserRaydiumPositions(walletPublicKey, rpcUrl, 1);
    const positionsWithBalance = [];
    
    for (const pos of allPositions) {
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
    
    return positionsWithBalance;
}

// Helper to remove liquidity from all positions
async function removeAllLiquidity(connection: Connection, positionsWithBalance: any[], walletKeypair: Keypair) {
    if (positionsWithBalance.length === 0) {
        elizaLogger.info("No positions with balance found to liquidate");
        return;
    }
    
    elizaLogger.info("   =======================================================");
    elizaLogger.info("🚀 Remove liquidity from all positions...");
    elizaLogger.info("   -------------------------------------------------------");
    
    elizaLogger.info(`💧 Removing liquidity from ${positionsWithBalance.length} LP positions...`);
    
    for (const position of positionsWithBalance) {
        try {
            elizaLogger.info(`💰 LP balance in pool ${position.poolId}: ${position.balanceFormatted} tokens (raw: ${position.balance})`);
            elizaLogger.info(`🚀 Removing ${position.balanceFormatted} LP tokens from pool ${position.poolId}...`);
            
            const beforeSOL = await connection.getBalance(walletKeypair.publicKey) / 1e9;
            elizaLogger.info(`📊 SOL balance before: ${beforeSOL.toFixed(6)} SOL`);
            
            const txSignature = await removeLiquidity(connection, {
                poolId: position.poolId,
                lpAmountIn: position.balance,
                walletKeypair: walletKeypair,
                slippage: 1
            });
            
            elizaLogger.info(`✅ Successfully removed liquidity!`);
            elizaLogger.info(`📋 Pool: ${position.poolId}`);
            elizaLogger.info(`💧 LP tokens removed: ${position.balanceFormatted}`);
            
            await wait(5000, 7000);
            const afterSOL = await connection.getBalance(walletKeypair.publicKey) / 1e9;
            elizaLogger.info(`📊 SOL balance after: ${afterSOL.toFixed(6)} SOL`);
            elizaLogger.info(`💰 SOL gained: ${(afterSOL - beforeSOL).toFixed(6)} SOL`);
            
            await wait(3000, 5000);
            
        } catch (removeError: any) {
            elizaLogger.error(`❌ Remove liquidity failed for pool ${position.poolId}:`);
            elizaLogger.error(`   Error: ${removeError.message}`);
            if (removeError.logs) {
                elizaLogger.error(`   Logs:`, removeError.logs);
            }
        }
    }
    
    elizaLogger.info("✅ All positions liquidated");
}

// Helper to swap all non-SOL tokens to SOL
async function consolidateAllTokensToSOL(connection: Connection, walletKeypair: Keypair, TOKEN_PROGRAM_ID: PublicKey, SOL_MINT: string) {
    elizaLogger.info("   ==================================================");
    elizaLogger.info("🚀 Consolidate all tokens to SOL...");
    elizaLogger.info("   --------------------------------------------------");
    
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletKeypair.publicKey,
        { programId: TOKEN_PROGRAM_ID }
    );
    
    elizaLogger.info(`Found ${tokenAccounts.value.length} token accounts`);
    
    const nonSolTokens = tokenAccounts.value.filter(account => {
        const tokenInfo = account.account.data.parsed.info;
        const balance = tokenInfo.tokenAmount.uiAmount;
        return balance > 0 && tokenInfo.mint !== SOL_MINT;
    });
    
    elizaLogger.info(`Found ${nonSolTokens.length} non-SOL tokens to swap`);
    
    for (const tokenAccount of nonSolTokens) {
        const tokenInfo = tokenAccount.account.data.parsed.info;
        const mint = tokenInfo.mint;
        const balance = tokenInfo.tokenAmount.amount;
        const uiBalance = tokenInfo.tokenAmount.uiAmount;
        
        elizaLogger.info(`💱 Swapping ${uiBalance} of token ${mint} to SOL...`);
        
        try {
            await executeJupiterSwap(connection, walletKeypair, mint, SOL_MINT, balance);
        } catch (swapError: any) {
            elizaLogger.error(`❌ Failed to swap ${mint} to SOL:`, swapError.message);
        }
    }
    
    elizaLogger.info("✅ All tokens consolidated to SOL");
    
    const finalSolBalance = await connection.getBalance(walletKeypair.publicKey) / 1e9;
    elizaLogger.info(`💰 Final SOL balance: ${finalSolBalance.toFixed(6)} SOL`);
    
    return finalSolBalance;
}

// Helper to execute Jupiter swap with retry logic
async function executeJupiterSwap(connection: Connection, walletKeypair: Keypair, inputMint: string, outputMint: string, amount: string) {
    const beforeSOL = await connection.getBalance(walletKeypair.publicKey) / 1e9;
    
    // Get quote from Jupiter
    const quoteResponse = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`
    );
    const quoteData = await quoteResponse.json();
    
    if (!quoteData || quoteData.error) {
        throw new Error(`Failed to get quote: ${quoteData?.error || 'Unknown error'}`);
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
        throw new Error(`Failed to get swap transaction: ${swapData?.error || 'Unknown error'}`);
    }
    
    // Execute swap with retry logic
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
    let transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    transaction.sign([walletKeypair]);
    
    let signature: string;
    let sendAttempts = 0;
    const maxSendAttempts = 3;
    
    while (sendAttempts < maxSendAttempts) {
        try {
            signature = await connection.sendTransaction(transaction, {
                maxRetries: 3,
                skipPreflight: false
            });
            break;
        } catch (sendError: any) {
            sendAttempts++;
            if (sendError.message?.includes('block height exceeded') && sendAttempts < maxSendAttempts) {
                elizaLogger.warn(`⚠️ Blockhash expired, getting new quote (attempt ${sendAttempts + 1}/${maxSendAttempts})...`);
                // Get fresh quote and transaction
                const freshQuoteResponse = await fetch(
                    `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`
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
                
                await wait(1000, 2000);
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
    elizaLogger.info(`📊 SOL balance: ${beforeSOL.toFixed(6)} → ${afterSOL.toFixed(6)}`);
    
    await wait(2000, 3000);
}

// Helper to swap half SOL to pool token
async function swapHalfSOLToPoolToken(connection: Connection, walletKeypair: Keypair, mintA: string, mintB: string, poolInfo: any, parsed: any, SOL_MINT: string, MIN_SOL_BALANCE: number) {
    elizaLogger.info("   ================================================");
    elizaLogger.info("🚀 Swap half SOL for pool token...");
    elizaLogger.info("   ------------------------------------------------");
    
    const otherTokenMint = mintA === SOL_MINT ? mintB : mintA;
    elizaLogger.info(`Pool tokens: ${mintA} and ${mintB}`);
    elizaLogger.info(`Other token mint: ${otherTokenMint}`);
    
    const currentSolBalance = await connection.getBalance(walletKeypair.publicKey) / 1e9;
    elizaLogger.info(`Current SOL balance: ${currentSolBalance.toFixed(6)} SOL`);
    
    const availableForSwap = currentSolBalance - MIN_SOL_BALANCE;
    if (availableForSwap <= 0) {
        elizaLogger.warn(`Insufficient SOL balance for swap. Have ${currentSolBalance} SOL, need at least ${MIN_SOL_BALANCE} SOL for fees`);
        return false;
    }
    
    const amountToSwap = availableForSwap / 2;
    const amountToSwapLamports = Math.floor(amountToSwap * 1e9).toString();
    
    elizaLogger.info(`💱 Swapping ${amountToSwap.toFixed(6)} SOL to ${otherTokenMint}...`);
    elizaLogger.info(`   Keeping ${MIN_SOL_BALANCE} SOL for fees`);
    elizaLogger.info(`   Remaining SOL after swap: ~${(currentSolBalance - amountToSwap).toFixed(6)} SOL`);
    
    try {
        await executeJupiterSwap(connection, walletKeypair, SOL_MINT, otherTokenMint, amountToSwapLamports);
        
        await wait(3000, 5000);
        
        elizaLogger.info("✅ Swapped half SOL for pool token");
        return true;
    } catch (swapError: any) {
        elizaLogger.error(`❌ Failed to swap SOL to ${otherTokenMint}:`, swapError.message);
        return false;
    }
}

// Helper to add liquidity to pool with retry logic
async function addLiquidityToPool(
    connection: Connection,
    walletKeypair: Keypair,
    walletPublicKey: string,
    poolInfo: any,
    mintA: string,
    mintB: string,
    parsed: any,
    SOL_MINT: string,
    MIN_SOL_BALANCE: number,
    TOKEN_PROGRAM_ID: PublicKey,
    // Variables to update on success
    onSuccess: (poolInfo: any, poolId: string, apy: number) => void,
    newPoolId: string,
    bestApy: number
) {
    elizaLogger.info("   =================================================");
    elizaLogger.info("🚀 Add liquidity to the new pool...");
    elizaLogger.info("   -------------------------------------------------");
    
    try {
        const solBalance = await connection.getBalance(walletKeypair.publicKey) / 1e9;
        elizaLogger.info(`💰 Current SOL balance: ${solBalance.toFixed(6)} SOL`);
        
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            walletKeypair.publicKey,
            { programId: TOKEN_PROGRAM_ID }
        );
        
        const otherTokenMint = mintA === SOL_MINT ? mintB : mintA;
        const otherTokenAccount = tokenAccounts.value.find(account => 
            account.account.data.parsed.info.mint === otherTokenMint
        );
        
        if (!otherTokenAccount) {
            elizaLogger.warn(`❌ No balance found for token ${otherTokenMint}`);
            elizaLogger.warn(`💡 You need to have both tokens to add liquidity`);
            return false;
        }
        
        const otherTokenInfo = otherTokenAccount.account.data.parsed.info;
        const otherTokenBalance = otherTokenInfo.tokenAmount.amount;
        const otherTokenUiBalance = otherTokenInfo.tokenAmount.uiAmount;
        
        elizaLogger.info(`💰 Other token balance: ${otherTokenUiBalance} (${otherTokenBalance} raw)`);
        
        // Fetch pool reserves
        elizaLogger.info("📊 Fetching current pool reserves...");
        const poolReserves = await getRaydiumPoolInfo(poolInfo.id, connection.rpcEndpoint);
        
        if (!poolReserves || !poolReserves.baseReserve || !poolReserves.quoteReserve) {
            elizaLogger.error("❌ Failed to fetch pool reserves");
            return false;
        }
        
        elizaLogger.info(`📊 Pool reserves - Base: ${poolReserves.baseReserve}, Quote: ${poolReserves.quoteReserve}`);
        
        // Calculate amounts
        const { baseAmount, quoteAmount, fixedSide } = calculateLiquidityAmounts(
            poolInfo,
            poolReserves,
            otherTokenBalance,
            solBalance,
            mintA,
            mintB,
            SOL_MINT,
            MIN_SOL_BALANCE,
            parsed
        );
        
        if (parseInt(baseAmount) > 0 && parseInt(quoteAmount) > 0) {
            elizaLogger.info(`💧 Adding liquidity to pool ${poolInfo.id}`);
            elizaLogger.info(`   Base amount: ${baseAmount}`);
            elizaLogger.info(`   Quote amount: ${quoteAmount}`);
            elizaLogger.info(`   Fixed side: ${fixedSide}`);
            elizaLogger.info(`   Pool symbol: ${parsed.symbol}`);
            
            const slippagePercent = 1;
            elizaLogger.info(`📊 Using ${slippagePercent}% slippage to handle price movements`);
            
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
                
                // Update tracking variables
                onSuccess(poolInfo, newPoolId, bestApy);
                
                await wait(5000, 7000);
                const lpBalance = await getUserLpBalance(connection, walletPublicKey, poolInfo.id);
                elizaLogger.info(`💎 New LP token balance: ${(parseInt(lpBalance.balance) / Math.pow(10, lpBalance.decimals)).toFixed(6)} LP tokens`);
                
                return true;
                
            } catch (firstAttemptError: any) {
                if (firstAttemptError.message?.includes('exceeds desired slippage limit')) {
                    elizaLogger.warn(`⚠️ First attempt failed due to slippage. Trying alternative approach...`);
                    
                    // Alternative approach
                    const availableSolLamports = Math.floor((solBalance - MIN_SOL_BALANCE) * 0.9 * 1e9);
                    const baseReserve = new BN(poolReserves.baseReserve);
                    const quoteReserve = new BN(poolReserves.quoteReserve);
                    const calculatedBase = new BN(availableSolLamports).mul(baseReserve).div(quoteReserve);
                    
                    elizaLogger.info(`🔄 Alternative approach: Fix SOL amount`);
                    elizaLogger.info(`   Fixed SOL amount: ${availableSolLamports / 1e9} SOL`);
                    elizaLogger.info(`   Calculated base amount: ${calculatedBase.toString()}`);
                    
                    const finalBaseAmount = BN.min(calculatedBase, new BN(otherTokenBalance)).toString();
                    
                    const txSignature = await addLiquidity(connection, {
                        poolId: poolInfo.id,
                        baseAmountIn: finalBaseAmount,
                        quoteAmountIn: availableSolLamports.toString(),
                        walletKeypair: walletKeypair,
                        slippage: slippagePercent,
                        fixedSide: 'quote'
                    });
                    
                    elizaLogger.info(`✅ Successfully added liquidity (alternative approach)!`);
                    elizaLogger.info(`🔗 Transaction: ${txSignature}`);
                    elizaLogger.info(`🌐 Explorer: https://solscan.io/tx/${txSignature}`);
                    
                    // Update tracking variables
                    onSuccess(poolInfo, newPoolId, bestApy);
                    
                    await wait(5000, 7000);
                    const lpBalance = await getUserLpBalance(connection, walletPublicKey, poolInfo.id);
                    elizaLogger.info(`💎 New LP token balance: ${(parseInt(lpBalance.balance) / Math.pow(10, lpBalance.decimals)).toFixed(6)} LP tokens`);
                    
                    return true;
                } else {
                    throw firstAttemptError;
                }
            }
        } else {
            elizaLogger.warn(`❌ Insufficient token balances to add liquidity`);
            elizaLogger.warn(`   Base amount: ${baseAmount}`);
            elizaLogger.warn(`   Quote amount: ${quoteAmount}`);
            return false;
        }
        
    } catch (error: any) {
        elizaLogger.error("❌ Error adding liquidity:", error.message);
        return false;
    }
}

// Helper to calculate liquidity amounts
function calculateLiquidityAmounts(
    poolInfo: any,
    poolReserves: any,
    otherTokenBalance: string,
    solBalance: number,
    mintA: string,
    mintB: string,
    SOL_MINT: string,
    MIN_SOL_BALANCE: number,
    parsed: any
) {
    const baseReserve = new BN(poolReserves.baseReserve);
    const quoteReserve = new BN(poolReserves.quoteReserve);
    
    elizaLogger.info(`📊 mintA: ${mintA}, mintB: ${mintB}, SOL_MINT: ${SOL_MINT}`);
    
    let baseAmount: string;
    let quoteAmount: string;
    let fixedSide: 'base' | 'quote';
    
    if (mintA === SOL_MINT) {
        elizaLogger.warn(`⚠️ Token order mismatch detected - adjusting logic`);
        baseAmount = otherTokenBalance;
        const requiredQuote = new BN(otherTokenBalance).mul(quoteReserve).div(baseReserve);
        const slippageBuffer = 1.1;
        const maxQuoteAmount = requiredQuote.muln(slippageBuffer);
        quoteAmount = maxQuoteAmount.toString();
        fixedSide = 'base';
        
        elizaLogger.info(`📊 Using ${otherTokenBalance} tokens as base (fixed)`);
    } else {
        baseAmount = otherTokenBalance;
        const requiredQuote = new BN(otherTokenBalance).mul(quoteReserve).div(baseReserve);
        const slippageBuffer = 1.1;
        const maxQuoteAmount = requiredQuote.muln(slippageBuffer);
        quoteAmount = maxQuoteAmount.toString();
        fixedSide = 'base';
        
        elizaLogger.info(`📊 Using ${parsed.symbol.split('-')[0]} as base (fixed)`);
    }
    
    return { baseAmount, quoteAmount, fixedSide };
}

// Helper to find the best pool
async function findBestPool(runtime: any, config: any) {
    elizaLogger.info("   ==============================================");
    elizaLogger.info("🚀 Getting best Raydium-amm APY from DefiLlama...");
    elizaLogger.info("   ----------------------------------------------");
    
    const { bestPoolId, bestApy, parsed } = await getBestRaydiumPoolInfo(runtime, null);
    
    if (!parsed || !parsed.symbol || !bestApy) {
        elizaLogger.warn("No valid pool found from DefiLlama");
        return null;
    }
    
    // Get mints and pool info for the best symbol
    const { mintA, mintB, poolInfo } = await getBestRaydiumPool(runtime, parsed.symbol);
    
    if (!poolInfo || !poolInfo.id) {
        elizaLogger.error('Could not find Raydium pool for symbol:', parsed.symbol);
        return null;
    }
    
    const newPoolId = poolInfo.id;
    
    // Verify this pool contains SOL/WSOL
    const connection = createSolanaConnection(settings.SOLANA_RPC_URL!);
    const containsSol = await poolContainsSol(connection, newPoolId);
    if (!containsSol) {
        elizaLogger.warn(`Pool ${newPoolId} does not contain SOL/WSOL, skipping`);
        return null;
    }
    
    return { bestPoolId, bestApy, parsed, mintA, mintB, poolInfo, newPoolId };
}

// Helper to check if we should switch pools
function shouldSwitchPool(
    currentPoolId: string | null,
    newPoolId: string,
    currentApy: number,
    bestApy: number,
    apyThreshold: number
): boolean {
    elizaLogger.info("   =====================================");
    elizaLogger.info("🚀 Checking if we should switch pools...");
    elizaLogger.info("   -------------------------------------");
    
    return !currentPoolId || 
           currentPoolId !== newPoolId || 
           (bestApy - currentApy) > apyThreshold;
}

// Helper to create Solana connection
function createSolanaConnection(rpcUrl: string): Connection {
    // Detect RPC provider type
    const isAlchemy = rpcUrl.includes('alchemy.com');
    const isHelius = rpcUrl.includes('helius-rpc.com') || rpcUrl.includes('helius.xyz');
    
    elizaLogger.info(`🌐 RPC Provider detected: ${isAlchemy ? 'Alchemy' : isHelius ? 'Helius' : 'Other'}`);
    
    // Different configurations for different providers
    if (isAlchemy) {
        // Alchemy doesn't support WebSocket, use HTTP-only configuration
        return new Connection(rpcUrl, {
            commitment: 'confirmed',
            wsEndpoint: undefined, // Explicitly disable WebSocket
            httpHeaders: {
                'solana-client': 'eliza-yield-optimizer'
            },
            disableRetryOnRateLimit: false,
            confirmTransactionInitialTimeout: 60000
        });
    } else {
        // Helius and others support WebSocket
        return new Connection(rpcUrl, {
            commitment: 'confirmed',
            httpHeaders: {
                'solana-client': 'eliza-yield-optimizer'
            }
        });
    }
}

// Helper to create wallet keypair
async function createWalletKeypair(privateKey: string, publicKey: string): Promise<Keypair> {
    if (!privateKey) {
        elizaLogger.error("SOLANA_PRIVATE_KEY not found in settings!");
        throw new Error("Wallet private key required for operations");
    }
    
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    
    // Verify wallet matches expected public key
    if (keypair.publicKey.toString() !== publicKey) {
        elizaLogger.error(`❌ Wallet mismatch! Expected: ${publicKey}, Got: ${keypair.publicKey.toString()}`);
        throw new Error("Wallet keypair does not match expected public key");
    }
    
    return keypair;
}

// Helper to execute the pool switch
async function executePoolSwitch(
    connection: Connection,
    walletKeypair: Keypair,
    config: any,
    poolInfo: any,
    mintA: string,
    mintB: string,
    parsed: any,
    newPoolId: string,
    bestApy: number,
    onSuccess: (poolInfo: any, poolId: string, apy: number) => void
): Promise<boolean> {
    try {
        // Step 1: Get current LP positions
        const positionsWithBalance = await getCurrentLPPositions(
            connection,
            config.walletPublicKey,
            settings.SOLANA_RPC_URL!
        );
        
        // Step 2: Remove liquidity from all positions
        if (positionsWithBalance.length > 0) {
            await removeAllLiquidity(connection, positionsWithBalance, walletKeypair);
        }
        
        // Step 3: Consolidate all tokens to SOL
        await consolidateAllTokensToSOL(
            connection,
            walletKeypair,
            config.TOKEN_PROGRAM_ID,
            config.SOL_MINT
        );
        
        // Step 4: Swap half SOL balance to pool token
        const swapSuccess = await swapHalfSOLToPoolToken(
            connection,
            walletKeypair,
            mintA,
            mintB,
            poolInfo,
            parsed,
            config.SOL_MINT,
            config.MIN_SOL_BALANCE
        );
        
        if (!swapSuccess) {
            elizaLogger.warn("Failed to swap SOL to pool token, skipping liquidity addition");
            return false;
        }
        
        // Step 5: Add liquidity to the new pool
        const addSuccess = await addLiquidityToPool(
            connection,
            walletKeypair,
            config.walletPublicKey,
            poolInfo,
            mintA,
            mintB,
            parsed,
            config.SOL_MINT,
            config.MIN_SOL_BALANCE,
            config.TOKEN_PROGRAM_ID,
            onSuccess,
            newPoolId,
            bestApy
        );
        
        return addSuccess;
        
    } catch (error: any) {
        elizaLogger.error("Error in pool switch:", error.message);
        return false;
    }
}

// --- Yield Optimizer Loop ---
async function startYieldOptimizerLoop(runtime: any) {
    elizaLogger.warn("*** MAINNET MODE: REAL FUNDS AT RISK! ***");
    
    // Configuration
    const config = {
        scanIntervalMs: 1 * 60 * 1000, // 5 minutes
        SOL_MINT: "So11111111111111111111111111111111111111112",
        walletPublicKey: settings.SOLANA_PUBLIC_KEY!,
        walletPrivateKey: settings.SOLANA_PRIVATE_KEY!,
        APY_IMPROVEMENT_THRESHOLD: 0.5, // percent
        MIN_SOL_BALANCE: 0.05, // Keep minimum SOL for fees
        TOKEN_PROGRAM_ID: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    };
    
    // State tracking
    let currentPoolInfo: any = null;
    let currentPoolId: string | null = null;
    let currentApy = 0;
    
    elizaLogger.info('Using public key for Raydium positions:', config.walletPublicKey);
    // Main loop
    while (true) {
        try {
            // Step 1: Find the best pool
            const bestPool = await findBestPool(runtime, config);
            if (!bestPool) {
                await wait(config.scanIntervalMs, config.scanIntervalMs + 1000);
                continue;
            }
            
            const { bestApy, parsed, mintA, mintB, poolInfo, newPoolId } = bestPool;
            
            // Step 2: Check if we should switch pools
            if (!shouldSwitchPool(currentPoolId, newPoolId, currentApy, bestApy, config.APY_IMPROVEMENT_THRESHOLD)) {
                elizaLogger.info(`Current pool ${currentPoolId} is still optimal (APY: ${currentApy}%)`);
                elizaLogger.info("💡 Ready for next yield optimization cycle (30 minutes)");
                await wait(config.scanIntervalMs, config.scanIntervalMs + 1000);
                continue;
            }
            
            elizaLogger.info(`Switching from pool ${currentPoolId} (APY: ${currentApy}%) to ${newPoolId} (APY: ${bestApy}%)`);
            
            // Step 3: Create connection and wallet
            const connection = createSolanaConnection(settings.SOLANA_RPC_URL!);
            const walletKeypair = await createWalletKeypair(config.walletPrivateKey, config.walletPublicKey);
            
            // Step 4: Execute pool switch
            const success = await executePoolSwitch(
                connection,
                walletKeypair,
                config,
                poolInfo,
                mintA,
                mintB,
                parsed,
                newPoolId,
                bestApy,
                (poolInfo, poolId, apy) => {
                    currentPoolInfo = poolInfo;
                    currentPoolId = poolId;
                    currentApy = apy;
                }
            );
            
            if (success) {
                elizaLogger.info("🏁 Yield optimizer completed: Full cycle executed!");
                elizaLogger.info("💡 Ready for next yield optimization cycle (30 minutes)");
            }
        } catch (err) {
            elizaLogger.error("Error in yield optimizer loop:");
            if (err && err.stack) {
                elizaLogger.error(err.stack);
            } else if (typeof err === "object") {
                elizaLogger.error(JSON.stringify(err, null, 2));
            } else {
                elizaLogger.error(String(err));
            }
        } finally {
            // Clear the Raydium pool cache to free up memory
            clearPoolCache();
            elizaLogger.info("🧹 Cleared Raydium pool cache to free memory");
        }
        await wait(config.scanIntervalMs, config.scanIntervalMs + 1000);
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
