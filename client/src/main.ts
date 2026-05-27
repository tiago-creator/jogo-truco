import Phaser from "phaser";
import { io, type Socket } from "socket.io-client";
import { compareCards, compareCardsWithVira, type ActionAck, type Card, type ClientToServerEvents, type RoomState, type ServerToClientEvents } from "@truco/shared";
import "./styles.css";
import opponentAvatarUrl from "./img/avatar/user-secret.svg";
import crimsonGoldCardBackUrl from "./img/cartas/crimson-gold.svg";
import blackCardBackUrl from "./img/cartas/black.svg";
import grayCardBackUrl from "./img/cartas/gray.svg";
import ivoryEmeraldCardBackUrl from "./img/cartas/ivory-emerald.svg";
import midnightPurpleCardBackUrl from "./img/cartas/midnight-purple.svg";
import royalBlueCardBackUrl from "./img/cartas/royal-blue.svg";
import arrowUpActionIconUrl from "./img/icons/arrow-up-action.svg";
import checkActionIconUrl from "./img/icons/check-action.svg";
import chevronUpHintIconUrl from "./img/icons/chevron-up-hint.svg";
import runningPlayerIconUrl from "./img/icons/running-player.svg";
import trucoRibbonUrl from "./img/faixa.svg";
import feltBurgundyUrl from "./img/table-backgrounds/felt-burgundy.png";
import feltCharcoalUrl from "./img/table-backgrounds/felt-charcoal.png";
import feltDefaultUrl from "./img/table-backgrounds/felt-default.png";
import feltEmeraldUrl from "./img/table-backgrounds/felt-emerald.png";
import feltNavyUrl from "./img/table-backgrounds/felt-navy.png";
import feltTealUrl from "./img/table-backgrounds/felt-teal.png";
import buttonClickAudioUrl from "./audio/clique-botao.mp3";
import placingCardAudioUrl from "./audio/colocando-carta-na-mesa.mp3";
import dealingCardsAudioUrl from "./audio/distribuindo-cartas-na-mesa.mp3";
import shufflingCardsAudioUrl from "./audio/embaralhar-carta.mp3";
import flipCardAudioUrl from "./audio/flip-carta.mp3";
import removingCardAudioUrl from "./audio/tirando-carta-da-mesa.mp3";
import trucoAlertAudioUrl from "./audio/alerta-truco.mp3";
import meme67Url from "./audio/memes/67.mp3";
import memeKikoUrl from "./audio/memes/a-risada-do-kiko.mp3";
import memeAiPaiUrl from "./audio/memes/ai-pai-para-hihi.mp3";
import memeMickeyUrl from "./audio/memes/ai-que-delicia-mickey.mp3";
import memeFahUrl from "./audio/memes/fahhhhhhhhhhhhhh.mp3";
import memeFogosUrl from "./audio/memes/fogos-caruaru-foguete-12x1-8.mp3";
import memeGriloUrl from "./audio/memes/grilo_1.mp3";
import memeLulaAjudaUrl from "./audio/memes/lula-por-favor-me-ajuda.mp3";
import memeNaoSobrouUrl from "./audio/memes/nao-sobrou-nada_fZprXSC.mp3";
import memeHomemMaquinaUrl from "./audio/memes/o-homem-uma-maquina-uma-besta-enjaulada.mp3";
import memeUndaiaUrl from "./audio/memes/papo-de-undaia.mp3";
import memePeidoUrl from "./audio/memes/peido.mp3";
import memeRisadaLadraoUrl from "./audio/memes/risada-de-ladrao-mp3cut.mp3";
import memeSelocoUrl from "./audio/memes/seloco-nao-compensa.mp3";
import memeSetembroUrl from "./audio/memes/setembro-vai-entrar-o-grosso-lula.mp3";
import memeTmpUrl from "./audio/memes/tmpyhr2sh8l.mp3";
import memeVouNadaUrl from "./audio/memes/vou-nada.mp3";
import memeWowUrl from "./audio/memes/wow_8.mp3";
import memeZeMangaUrl from "./audio/memes/ze-da-manga_G3QwWGi.mp3";

const memeAudios = [
  { id: "67.mp3", key: "meme-67.mp3", name: "67", url: meme67Url },
  { id: "a-risada-do-kiko.mp3", key: "meme-a-risada-do-kiko.mp3", name: "A Risada Do Kiko", url: memeKikoUrl },
  { id: "ai-pai-para-hihi.mp3", key: "meme-ai-pai-para-hihi.mp3", name: "Ai Pai Para Hihi", url: memeAiPaiUrl },
  { id: "ai-que-delicia-mickey.mp3", key: "meme-ai-que-delicia-mickey.mp3", name: "Ai Que Delicia Mickey", url: memeMickeyUrl },
  { id: "fahhhhhhhhhhhhhh.mp3", key: "meme-fahhhhhhhhhhhhhh.mp3", name: "Fahhhhhhhhhhhhhh", url: memeFahUrl },
  { id: "fogos-caruaru-foguete-12x1-8.mp3", key: "meme-fogos-caruaru-foguete-12x1-8.mp3", name: "Fogos Caruaru", url: memeFogosUrl },
  { id: "grilo_1.mp3", key: "meme-grilo_1.mp3", name: "Grilo", url: memeGriloUrl },
  { id: "lula-por-favor-me-ajuda.mp3", key: "meme-lula-por-favor-me-ajuda.mp3", name: "Lula Por Favor Me Ajuda", url: memeLulaAjudaUrl },
  { id: "nao-sobrou-nada_fZprXSC.mp3", key: "meme-nao-sobrou-nada_fZprXSC.mp3", name: "Nao Sobrou Nada", url: memeNaoSobrouUrl },
  { id: "o-homem-uma-maquina-uma-besta-enjaulada.mp3", key: "meme-o-homem-uma-maquina-uma-besta-enjaulada.mp3", name: "O Homem Uma Maquina", url: memeHomemMaquinaUrl },
  { id: "papo-de-undaia.mp3", key: "meme-papo-de-undaia.mp3", name: "Papo De Undaia", url: memeUndaiaUrl },
  { id: "peido.mp3", key: "meme-peido.mp3", name: "Peido", url: memePeidoUrl },
  { id: "risada-de-ladrao-mp3cut.mp3", key: "meme-risada-de-ladrao-mp3cut.mp3", name: "Risada De Ladrao", url: memeRisadaLadraoUrl },
  { id: "seloco-nao-compensa.mp3", key: "meme-seloco-nao-compensa.mp3", name: "Seloco Nao Compensa", url: memeSelocoUrl },
  { id: "setembro-vai-entrar-o-grosso-lula.mp3", key: "meme-setembro-vai-entrar-o-grosso-lula.mp3", name: "Setembro Vai Entrar", url: memeSetembroUrl },
  { id: "tmpyhr2sh8l.mp3", key: "meme-tmpyhr2sh8l.mp3", name: "Tmpyhr2sh8l", url: memeTmpUrl },
  { id: "vou-nada.mp3", key: "meme-vou-nada.mp3", name: "Vou Nada", url: memeVouNadaUrl },
  { id: "wow_8.mp3", key: "meme-wow_8.mp3", name: "Wow", url: memeWowUrl },
  { id: "ze-da-manga_G3QwWGi.mp3", key: "meme-ze-da-manga_G3QwWGi.mp3", name: "Ze Da Manga", url: memeZeMangaUrl }
];

type TrucoSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type PlayerProfile = {
  token: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
};
type RankingPlayer = {
  position: number;
  name: string;
  avatarUrl?: string | null;
  rankPoints: number;
  gamesPlayed: number;
  gamesWon: number;
  handsWon: number;
};
type ReliableClientEvent =
  | "card:play"
  | "truco:raise"
  | "truco:respond"
  | "eleven-hand:respond"
  | "audio:send"
  | "meme:play";
type ReliableActionPayload =
  | { roomId: string; cardId: string; faceDown?: boolean; actionId: string }
  | { roomId: string; actionId: string }
  | { roomId: string; action: "accept" | "reject" | "raise"; actionId: string }
  | { roomId: string; action: "play" | "run"; actionId: string }
  | { roomId: string; audio: ArrayBuffer; mimeType: string; actionId: string }
  | { roomId: string; memeId: string; actionId: string };
type ReliableActionInput =
  | { roomId: string; cardId: string; faceDown?: boolean }
  | { roomId: string }
  | { roomId: string; action: "accept" | "reject" | "raise" }
  | { roomId: string; action: "play" | "run" }
  | { roomId: string; audio: ArrayBuffer; mimeType: string }
  | { roomId: string; memeId: string };
type PendingReliableAction = {
  event: ReliableClientEvent;
  payload: ReliableActionPayload;
  key: string;
  attempts: number;
  retryTimer?: number;
};

const opponentAvatarPhotoSize = 122;
const opponentAvatarMaskRadius = 57;

const serverUrl = import.meta.env.VITE_SERVER_URL ?? "https://app-truco-9ddcf4b48235.herokuapp.com";
const tableBackgrounds = {
  "felt-default": { label: "Default", url: feltDefaultUrl },
  "felt-teal": { label: "Teal", url: feltTealUrl },
  "felt-emerald": { label: "Emerald", url: feltEmeraldUrl },
  "felt-navy": { label: "Navy", url: feltNavyUrl },
  "felt-burgundy": { label: "Burgundy", url: feltBurgundyUrl },
  "felt-charcoal": { label: "Charcoal", url: feltCharcoalUrl }
} as const;
const defaultTableBackground = "felt-default";
const cardBacks = {
  "ivory-emerald": { label: "Ivory", url: ivoryEmeraldCardBackUrl },
  "crimson-gold": { label: "Crimson", url: crimsonGoldCardBackUrl },
  "royal-blue": { label: "Royal", url: royalBlueCardBackUrl },
  "midnight-purple": { label: "Midnight", url: midnightPurpleCardBackUrl },
  "black": { label: "Black", url: blackCardBackUrl },
  "gray": { label: "Gray", url: grayCardBackUrl }
} as const;
const defaultCardBack = "ivory-emerald";
const tableBackgroundStorageKey = "truco-table-background";
const cardBackStorageKey = "truco-card-back";
const profileStorageKey = "truco-player-profile";
const sessionProfileStorageKey = "truco-session-profile";
const playerTokenStorageKey = "truco-player-token";

type TableBackgroundId = keyof typeof tableBackgrounds;
type CardBackId = keyof typeof cardBacks;

function isTableBackgroundId(value: string | null): value is TableBackgroundId {
  return Boolean(value && value in tableBackgrounds);
}

function isCardBackId(value: string | null): value is CardBackId {
  return Boolean(value && value in cardBacks);
}

function getSelectedTableBackground(): TableBackgroundId {
  try {
    const storedBackground = localStorage.getItem(tableBackgroundStorageKey);

    if (isTableBackgroundId(storedBackground)) {
      return storedBackground;
    }
  } catch {
    // localStorage can be blocked on some mobile browsers.
  }

  return defaultTableBackground;
}

function saveSelectedTableBackground(backgroundId: TableBackgroundId): void {
  try {
    localStorage.setItem(tableBackgroundStorageKey, backgroundId);
  } catch {
    // The current session still uses the selected value through the DOM state.
  }
}

function getSelectedCardBack(): CardBackId {
  try {
    const storedCardBack = localStorage.getItem(cardBackStorageKey);

    if (isCardBackId(storedCardBack)) {
      return storedCardBack;
    }
  } catch {
    // localStorage can be blocked on some mobile browsers.
  }

  return defaultCardBack;
}

function saveSelectedCardBack(cardBackId: CardBackId): void {
  try {
    localStorage.setItem(cardBackStorageKey, cardBackId);
  } catch {
    // The current session still uses the selected value through the DOM state.
  }
}

function createPlayerToken(): string {
  const randomUUID = globalThis.crypto?.randomUUID;

  if (randomUUID) {
    return randomUUID.call(globalThis.crypto);
  }

  return `player-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getPlayerToken(): string {
  try {
    const storedToken = localStorage.getItem(playerTokenStorageKey);

    if (storedToken) {
      return storedToken;
    }

    const newToken = createPlayerToken();

    localStorage.setItem(playerTokenStorageKey, newToken);
    return newToken;
  } catch {
    return createPlayerToken();
  }
}

function savePlayerToken(token: string): void {
  playerToken = token;

  try {
    localStorage.setItem(playerTokenStorageKey, token);
  } catch {
    // The current page session still keeps the token in memory.
  }
}

let playerToken = getPlayerToken();
let pendingProfileEmail = "";
let currentPlayerProfile: PlayerProfile | null = loadSessionProfile();

function loadSessionProfile(): PlayerProfile | null {
  try {
    const rawProfile = sessionStorage.getItem(sessionProfileStorageKey);

    if (!rawProfile) {
      return null;
    }

    const profile = JSON.parse(rawProfile) as PlayerProfile;

    if (profile.token) {
      savePlayerToken(profile.token);
    }

    return profile;
  } catch {
    return null;
  }
}

function loadStoredProfile(): PlayerProfile | null {
  try {
    const rawProfile = localStorage.getItem(profileStorageKey);

    if (!rawProfile) {
      return null;
    }

    const profile = JSON.parse(rawProfile) as PlayerProfile;

    return profile.token === playerToken ? profile : null;
  } catch {
    return null;
  }
}

function saveStoredProfile(profile: PlayerProfile): void {
  currentPlayerProfile = profile;
  savePlayerToken(profile.token);

  try {
    localStorage.setItem(profileStorageKey, JSON.stringify(profile));
    sessionStorage.setItem(sessionProfileStorageKey, JSON.stringify(profile));
  } catch {
    // The server profile remains the source of truth.
  }
}

function getCurrentPlayerName(): string {
  return currentPlayerProfile?.name ?? `Jogador ${Math.floor(Math.random() * 900 + 100)}`;
}

async function fetchPlayerProfile(): Promise<PlayerProfile | null> {
  const response = await fetch(`${serverUrl}/profile/${encodeURIComponent(playerToken)}`);

  if (!response.ok) {
    return currentPlayerProfile;
  }

  const payload = await response.json() as { profile: PlayerProfile | null };

  if (payload.profile) {
    saveStoredProfile(payload.profile);
  }

  return payload.profile ?? currentPlayerProfile;
}

let sharedAudioContext: AudioContext | null = null;
let audioPlaybackUnlocked = false;

function getSharedAudioContext(): AudioContext {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("AudioContext nao suportado");
  }

  sharedAudioContext ??= new AudioContextConstructor();
  return sharedAudioContext;
}

async function unlockAudioPlayback(): Promise<void> {
  const context = getSharedAudioContext();

  if (context.state === "suspended") {
    await context.resume();
  }

  if (audioPlaybackUnlocked) {
    return;
  }

  const buffer = context.createBuffer(1, 1, context.sampleRate);
  const source = context.createBufferSource();

  source.buffer = buffer;
  source.connect(context.destination);
  source.start(0);
  audioPlaybackUnlocked = true;
}

async function playIncomingAudio(audio: ArrayBuffer): Promise<void> {
  const context = getSharedAudioContext();

  if (context.state === "suspended") {
    await context.resume();
  }

  const audioBuffer = await context.decodeAudioData(audio.slice(0));
  const source = context.createBufferSource();

  source.buffer = audioBuffer;
  source.connect(context.destination);
  source.start();
}

function mergeAudioChunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;

  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));

    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

class WavAudioRecorder {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private sampleRate = 44100;

  async start(): Promise<void> {
    this.cancel();
    await unlockAudioPlayback();

    this.context = getSharedAudioContext();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    this.source = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(4096, 1, 1);
    this.sampleRate = this.context.sampleRate;
    this.chunks = [];

    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const output = event.outputBuffer.getChannelData(0);

      output.fill(0);
      this.chunks.push(new Float32Array(input));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  stop(): ArrayBuffer | null {
    const chunks = this.chunks;

    this.disconnect();

    if (chunks.length === 0) {
      return null;
    }

    return encodeWav(mergeAudioChunks(chunks), this.sampleRate);
  }

  cancel(): void {
    this.disconnect();
  }

  private disconnect(): void {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.chunks = [];
  }
}

class TableScene extends Phaser.Scene {
  private socket!: TrucoSocket;
  private roomState: RoomState | null = null;
  private previousRoomState: RoomState | null = null;
  private hasReceivedRoomState = false;
  private suppressNextStateEffects = false;
  private animatingTableCardIds = new Set<string>();
  private animatingHandCardIds = new Set<string>();
  private revealedDealCardIds = new Set<string>();
  private faceDownHandCardIds = new Set<string>();
  private pendingFaceDownTableCardIds = new Set<string>();
  private pendingReliableActions = new Map<string, PendingReliableAction>();
  private pendingReliableActionKeys = new Set<string>();
  private handCardObjects = new Map<string, { container: Phaser.GameObjects.Container; signature: string }>();
  private tableCardObjects = new Map<string, { container: Phaser.GameObjects.Container; signature: string }>();
  private roomId = "";
  private playerName = getCurrentPlayerName();
  private statusBg!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;
  private statusName!: Phaser.GameObjects.Text;
  private turnProgress!: Phaser.GameObjects.Graphics;
  private statusBoxRect = { x: 0, y: 0, width: 0, height: 0 };
  private statusCenterX = 0;
  private statusCenterY = 0;
  private scoreboardGroup!: Phaser.GameObjects.Container;
  private trucoButton!: Phaser.GameObjects.Container;
  private trucoButtonBg!: Phaser.GameObjects.Graphics;
  private trucoButtonText!: Phaser.GameObjects.Text;
  private trucoButtonSmallText!: Phaser.GameObjects.Text;
  private trucoButtonHitZone!: Phaser.GameObjects.Zone;
  private trucoButtonIsShown = false;
  private trucoButtonVisibilityTween: Phaser.Tweens.Tween | null = null;
  private trucoResponseGroup!: Phaser.GameObjects.Container;
  private trucoResponseTitle!: Phaser.GameObjects.Text;
  private trucoResponsePlayerName!: Phaser.GameObjects.Text;
  private trucoResponseSubtitle!: Phaser.GameObjects.Text;
  private trucoResponseRaiseText!: Phaser.GameObjects.Text;
  private trucoResponseProgress!: Phaser.GameObjects.Graphics;
  private elevenHandGroup!: Phaser.GameObjects.Container;
  private handGroup!: Phaser.GameObjects.Container;
  private handHintGroup!: Phaser.GameObjects.Container;
  private opponentHandGroup!: Phaser.GameObjects.Container;
  private opponentAvatarGroup!: Phaser.GameObjects.Container;
  private opponentNameGroup!: Phaser.GameObjects.Container;
  private opponentAvatarImage!: Phaser.GameObjects.Image;
  private opponentAvatarMaskShape!: Phaser.GameObjects.Graphics;
  private opponentNameBox!: Phaser.GameObjects.Graphics;
  private opponentNameText!: Phaser.GameObjects.Text;
  private opponentTurnProgress!: Phaser.GameObjects.Graphics;
  private opponentFootMarker!: Phaser.GameObjects.Container;
  private selfFootMarker!: Phaser.GameObjects.Container;
  private currentOpponentAvatarUrl: string | null = null;
  private deckGroup!: Phaser.GameObjects.Container;
  private viraGroup!: Phaser.GameObjects.Container;
  private tableGroup!: Phaser.GameObjects.Container;
  private tableBackground!: Phaser.GameObjects.Image;
  private lastAnimatedTrucoValue: number | null = null;
  private delayedTrucoResponseKey: string | null = null;
  private visibleTrucoResponseKey: string | null = null;
  private trucoResponseDelayTimer: Phaser.Time.TimerEvent | null = null;
  private lastCelebratedGameWinnerKey: string | null = null;
  private activeDealAnimationKey: string | null = null;
  private animatingViraHandSequence: number | null = null;
  private lastShownTrucoResponseKey: string | null = null;
  private exitButton!: Phaser.GameObjects.Container;
  private exitButtonBg!: Phaser.GameObjects.Graphics;
  private audioButton!: Phaser.GameObjects.Container;
  private audioButtonBg!: Phaser.GameObjects.Graphics;
  private audioButtonText!: Phaser.GameObjects.Text;
  private audioButtonHint!: Phaser.GameObjects.Text;
  private memeButton!: Phaser.GameObjects.Container;
  private memeButtonBg!: Phaser.GameObjects.Graphics;
  private quickActionButton!: Phaser.GameObjects.Container;
  private quickActionButtonBg!: Phaser.GameObjects.Graphics;
  private quickActionMenu!: Phaser.GameObjects.Container;
  private quickActionMenuBg!: Phaser.GameObjects.Graphics;
  private quickActionOutsideZone!: Phaser.GameObjects.Zone;
  private memePopup!: Phaser.GameObjects.Container;
  private memePopupIgnoreClicksUntil = 0;
  private audioRecorder = new WavAudioRecorder();
  private isRecordingAudio = false;
  private audioRecordingSession = 0;
  private audioStopTimer: Phaser.Time.TimerEvent | null = null;
  private readonly turnTimeoutMs = 30000;
  private turnTimerKey: string | null = null;
  private turnTimerStartedAt = 0;
  private autoPlayTriggeredForKey: string | null = null;
  private readonly trucoResponseTimeoutMs = 20000;
  private trucoResponseTimerKey: string | null = null;
  private trucoResponseTimerStartedAt = 0;
  private autoRejectTrucoTriggeredForKey: string | null = null;
  constructor() {
    super("table");
  }

  
  preload(): void {
    for (const [backgroundId, background] of Object.entries(tableBackgrounds)) {
      this.load.image(backgroundId, background.url);
    }

    for (const [cardBackId, cardBack] of Object.entries(cardBacks)) {
      this.load.image(cardBackId, cardBack.url);
    }
    this.load.image("opponent-avatar", opponentAvatarUrl);
    this.load.image("arrow-up-action-icon", arrowUpActionIconUrl);
    this.load.image("check-action-icon", checkActionIconUrl);
    this.load.image("chevron-up-hint-icon", chevronUpHintIconUrl);
    this.load.image("running-player-icon", runningPlayerIconUrl);
    this.load.image("truco-ribbon", trucoRibbonUrl);
    this.load.audio("button-click", buttonClickAudioUrl);
    this.load.audio("card-place", placingCardAudioUrl);
    this.load.audio("cards-deal", dealingCardsAudioUrl);
    this.load.audio("cards-shuffle", shufflingCardsAudioUrl);
    this.load.audio("card-flip", flipCardAudioUrl);
    this.load.audio("card-remove", removingCardAudioUrl);
    this.load.audio("truco-alert", trucoAlertAudioUrl);
    for (const meme of memeAudios) {
      this.load.audio(meme.key, meme.url);
    }

  }

  create(): void {
    this.cameras.main.setBackgroundColor("#12372a");
    this.cameras.main.roundPixels = true;
    this.game.canvas.style.imageRendering = "auto";
    this.tableBackground = this.add.image(0, 0, currentTableBackground)
      .setOrigin(0.5)
      .setDepth(-100);
    this.socket = io(serverUrl, {
      transports: ["websocket"]
    });
    this.input.dragDistanceThreshold = 6;

    this.statusBg = this.add.graphics();
    this.turnProgress = this.add.graphics();
    this.status = this.add.text(0, 0, "Conectando...", {
      color: "#f8f1d9",
      fontFamily: "Arial",
      fontSize: "20px"
    }).setOrigin(0.5);
    this.statusName = this.add.text(0, 0, "", {
      color: "#ffcf5a",
      fontFamily: "Arial",
      fontSize: "20px",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.statusBg.setDepth(89);
    this.turnProgress.setDepth(89.5);
    this.status.setDepth(90);
    this.statusName.setDepth(90);
    this.statusName.setVisible(false);

    this.scoreboardGroup = this.add.container(0, 0);

    //#region Truco Button
    this.trucoButtonHitZone = this.add.zone(0, 0, 150, 160);
    this.trucoButtonBg = this.add.graphics();
    this.trucoButtonSmallText = this.add.text(0, 0, "PEDIR", {
      color: "#5f3900",
      fontFamily: "Arial",
      fontSize: "17px",
      fontStyle: "900"
    }).setOrigin(0.5);
    this.trucoButtonText = this.add.text(0, 0, "TRUCO", {
      color: "#5f3900",
      fontFamily: "Arial",
      fontSize: "23px",
      fontStyle: "900"
    }).setOrigin(0.5);
    this.trucoButton = this.add.container(0, 0, [
      this.trucoButtonBg,
      this.trucoButtonSmallText,
      this.trucoButtonText
    ]);
    this.trucoButton.setVisible(false);
    this.trucoButton.setAlpha(0);
    this.trucoButton.setScale(0.82);
    this.trucoButtonHitZone.on("pointerup", () => {
      const state = this.roomState;

      if (state && this.canRaiseTruco()) {
        this.playButtonClickSound();
        this.sendReliableAction("truco:raise", { roomId: this.roomId });
        const value = {
          1: "TRUCO",
          3: "SEIS",
          6: "NOVE",
          9: "DOZE",
          12: "DOZE"
        }[state.handValue] ?? "TRUCO";
        this.playGameSound("truco-alert", 0.82);
        this.playTrucoRaiseAnimation(state.self?.name ?? "Jogador",
          value);

      }
    });
    //#endregion

    this.trucoResponseGroup = this.createTrucoResponseGroup();
    this.elevenHandGroup = this.createElevenHandGroup();

    //#region Exit Button
this.exitButtonBg = this.add.graphics();

this.exitButton = this.add.container(0, 0, [
  this.exitButtonBg
]);

this.drawExitButton();

const exitButtonHitZone = this.add.zone(0, 0, 86, 86);

this.exitButton.add(exitButtonHitZone);
this.exitButton.setSize(86, 86);

exitButtonHitZone.setInteractive({ useHandCursor: true });
exitButtonHitZone.on("pointerup", () => {
  this.playButtonClickSound();
  this.leaveTable();
});
//#endregion

    //#region Audio Button
    this.audioButtonBg = this.add.graphics();
    this.audioButtonHint = this.add.text(-92, 0, "🎙", {
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: "34px"
    }).setOrigin(0.5);
    this.audioButtonText = this.add.text(30, 0, "ENVIAR AUDIO", {
      align: "center",
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: "17px",
      fontStyle: "bold",
      lineSpacing: 2
    }).setOrigin(0.5);
    this.audioButton = this.add.container(0, 0, [
      this.audioButtonBg,
      this.audioButtonHint,
      this.audioButtonText
    ]);
    const audioButtonHitZone = this.add.zone(0, 0, 268, 92);

    this.audioButton.add(audioButtonHitZone);
    this.audioButton.setSize(260, 82);
    audioButtonHitZone.setInteractive({ useHandCursor: true });
    audioButtonHitZone.on("pointerdown", () => {
      this.playButtonClickSound();
      void this.startAudioRecording();
    });
    audioButtonHitZone.on("pointerup", () => {
      void this.stopAudioRecording();
    });
    audioButtonHitZone.on("pointerout", () => {
      void this.stopAudioRecording();
    });
    this.drawAudioButton();
    //#endregion

    this.memeButton = this.createMemeButton();
    this.quickActionMenu = this.createQuickActionMenu();
    this.quickActionButton = this.createQuickActionButton();
    this.memePopup = this.createMemePopup();

    this.handGroup = this.add.container(0, 0);
    this.handHintGroup = this.createHandHintGroup();
    this.handGroup.add(this.handHintGroup);
    this.selfFootMarker = this.createFootMarker();
    this.handGroup.add(this.selfFootMarker);
    this.opponentHandGroup = this.add.container(0, 0);
    this.opponentAvatarGroup = this.createOpponentAvatar();
    this.deckGroup = this.add.container(0, 0);
    this.viraGroup = this.add.container(0, 0);
    this.tableGroup = this.add.container(0, 0);
    this.opponentHandGroup.setDepth(9);
    this.opponentNameGroup.setDepth(10);
    this.viraGroup.setDepth(8);
    this.deckGroup.setDepth(12);
    this.tableGroup.setDepth(20);
    this.handGroup.setDepth(95);
    this.trucoButton.setDepth(100);
    this.trucoButtonHitZone.setDepth(101);
    this.audioButton.setDepth(100);
    this.memeButton.setDepth(100);
    this.quickActionMenu.setDepth(118);
    this.quickActionButton.setDepth(119);
    this.memePopup.setDepth(240);
    this.exitButton.setDepth(100);

    this.socket.on("connect", () => {
     if (this.hasReceivedRoomState) {
       this.suppressNextStateEffects = true;
     }
     this.socket.emit("room:join", {
  roomId: this.roomId,
  name: this.playerName,
  token: playerToken
});
    });

    this.socket.on("room:state", (state) => {
      const previousState = this.hasReceivedRoomState ? this.roomState : null;
      const suppressStateEffects = this.suppressNextStateEffects;

      this.suppressNextStateEffects = false;
      this.previousRoomState = previousState;
      this.roomState = state;
      this.hasReceivedRoomState = true;
      this.roomId = state.roomId;
      this.syncFaceDownHandCards();
      if (!suppressStateEffects) {
        this.playTableClearSoundIfNeeded(state);
      }

      if (state.status === "waiting") {
        showWaitingRoom(state.message);
      }

      if (state.status === "playing") {
        showGameTable();
      }

      if (!state.lastTrucoRaise) {
        this.lastAnimatedTrucoValue = null;
      }

      const trucoResponse = state.lastTrucoResponse;
      const trucoResponseKey = trucoResponse
        ? `${trucoResponse.playerId}:${trucoResponse.action}:${trucoResponse.requestedValue}`
        : null;

      if (!trucoResponse || !trucoResponseKey) {
        this.lastShownTrucoResponseKey = null;
      } else if (suppressStateEffects) {
        this.lastShownTrucoResponseKey = trucoResponseKey;
      } else if (
        trucoResponse.playerId !== state.self?.id &&
        this.lastShownTrucoResponseKey !== trucoResponseKey
      ) {
        this.lastShownTrucoResponseKey = trucoResponseKey;
        this.showOpponentSpeechBubble(this.getTrucoResponseMessage(trucoResponse.action));
      }

      const gameWinnerKey = state.lastGameWinnerId
        ? `${state.lastGameWinnerId}:${state.lastGameWinnerSequence ?? 0}:${state.lastGameWinnerName ?? ""}`
        : null;
      const previousGameWinnerKey = previousState?.lastGameWinnerId
        ? `${previousState.lastGameWinnerId}:${previousState.lastGameWinnerSequence ?? 0}:${previousState.lastGameWinnerName ?? ""}`
        : null;

      if (!gameWinnerKey) {
        this.lastCelebratedGameWinnerKey = null;
      } else if (suppressStateEffects) {
        this.lastCelebratedGameWinnerKey = gameWinnerKey;
      } else if (
        previousState &&
        previousGameWinnerKey !== gameWinnerKey &&
        state.lastGameWinnerId === state.self?.id &&
        this.lastCelebratedGameWinnerKey !== gameWinnerKey
      ) {
        this.lastCelebratedGameWinnerKey = gameWinnerKey;
        this.playGameWinAnimation();
      }

      const pendingTrucoResponseKey = this.getTrucoResponseKey(state);

      if (!state.trucoRequest) {
        this.delayedTrucoResponseKey = null;
        this.visibleTrucoResponseKey = null;
        this.trucoResponseDelayTimer?.remove(false);
        this.trucoResponseDelayTimer = null;
        this.clearTrucoResponseTimer();
      }

      // animação do truco do oponente
      if (
        !suppressStateEffects &&
        state.lastTrucoRaise &&
        state.lastTrucoRaise.playerId !== state.self?.id &&
        this.lastAnimatedTrucoValue !== state.lastTrucoRaise.value
      ) {
        this.lastAnimatedTrucoValue = state.lastTrucoRaise.value;

        this.playGameSound("truco-alert", 0.82);
        const trucoAnimationDuration = this.playTrucoRaiseAnimation(
          state.lastTrucoRaise.playerName,
          {
            1: "TRUCO",
            3: "TRUCO",
            6: "SEIS",
            9: "NOVE",
            12: "DOZE"
          }[state.lastTrucoRaise.value] ?? "TRUCO"
        );
          this.showOpponentSpeechBubble(
  {
    1: "TRUCO!",
    3: "TRUCO!",
    6: "SEIS!",
    9: "NOVE!",
    12: "DOZE!"
  }[state.lastTrucoRaise.value] ?? "TRUCO!"
);

        if (pendingTrucoResponseKey) {
          this.delayTrucoResponseOptions(pendingTrucoResponseKey, trucoAnimationDuration);
        }
      }

      if (suppressStateEffects && state.lastTrucoRaise) {
        this.lastAnimatedTrucoValue = state.lastTrucoRaise.value;
      }

      if (!suppressStateEffects) {
        this.animateDealIfNeeded();
        this.animateOpponentPlayIfNeeded();
      }
      this.renderState();
      this.syncTurnTimer();
      this.flushPendingReliableActions();
    });

    this.socket.on("room:error", ({ message }) => {
      this.setStatusMessage(message);

      if (this.roomState?.status !== "playing") {
        showWaitingRoom(message);
      }
    });

    this.socket.on("audio:message", ({ playerName, audio }) => {
      this.showOpponentSpeechBubble(`${playerName}: audio`);
      void playIncomingAudio(audio).catch(() => {
        this.setStatusMessage("Toque uma vez na tela para liberar o audio");
      });
    });

    this.socket.on("meme:play", ({ memeId }, ack) => {
      const didPlay = this.playMeme(memeId);

      this.showOpponentSpeechBubble("audio meme...");
      ack?.({
        ok: didPlay,
        message: didPlay ? undefined : "Audio meme indisponivel"
      });
    });

    this.scale.on("resize", () => this.layout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clearTurnTimer());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.clearTurnTimer());
    this.sharpenExistingTexts();
    this.layout();
  }

  private getTextResolution(): number {
    return Phaser.Math.Clamp((window.devicePixelRatio || 1) * 1.75, 2, 4);
  }

  private createReliableActionId(): string {
    const randomUUID = globalThis.crypto?.randomUUID;

    if (randomUUID) {
      return randomUUID.call(globalThis.crypto);
    }

    return `action-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

  private getReliableActionKey(event: ReliableClientEvent, payload: ReliableActionPayload): string {
    if (event === "card:play" && "cardId" in payload) {
      return `${event}:${payload.roomId}:${payload.cardId}`;
    }

    if ((event === "truco:respond" || event === "eleven-hand:respond") && "action" in payload) {
      return `${event}:${payload.roomId}:${payload.action}`;
    }

    if (event === "meme:play" && "memeId" in payload) {
      return `${event}:${payload.roomId}:${payload.memeId}`;
    }

    return `${event}:${payload.roomId}`;
  }

  private sendReliableAction(event: ReliableClientEvent, payload: ReliableActionInput): boolean {
    const payloadWithId = {
      ...payload,
      actionId: this.createReliableActionId()
    } as ReliableActionPayload;
    const key = this.getReliableActionKey(event, payloadWithId);

    if (this.pendingReliableActionKeys.has(key)) {
      this.setStatusMessage("Enviando acao...");
      return false;
    }

    const pendingAction: PendingReliableAction = {
      event,
      payload: payloadWithId,
      key,
      attempts: 0
    };

    this.pendingReliableActions.set(payloadWithId.actionId, pendingAction);
    this.pendingReliableActionKeys.add(key);
    this.flushReliableAction(pendingAction);
    return true;
  }

  private flushPendingReliableActions(): void {
    for (const pendingAction of this.pendingReliableActions.values()) {
      this.flushReliableAction(pendingAction);
    }
  }

  private flushReliableAction(pendingAction: PendingReliableAction): void {
    if (!this.socket.connected || !this.roomId) {
      this.scheduleReliableActionRetry(pendingAction);
      return;
    }

    window.clearTimeout(pendingAction.retryTimer);
    pendingAction.attempts += 1;

    const reliableSocket = this.socket as unknown as {
      timeout: (milliseconds: number) => {
        emit: (
          event: string,
          payload: ReliableActionPayload,
          callback: (error: Error | null, response?: ActionAck) => void
        ) => void;
      };
    };

    reliableSocket.timeout(2500).emit(pendingAction.event, pendingAction.payload, (error, response) => {
      if (error || !response) {
        this.scheduleReliableActionRetry(pendingAction);
        return;
      }

      this.pendingReliableActions.delete(pendingAction.payload.actionId);
      this.pendingReliableActionKeys.delete(pendingAction.key);
      window.clearTimeout(pendingAction.retryTimer);

      if (!response.ok) {
        this.setStatusMessage(response.message ?? "Acao nao realizada");
      }
    });
  }

  private scheduleReliableActionRetry(pendingAction: PendingReliableAction): void {
    window.clearTimeout(pendingAction.retryTimer);

    const delay = Math.min(1000 + pendingAction.attempts * 600, 4000);

    pendingAction.retryTimer = window.setTimeout(() => {
      this.flushReliableAction(pendingAction);
    }, delay);
  }

  private clearReliableActions(): void {
    for (const pendingAction of this.pendingReliableActions.values()) {
      window.clearTimeout(pendingAction.retryTimer);
    }

    this.pendingReliableActions.clear();
    this.pendingReliableActionKeys.clear();
  }

  private sharpenText<T extends Phaser.GameObjects.Text>(text: T): T {
    const resolution = this.getTextResolution();

    if (text.getData("sharpResolution") !== resolution) {
      text.setResolution(resolution);
      text.setData("sharpResolution", resolution);
    }

    return text;
  }

  private sharpenExistingTexts(): void {
    this.children.each((child) => {
      this.sharpenTextsInGameObject(child);
    });
  }

  private sharpenTextsInGameObject(gameObject: Phaser.GameObjects.GameObject): void {
    if (gameObject instanceof Phaser.GameObjects.Text) {
      this.sharpenText(gameObject);
      return;
    }

    if (gameObject instanceof Phaser.GameObjects.Container) {
      for (const child of gameObject.list) {
        this.sharpenTextsInGameObject(child as Phaser.GameObjects.GameObject);
      }
    }
  }

  private playGameSound(key: string, volume = 0.8): boolean {
    if (!this.sound.get(key) && !this.cache.audio.exists(key)) {
      return false;
    }

    try {
      const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager | Phaser.Sound.HTML5AudioSoundManager;
      const audioContext = "context" in soundManager ? soundManager.context : null;

      if (audioContext?.state === "suspended") {
        void audioContext.resume()
          .then(() => {
            this.sound.play(key, { volume });
          })
          .catch(() => undefined);
        return true;
      }

      this.sound.play(key, { volume });
      return true;
    } catch {
      // Audio playback can still be blocked until the first user interaction.
      return false;
    }
  }

  private playButtonClickSound(): void {
    this.playGameSound("button-click", 0.65);
  }

  private createFootMarker(): Phaser.GameObjects.Container {
    const marker = this.add.container(0, 0);
    const bg = this.add.circle(0, 0, 19, 0x000000, 0.92)
      .setStrokeStyle(2, 0xffcf5a, 1);
    const icon = this.add.text(0, 0, "🦶", {
      fontFamily: "Arial",
      fontSize: "22px"
    }).setOrigin(0.5);

    marker.add([bg, icon]);
    marker.setSize(38, 38);
    marker.setDepth(80);
    marker.setVisible(false);
    return marker;
  }

  private drawExitButton(): void {
    const g = this.exitButtonBg;

    g.clear();

    const width = 82;
    const height = 82;
    const left = -width / 2;
    const top = -height / 2;
    const radius = 14;

    g.fillStyle(0x000000, 0.34);
    g.fillRoundedRect(left + 2, top + 3, width, height, radius);
    g.fillStyle(0x020403, 0.88);
    g.fillRoundedRect(left, top, width, height, radius);
    g.lineStyle(1.2, 0x3d250d, 0.34);
    g.strokeRoundedRect(left, top, width, height, radius);
    g.lineStyle(0.7, 0xffe8a8, 0.74);
    g.strokeRoundedRect(left, top, width, height, radius);
    g.lineStyle(0.3, 0xfff6d8, 0.42);
    g.strokeRoundedRect(left + 2, top + 2, width - 4, height - 4, radius - 3);

    g.lineStyle(6.2, 0xd8c89d, 0.95);
    g.lineBetween(-12, -12, 12, 12);
    g.lineBetween(12, -12, -12, 12);
    g.fillStyle(0xd8c89d, 0.95);
    g.fillCircle(-12, -12, 3.1);
    g.fillCircle(12, 12, 3.1);
    g.fillCircle(12, -12, 3.1);
    g.fillCircle(-12, 12, 3.1);
  }

  leaveTable(): void {
    this.clearReliableActions();
    this.audioRecorder.cancel();
    this.audioStopTimer?.remove(false);
    this.audioStopTimer = null;
    this.isRecordingAudio = false;
    this.audioRecordingSession += 1;

    const currentSocket = this.socket;
    const leaveRoomId = this.roomId;
    let didDisconnect = false;
    const disconnectSocket = () => {
      if (didDisconnect) {
        return;
      }

      didDisconnect = true;
      currentSocket.disconnect();
    };

    if (this.roomState && leaveRoomId) {
      this.socket.emit("room:leave", {
        roomId: leaveRoomId
      }, () => {
        disconnectSocket();
      });
      window.setTimeout(disconnectSocket, 1200);
    } else {
      disconnectSocket();
    }

    this.roomId = "";
    this.roomState = null;
    this.previousRoomState = null;
    this.lastAnimatedTrucoValue = null;
    this.faceDownHandCardIds.clear();
    this.pendingFaceDownTableCardIds.clear();
    this.clearCachedCardObjects();

    returnToMainMenu();
  }

  private drawAudioButton(): void {
    const g = this.audioButtonBg;
    const recording = this.isRecordingAudio;

    this.drawFlatQuickActionButton(g, recording ? 0x5a1515 : 0x050505, 260, 82);
    this.audioButtonText.setText(recording ? "SOLTE AUDIO" : "ENVIAR AUDIO");
    this.audioButtonHint.setText(recording ? "●" : "🎙");
    this.audioButtonHint.setColor(recording ? "#ffddd8" : "#ffffff");
  }

  private drawQuickActionButton(
    g: Phaser.GameObjects.Graphics,
    colors: {
      topLeft: number;
      topRight: number;
      bottomLeft: number;
      bottomRight: number;
      border: number;
      fill: number;
    },
    width = 126,
    height = 58
  ): void {
    const x = -width / 2;
    const y = -height / 2;
    const radius = height <= 36 ? 7 : 12;

    g.clear();
    g.fillStyle(colors.bottomLeft, 1);
    g.fillRoundedRect(x, y, width, height, radius);

    const steps = 18;
    const getRoundedInset = (localY: number): number => {
      if (localY < radius) {
        return radius - Math.sqrt(Math.max(0, radius * radius - (radius - localY) ** 2));
      }

      if (localY > height - radius) {
        return radius - Math.sqrt(Math.max(0, radius * radius - (localY - (height - radius)) ** 2));
      }

      return 0;
    };

    for (let index = 0; index < steps; index += 1) {
      const lineY = y + (height / steps) * index;
      const lineHeight = Math.ceil(height / steps) + 1;
      const localTop = Math.max(0, lineY - y);
      const localBottom = Math.min(height, localTop + lineHeight);
      const topInset = getRoundedInset(localTop);
      const bottomInset = getRoundedInset(localBottom);
      const inset = localTop < radius ? Math.max(topInset-3.9, bottomInset+3.1) : Math.max(topInset, bottomInset);
      const edgeAllowance = localTop < radius ? 1.8 : 0.8;
      const adjustedInset = Math.max(0, inset - edgeAllowance);
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(colors.topLeft),
        Phaser.Display.Color.ValueToColor(colors.bottomLeft),
        steps - 1,
        index
      );

      g.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
      g.fillRect(x + adjustedInset, lineY, width - adjustedInset * 2, lineHeight);
    }

    g.fillStyle(colors.fill, 0.18);
    g.fillRoundedRect(x, y, width, height, radius);
    g.lineStyle(1.2, colors.border, 0.82);
    g.strokeRoundedRect(x, y, width, height, radius);
  }

  private createMemeButton(): Phaser.GameObjects.Container {
    const bg = this.add.graphics();
    const icon = this.add.text(-92, 0, "😄", {
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: "33px"
    }).setOrigin(0.5);
    const title = this.add.text(30, 0, "ENVIAR MEME", {
      align: "center",
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: "17px",
      fontStyle: "bold",
      lineSpacing: 2
    }).setOrigin(0.5);
    const hitZone = this.add.zone(0, 0, 268, 92);
    const button = this.add.container(0, 0, [bg, icon, title, hitZone]);

    this.memeButtonBg = bg;
    this.drawMemeButton();
    button.setSize(260, 82);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on("pointerup", () => {
      this.playButtonClickSound();
      const shouldOpen = !this.memePopup.visible;

      if (shouldOpen) {
        this.memePopupIgnoreClicksUntil = this.time.now + 220;
      }

      this.setQuickActionMenuVisible(false);
      this.memePopup.setVisible(shouldOpen);
    });

    return button;
  }

  private drawFlatQuickActionButton(
    g: Phaser.GameObjects.Graphics,
    fill: number,
    width: number,
    height: number
  ): void {
    const radius = 8;

    g.clear();
    g.fillStyle(fill, 0.96);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
  }

  private createQuickActionMenu(): Phaser.GameObjects.Container {
    this.quickActionMenuBg = this.add.graphics();
    this.audioButton.setPosition(0, -43);
    this.memeButton.setPosition(0, 43);
    this.quickActionOutsideZone = this.add.zone(0, 0, this.getViewWidth(), this.getViewHeight());
    this.quickActionOutsideZone.setOrigin(0);
    this.quickActionOutsideZone.setInteractive({ useHandCursor: false });
    this.quickActionOutsideZone.on("pointerup", () => {
      this.setQuickActionMenuVisible(false);
    });
    const menu = this.add.container(0, 0, [
      this.quickActionOutsideZone,
      this.quickActionMenuBg,
      this.audioButton,
      this.memeButton
    ]);

    menu.setVisible(false);
    this.drawQuickActionMenu();

    return menu;
  }

  private drawQuickActionMenu(): void {
    const g = this.quickActionMenuBg;

    g.clear();
    g.fillStyle(0x000000, 0.34);
    g.fillRoundedRect(-133, -94, 266, 188, 13);
    g.fillStyle(0x050505, 0.92);
    g.fillRoundedRect(-135, -96, 266, 188, 13);
    g.lineStyle(1.1, 0xffcf5a, 0.72);
    g.strokeRoundedRect(-135, -96, 266, 188, 13);
    g.lineStyle(0.8, 0xffffff, 0.12);
    g.lineBetween(-120, 0, 120, 0);
  }

  private createQuickActionButton(): Phaser.GameObjects.Container {
    this.quickActionButtonBg = this.add.graphics();
    const hitZone = this.add.zone(0, 0, 112, 112);
    const button = this.add.container(0, 0, [this.quickActionButtonBg, hitZone]);

    this.drawQuickActionToggleButton(false);
    button.setSize(110, 110);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on("pointerup", () => {
      this.playButtonClickSound();
      this.setQuickActionMenuVisible(!this.quickActionMenu.visible);
    });

    return button;
  }

  private setQuickActionMenuVisible(visible: boolean): void {
    this.quickActionMenu.setVisible(visible);
    this.drawQuickActionToggleButton(visible);
  }

  private drawQuickActionToggleButton(active: boolean): void {
    const g = this.quickActionButtonBg;

    g.clear();
    if (active) {
      g.fillStyle(0xffcf5a, 0.26);
      g.fillCircle(0, 0, 55);
    }
    g.fillStyle(0x050505, 0.94);
    g.fillCircle(0, 0, 45);
    if (active) {
      g.lineStyle(4, 0xffcf5a, 0.95);
      g.strokeCircle(0, 0, 45);
      g.lineStyle(1, 0xffffff, 0.18);
      g.strokeCircle(0, 0, 36);
    } else {
      g.lineStyle(1.2, 0x3d250d, 0.34);
      g.strokeCircle(0, 0, 45);
      g.lineStyle(0.7, 0xffe8a8, 0.74);
      g.strokeCircle(0, 0, 45);
    }
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(-22, -14, 44, 28, 11);
    g.fillTriangle(-9, 12, -18, 23, 6, 14);
    g.fillStyle(0x050505, 0.92);
    g.fillCircle(-10, 0, 2.6);
    g.fillCircle(0, 0, 2.6);
    g.fillCircle(10, 0, 2.6);
  }

  private drawMemeButton(): void {
    const g = this.memeButtonBg;

    this.drawFlatQuickActionButton(g, 0x050505, 260, 82);
  }

  private createMemePopup(): Phaser.GameObjects.Container {
    const popup = this.add.container(0, 0);
    const width = 520;
    const rowHeight = 112;
    const visibleRows = Math.min(memeAudios.length, 6);
    const height = 61 + visibleRows * rowHeight;
    const listTop = -height / 2 + 86;
    const maxStartIndex = Math.max(0, memeAudios.length - visibleRows);
    const bg = this.add.graphics();
    const outsideCloseZone = this.add.zone(0, 0, this.getViewWidth(), this.getViewHeight());
    const title = this.add.text(0, -height / 2 + 30, "Áudios", {
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: "20px",
      fontStyle: "bold"
    }).setOrigin(0.5);

    outsideCloseZone.setInteractive({ useHandCursor: false });
    outsideCloseZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointerStartedInsidePopup = isPointerInsidePopup(pointer);
    });
    outsideCloseZone.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.time.now < this.memePopupIgnoreClicksUntil) {
        return;
      }

      if (pointerStartedInsidePopup || isPointerInsidePopup(pointer)) {
        pointerStartedInsidePopup = false;
        return;
      }

      pointerStartedInsidePopup = false;
      popup.setVisible(false);
    });
    outsideCloseZone.setDepth(-1);
    bg.fillStyle(0x000000, 0.34);
    bg.fillRoundedRect(-width / 2 + 2, -height / 2 + 3, width, height, 14);
    bg.fillStyle(0x020403, 0.95);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    bg.lineStyle(1.2, 0x3d250d, 0.34);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);
    bg.lineStyle(0.7, 0xffe8a8, 0.74);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);
    bg.lineStyle(0.3, 0xfff6d8, 0.42);
    bg.strokeRoundedRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 11);
    popup.add([outsideCloseZone, bg, title]);

    const rows = this.add.container(0, 0);
    const scrollTrack = this.add.graphics();
    const scrollThumb = this.add.graphics();
    let startIndex = 0;
    let dragStartY = 0;
    let dragStartIndex = 0;
    let dragDistance = 0;
    let pointerStartedInsidePopup = false;

    const isPointerInsidePopup = (pointer: Phaser.Input.Pointer): boolean => {
      const localX = (pointer.worldX - popup.x) / popup.scaleX;
      const localY = (pointer.worldY - popup.y) / popup.scaleY;

      return localX >= -width / 2 &&
        localX <= width / 2 &&
        localY >= -height / 2 &&
        localY <= height / 2;
    };

    popup.add([rows, scrollTrack, scrollThumb]);

    const drawScrollBar = () => {
      scrollTrack.clear();
      scrollThumb.clear();

      if (maxStartIndex <= 0) {
        return;
      }

      const trackX = width / 2 - 18;
      const trackTop = listTop - rowHeight / 2 + 6;
      const trackHeight = visibleRows * rowHeight - 12;
      const thumbHeight = Math.max(42, trackHeight * (visibleRows / memeAudios.length));
      const thumbY = trackTop + (trackHeight - thumbHeight) * (startIndex / maxStartIndex);

      scrollTrack.fillStyle(0x000000, 0.35);
      scrollTrack.fillRoundedRect(trackX, trackTop, 6, trackHeight, 4);
      scrollThumb.fillStyle(0xffcf5a, 0.95);
      scrollThumb.fillRoundedRect(trackX - 1, thumbY, 8, thumbHeight, 4);
    };

    const renderRows = () => {
      rows.removeAll(true);

      memeAudios.slice(startIndex, startIndex + visibleRows).forEach((meme, index) => {
        const y = listTop + index * rowHeight;
        const rowBg = this.add.graphics();
        const text = this.add.text(-width / 2 + 22, y, meme.name, {
          color: "#ffffff",
          fontFamily: "Arial",
          fontSize: "22px",
          fontStyle: "bold"
        }).setOrigin(0, 0.5);
        const hitZone = this.add.zone(0, y, width - 26, rowHeight - 6);

        if (index > 0) {
          rowBg.lineStyle(1, 0xb9b1a4, 0.42);
          rowBg.lineBetween(-width / 2 + 22, y - rowHeight / 2, width / 2 - 32, y - rowHeight / 2);
        }
        hitZone.setInteractive({ useHandCursor: true });
        hitZone.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => {
          setScrollIndex(startIndex + Math.sign(dy));
        });
        hitZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          dragStartY = pointer.y;
          dragStartIndex = startIndex;
          dragDistance = 0;
        });
        hitZone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
          if (!pointer.isDown) {
            return;
          }

          dragDistance = Math.max(dragDistance, Math.abs(pointer.y - dragStartY));
          setScrollIndex(dragStartIndex + Math.round((dragStartY - pointer.y) / rowHeight));
        });
        hitZone.on("pointerup", () => {
        if (dragDistance > 8) {
          this.time.delayedCall(50, () => {
            dragDistance = 0;
          });
          return;
        }

        if (this.time.now < this.memePopupIgnoreClicksUntil) {
          return;
        }

        this.playButtonClickSound();
        this.playMeme(meme.id);
          this.sendReliableAction("meme:play", {
            roomId: this.roomId,
            memeId: meme.id
          });
          popup.setVisible(false);
        });
        rows.add([rowBg, text, hitZone]);
      });
    };

    const setScrollIndex = (index: number) => {
      startIndex = Phaser.Math.Clamp(index, 0, maxStartIndex);
      renderRows();
      drawScrollBar();
    };
    setScrollIndex(0);
    popup.setVisible(false);
    return popup;
  }

  private playMeme(memeId: string): boolean {
    const meme = memeAudios.find((item) => item.id === memeId);

    if (!meme) {
      return false;
    }

    return this.playGameSound(meme.key, 0.9);
  }

  private createTrucoResponseGroup(): Phaser.GameObjects.Container {
    const bg = this.add.graphics();

    bg.fillStyle(0x000000, 0.34);
    bg.fillRoundedRect(-322, -180, 644, 362, 26);
    bg.fillStyle(0x020403, 0.92);
    bg.fillRoundedRect(-326, -184, 644, 362, 26);
    bg.lineStyle(1.2, 0x3d250d, 0.34);
    bg.strokeRoundedRect(-326, -184, 644, 362, 26);
    bg.lineStyle(0.7, 0xffe8a8, 0.74);
    bg.strokeRoundedRect(-326, -184, 644, 362, 26);
    bg.lineStyle(0.3, 0xfff6d8, 0.42);
    bg.strokeRoundedRect(-322, -180, 636, 354, 22);

    const title = this.add.text(0, -116, "PEDIDO DE TRUCO", {
      color: "#ffe7a0",
      fontFamily: "Arial",
      fontSize: "38px",
      fontStyle: "bold",
      stroke: "#5d3b08",
      strokeThickness: 2
    }).setOrigin(0.5);
    const playerName = this.add.text(0, -66, "", {
      align: "right",
      color: "#42e878",
      fontFamily: "Arial",
      fontSize: "20px",
      fontStyle: "normal"
    }).setOrigin(0.5);
    const subtitle = this.add.text(0, -66, "", {
      align: "left",
      color: "#f8f1d9",
      fontFamily: "Arial",
      fontSize: "20px",
      fontStyle: "normal",
    }).setOrigin(0.5);
    const footer = this.add.text(0, 144, "Escolha rapidamente para nao perder a vez.", {
      color: "#d8d3c6",
      fontFamily: "Arial",
      fontSize: "17px"
    }).setOrigin(0.5);
    const progress = this.add.graphics();

    const reject = this.createTrucoResponseButton(-208, 50, "CORRER", 0x8b4a12, "reject");
    const accept = this.createTrucoResponseButton(0, 50, "ACEITAR", 0x1f7a2e, "accept");
    const raise = this.createTrucoResponseButton(208, 50, "AUMENTAR", 0x1976a8, "raise");
    const group = this.add.container(0, 0, [bg, title, playerName, subtitle, progress, reject.container, accept.container, raise.container, footer]);

    this.trucoResponseTitle = title;
    this.trucoResponsePlayerName = playerName;
    this.trucoResponseSubtitle = subtitle;
    this.trucoResponseRaiseText = raise.text;
    this.trucoResponseProgress = progress;
    group.setDepth(15000);
    group.setVisible(false);

    return group;
  }

  private createElevenHandGroup(): Phaser.GameObjects.Container {
    const bg = this.add.graphics();

    bg.fillStyle(0x06130f, 0.94);
    bg.fillRoundedRect(-210, -106, 420, 212, 22);
    bg.lineStyle(3, 0xffcf5a, 1);
    bg.strokeRoundedRect(-210, -106, 420, 212, 22);

    const title = this.add.text(0, -62, "Mao de 11", {
      color: "#fff3a3",
      fontFamily: "Arial Black",
      fontSize: "32px",
      fontStyle: "900"
    }).setOrigin(0.5);

    const play = this.createElevenHandButton(-92, 32, "JOGAR", 0x1f7a2e, "play");
    const run = this.createElevenHandButton(92, 32, "CORRER", 0x8b4a12, "run");
    const group = this.add.container(0, 0, [bg, title, play, run]);

    group.setDepth(15001);
    group.setVisible(false);

    return group;
  }

  private createElevenHandButton(
    x: number,
    y: number,
    label: string,
    color: number,
    action: "play" | "run"
  ): Phaser.GameObjects.Container {
    const bg = this.add.graphics();

    bg.fillStyle(0x000000, 0.38);
    bg.fillRoundedRect(-72, -38, 150, 80, 12);
    bg.fillGradientStyle(
      action === "play" ? 0x66d05f : 0xf2a334,
      color,
      action === "play" ? 0x0d3914 : 0x4a1e07,
      action === "play" ? 0x061907 : 0x160804,
      1
    );
    bg.fillRoundedRect(-76, -42, 150, 80, 12);
    bg.lineStyle(3, 0xffffff, 0.22);
    bg.strokeRoundedRect(-76, -42, 150, 80, 12);

    const text = this.add.text(0, 0, label, {
      color: "#ffffff",
      fontFamily: "Arial Black",
      fontSize: "22px",
      fontStyle: "900",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5);
    const hitZone = this.add.zone(0, 0, 158, 88);
    const button = this.add.container(x, y, [bg, text, hitZone]);

    button.setSize(150, 80);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on("pointerup", () => {
      this.playButtonClickSound();
      this.sendReliableAction("eleven-hand:respond", {
        roomId: this.roomId,
        action
      });
    });

    return button;
  }

  private createTrucoResponseButton(
    x: number,
    y: number,
    label: string,
    color: number,
    action: "accept" | "reject" | "raise"
  ): { container: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text } {
    const bg = this.add.graphics();
    const style = {
      reject: { fill: 0x170e05, border: 0xc98b24, iconTint: 0xf0bd4f, subtitle: "-1 ponto", subtitleColor: "#ff8b34" },
      accept: { fill: 0x0f2608, border: 0x9be85d, iconTint: 0x8fe26a, subtitle: "Continuar rodada", subtitleColor: "#5cff55" },
      raise: { fill: 0x081523, border: 0x5e9bd4, iconTint: 0xb9d7ff, subtitle: "+3 pontos", subtitleColor: "#a9d5ff" }
    }[action];

    bg.fillStyle(0x000000, 0.38);
    bg.fillRoundedRect(-80, -68, 160, 136, 14);
    bg.fillStyle(style.fill, 0.96);
    bg.fillRoundedRect(-84, -72, 160, 136, 14);
    bg.lineStyle(1.6, style.border, 0.88);
    bg.strokeRoundedRect(-84, -72, 160, 136, 14);
    bg.lineStyle(0.8, 0xffffff, 0.14);
    bg.strokeRoundedRect(-78, -66, 148, 124, 10);

    const runIcon = action === "reject"
      ? this.add.image(0, -32, "running-player-icon").setDisplaySize(54, 54).setTint(style.iconTint)
      : null;
    const acceptIcon = action === "accept"
      ? this.add.image(0, -32, "check-action-icon").setDisplaySize(54, 54).setTint(style.iconTint)
      : null;
    const raiseIcon = action === "raise"
      ? this.add.image(0, -32, "arrow-up-action-icon").setDisplaySize(54, 54).setTint(style.iconTint)
      : null;

    const text = this.add.text(0, 23, label, {
      align: "center",
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: "22px",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const subtitle = this.add.text(0, 43, style.subtitle, {
      color: style.subtitleColor,
      fontFamily: "Arial",
      fontSize: "15px",
      fontStyle: "bold"
    }).setOrigin(0.5);

    const hitZone = this.add.zone(0, 0, 176, 152);
    const children = [bg, runIcon, acceptIcon, raiseIcon, text, subtitle, hitZone].filter(Boolean) as Phaser.GameObjects.GameObject[];
    const button = this.add.container(x, y, children);

    button.setName(`truco-response-${action}`);
    button.setSize(160, 136);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on("pointerup", () => {
      this.playButtonClickSound();
      this.respondToTrucoRequest(action);
    });

    return { container: button, text };
  }

  private respondToTrucoRequest(action: "accept" | "reject" | "raise"): boolean {
    const request = this.roomState?.trucoRequest;
    const didSend = this.sendReliableAction("truco:respond", {
      roomId: this.roomId,
      action
    });

    if (didSend) {
      this.clearTrucoResponseTimer();
      this.trucoResponseGroup.setVisible(false);

      if (action === "raise" && request) {
        const raisedValue = {
          3: "SEIS",
          6: "NOVE",
          9: "DOZE",
          12: "DOZE"
        }[request.requestedValue] ?? "SEIS";

        this.playGameSound("truco-alert", 0.82);
        this.playTrucoRaiseAnimation(this.roomState?.self?.name ?? "Jogador", raisedValue);
      }
    }

    return didSend;
  }

  private drawTrucoResponseIcon(
    graphics: Phaser.GameObjects.Graphics,
    action: "accept" | "reject" | "raise"
  ): void {
    graphics.lineStyle(7, 0xffffff, 0.92);
    graphics.fillStyle(0xffffff, 0.92);

  }

  private async startAudioRecording(): Promise<void> {
    if (this.isRecordingAudio || this.roomState?.status !== "playing") {
      return;
    }

    if (!window.isSecureContext) {
      this.setStatusMessage("Use HTTPS para liberar o microfone no celular");
      return;
    }

    try {
      const recordingSession = ++this.audioRecordingSession;

      this.isRecordingAudio = true;
      this.drawAudioButton();
      this.setStatusMessage("Gravando audio...");
      await this.audioRecorder.start();

      if (!this.isRecordingAudio || recordingSession !== this.audioRecordingSession) {
        this.audioRecorder.stop();
        return;
      }

      this.audioStopTimer = this.time.delayedCall(8000, () => {
        void this.stopAudioRecording();
      });
    } catch {
      this.isRecordingAudio = false;
      this.drawAudioButton();
      this.setStatusMessage("Permita o microfone para enviar audio");
    }
  }

  private async stopAudioRecording(): Promise<void> {
    if (!this.isRecordingAudio) {
      return;
    }

    this.audioStopTimer?.remove(false);
    this.audioStopTimer = null;
    this.isRecordingAudio = false;
    this.audioRecordingSession += 1;
    this.drawAudioButton();

    const audio = this.audioRecorder.stop();

    if (!audio || audio.byteLength < 2000) {
      this.setStatusMessage("Audio muito curto");
      return;
    }

    this.sendReliableAction("audio:send", {
      roomId: this.roomId,
      audio,
      mimeType: "audio/wav"
    });
    this.setStatusMessage("Audio enviado");
  }

  private showOpponentSpeechBubble(message: string): void {
    const bubble = this.add.container(0, -82);
    bubble.setAlpha(0);
    bubble.setScale(0.85);
    bubble.setDepth(30000);

    const bg = this.add.graphics();

    // sombra
    bg.fillStyle(0x000000, 0.35);
    bg.fillRoundedRect(-78, -34, 156, 50, 14);

    // balão
    bg.fillStyle(0xfffbef, 1);
    bg.fillRoundedRect(-82, -38, 156, 50, 14);

    // borda
    bg.lineStyle(3, 0xffcf5a, 1);
    bg.strokeRoundedRect(-82, -38, 156, 50, 14);

    // pontinha do balão
    bg.fillStyle(0xfffbef, 1);
    bg.fillTriangle(-12, 10, 8, 10, -2, 28);

    bg.lineStyle(3, 0xffcf5a, 1);
    bg.lineBetween(-12, 10, -2, 28);
    bg.lineBetween(8, 10, -2, 28);

    const maxBubbleWidth = Math.min(260, Math.max(156, this.getViewWidth() - 42));
    const text = this.add.text(0, 0, message, {
      color: "#1f1408",
      fontFamily: "Arial",
      fontSize: "22px",
      fontStyle: "normal",
      align: "center",
      wordWrap: { width: maxBubbleWidth - 30, useAdvancedWrap: true }
    }).setOrigin(0.5);

    const textBounds = text.getBounds();
    const bubbleWidth = Math.min(maxBubbleWidth, Math.max(156, textBounds.width + 34));
    const bubbleHeight = Math.max(66, textBounds.height + 50);
    const bubbleTop = -bubbleHeight / 2;
    const bubbleLeft = -bubbleWidth / 2;
    const tailTop = bubbleHeight / 2 - 4;
    const tailBottom = bubbleHeight / 2 + 18;

    text.setPosition(0, -2);
    bg.clear();
    const bubbleBorderColor = 0x5a3714;
    const bubbleFillBottom = 0xffedbd;

    bg.fillStyle(0x000000, 0.22);
    bg.fillRoundedRect(bubbleLeft + 5, bubbleTop + 6, bubbleWidth, bubbleHeight, 24);
    bg.fillTriangle(-12 + 5, tailTop + 6, 8 + 5, tailTop + 6, -2 + 5, tailBottom + 6);
    bg.fillGradientStyle(0xfff8df, 0xfff8df, bubbleFillBottom, bubbleFillBottom, 1);
    bg.fillRoundedRect(bubbleLeft, bubbleTop, bubbleWidth, bubbleHeight, 24);
    bg.lineStyle(3, bubbleBorderColor, 1);
    bg.strokeRoundedRect(bubbleLeft, bubbleTop, bubbleWidth, bubbleHeight, 24);
    bg.fillStyle(bubbleFillBottom, 1);
    bg.fillTriangle(-14, tailTop - 2, 10, tailTop - 2, -2, tailBottom);
    bg.lineStyle(3, bubbleBorderColor, 1);
    bg.lineBetween(-12, tailTop+5, -2, tailBottom);
    bg.lineBetween(8, tailTop+3, -2, tailBottom);
    bg.lineStyle(1, 0xffffff, 0.58);
    bg.lineBetween(bubbleLeft + 22, bubbleTop + 5, bubbleLeft + bubbleWidth - 22, bubbleTop + 5);

    bubble.add([bg, text]);

    this.opponentAvatarGroup.add(bubble);

    this.tweens.add({
      targets: bubble,
      alpha: 1,
      scale: 1,
      y: -92,
      duration: 220,
      ease: "Back.Out",
      onComplete: () => {
        this.time.delayedCall(1200, () => {
          this.tweens.add({
            targets: bubble,
            alpha: 0,
            y: -120,
            scale: 0.9,
            duration: 260,
            ease: "Cubic.In",
            onComplete: () => bubble.destroy()
          });
        });
      }
    });
  }

  private drawMiniCardIcon(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    rotate: number,
    rank: string,
    suit: string,
    color: string,
    scale: number
  ): void {
    const miniWidth = 34 * scale;
    const miniHeight = 48 * scale;

    const card = new Phaser.GameObjects.Container(this, x, y);
    card.setRotation(rotate);

    const bg = this.add.graphics();
    bg.fillStyle(0xfffaf0, 1);
    bg.fillRoundedRect(-miniWidth / 2, -miniHeight / 2, miniWidth, miniHeight, 5 * scale);
    bg.lineStyle(1.4 * scale, 0x78350f, 0.34);
    bg.strokeRoundedRect(-miniWidth / 2, -miniHeight / 2, miniWidth, miniHeight, 5 * scale);

    const rankText = this.add.text(-miniWidth / 2 + 5 * scale, -miniHeight / 2 + 4 * scale, rank, {
      color,
      fontFamily: "Arial",
      fontSize: `${13 * scale}px`,
      fontStyle: "bold"
    }).setOrigin(0, 0);

    const suitText = this.add.text(0, 8 * scale, suit, {
      color,
      fontFamily: "Arial",
      fontSize: `${18 * scale}px`,
      fontStyle: "bold"
    }).setOrigin(0.5);

    card.add([bg, rankText, suitText]);
    this.trucoButton.add(card);
  }

  private getTrucoResponseKey(state: RoomState): string | null {
    const request = state.trucoRequest;

    if (!request || request.responderPlayerId !== state.self?.id) {
      return null;
    }

    return `${request.requestedByPlayerId}:${request.responderPlayerId}:${request.requestedValue}`;
  }

  private getTrucoRequestTimerKey(state: RoomState): string | null {
    const request = state.trucoRequest;

    if (!request) {
      return null;
    }

    return `${request.requestedByPlayerId}:${request.responderPlayerId}:${request.requestedValue}`;
  }

  private getTrucoResponseMessage(action: "accept" | "reject" | "raise"): string {
    return {
      accept: "ACEITOU!",
      reject: "TO FORA!",
      raise: "AUMENTOU!"
    }[action];
  }

  private delayTrucoResponseOptions(key: string, delayMs = 2300): void {
    this.delayedTrucoResponseKey = key;
    this.visibleTrucoResponseKey = null;
    this.trucoResponseDelayTimer?.remove(false);
    this.trucoResponseDelayTimer = this.time.delayedCall(delayMs, () => {
      if (!this.roomState || this.delayedTrucoResponseKey !== key || this.getTrucoResponseKey(this.roomState) !== key) {
        return;
      }

      this.visibleTrucoResponseKey = key;
      this.delayedTrucoResponseKey = null;
      this.trucoResponseDelayTimer = null;
      this.renderTrucoResponse();
    });
  }

  private drawTrucoRaiseButton(value: string, enabled: boolean): void {
    const scale = this.actionButtonScale;
    const g = this.trucoButtonBg;

    g.clear();

    this.trucoButton.each((child: Phaser.GameObjects.GameObject) => {
      if (
        child !== this.trucoButtonBg &&
        child !== this.trucoButtonSmallText &&
        child !== this.trucoButtonText
      ) {
        child.destroy();
      }
    });
    this.trucoButton.add(g);

    const buttonWidth = 176 * scale;
    const buttonHeight = 190 * scale;
    const centerX = 0;
    const buttonX = -buttonWidth / 2;
    const buttonY = -buttonHeight / 2;

    const plateX = buttonX + 18 * scale;
    const plateY = buttonY + 104 * scale;
    const plateWidth = buttonWidth - 36 * scale;
    const plateHeight = 66 * scale;

    const points = [
      new Phaser.Math.Vector2(centerX, buttonY),
      new Phaser.Math.Vector2(buttonX + buttonWidth - 12 * scale, buttonY + 46 * scale),
      new Phaser.Math.Vector2(buttonX + buttonWidth - 12 * scale, buttonY + 138 * scale),
      new Phaser.Math.Vector2(centerX, buttonY + buttonHeight),
      new Phaser.Math.Vector2(buttonX + 12 * scale, buttonY + 138 * scale),
      new Phaser.Math.Vector2(buttonX + 12 * scale, buttonY + 46 * scale),
    ];

    if (enabled) {
      this.fillPolygonVerticalGradient(g, points, 0x28d85b, 0x020d06, buttonY, buttonHeight, 220, scale);
      g.fillStyle(0x0f7a2d, 0.12);
      g.fillPoints(points, true);
    } else {
      g.fillStyle(0x444444, 1);
      g.fillPoints(points, true);
    }

    g.lineStyle(5 * scale, 0xfff3a3, 1);
    g.strokePoints(points, true, true);

    g.lineStyle(2 * scale, 0xd7a94c, 1);
    g.strokePoints(points, true, true);

    this.drawMiniCardIcon(g, centerX - 28 * scale, buttonY + 58 * scale, -0.2, "7", "♦", "#b3261e", scale);
    this.drawMiniCardIcon(g, centerX, buttonY + 52 * scale, 0, "A", "♠", "#202124", scale);
    this.drawMiniCardIcon(g, centerX + 28 * scale, buttonY + 58 * scale, 0.2, "3", "♣", "#202124", scale);

    if (enabled) {
      this.fillRoundedVerticalGradient(
        g,
        plateX,
        plateY,
        plateWidth,
        plateHeight,
        14 * scale,
        0xffe27a,
        0x8a4308,
        0xc17a13
      );
    } else {
      g.fillStyle(0x999999, 1);
      g.fillRoundedRect(plateX, plateY, plateWidth, plateHeight, 14 * scale);
    }

    g.lineStyle(2.4 * scale, 0xfff3a3, 1);
    g.strokeRoundedRect(plateX, plateY, plateWidth, plateHeight, 14 * scale);

    g.lineStyle(1.5 * scale, 0x5d2e08, 0.46);
    g.strokeRoundedRect(
      plateX + 4 * scale,
      plateY + 4 * scale,
      plateWidth - 8 * scale,
      plateHeight - 8 * scale,
      10 * scale
    );

    this.trucoButtonSmallText.setText("PEDIR");
    this.trucoButtonSmallText.setFontSize(Math.max(16, 19 * scale));
    this.trucoButtonSmallText.setPosition(centerX, plateY + 21 * scale);
    this.trucoButtonSmallText.setColor(enabled ? "#5f3900" : "#555555");

    this.trucoButtonText.setText(value.toUpperCase());
    this.trucoButtonText.setFontSize(Math.max(19, 23 * scale));
    this.trucoButtonText.setPosition(centerX, plateY + 45 * scale);
    this.trucoButtonText.setColor(enabled ? "#5f3900" : "#555555");

    this.trucoButton.add(this.trucoButtonSmallText);
    this.trucoButton.add(this.trucoButtonText);

    this.trucoButton.setSize(buttonWidth, buttonHeight);
  }

  private fillPolygonVerticalGradient(
    g: Phaser.GameObjects.Graphics,
    points: Phaser.Math.Vector2[],
    topColorValue: number,
    bottomColorValue: number,
    top: number,
    height: number,
    steps: number,
    scale: number
  ): void {
    const topColor = Phaser.Display.Color.ValueToColor(topColorValue);
    const bottomColor = Phaser.Display.Color.ValueToColor(bottomColorValue);

    for (let index = 0; index < steps; index += 1) {
      const ratio = index / (steps - 1);
      const y1 = top + height * ratio;
      const y2 = top + height * ((index + 1) / steps) + 1 * scale;
      const intersections = points
        .map((point, pointIndex) => {
          const next = points[(pointIndex + 1) % points.length];
          const minY = Math.min(point.y, next.y);
          const maxY = Math.max(point.y, next.y);

          if (y1 < minY || y1 > maxY || point.y === next.y) {
            return null;
          }

          const edgeRatio = (y1 - point.y) / (next.y - point.y);
          return point.x + (next.x - point.x) * edgeRatio;
        })
        .filter((value): value is number => value !== null)
        .sort((left, right) => left - right);

      if (intersections.length < 2) {
        continue;
      }

      const color = Phaser.Display.Color.Interpolate.ColorWithColor(topColor, bottomColor, steps - 1, index);

      g.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
      g.fillRect(intersections[0], y1, intersections[intersections.length - 1] - intersections[0], y2 - y1);
    }
  }

  private fillRoundedVerticalGradient(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    topColorValue: number,
    bottomColorValue: number,
    overlayColorValue: number
  ): void {
    g.fillStyle(bottomColorValue, 1);
    g.fillRoundedRect(x, y, width, height, radius);

    const steps = 18;
    const getRoundedInset = (localY: number): number => {
      if (localY < radius) {
        return radius - Math.sqrt(Math.max(0, radius * radius - (radius - localY) ** 2));
      }

      if (localY > height - radius) {
        return radius - Math.sqrt(Math.max(0, radius * radius - (localY - (height - radius)) ** 2));
      }

      return 0;
    };
    const topColor = Phaser.Display.Color.ValueToColor(topColorValue);
    const bottomColor = Phaser.Display.Color.ValueToColor(bottomColorValue);

    for (let index = 0; index < steps; index += 1) {
      const lineY = y + (height / steps) * index;
      const lineHeight = Math.ceil(height / steps) + 1;
      const localTop = Math.max(0, lineY - y);
      const localBottom = Math.min(height, localTop + lineHeight);
      const topInset = getRoundedInset(localTop);
      const bottomInset = getRoundedInset(localBottom);
      const inset = localTop < radius ? Math.max(topInset - 3.9, bottomInset + 3.1) : Math.max(topInset, bottomInset);
      const adjustedInset = Math.max(0, inset - 0.8);
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(topColor, bottomColor, steps - 1, index);

      g.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
      g.fillRect(x + adjustedInset, lineY, width - adjustedInset * 2, lineHeight);
    }

    g.fillStyle(overlayColorValue, 0.18);
    g.fillRoundedRect(x, y, width, height, radius);
  }

  private uiScale = 1;
  private actionButtonScale = 1;
  private actionBottom = 74;
  private readonly tableCardScale = 1.1;
  private readonly deckCardScale = 1.1;

  private getViewWidth(): number {
    return this.scale.width;
  }

  private getViewHeight(): number {
    return this.scale.height;
  }

  private updateUiScale(): void {
    const width = this.getViewWidth();
    const height = this.getViewHeight();

    const baseWidth = 390;
    const baseHeight = 844;

    const scaleX = width / baseWidth;
    const scaleY = height / baseHeight;

    this.uiScale = Phaser.Math.Clamp(Math.min(scaleX, scaleY), 0.82, 1.08);
    this.actionButtonScale = Phaser.Math.Clamp(this.uiScale * 0.82, 0.64, 0.74);
  }

  private layout(): void {
    this.updateUiScale();

    const width = this.getViewWidth();
    const height = this.getViewHeight();
    const safeTop = 12 * this.uiScale;
    const backgroundScale = Math.max(
      width / this.tableBackground.width,
      height / this.tableBackground.height
    );

    this.cameras.main.setViewport(0, 0, width, height);
    this.cameras.main.setZoom(1);
    this.tableBackground.setPosition(width / 2, height / 2);
    this.tableBackground.setScale(backgroundScale);
    const topScoreWidth = Math.min(width - 92 * this.uiScale, 620 * this.uiScale);
    this.scoreboardGroup.setPosition(8 * this.uiScale + topScoreWidth / 2, safeTop + 86 * this.uiScale);
    this.actionBottom = Math.max(58, 78 * this.actionButtonScale);

    this.trucoButton.setPosition(width - 98 * this.actionButtonScale, height - this.actionBottom-30);
    this.trucoButtonHitZone.setPosition(
      this.trucoButton.x,
      this.trucoButton.y
    );
    this.trucoResponseGroup.setPosition(width / 2, height / 2 + 112 * this.uiScale);
    this.trucoResponseGroup.setScale(Math.min(this.uiScale, (width - 24) / 680, (height - 120 * this.uiScale) / 390));
    this.elevenHandGroup.setPosition(width / 2, height / 2 + 112 * this.uiScale);
    this.elevenHandGroup.setScale(Math.min(this.uiScale, (width - 24) / 420));
    const quickActionX = 108 * this.actionButtonScale;
    const quickActionY = height - this.actionBottom - 18 * this.actionButtonScale;
    const quickActionScale = this.actionButtonScale * 1.55;
    this.audioButton.setScale(1);
    this.memeButton.setScale(1);
    this.quickActionMenu.setScale(quickActionScale);
    this.quickActionMenu.setPosition(quickActionX + 94 * quickActionScale, quickActionY - 156 * quickActionScale);
    this.quickActionOutsideZone.setPosition(
      -this.quickActionMenu.x / quickActionScale,
      -this.quickActionMenu.y / quickActionScale
    );
    this.quickActionOutsideZone.setSize(width / quickActionScale, height / quickActionScale);
    this.quickActionButton.setScale(quickActionScale);
    this.quickActionButton.setPosition(quickActionX, quickActionY);
    this.memePopup.setScale(Math.min(this.uiScale, (width - 24) / 430));
    this.memePopup.setPosition(width / 2, height / 2);
    const memeOutsideCloseZone = this.memePopup.list[0];
    if (memeOutsideCloseZone instanceof Phaser.GameObjects.Zone) {
      memeOutsideCloseZone.setSize(width / this.memePopup.scaleX, height / this.memePopup.scaleY);
    }
this.exitButton.setPosition(
  width - 50 * this.uiScale,
  safeTop + 39 * this.uiScale
);
    this.exitButton.setScale(this.uiScale);
    this.opponentHandGroup.setPosition(width / 2, safeTop + 336 * this.uiScale);
    this.opponentAvatarGroup.setPosition(width / 2, safeTop + 276 * this.uiScale);
    this.opponentNameGroup.setPosition(width / 2, safeTop + 276 * this.uiScale);
    this.updateOpponentAvatarMaskPosition();
    this.viraGroup.setPosition(width / 2, height / 2 + 10 * this.uiScale);
    this.deckGroup.setPosition(width / 2 + 30 * this.uiScale, height / 2 + 12 * this.uiScale);
    this.tableGroup.setPosition(width / 2, height / 2 - 20 * this.uiScale);
    this.updateHandGroupPosition();
    this.updateStatusPosition(safeTop);
    this.renderState();
  }

  update(): void {
    this.updateTurnProgress();
    this.updateTrucoResponseProgress();
  }

  private renderState(): void {
    if (!this.roomState) {
      return;
    }

    const self = this.roomState.self;
    const opponent = this.roomState.players.find((player) => player.id !== self?.id);
    const isMyTurn = this.roomState.turnPlayerId === self?.id;

    this.opponentNameText.setText((opponent?.name ?? "Oponente").toUpperCase());
    this.drawOpponentNameBox(this.hasOpponentTurnProgress());
    this.updateOpponentAvatar(opponent);
    this.renderFootMarkers();

    this.setStatusMessage(this.roomState.message);
    this.quickActionButton.setVisible(this.roomState.status === "playing");
    this.quickActionMenu.setVisible(this.roomState.status === "playing" && this.quickActionMenu.visible);
    this.drawQuickActionToggleButton(this.quickActionMenu.visible);
    if (this.roomState.status !== "playing") {
      this.memePopup.setVisible(false);
      this.setQuickActionMenuVisible(false);
    }
    this.renderTrucoResponse();
    this.renderElevenHandDecision();

    this.renderScoreboard();
    this.renderTrucoButton();
    this.renderVira();
    this.renderDeck();
    this.renderTable();
    this.renderOpponentHand(opponent?.hand ?? []);
    this.updateHandGroupPosition();
    this.updateStatusPosition(12 * this.uiScale);
    this.drawStatusBox();
    this.renderHand(self?.hand ?? [], isMyTurn && !this.roomState.trucoRequest && !this.roomState.elevenHandDecision);
    this.syncTurnTimer();
    this.sharpenExistingTexts();
  }

  private updateStatusPosition(safeTop = 12 * this.uiScale): void {
    const width = this.getViewWidth();
    const selfId = this.roomState?.self?.id;
    const selfIsFoot = Boolean(selfId && this.roomState?.footPlayerId === selfId);
    const isOpponentTurn = Boolean(selfId && this.roomState?.turnPlayerId && this.roomState.turnPlayerId !== selfId);
    const statusAboveHand = selfIsFoot || isOpponentTurn;
    const handCount = this.roomState?.self?.hand.length ?? 3;
    const handScale = this.getHandCardScale(handCount);

    if (statusAboveHand) {
      this.statusCenterX = width / 2;
      this.statusCenterY = this.handGroup.y - 82 * handScale;
    } else {
      this.statusCenterX = width / 2;
      this.statusCenterY = this.handGroup.y - 82 * handScale;
    }

    this.layoutStatusText();
  }

  private setStatusMessage(message: string): void {
    const turnPrefix = "Vez de ";
    const playerName = message.startsWith(turnPrefix) ? message.slice(turnPrefix.length).trim() : "";

    if (playerName) {
      this.status.setText("Vez de");
      this.statusName.setText(playerName);
      this.statusName.setVisible(true);
    } else {
      this.status.setText(message);
      this.statusName.setVisible(false);
    }

    this.layoutStatusText();
  }

  private layoutStatusText(): void {
    const width = this.getViewWidth();

    this.status.setWordWrapWidth(Math.min(width - 32, 420 * this.uiScale), true);
    this.status.setAlign("center");
    this.statusName.setWordWrapWidth(Math.min(width - 120, 300 * this.uiScale), true);
    this.statusName.setAlign("center");

    if (this.statusName.visible) {
      const gap = 5 * this.uiScale;
      const statusWidth = this.status.getBounds().width;
      const nameWidth = this.statusName.getBounds().width;
      const totalWidth = statusWidth + gap + nameWidth;

      this.status.setPosition(this.statusCenterX - totalWidth / 2 + statusWidth / 2, this.statusCenterY);
      this.statusName.setPosition(this.statusCenterX + totalWidth / 2 - nameWidth / 2, this.statusCenterY);
    } else {
      this.status.setPosition(this.statusCenterX, this.statusCenterY);
      this.statusName.setPosition(this.statusCenterX, this.statusCenterY);
    }

    this.drawStatusBox();
  }

  private drawStatusBox(): void {
    const bounds = this.status.getBounds();
    const nameBounds = this.statusName.visible ? this.statusName.getBounds() : bounds;
    const paddingX = 14 * this.uiScale;
    const paddingY = 7 * this.uiScale;
    const hasStatusProgress = Boolean(
      this.getTurnTimerKey() &&
      this.roomState?.self?.id &&
      this.roomState.turnPlayerId === this.roomState.self.id
    );
    const progressLaneHeight = hasStatusProgress ? 10 * this.uiScale : 0;
    const boundsX = Math.min(bounds.x, nameBounds.x);
    const boundsY = Math.min(bounds.y, nameBounds.y);
    const boundsRight = Math.max(bounds.right, nameBounds.right);
    const boundsBottom = Math.max(bounds.bottom, nameBounds.bottom);
    const x = boundsX - paddingX;
    const y = boundsY - paddingY;
    const width = boundsRight - boundsX + paddingX * 2;
    const height = boundsBottom - boundsY + paddingY * 2 + progressLaneHeight;
    const radius = 9 * this.uiScale;

    this.statusBg.clear();
    this.statusBg.fillStyle(0x000000, 0.34);
    this.statusBg.fillRoundedRect(x + 2 * this.uiScale, y + 3 * this.uiScale, width, height, radius);
    this.statusBg.fillStyle(0x020403, 0.86);
    this.statusBg.fillRoundedRect(x, y, width, height, radius);
    this.statusBg.lineStyle(1.2 * this.uiScale, 0x3d250d, 0.34);
    this.statusBg.strokeRoundedRect(x, y, width, height, radius);
    this.statusBg.lineStyle(0.7 * this.uiScale, 0xffe8a8, 0.74);
    this.statusBg.strokeRoundedRect(x, y, width, height, radius);
    this.statusBg.lineStyle(0.3 * this.uiScale, 0xfff6d8, 0.42);
    this.statusBg.strokeRoundedRect(
      x + 2 * this.uiScale,
      y + 2 * this.uiScale,
      width - 4 * this.uiScale,
      height - 4 * this.uiScale,
      Math.max(2 * this.uiScale, radius - 3 * this.uiScale)
    );

    this.statusBoxRect = { x, y, width, height };
    this.drawTurnProgress();
  }

  private updateHandGroupPosition(): void {
    const handCount = this.roomState?.self?.hand.length ?? 3;
    const handScale = this.getHandCardScale(handCount);
    const width = this.getViewWidth();
    const height = this.getViewHeight();
    const defaultY = height - 66 * this.uiScale;
    const actionTopY = height - this.actionBottom - 60 * this.actionButtonScale;
    const handHalfHeight = 59 * handScale;
    const gap = 6 * this.uiScale;
    const safeY = actionTopY - handHalfHeight - gap;

    this.handGroup.setPosition(width / 2, Math.min(defaultY, safeY));
  }

  private renderFootMarkers(): void {
    const footPlayerId = this.roomState?.footPlayerId;
    const selfId = this.roomState?.self?.id;
    const selfIsFoot = Boolean(footPlayerId && selfId && footPlayerId === selfId);
    const opponentIsFoot = Boolean(footPlayerId && selfId && footPlayerId !== selfId);

    this.selfFootMarker.setVisible(selfIsFoot);
    this.opponentFootMarker.setVisible(opponentIsFoot);

    if (selfIsFoot) {
      const fixedHandCount = 3;
      const cardScale = this.getHandCardScale(fixedHandCount);
      const spacing = this.getHandCardSpacing(fixedHandCount, cardScale);
      const rightEdgeX = spacing + 42 * cardScale;

      this.selfFootMarker.setPosition(rightEdgeX, -82 * cardScale);
      this.selfFootMarker.setScale(1 / Math.max(0.75, this.uiScale));
    }
  }

  private syncFaceDownHandCards(): void {
    const hand = this.roomState?.self?.hand ?? [];
    const handIds = new Set(hand.map((card) => card.id));
    const previousHandLength = this.previousRoomState?.self?.hand.length ?? 0;

    if (hand.length === 3 && previousHandLength !== 3) {
      this.faceDownHandCardIds.clear();
      this.revealedDealCardIds.clear();
      return;
    }

    for (const cardId of this.faceDownHandCardIds) {
      if (!handIds.has(cardId)) {
        this.faceDownHandCardIds.delete(cardId);
      }
    }

    const tableCardIds = new Set((this.roomState?.table ?? []).map((entry) => entry.card.id));

    for (const cardId of this.pendingFaceDownTableCardIds) {
      if (!handIds.has(cardId) && !tableCardIds.has(cardId)) {
        this.pendingFaceDownTableCardIds.delete(cardId);
      }
    }
  }

  private playTableClearSoundIfNeeded(state: RoomState): void {
    const previousTableCount = this.previousRoomState?.table.length ?? 0;

    if (previousTableCount >= 2 && state.table.length === 0 && state.status === "playing") {
      this.playGameSound("card-remove", 0.78);
    }
  }

  private getTurnTimerKey(): string | null {
    const state = this.roomState;

    if (!state || state.status !== "playing" || !state.turnPlayerId || state.trucoRequest || state.elevenHandDecision) {
      return null;
    }

    const tableKey = state.table.map((entry) => entry.card.id).join(",");

    return `${state.roomId}:${state.handSequence}:${state.turnPlayerId}:${tableKey}`;
  }

  private syncTurnTimer(): void {
    const nextKey = this.getTurnTimerKey();

    if (!nextKey) {
      this.clearTurnTimer();
      return;
    }

    if (this.turnTimerKey !== nextKey) {
      this.turnTimerKey = nextKey;
      this.turnTimerStartedAt = Date.now();
      this.autoPlayTriggeredForKey = null;
    }

    this.drawTurnProgress();
  }

  private clearTurnTimer(): void {
    this.turnTimerKey = null;
    this.turnTimerStartedAt = 0;
    this.autoPlayTriggeredForKey = null;
    this.turnProgress?.clear();
    this.opponentTurnProgress?.clear();
    this.drawOpponentNameBox(this.hasOpponentTrucoResponseProgress());
  }

  private updateTurnProgress(): void {
    if (!this.turnTimerKey) {
      return;
    }

    this.drawTurnProgress();

    if (Date.now() - this.turnTimerStartedAt >= this.turnTimeoutMs) {
      this.autoPlayCurrentTurnCard();
    }
  }

  private getTurnProgressRatio(): number {
    if (!this.turnTimerKey || !this.turnTimerStartedAt) {
      return 0;
    }

    return Phaser.Math.Clamp((Date.now() - this.turnTimerStartedAt) / this.turnTimeoutMs, 0, 1);
  }

  private drawTurnProgress(): void {
    this.turnProgress.clear();
    this.opponentTurnProgress?.clear();

    const state = this.roomState;
    const selfId = state?.self?.id;

    if (!state || !selfId || !this.turnTimerKey) {
      return;
    }

    const ratio = this.getTurnProgressRatio();

    if (state.turnPlayerId === selfId) {
      this.drawStatusTurnProgress(ratio);
      return;
    }

    this.drawOpponentTurnProgress(ratio);
  }

  private drawStatusTurnProgress(ratio: number): void {
    const { x, y, width, height } = this.statusBoxRect;

    if (!width || !height) {
      return;
    }

    const padding = 5 * this.uiScale;
    const progressTopPadding = 6 * this.uiScale;
    const progressHeight = 4 * this.uiScale;
    const progressX = x + padding;
    const progressY = y + height - padding - progressHeight;
    const progressWidth = width - padding * 2;

    if (height < padding * 2 + progressHeight + progressTopPadding) {
      return;
    }

    this.turnProgress.fillStyle(0xffffff, 0.16);
    this.turnProgress.fillRoundedRect(progressX, progressY, progressWidth, progressHeight, progressHeight / 2);
    this.turnProgress.fillStyle(0x42e878, 0.92);
    this.turnProgress.fillRoundedRect(progressX, progressY, progressWidth * ratio, progressHeight, progressHeight / 2);
  }

  private drawOpponentTurnProgress(ratio: number): void {
    if (!this.opponentTurnProgress) {
      return;
    }

    const progressX = -54;
    const progressY = 128;
    const progressWidth = 108;
    const progressHeight = 4;

    this.drawOpponentNameBox(true);
    this.opponentTurnProgress.fillStyle(0xffffff, 0.16);
    this.opponentTurnProgress.fillRoundedRect(progressX, progressY, progressWidth, progressHeight, progressHeight / 2);
    this.opponentTurnProgress.fillStyle(0xffcf5a, 0.94);
    this.opponentTurnProgress.fillRoundedRect(progressX, progressY, progressWidth * ratio, progressHeight, progressHeight / 2);
  }

  private hasOpponentTurnProgress(): boolean {
    const state = this.roomState;
    const selfId = state?.self?.id;

    return Boolean(
      (this.getTurnTimerKey() && selfId && state?.turnPlayerId && state.turnPlayerId !== selfId) ||
      this.hasOpponentTrucoResponseProgress()
    );
  }

  private hasOpponentTrucoResponseProgress(): boolean {
    const state = this.roomState;
    const selfId = state?.self?.id;

    return Boolean(this.trucoResponseTimerKey && selfId && state?.trucoRequest?.responderPlayerId !== selfId);
  }

  private drawOpponentNameBox(hasProgress: boolean): void {
    if (!this.opponentNameBox) {
      return;
    }

    const nameBoxX = -62;
    const nameBoxY = 89;
    const nameBoxWidth = 124;
    const nameBoxHeight = hasProgress ? 48 : 40;
    const nameBoxRadius = 10;

    this.opponentNameBox.clear();
    this.opponentNameBox.fillStyle(0x000000, 0.34);
    this.opponentNameBox.fillRoundedRect(nameBoxX + 2, nameBoxY + 3, nameBoxWidth, nameBoxHeight, nameBoxRadius);
    this.opponentNameBox.fillStyle(0x020403, 0.86);
    this.opponentNameBox.fillRoundedRect(nameBoxX, nameBoxY, nameBoxWidth, nameBoxHeight, nameBoxRadius);
    this.opponentNameBox.lineStyle(1.2, 0x3d250d, 0.34);
    this.opponentNameBox.strokeRoundedRect(nameBoxX, nameBoxY, nameBoxWidth, nameBoxHeight, nameBoxRadius);
    this.opponentNameBox.lineStyle(0.7, 0xffe8a8, 0.74);
    this.opponentNameBox.strokeRoundedRect(nameBoxX, nameBoxY, nameBoxWidth, nameBoxHeight, nameBoxRadius);
    this.opponentNameBox.lineStyle(0.3, 0xfff6d8, 0.42);
    this.opponentNameBox.strokeRoundedRect(nameBoxX + 2, nameBoxY + 2, nameBoxWidth - 4, nameBoxHeight - 4, nameBoxRadius - 3);
  }

  private autoPlayCurrentTurnCard(): void {
    const state = this.roomState;
    const self = state?.self;
    const timerKey = this.turnTimerKey;

    if (!state || !self || !timerKey || this.autoPlayTriggeredForKey === timerKey || state.turnPlayerId !== self.id) {
      return;
    }

    const card = this.chooseAutoPlayCard();

    if (!card) {
      return;
    }

    this.autoPlayTriggeredForKey = timerKey;
    this.faceDownHandCardIds.delete(card.id);
    this.playGameSound("card-place", 0.78);
    this.sendReliableAction("card:play", {
      roomId: this.roomId,
      cardId: card.id,
      faceDown: false
    });
  }

  private chooseAutoPlayCard(): Card | null {
    const state = this.roomState;
    const cards = state?.self?.hand ?? [];

    if (cards.length === 0) {
      return null;
    }

    const compareAutoPlayCards = (left: Card, right: Card) => state?.vira
      ? compareCardsWithVira(left, right, state.vira)
      : compareCards(left, right);
    const sortedCards = [...cards].sort(compareAutoPlayCards);
    const tableCard = state?.table.length === 1 ? state.table[0].card : null;

    if (!tableCard) {
      return sortedCards[sortedCards.length - 1] ?? null;
    }

    const winningCards = sortedCards.filter((card) => compareAutoPlayCards(card, tableCard) > 0);

    return winningCards[0] ?? sortedCards[0] ?? null;
  }

  private canToggleFaceDownCard(): boolean {
    return !this.roomState?.isIronHand && (this.roomState?.self?.hand.length ?? 0) < 3;
  }

  private toggleFaceDownCard(cardId: string): void {
    this.playGameSound("card-flip", 0.72);

    if (this.faceDownHandCardIds.has(cardId)) {
      this.faceDownHandCardIds.delete(cardId);
    } else {
      this.faceDownHandCardIds.add(cardId);
    }

    this.renderState();
  }

  private createCurvedStars(
    count: number,
    centerX: number,
    centerY: number,
    radius: number,
    side: "top" | "bottom"
  ): Phaser.GameObjects.Container {
    const container = this.add.container(centerX, centerY);

    const totalAngle = count <= 3 ? 76 : count <= 5 ? 104 : 124;
    const startAngle = -totalAngle / 2;
    const step = count > 1 ? totalAngle / (count - 1) : 0;

    for (let i = 0; i < count; i++) {
      const angleDeg = startAngle + i * step;
      const angle = Phaser.Math.DegToRad(angleDeg);

      const x = Math.sin(angle) * radius;
      const y = side === "top"
        ? -Math.cos(angle) * 28
        : Math.cos(angle) * 28;

      const size = i % 2 === 0 ? 25 : 20;

      const glow = this.add.text(x, y, "★", {
        color: "#fff1a8",
        fontFamily: "Arial",
        fontSize: `${size + 8}px`,
        fontStyle: "bold"
      }).setOrigin(0.5);

      glow.setAlpha(0.25);

      const star = this.add.text(x, y, "★", {
        color: "#ffcf5a",
        fontFamily: "Arial",
        fontSize: `${size}px`,
        fontStyle: "bold",
        stroke: "#6b3700",
        strokeThickness: 5
      }).setOrigin(0.5);

      star.setRotation(side === "top" ? angle * 0.5 : -angle * 0.5);

      container.add([glow, star]);
    }

    return container;
  }

  private playTrucoRaiseAnimation(playerName: string, value: string): number {
    const animationDurationMs = 2300;
    const width = this.getViewWidth();
    const height = this.getViewHeight();
    const valueUpper = value.toUpperCase();
    const scale = Phaser.Math.Clamp(Math.min(width / 820, height / 920), 0.72, 1.08);
    const container = this.add.container(width / 2, height / 2 + 34 * scale);

    container.setDepth(20000);
    container.setAlpha(0);
    container.setScale(0.42);

    const glow = this.add.graphics();

    glow.fillStyle(0xffcf5a, 0.14);
    glow.fillCircle(0, 0, 280 * scale);
    glow.fillStyle(0x42e878, 0.1);
    glow.fillCircle(0, 18 * scale, 220 * scale);
    glow.fillStyle(0xffffff, 0.07);
    glow.fillCircle(0, -8 * scale, 150 * scale);

    const burst = this.add.graphics();

    for (let index = 0; index < 46; index += 1) {
      const angle = Phaser.Math.DegToRad(index * (360 / 46));
      const inner = (42 + (index % 3) * 18) * scale;
      const outer = (220 + (index % 4) * 34) * scale;
      const color = index % 4 === 0 ? 0xffffff : index % 3 === 0 ? 0x42e878 : 0xffcf5a;

      burst.lineStyle(index % 4 === 0 ? 2.4 * scale : 3.4 * scale, color, index % 4 === 0 ? 0.45 : 0.64);
      burst.lineBetween(
        Math.cos(angle) * inner,
        Math.sin(angle) * inner,
        Math.cos(angle) * outer,
        Math.sin(angle) * outer
      );
    }

    const ribbonY = 84 * scale;
    const ribbon = this.add.image(0, ribbonY, "truco-ribbon")
      .setDisplaySize(620 * scale, 160 * scale);

    const raiseTitleFont = "Impact, Arial Black, Arial";
    const titleGlow = this.add.text(0, 0, `${valueUpper}!`, {
      color: "#ffcf5a",
      fontFamily: raiseTitleFont,
      fontSize: `${128 * scale}px`,
      fontStyle: "900",
      stroke: "#3b1700",
      strokeThickness: 24 * scale,
      shadow: {
        offsetX: 0,
        offsetY: 10 * scale,
        color: "#000000",
        blur: 14 * scale,
        stroke: true,
        fill: true
      }
    }).setOrigin(0.5);

    titleGlow.setAlpha(0.42);

    const title = this.add.text(0, 0, `${valueUpper}!`, {
      color: "#fff7d7",
      fontFamily: raiseTitleFont,
      fontSize: `${120 * scale}px`,
      fontStyle: "900",
      stroke: "#9c4b00",
      strokeThickness: 13 * scale,
      shadow: {
        offsetX: 0,
        offsetY: 6 * scale,
        color: "#4f2100",
        blur: 0,
        stroke: true,
        fill: true
      }
    }).setOrigin(0.5);

    const shine = this.add.graphics();

    shine.fillStyle(0xffffff, 0.26);
    shine.fillEllipse(-52 * scale, -34 * scale, 170 * scale, 30 * scale);
    shine.setRotation(-0.14);

    const captionY = 184 * scale;
    const captionBg = this.add.graphics();

    captionBg.fillStyle(0x000000, 0.68);
    captionBg.fillRoundedRect(-92 * scale, captionY - 17 * scale, 184 * scale, 34 * scale, 8 * scale);
    captionBg.lineStyle(1 * scale, 0xffcf5a, 0.72);
    captionBg.strokeRoundedRect(-92 * scale, captionY - 17 * scale, 184 * scale, 34 * scale, 8 * scale);

    const captionName = this.add.text(0, captionY, `${playerName} pediu `, {
      color: "#f8f1d9",
      fontFamily: "Arial",
      fontSize: `${18 * scale}px`
    }).setOrigin(1, 0.5);
    const captionValue = this.add.text(0, captionY, valueUpper.toLowerCase(), {
      color: "#ffcf5a",
      fontFamily: "Arial",
      fontSize: `${18 * scale}px`,
      fontStyle: "bold"
    }).setOrigin(0, 0.5);

    const makeStar = (x: number, y: number, size: number): Phaser.GameObjects.Container => {
      const star = this.add.container(x, y);
      const g = this.add.graphics();
      const points: Phaser.Math.Vector2[] = [];

      for (let index = 0; index < 10; index += 1) {
        const radius = (index % 2 === 0 ? size : size * 0.45) * scale;
        const angle = Phaser.Math.DegToRad(-90 + index * 36);

        points.push(new Phaser.Math.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
      }

      g.fillStyle(0xfff3a3, 1);
      g.fillPoints(points, true);
      g.lineStyle(2 * scale, 0xd98008, 0.95);
      g.strokePoints(points, true, true);
      star.add(g);
      return star;
    };
    const stars: Phaser.GameObjects.Container[] = [];

    [
      [-250, -70, 16],
      [-188, 98, 24],
      [-52, 128, 18],
      [82, -118, 16],
      [214, 112, 22],
      [268, -40, 15]
    ].forEach(([x, y, size]) => {
      stars.push(makeStar(x * scale, y * scale, size));
    });

    const confetti: Phaser.GameObjects.Graphics[] = [];

    for (let index = 0; index < 22; index += 1) {
      const g = this.add.graphics();
      const color = index % 3 === 0 ? 0xffcf5a : index % 3 === 1 ? 0x42e878 : 0xffffff;

      g.fillStyle(color, 0.92);
      g.fillRoundedRect(-4 * scale, -9 * scale, 8 * scale, 18 * scale, 2 * scale);
      g.setPosition(Phaser.Math.Between(-310, 310) * scale, Phaser.Math.Between(-145, 135) * scale);
      g.setRotation(Phaser.Math.FloatBetween(-1.2, 1.2));
      confetti.push(g);
    }

    const flyingCards = [
      { x: -260 * scale, y: -54 * scale, rotation: -0.42, card: { id: "anim-6-clubs", rank: "6", suit: "clubs" } as Card },
      { x: 262 * scale, y: -62 * scale, rotation: 0.34, card: { id: "anim-6-diamonds", rank: "6", suit: "diamonds" } as Card },
      { x: -302 * scale, y: 78 * scale, rotation: -0.2, card: null },
      { x: 318 * scale, y: 70 * scale, rotation: 0.28, card: null }
    ].map((item) => {
      const card = item.card ? this.createCard(item.card, false) : this.createCardBack();

      card.setPosition(item.x, item.y);
      card.setScale(0.78 * scale);
      card.setRotation(item.rotation);
      card.setAlpha(0);
      return card;
    });

    container.add([
      glow,
      burst,
      ...confetti,
      ...stars,
      ...flyingCards,
      ribbon,
      titleGlow,
      title,
      shine,
      captionBg,
      captionName,
      captionValue
    ]);

    stars.forEach((star, index) => {
      star.setAlpha(0);
      star.setScale(0.35);
      this.tweens.add({
        targets: star,
        alpha: 1,
        scale: { from: 0.35, to: 1 },
        angle: index % 2 === 0 ? 18 : -18,
        delay: 110 + index * 42,
        duration: 360,
        ease: "Back.Out",
        yoyo: true,
        repeat: 1
      });
    });

    confetti.forEach((piece, index) => {
      piece.setAlpha(0);
      this.tweens.add({
        targets: piece,
        alpha: { from: 0, to: 1 },
        y: piece.y + Phaser.Math.Between(24, 70) * scale,
        x: piece.x + Phaser.Math.Between(-28, 28) * scale,
        rotation: piece.rotation + Phaser.Math.FloatBetween(-1.6, 1.6),
        delay: 80 + index * 18,
        duration: 800,
        ease: "Cubic.Out"
      });
    });

    flyingCards.forEach((card, index) => {
      const targetY = card.y;

      card.setY(card.y + (index < 2 ? -170 : 150) * scale);
      this.tweens.add({
        targets: card,
        alpha: 1,
        y: targetY,
        rotation: card.rotation + (index % 2 === 0 ? -0.16 : 0.16),
        delay: 130 + index * 80,
        duration: 560,
        ease: "Back.Out"
      });
    });

    this.tweens.add({
      targets: burst,
      alpha: { from: 0.28, to: 0.8 },
      scale: { from: 0.62, to: 1.06 },
      duration: 520,
      ease: "Cubic.Out"
    });

    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 320,
      ease: "Back.Out",
      onComplete: () => {
        this.tweens.add({
          targets: [title, titleGlow],
          scaleX: 1.04,
          scaleY: 1.04,
          yoyo: true,
          repeat: 2,
          duration: 170,
          ease: "Sine.Out"
        });

        this.tweens.add({
          targets: glow,
          alpha: 0.68,
          scale: 1.08,
          yoyo: true,
          repeat: 3,
          duration: 260,
          ease: "Sine.InOut"
        });

        this.time.delayedCall(1450, () => {
          this.tweens.add({
            targets: container,
            alpha: 0,
            y: container.y - 92 * scale,
            scale: 0.76,
            duration: 420,
            ease: "Cubic.In",
            onComplete: () => container.destroy()
          });
        });
      }
    });

    this.cameras.main.shake(240, 0.007);
    return animationDurationMs;
  }

  private playGameWinTrucoStyleAnimation(): void {
    const width = this.getViewWidth();
    const height = this.getViewHeight();
    const scale = Phaser.Math.Clamp(Math.min(width / 860, height / 920), 0.72, 1.08);
    const container = this.add.container(width / 2, height / 2 + 30 * scale);

    container.setDepth(50000);
    container.setAlpha(0);
    container.setScale(0.42);

    const glow = this.add.graphics();

    glow.fillStyle(0xffcf5a, 0.18);
    glow.fillCircle(0, 0, 300 * scale);
    glow.fillStyle(0x42e878, 0.1);
    glow.fillCircle(0, 18 * scale, 230 * scale);
    glow.fillStyle(0xffffff, 0.08);
    glow.fillCircle(0, -10 * scale, 165 * scale);

    const burst = this.add.graphics();

    for (let index = 0; index < 52; index += 1) {
      const angle = Phaser.Math.DegToRad(index * (360 / 52));
      const inner = (44 + (index % 3) * 18) * scale;
      const outer = (220 + (index % 4) * 38) * scale;
      const color = index % 4 === 0 ? 0xffffff : index % 3 === 0 ? 0x42e878 : 0xffcf5a;

      burst.lineStyle(index % 4 === 0 ? 2.4 * scale : 3.6 * scale, color, index % 4 === 0 ? 0.45 : 0.66);
      burst.lineBetween(
        Math.cos(angle) * inner,
        Math.sin(angle) * inner,
        Math.cos(angle) * outer,
        Math.sin(angle) * outer
      );
    }

    const ribbonY = 88 * scale;
    const ribbon = this.add.image(0, ribbonY, "truco-ribbon")
      .setDisplaySize(640 * scale, 164 * scale);

    const crown = this.add.container(0, -168 * scale);
    const crownGraphic = this.add.graphics();
    const crownScale = (130 * scale) / 24;
    const crownLeft = -12 * crownScale;
    const crownTop = -14 * crownScale;
    const crownPoint = (px: number, py: number) => new Phaser.Math.Vector2(crownLeft + px * crownScale, crownTop + py * crownScale);

    crownGraphic.fillStyle(0xffcf5a, 1);
    crownGraphic.fillPoints([
      crownPoint(5, 16),
      crownPoint(3, 5),
      crownPoint(8.5, 10),
      crownPoint(12, 4),
      crownPoint(15.5, 10),
      crownPoint(21, 5),
      crownPoint(19, 16)
    ], true);
    crownGraphic.fillRoundedRect(crownLeft + 5 * crownScale, crownTop + 18 * crownScale, 14 * crownScale, 2 * crownScale, crownScale);
    crown.add(crownGraphic);

    const winTitleFont = "Impact, Arial Black, Arial";
    const titleGlow = this.add.text(0, 0, "VITORIA!", {
      color: "#ffcf5a",
      fontFamily: winTitleFont,
      fontSize: `${126 * scale}px`,
      fontStyle: "900",
      stroke: "#3b1700",
      strokeThickness: 24 * scale,
      shadow: {
        offsetX: 0,
        offsetY: 10 * scale,
        color: "#000000",
        blur: 14 * scale,
        stroke: true,
        fill: true
      }
    }).setOrigin(0.5);

    titleGlow.setAlpha(0.45);

    const title = this.add.text(0, 0, "VITORIA!", {
      color: "#fff7d7",
      fontFamily: winTitleFont,
      fontSize: `${118 * scale}px`,
      fontStyle: "900",
      stroke: "#9c4b00",
      strokeThickness: 13 * scale,
      shadow: {
        offsetX: 0,
        offsetY: 6 * scale,
        color: "#4f2100",
        blur: 0,
        stroke: true,
        fill: true
      }
    }).setOrigin(0.5);

    const shine = this.add.graphics();

    shine.fillStyle(0xffffff, 0.25);
    shine.fillEllipse(-50 * scale, -34 * scale, 170 * scale, 30 * scale);
    shine.setRotation(-0.14);

    const captionY = 186 * scale;
    const captionBg = this.add.graphics();

    captionBg.fillStyle(0x000000, 0.7);
    captionBg.fillRoundedRect(-112 * scale, captionY - 17 * scale, 224 * scale, 34 * scale, 8 * scale);
    captionBg.lineStyle(1 * scale, 0xffcf5a, 0.72);
    captionBg.strokeRoundedRect(-112 * scale, captionY - 17 * scale, 224 * scale, 34 * scale, 8 * scale);

    const caption = this.add.text(0, captionY, "voce ganhou o jogo", {
      color: "#fff3c0",
      fontFamily: "Arial",
      fontSize: `${18 * scale}px`,
      fontStyle: "bold"
    }).setOrigin(0.5);

    const makeStar = (x: number, y: number, size: number): Phaser.GameObjects.Container => {
      const star = this.add.container(x, y);
      const g = this.add.graphics();
      const points: Phaser.Math.Vector2[] = [];

      for (let index = 0; index < 10; index += 1) {
        const radius = (index % 2 === 0 ? size : size * 0.45) * scale;
        const angle = Phaser.Math.DegToRad(-90 + index * 36);

        points.push(new Phaser.Math.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
      }

      g.fillStyle(0xfff3a3, 1);
      g.fillPoints(points, true);
      g.lineStyle(2 * scale, 0xd98008, 0.95);
      g.strokePoints(points, true, true);
      star.add(g);
      return star;
    };
    const stars: Phaser.GameObjects.Container[] = [];

    [
      [-268, -68, 18],
      [-206, 98, 24],
      [-60, 132, 18],
      [78, -128, 16],
      [214, 116, 23],
      [282, -42, 16]
    ].forEach(([x, y, size]) => {
      stars.push(makeStar(x * scale, y * scale, size));
    });

    const confetti: Phaser.GameObjects.Graphics[] = [];

    for (let index = 0; index < 32; index += 1) {
      const piece = this.add.graphics();
      const color = [0xffcf5a, 0xffffff, 0x42e878, 0x38bdf8, 0xf97316][index % 5];

      piece.fillStyle(color, 0.94);
      piece.fillRoundedRect(-4 * scale, -9 * scale, 8 * scale, 18 * scale, 2 * scale);
      piece.setPosition(Phaser.Math.Between(-330, 330) * scale, Phaser.Math.Between(-155, 145) * scale);
      piece.setRotation(Phaser.Math.FloatBetween(-1.2, 1.2));
      confetti.push(piece);
    }

    const flyingCards = [
      { x: -268 * scale, y: -58 * scale, rotation: -0.42, card: { id: "win-ace-spades", rank: "A", suit: "spades" } as Card },
      { x: 268 * scale, y: -62 * scale, rotation: 0.34, card: { id: "win-seven-diamonds", rank: "7", suit: "diamonds" } as Card },
      { x: -318 * scale, y: 82 * scale, rotation: -0.18, card: null },
      { x: 318 * scale, y: 76 * scale, rotation: 0.24, card: null }
    ].map((item) => {
      const card = item.card ? this.createCard(item.card, false) : this.createCardBack();

      card.setPosition(item.x, item.y);
      card.setScale(0.78 * scale);
      card.setRotation(item.rotation);
      card.setAlpha(0);
      return card;
    });

    container.add([
      glow,
      burst,
      ...confetti,
      ...stars,
      ...flyingCards,
      ribbon,
      crown,
      titleGlow,
      title,
      shine,
      captionBg,
      caption
    ]);

    stars.forEach((star, index) => {
      star.setAlpha(0);
      star.setScale(0.35);
      this.tweens.add({
        targets: star,
        alpha: 1,
        scale: { from: 0.35, to: 1 },
        angle: index % 2 === 0 ? 18 : -18,
        delay: 110 + index * 42,
        duration: 360,
        ease: "Back.Out",
        yoyo: true,
        repeat: 2
      });
    });

    confetti.forEach((piece, index) => {
      piece.setAlpha(0);
      this.tweens.add({
        targets: piece,
        alpha: { from: 0, to: 1 },
        y: piece.y + Phaser.Math.Between(42, 110) * scale,
        x: piece.x + Phaser.Math.Between(-40, 40) * scale,
        rotation: piece.rotation + Phaser.Math.FloatBetween(-2.4, 2.4),
        delay: 80 + index * 15,
        duration: 1150,
        ease: "Cubic.Out"
      });
    });

    flyingCards.forEach((card, index) => {
      const targetY = card.y;

      card.setY(card.y + (index < 2 ? -180 : 155) * scale);
      this.tweens.add({
        targets: card,
        alpha: 1,
        y: targetY,
        rotation: card.rotation + (index % 2 === 0 ? -0.16 : 0.16),
        delay: 130 + index * 80,
        duration: 560,
        ease: "Back.Out"
      });
    });

    this.tweens.add({
      targets: burst,
      alpha: { from: 0.28, to: 0.84 },
      scale: { from: 0.62, to: 1.06 },
      duration: 520,
      ease: "Cubic.Out"
    });

    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 320,
      ease: "Back.Out",
      onComplete: () => {
        this.tweens.add({
          targets: [title, titleGlow],
          scaleX: 1.04,
          scaleY: 1.04,
          yoyo: true,
          repeat: 3,
          duration: 170,
          ease: "Sine.Out"
        });

        this.tweens.add({
          targets: glow,
          alpha: 0.68,
          scale: 1.08,
          yoyo: true,
          repeat: 5,
          duration: 260,
          ease: "Sine.InOut"
        });

        this.tweens.add({
          targets: crown,
          y: crown.y - 6 * scale,
          scaleX: 1.01,
          scaleY: 1.01,
          yoyo: true,
          repeat: 5,
          duration: 260,
          ease: "Sine.InOut"
        });

        this.time.delayedCall(2600, () => {
          this.tweens.add({
            targets: container,
            alpha: 0,
            y: container.y - 92 * scale,
            scale: 0.76,
            duration: 420,
            ease: "Cubic.In",
            onComplete: () => container.destroy()
          });
        });
      }
    });

    this.cameras.main.flash(260, 255, 207, 90, true);
    this.cameras.main.shake(260, 0.007);
  }

  private playGameWinAnimation(): void {
    this.playGameWinTrucoStyleAnimation();
    return;
    const width = this.getViewWidth();
    const height = this.getViewHeight();
    const container = this.add.container(width / 2, height / 2);

    container.setDepth(50000);
    container.setAlpha(0);
    container.setScale(0.78);

    const glow = this.add.graphics();

    glow.fillStyle(0xffcf5a, 0.18);
    glow.fillCircle(0, 0, 210);
    glow.fillStyle(0xffffff, 0.11);
    glow.fillCircle(0, 0, 150);

    const burst = this.add.graphics();

    for (let index = 0; index < 28; index += 1) {
      const angle = Phaser.Math.DegToRad(index * (360 / 28));
      const inner = index % 2 === 0 ? 82 : 54;
      const outer = index % 2 === 0 ? 220 : 176;

      burst.lineStyle(index % 2 === 0 ? 5 : 3, index % 3 === 0 ? 0xffffff : 0xffcf5a, 0.58);
      burst.lineBetween(
        Math.cos(angle) * inner,
        Math.sin(angle) * inner,
        Math.cos(angle) * outer,
        Math.sin(angle) * outer
      );
    }

    const plate = this.add.graphics();

    plate.fillGradientStyle(0x135c3f, 0x0a3428, 0x061c16, 0x020a08, 1);
    plate.fillRoundedRect(-250, -92, 500, 184, 24);
    plate.lineStyle(5, 0xffcf5a, 1);
    plate.strokeRoundedRect(-250, -92, 500, 184, 24);
    plate.lineStyle(2, 0xffffff, 0.6);
    plate.strokeRoundedRect(-236, -78, 472, 156, 18);

    const crown = this.add.text(0, -64, "♛", {
      color: "#ffcf5a",
      fontFamily: "Arial Black",
      fontSize: "58px",
      fontStyle: "900",
      stroke: "#000000",
      strokeThickness: 5
    }).setOrigin(0.5);

    const titleGlow = this.add.text(0, -5, "VOCE GANHOU", {
      color: "#ffcf5a",
      fontFamily: "Arial Black",
      fontSize: "46px",
      fontStyle: "900",
      stroke: "#000000",
      strokeThickness: 12
    }).setOrigin(0.5);

    titleGlow.setAlpha(0.45);

    const title = this.add.text(0, -5, "VOCE GANHOU", {
      color: "#ffffff",
      fontFamily: "Arial Black",
      fontSize: "42px",
      fontStyle: "900",
      stroke: "#7a3500",
      strokeThickness: 6
    }).setOrigin(0.5);

    const subtitle = this.add.text(0, 50, "O JOGO", {
      color: "#fff3a3",
      fontFamily: "Arial Black",
      fontSize: "30px",
      fontStyle: "900",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5);

    container.add([glow, burst, plate, crown, titleGlow, title, subtitle]);

    const confettiColors = [0xffcf5a, 0xffffff, 0x35d399, 0x38bdf8, 0xf97316];

    for (let index = 0; index < 42; index += 1) {
      const piece = this.add.rectangle(
        Phaser.Math.Between(-260, 260),
        Phaser.Math.Between(-230, -120),
        Phaser.Math.Between(6, 14),
        Phaser.Math.Between(10, 18),
        confettiColors[index % confettiColors.length],
        0.95
      );

      piece.setRotation(Phaser.Math.FloatBetween(-1.2, 1.2));
      piece.setDepth(50001);
      container.add(piece);

      this.tweens.add({
        targets: piece,
        y: Phaser.Math.Between(160, 260),
        x: piece.x + Phaser.Math.Between(-70, 70),
        rotation: piece.rotation + Phaser.Math.FloatBetween(3, 7),
        alpha: 0,
        duration: Phaser.Math.Between(1500, 2500),
        delay: Phaser.Math.Between(100, 550),
        ease: "Cubic.In"
      });
    }

    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 420,
      ease: "Back.Out",
      onComplete: () => {
        this.tweens.add({
          targets: [glow, burst],
          scale: 1.08,
          alpha: 0.75,
          yoyo: true,
          repeat: 5,
          duration: 260,
          ease: "Sine.InOut"
        });

        this.tweens.add({
          targets: crown,
          y: crown.y - 10,
          yoyo: true,
          repeat: 5,
          duration: 260,
          ease: "Sine.InOut"
        });

        this.time.delayedCall(2800, () => {
          this.tweens.add({
            targets: container,
            alpha: 0,
            scale: 1.12,
            duration: 420,
            ease: "Cubic.In",
            onComplete: () => container.destroy()
          });
        });
      }
    });

    this.cameras.main.flash(260, 255, 207, 90, true);
    this.cameras.main.shake(240, 0.004);
  }

  private animateOpponentPlayIfNeeded(): void {
    if (!this.previousRoomState || !this.roomState?.self) {
      return;
    }

    const previousTable = this.previousRoomState.table;
    const currentTable = this.roomState.table;

    if (currentTable.length <= previousTable.length) {
      return;
    }

    const playedEntry = currentTable[currentTable.length - 1];

    if (playedEntry.playerId === this.roomState.self.id || this.animatingTableCardIds.has(playedEntry.card.id)) {
      return;
    }

    const previousOpponent = this.previousRoomState.players.find((player) => player.id === playedEntry.playerId);
    const previousCardIndex = previousOpponent?.hand.findIndex((card) => card.id === playedEntry.card.id) ?? -1;
    const opponentCardCount = previousOpponent?.hand.length ?? 1;
    const opponentSpacing = Math.min(82, this.getViewWidth() / 4.8);
    const opponentStartX = -((opponentCardCount - 1) * opponentSpacing) / 2;
    const fromX = this.opponentHandGroup.x + opponentStartX + Math.max(previousCardIndex, 0) * opponentSpacing;
    const fromY = this.opponentHandGroup.y;
    const targetPosition = this.getTableCardPosition(playedEntry.playerId, currentTable.length - 1, currentTable.length);
    const toX = this.tableGroup.x + targetPosition.x;
    const toY = this.tableGroup.y + targetPosition.y;
    const animatedCard = this.createTableCard(playedEntry);

    this.playGameSound("card-place", 0.75);
    this.animatingTableCardIds.add(playedEntry.card.id);
    animatedCard.setPosition(fromX, fromY);
    animatedCard.setScale(0.72 * this.uiScale);
    animatedCard.setDepth(30);

    this.tweens.add({
      targets: animatedCard,
      x: toX,
      y: toY,
      scale: this.tableCardScale * this.uiScale,
      duration: 520,
      ease: "Cubic.Out",
      onComplete: () => {
        animatedCard.destroy();
        this.animatingTableCardIds.delete(playedEntry.card.id);
        this.renderState();
      }
    });
  }

  private animateDealIfNeeded(): void {
    if (!this.previousRoomState || !this.roomState?.self || this.roomState.status !== "playing") {
      return;
    }

    const isNewHand = this.previousRoomState.handSequence !== this.roomState.handSequence;
    const previousSelfHandIds = new Set(this.previousRoomState.self?.hand.map((card) => card.id) ?? []);
    const selfCards = isNewHand
      ? [...this.roomState.self.hand]
      : this.roomState.self.hand.filter((card) => !previousSelfHandIds.has(card.id));
    const opponent = this.roomState.players.find((player) => player.id !== this.roomState?.self?.id);
    const previousOpponent = this.previousRoomState?.players.find((player) => player.id === opponent?.id);
    const previousOpponentHandIds = new Set(previousOpponent?.hand.map((card) => card.id) ?? []);
    const opponentCards = isNewHand
      ? [...(opponent?.hand ?? [])]
      : opponent?.hand.filter((card) => !previousOpponentHandIds.has(card.id)) ?? [];
    const cardsToAnimate: Array<{ card: Card; owner: "self" | "opponent"; hand: Card[] }> = [];
    const dealCount = Math.max(selfCards.length, opponentCards.length);

    for (let index = 0; index < dealCount; index += 1) {
      const selfCard = selfCards[index];
      const opponentCard = opponentCards[index];

      if (selfCard) {
        cardsToAnimate.push({
          card: selfCard,
          owner: "self",
          hand: this.roomState.self.hand
        });
      }

      if (opponentCard) {
        cardsToAnimate.push({
          card: opponentCard,
          owner: "opponent",
          hand: opponent?.hand ?? []
        });
      }
    }

    if (cardsToAnimate.length === 0) {
      return;
    }

    const expectedHandSequence = this.roomState.handSequence;
    const dealAnimationKey = `${expectedHandSequence}:${cardsToAnimate.map((item) => item.card.id).join(",")}`;

    if (this.activeDealAnimationKey === dealAnimationKey) {
      return;
    }

    this.activeDealAnimationKey = dealAnimationKey;
    if (isNewHand && this.roomState.vira) {
      this.animatingViraHandSequence = expectedHandSequence;
    }

    for (const item of cardsToAnimate) {
      this.animatingHandCardIds.add(item.card.id);
    }

    this.time.delayedCall(0, () => {
      this.playDeckShuffleAnimation(() => {
        if (this.activeDealAnimationKey !== dealAnimationKey || this.roomState?.handSequence !== expectedHandSequence) {
          return;
        }

        this.animateViraAfterShuffleIfNeeded(expectedHandSequence, () => {
          this.animateDealtCards(cardsToAnimate);
        });
      });
    });
  }

  private animateViraAfterShuffleIfNeeded(expectedHandSequence: number, onComplete: () => void): void {
    const vira = this.roomState?.vira;

    if (!vira || this.animatingViraHandSequence !== expectedHandSequence) {
      onComplete();
      return;
    }

    const animatedVira = this.createCard(vira, false);

    animatedVira.setPosition(this.deckGroup.x, this.deckGroup.y);
    animatedVira.setScale(this.deckCardScale * this.uiScale);
    animatedVira.setRotation(Phaser.Math.DegToRad(6));
    animatedVira.setDepth(11);

    this.tweens.add({
      targets: animatedVira,
      x: this.viraGroup.x,
      y: this.viraGroup.y,
      rotation: 0,
      duration: 360,
      ease: "Cubic.Out",
      onComplete: () => {
        animatedVira.destroy();
        this.animatingViraHandSequence = null;
        this.renderVira();
        onComplete();
      }
    });
  }

  private animateDealtCards(cardsToAnimate: Array<{ card: Card; owner: "self" | "opponent"; hand: Card[] }>): void {
    cardsToAnimate.forEach((item, index) => {
      const handIndex = item.hand.findIndex((card) => card.id === item.card.id);
      const fromX = this.deckGroup.x;
      const fromY = this.deckGroup.y;
      const target = item.owner === "self"
        ? this.getHandCardTarget(item.hand, handIndex)
        : this.getOpponentHandCardTarget(item.hand, handIndex);
      const animatedCard = this.createCardBack();

      animatedCard.setPosition(fromX, fromY);
      animatedCard.setScale(this.deckCardScale * this.uiScale);
      animatedCard.setDepth(60 + index);

      this.tweens.add({
        targets: animatedCard,
        x: target.x,
        y: target.y,
        scale: target.scale,
        rotation: target.rotation,
        duration: 460,
        delay: index * 90,
        ease: "Cubic.Out",
        onStart: () => {
          if (index === 0) {
            this.playGameSound("cards-deal", 0.72);
          }
        },
        onComplete: () => {
          if (item.owner === "self" && !this.roomState?.isIronHand) {
            if (this.revealedDealCardIds.has(item.card.id)) {
              animatedCard.destroy();
              this.finishDealAnimation(item.card.id);
              return;
            }

            this.revealedDealCardIds.add(item.card.id);
            this.revealDealtCard(animatedCard, item.card, target);
            return;
          }

          animatedCard.destroy();
          this.finishDealAnimation(item.card.id);
        }
      });
    });
  }

  private playDeckShuffleAnimation(onComplete: () => void): void {
    if (this.deckGroup.list.length === 0) {
      this.renderDeck();
    }

    this.playGameSound("cards-shuffle", 0.72);

    const deckCards = this.deckGroup.list.filter((child): child is Phaser.GameObjects.Container =>
      child instanceof Phaser.GameObjects.Container
    );

    if (deckCards.length === 0) {
      onComplete();
      return;
    }

    const basePositions = deckCards.map((card) => ({
      x: card.x,
      y: card.y,
      rotation: card.rotation,
      scaleX: card.scaleX,
      scaleY: card.scaleY
    }));
    let topDepth = 80;
    let pass = 0;
    const passes = 6;
    let deckOrder = [...deckCards];

    deckCards.forEach((card, index) => {
      this.deckGroup.moveTo(card, index);
    });

    const playPass = () => {
      const card = deckOrder[0];
      const base = basePositions[0];
      const side = pass % 2 === 0 ? -1 : 1;
      const nextOrder = [...deckOrder.slice(1), card];
      let finishedTweens = 0;

      const finishPassTween = () => {
        finishedTweens += 1;

        if (finishedTweens < deckOrder.length) {
          return;
        }

        deckOrder = nextOrder;

        deckOrder.forEach((deckCard, deckIndex) => {
          this.deckGroup.moveTo(deckCard, deckIndex);
        });

        pass += 1;

        if (pass < passes) {
          playPass();
          return;
        }

        deckOrder.forEach((deckCard, deckIndex) => {
          const target = basePositions[deckIndex];

          this.deckGroup.moveTo(deckCard, deckIndex);
          this.tweens.add({
            targets: deckCard,
            x: target.x,
            y: target.y,
            rotation: target.rotation,
            scaleX: target.scaleX,
            scaleY: target.scaleY,
            duration: 220,
            ease: "Back.easeOut",
            onComplete: deckIndex === deckOrder.length - 1 ? onComplete : undefined
          });
        });
      };

      this.tweens.add({
        targets: card,
        x: base.x + side * 76 * this.uiScale,
        y: base.y + 8 * this.uiScale,
        rotation: base.rotation + Phaser.Math.DegToRad(side * 8),
        duration: 130,
        ease: "Sine.easeOut",
        onComplete: () => {
          this.deckGroup.bringToTop(card);
          card.setDepth(topDepth);
          topDepth += 1;

          deckOrder.slice(1).forEach((deckCard, deckIndex) => {
            const target = basePositions[deckIndex];

            this.tweens.add({
              targets: deckCard,
              x: target.x,
              y: target.y,
              rotation: target.rotation,
              duration: 100,
              ease: "Sine.easeInOut",
              onComplete: finishPassTween
            });
          });

          this.tweens.add({
            targets: card,
            x: basePositions[basePositions.length - 1].x - side * 8 * this.uiScale,
            y: basePositions[basePositions.length - 1].y - 18 * this.uiScale,
            rotation: basePositions[basePositions.length - 1].rotation + Phaser.Math.DegToRad(-side * 7),
            duration: 110,
            ease: "Cubic.easeInOut",
            onComplete: () => {
              this.tweens.add({
                targets: card,
                x: basePositions[basePositions.length - 1].x,
                y: basePositions[basePositions.length - 1].y,
                rotation: basePositions[basePositions.length - 1].rotation,
                scaleX: basePositions[basePositions.length - 1].scaleX,
                scaleY: basePositions[basePositions.length - 1].scaleY,
                duration: 40,
                ease: "Back.easeOut",
                onComplete: finishPassTween
              });
            }
          });
        }
      });
    };

    playPass();
  }

  private revealDealtCard(
    cardBack: Phaser.GameObjects.Container,
    card: Card,
    target: { x: number; y: number; scale: number; rotation: number }
  ): void {
    this.playGameSound("card-flip", 0.56);
    this.animatingHandCardIds.delete(card.id);
    this.renderState();
    cardBack.destroy();

    if (this.animatingHandCardIds.size === 0) {
      this.activeDealAnimationKey = null;
    }
  }

  private finishDealAnimation(cardId: string): void {
    this.animatingHandCardIds.delete(cardId);

    if (this.animatingHandCardIds.size === 0) {
      this.activeDealAnimationKey = null;
      this.renderState();
    }
  }

  private canRaiseTruco(): boolean {
    const handValue = this.roomState?.handValue ?? 1;
    const self = this.roomState?.self;
    const isPlaying = this.roomState?.status === "playing";
    const isMyTurn = Boolean(self && this.roomState?.turnPlayerId === self.id);
    const selfPoints = self?.points ?? 0;
    const hasElevenHand = Boolean(
      this.roomState?.isIronHand ||
      this.roomState?.elevenHandDecision ||
      this.roomState?.players.some((player) => player.points === 11)
    );
    const lastRaiseWasMine = this.roomState?.lastTrucoRaise?.playerId === self?.id;

    return isPlaying &&
      isMyTurn &&
      !hasElevenHand &&
      !this.roomState?.trucoRequest &&
      !lastRaiseWasMine &&
      selfPoints !== 11 &&
      handValue < 12;
  }

  private renderTrucoButton(): void {
    const handValue = this.roomState?.handValue ?? 1;
    const label = {
      1: "Truco",
      3: "Seis",
      6: "Nove",
      9: "Doze",
      12: "Doze"
    }[handValue];
    const enabled = this.canRaiseTruco();

    this.drawTrucoRaiseButton(label, true);
    this.setTrucoButtonInteractive(enabled);
    this.setTrucoButtonVisibility(enabled);
  }

  private renderTrucoResponse(): void {
    const request = this.roomState?.trucoRequest;
    const responseKey = this.roomState ? this.getTrucoResponseKey(this.roomState) : null;
    const timerKey = this.roomState ? this.getTrucoRequestTimerKey(this.roomState) : null;
    const shouldRespond = Boolean(
      responseKey &&
      (this.visibleTrucoResponseKey === responseKey || this.delayedTrucoResponseKey !== responseKey)
    );

    if (request) {
      const raiseLabel = {
        3: "SEIS",
        6: "NOVE",
        9: "DOZE",
        12: "DOZE"
      }[request.requestedValue];
      const requestLabel = {
        3: "truco",
        6: "seis",
        9: "nove",
        12: "doze"
      }[request.requestedValue];

      this.trucoResponseTitle.setText(`PEDIDO DE ${requestLabel.toUpperCase()}`);
      this.trucoResponsePlayerName.setText(request.requestedByPlayerName);
      this.trucoResponseSubtitle.setText(`pediu ${requestLabel}. O que voce deseja fazer?`);
      this.layoutTrucoResponseSubtitle();
      this.trucoResponseRaiseText.setText(raiseLabel);
      this.setTrucoResponseRaiseEnabled(request.requestedValue < 12);
    }

    this.trucoResponseGroup.setVisible(shouldRespond);
    this.syncTrucoResponseTimer(timerKey);
  }

  private layoutTrucoResponseSubtitle(): void {
    const gap = -7;
    const nameWidth = this.trucoResponsePlayerName.getBounds().width;
    const subtitleWidth = this.trucoResponseSubtitle.getBounds().width;
    const totalWidth = nameWidth + gap + subtitleWidth;
    const y = -66;

    this.trucoResponsePlayerName.setPosition(-totalWidth / 2 + nameWidth / 2, y);
    this.trucoResponseSubtitle.setPosition(totalWidth / 2 - subtitleWidth / 2, y);
  }

  private syncTrucoResponseTimer(responseKey: string | null): void {
    if (!responseKey) {
      this.clearTrucoResponseTimer();
      return;
    }

    if (this.trucoResponseTimerKey !== responseKey) {
      this.trucoResponseTimerKey = responseKey;
      this.trucoResponseTimerStartedAt = Date.now();
      this.autoRejectTrucoTriggeredForKey = null;
    }

    this.drawTrucoResponseProgress();
  }

  private clearTrucoResponseTimer(): void {
    this.trucoResponseTimerKey = null;
    this.trucoResponseTimerStartedAt = 0;
    this.autoRejectTrucoTriggeredForKey = null;
    this.trucoResponseProgress?.clear();
    this.opponentTurnProgress?.clear();
    this.drawOpponentNameBox(this.hasOpponentTurnProgress());
  }

  private updateTrucoResponseProgress(): void {
    if (!this.trucoResponseTimerKey) {
      return;
    }

    this.drawTrucoResponseProgress();

    if (Date.now() - this.trucoResponseTimerStartedAt >= this.trucoResponseTimeoutMs) {
      this.autoRejectTrucoRequest();
    }
  }

  private getTrucoResponseProgressRatio(): number {
    if (!this.trucoResponseTimerKey || !this.trucoResponseTimerStartedAt) {
      return 0;
    }

    return Phaser.Math.Clamp((Date.now() - this.trucoResponseTimerStartedAt) / this.trucoResponseTimeoutMs, 0, 1);
  }

  private drawTrucoResponseProgress(): void {
    this.trucoResponseProgress.clear();
    this.opponentTurnProgress?.clear();

    if (!this.trucoResponseTimerKey) {
      return;
    }

    const state = this.roomState;
    const selfId = state?.self?.id;
    const ratio = this.getTrucoResponseProgressRatio();

    if (selfId && state?.trucoRequest?.responderPlayerId !== selfId) {
      this.drawOpponentTurnProgress(ratio);
      return;
    }

    const progressX = -250;
    const progressY = 158;
    const progressWidth = 500;
    const progressHeight = 7;

    this.trucoResponseProgress.fillStyle(0xffffff, 0.14);
    this.trucoResponseProgress.fillRoundedRect(progressX, progressY, progressWidth, progressHeight, progressHeight / 2);
    this.trucoResponseProgress.fillStyle(0xffcf5a, 0.94);
    this.trucoResponseProgress.fillRoundedRect(progressX, progressY, progressWidth * ratio, progressHeight, progressHeight / 2);
  }

  private autoRejectTrucoRequest(): void {
    const timerKey = this.trucoResponseTimerKey;
    const request = this.roomState?.trucoRequest;

    if (
      !timerKey ||
      this.autoRejectTrucoTriggeredForKey === timerKey ||
      !request ||
      request.responderPlayerId !== this.roomState?.self?.id
    ) {
      return;
    }

    this.autoRejectTrucoTriggeredForKey = timerKey;
    this.respondToTrucoRequest("reject");
  }

  private renderElevenHandDecision(): void {
    const decision = this.roomState?.elevenHandDecision;
    const shouldShow = Boolean(decision && decision.playerId === this.roomState?.self?.id);

    this.elevenHandGroup.setVisible(shouldShow);
  }

  private setTrucoResponseRaiseEnabled(enabled: boolean): void {
    const raiseButton = this.trucoResponseGroup.list.find((child) => child.name === "truco-response-raise");

    if (!(raiseButton instanceof Phaser.GameObjects.Container)) {
      return;
    }

    raiseButton.setAlpha(enabled ? 1 : 0.42);

    for (const child of raiseButton.list) {
      if (child instanceof Phaser.GameObjects.Zone) {
        if (enabled) {
          child.setInteractive({ useHandCursor: true });
        } else {
          child.disableInteractive();
        }
      }
    }
  }

  private setTrucoButtonInteractive(enabled: boolean): void {
    const width = 92 * this.actionButtonScale;
    const height = 98 * this.actionButtonScale;

    this.trucoButtonHitZone.setSize(width, height);
    this.trucoButtonHitZone.setPosition(this.trucoButton.x, this.trucoButton.y);
    this.trucoButtonHitZone.setActive(enabled);

    if (enabled) {
      this.trucoButtonHitZone.setInteractive({ useHandCursor: true });
    } else {
      this.trucoButtonHitZone.disableInteractive();
    }
  }

  private setTrucoButtonVisibility(visible: boolean): void {
    if (this.trucoButtonIsShown === visible && !this.trucoButtonVisibilityTween) {
      return;
    }

    this.trucoButtonIsShown = visible;
    this.trucoButtonVisibilityTween?.stop();
    this.trucoButtonVisibilityTween = null;

    if (visible) {
      this.trucoButton.setVisible(true);
      this.trucoButton.setAlpha(Math.min(this.trucoButton.alpha, 0.08));
      this.trucoButton.setScale(Math.min(this.trucoButton.scaleX, 0.46));
      this.trucoButtonVisibilityTween = this.tweens.add({
        targets: this.trucoButton,
        alpha: 1,
        scale: 1,
        duration: 340,
        ease: "Back.Out",
        onComplete: () => {
          this.trucoButtonVisibilityTween = null;
        }
      });
      return;
    }

    this.trucoButtonVisibilityTween = this.tweens.add({
      targets: this.trucoButton,
      alpha: 0,
      scale: 0.38,
      duration: 280,
      ease: "Back.In",
      onComplete: () => {
        this.trucoButton.setVisible(false);
        this.trucoButtonVisibilityTween = null;
      }
    });
  }

  private renderScoreboard(): void {
    this.scoreboardGroup.removeAll(true);

    const players = this.roomState?.players ?? [];
    const self = this.roomState?.self ?? players[0];
    const opponent = players.find((player) => player.id !== self?.id) ?? players[1] ?? players[0];
    const availableWidth = Math.min(this.getViewWidth() - 96 * this.uiScale, 620 * this.uiScale);
    const gap = 14 * this.uiScale;
    const sideWidth = Phaser.Math.Clamp(185 * this.uiScale, 124 * this.uiScale, availableWidth * 0.34);
    const centerWidth = Math.max(232 * this.uiScale, (availableWidth - sideWidth - gap) * 0.88);
    const sideHeight = 138 * this.uiScale;
    const centerHeight = 100 * this.uiScale;
    const leftX = -availableWidth / 2 + sideWidth / 2;
    const centerX = leftX + sideWidth / 2 + gap + centerWidth / 2;
    const handValue = this.roomState?.handValue ?? 1;
    const currentRound = Phaser.Math.Clamp((self?.roundWins ?? 0) + (opponent?.roundWins ?? 0) + 1, 1, 3);
    const mainY = -2 * this.uiScale;
    const dotsY = 58 * this.uiScale;
    const footerY = 116 * this.uiScale;
    const dotsWidth = Math.min(centerWidth * 0.64, 248 * this.uiScale);
    const dotsHeight = 46 * this.uiScale;
    const footerWidth = Math.min(centerWidth * 0.64, 246 * this.uiScale);
    const footerHeight = 66 * this.uiScale;

    const drawPanel = (
      x: number,
      y: number,
      width: number,
      height: number,
      alpha = 0.72,
      borderColor = 0xffe8a8,
      innerBorderColor = 0xfff6d8
    ) => {
      const panel = this.add.graphics();
      const left = x - width / 2;
      const top = y - height / 2;
      const radius = 18 * this.uiScale;

      panel.fillStyle(0x000000, 0.34);
      panel.fillRoundedRect(left + 2 * this.uiScale, top + 3 * this.uiScale, width, height, radius);
      panel.fillStyle(0x020403, alpha);
      panel.fillRoundedRect(left, top, width, height, radius);
      panel.lineStyle(1.2 * this.uiScale, 0x3d250d, 0.34);
      panel.strokeRoundedRect(left, top, width, height, radius);
      panel.lineStyle(0.7 * this.uiScale, borderColor, 0.74);
      panel.strokeRoundedRect(left, top, width, height, radius);
      panel.lineStyle(0.3 * this.uiScale, innerBorderColor, 0.42);
      panel.strokeRoundedRect(
        left + 2 * this.uiScale,
        top + 2 * this.uiScale,
        width - 4 * this.uiScale,
        height - 4 * this.uiScale,
        Math.max(2 * this.uiScale, radius - 3 * this.uiScale)
      );
      this.scoreboardGroup.add(panel);
    };

    const addLabel = (x: number, y: number, text: string, color = "#f8f1d9", size = 9, style = "bold") => {
      this.scoreboardGroup.add(this.add.text(x, y, text, {
        color,
        fontFamily: "Arial",
        fontSize: `${size * this.uiScale}px`,
        fontStyle: style
      }).setOrigin(0.5));
    };

    const addValue = (x: number, y: number, text: string, color = "#f8f1d9", size = 20) => {
      this.scoreboardGroup.add(this.add.text(x, y, text, {
        color,
        fontFamily: "Arial",
        fontSize: `${size * this.uiScale}px`,
        fontStyle: "bold"
      }).setOrigin(0.5));
    };

    const addRoundDot = (x: number, y: number, color: number, alpha: number, strokeColor = 0xb9b1a4) => {
      this.scoreboardGroup.add(this.add.circle(x, y, 8.2 * this.uiScale, color, alpha)
        .setStrokeStyle(1.7 * this.uiScale, strokeColor, 0.56));
    };

    const addCrownIcon = (x: number, y: number, size: number, color = 0xffcf5a) => {
      const scale = (size * this.uiScale) / 24;
      const left = x - 12 * scale;
      const top = y - 14 * scale;
      const point = (px: number, py: number) => new Phaser.Math.Vector2(left + px * scale, top + py * scale);
      const crown = this.add.graphics();

      crown.fillStyle(color, 1);
      crown.fillPoints([
        point(5, 16),
        point(3, 5),
        point(8.5, 10),
        point(12, 4),
        point(15.5, 10),
        point(21, 5),
        point(19, 16)
      ], true);
      crown.fillRoundedRect(left + 5 * scale, top + 18 * scale, 14 * scale, 2 * scale, 1 * scale);
      this.scoreboardGroup.add(crown);
    };

    drawPanel(leftX, mainY- 17 * this.uiScale, sideWidth, sideHeight);
    drawPanel(centerX, mainY - 30 * this.uiScale, centerWidth, centerHeight, 0.8);
    drawPanel(centerX, dotsY-42, dotsWidth, dotsHeight, 0.88, 0xb9b1a4, 0xe0d8ca);
    drawPanel(centerX, footerY-35, footerWidth, footerHeight, 0.86);

    addCrownIcon(leftX - 73 * this.uiScale, mainY - 60 * this.uiScale, 26);
    addLabel(leftX + 13 * this.uiScale, mainY - 60 * this.uiScale, "PLACAR DO JOGO", "#ffcf5a", 16, "normal");
    addLabel(leftX - sideWidth * 0.25, mainY - 22 * this.uiScale, "NÓS", "#42e878", 17, "normal");
    addLabel(leftX + sideWidth * 0.25, mainY - 22 * this.uiScale, "ELES", "#ff5a50", 17, "normal");
    addValue(leftX - sideWidth * 0.25, mainY + 12 * this.uiScale, String(self?.games ?? 0), "#f8f1d9", 44);
    addValue(leftX + sideWidth * 0.25, mainY + 12 * this.uiScale, String(opponent?.games ?? 0), "#ffddd8", 44);

    const selfPointsText = String(self?.points ?? 0);
    const opponentPointsText = String(opponent?.points ?? 0);
    const hasDoubleDigitPoints = selfPointsText.length > 1 || opponentPointsText.length > 1;
    const pointValueSize = hasDoubleDigitPoints ? 68 : 70;
    const pointValueOffset = hasDoubleDigitPoints ? 0.15 : 0.12;

    addLabel(centerX - centerWidth * 0.38, mainY - 35 * this.uiScale, "NÓS", "#42e878", 26, "normal");
    addValue(centerX - centerWidth * pointValueOffset, mainY - 35 * this.uiScale, selfPointsText, "#ffffff", pointValueSize);
    addLabel(centerX, mainY - 35 * this.uiScale, "X", "#79746d", 24, "normal");
    addValue(centerX + centerWidth * pointValueOffset, mainY - 35 * this.uiScale, opponentPointsText, "#ffffff", pointValueSize);
    addLabel(centerX + centerWidth * 0.38, mainY - 35 * this.uiScale, "ELES", "#ff5a50", 26, "normal");

    const trickResults = this.roomState?.trickResults ?? [];
    const getRoundDotColor = (playerId: string | undefined, index: number) => {
      const winnerPlayerId = trickResults[index]?.winnerPlayerId;

      if (!winnerPlayerId || !playerId) {
        return 0x8f8a82;
      }

      if (winnerPlayerId === playerId) {
        return 0x42e878;
      }

      return 0xff5a50;
    };

    for (let index = 0; index < 3; index += 1) {
      const x = centerX - 85 * this.uiScale + index * 25 * this.uiScale;
      const color = getRoundDotColor(self?.id, index);
      addRoundDot(x, dotsY-42, color, color === 0x8f8a82 ? 0.72 : 1);
    }
    addLabel(centerX, dotsY-42, "|", "#b9b1a4", 18, "normal");
    for (let index = 0; index < 3; index += 1) {
      const x = centerX + 35 * this.uiScale + index * 25 * this.uiScale;
      const color = getRoundDotColor(opponent?.id, index);
      addRoundDot(x, dotsY-42, color, color === 0x8f8a82 ? 0.72 : 1);
    }

    addLabel(centerX, footerY - 44 * this.uiScale, `RODADA ${currentRound}/3`, "#f8f1d9", 20);
    addLabel(centerX, footerY + -19 * this.uiScale, `VALENDO ${handValue} ${handValue === 1 ? "TENTO" : "TENTOS"}`, "#ffcf5a", 20);

    for (const child of this.scoreboardGroup.list) {
      if (child instanceof Phaser.GameObjects.Text) {
        this.sharpenText(child);
      }
    }
  }

  private renderVira(): void {
    this.viraGroup.removeAll(true);

    if (!this.roomState?.vira || this.animatingViraHandSequence === this.roomState.handSequence) {
      return;
    }

    const card = this.createCard(this.roomState.vira, false);
    card.setScale(this.deckCardScale * this.uiScale);

    this.viraGroup.add(card);
  }

  private renderDeck(): void {
    this.deckGroup.removeAll(true);

    if (this.roomState?.status === "waiting") {
      return;
    }

    for (let index = 0; index < 3; index += 1) {
      const card = this.createCardBack();
      card.setPosition(index * 3, -index * 2);
      card.setScale(this.deckCardScale * this.uiScale);
      card.setRotation(Phaser.Math.DegToRad(3));
      card.setDepth(12 + index);
      this.deckGroup.add(card);
    }

    this.viraGroup.setDepth(8);
    this.deckGroup.setDepth(12);
  }

  private renderTable(): void {
    const cards = this.roomState?.table ?? [];
    const activeCardIds = new Set<string>();

    cards.forEach((entry, index) => {
      activeCardIds.add(entry.card.id);

      if (this.animatingTableCardIds.has(entry.card.id)) {
        this.destroyCachedTableCard(entry.card.id);
        return;
      }

      const signature = this.getTableCardSignature(entry);
      const cached = this.tableCardObjects.get(entry.card.id);
      const card = cached?.signature === signature
        ? cached.container
        : this.replaceCachedTableCard(entry.card.id, this.createTableCard(entry), signature);
      const position = this.getTableCardPosition(entry.playerId, index, cards.length);

      card.setPosition(position.x, position.y);
      card.setScale(this.tableCardScale * this.uiScale);
    });

    const lastTrickWinnerId = this.roomState?.trickResults.at(-1)?.winnerPlayerId;

    for (const cardId of Array.from(this.tableCardObjects.keys())) {
      if (!activeCardIds.has(cardId)) {
        const tableEntry = this.previousRoomState?.table.find((entry) => entry.card.id === cardId);
        const isWinningCard = !!lastTrickWinnerId && tableEntry?.playerId === lastTrickWinnerId;

        this.animateCachedTableCardToDeck(cardId, isWinningCard ? 760 : 0, isWinningCard);
      }
    }
  }

  private getTableCardPosition(playerId: string, fallbackIndex: number, tableCardCount: number): { x: number; y: number } {
    const isSelf = playerId === this.roomState?.self?.id;

    if (isSelf) {
      return { x: 0, y: 190 * this.uiScale };
    }

    if (this.roomState?.self) {
      return { x: 0, y: -130 * this.uiScale };
    }

    const spacing = 92 * this.uiScale;
    const startX = -((tableCardCount - 1) * spacing) / 2;

    return { x: startX + fallbackIndex * spacing, y: 120 * this.uiScale };
  }

  private createTableCard(entry: RoomState["table"][number]): Phaser.GameObjects.Container {
    return this.isTableCardFaceDown(entry) ? this.createCardBack() : this.createCard(entry.card, false);
  }

  private getTableCardSignature(entry: RoomState["table"][number]): string {
    return this.isTableCardFaceDown(entry) ? "back" : "front";
  }

  private isTableCardFaceDown(entry: RoomState["table"][number]): boolean {
    return entry.faceDown === true || this.pendingFaceDownTableCardIds.has(entry.card.id);
  }

  private replaceCachedTableCard(
    cardId: string,
    container: Phaser.GameObjects.Container,
    signature: string
  ): Phaser.GameObjects.Container {
    this.destroyCachedTableCard(cardId);
    this.tableCardObjects.set(cardId, { container, signature });
    this.tableGroup.add(container);
    return container;
  }

  private destroyCachedTableCard(cardId: string): void {
    const cached = this.tableCardObjects.get(cardId);

    if (!cached) {
      return;
    }

    cached.container.destroy();
    this.tableCardObjects.delete(cardId);
  }

  private animateCachedTableCardToDeck(cardId: string, delay = 0, highlightWinner = false): void {
    const cached = this.tableCardObjects.get(cardId);

    if (!cached) {
      return;
    }

    this.tableCardObjects.delete(cardId);

    const card = cached.container;
    const startScale = card.scaleX || this.tableCardScale * this.uiScale;
    const targetX = this.deckGroup.x - this.tableGroup.x;
    const targetY = this.deckGroup.y - this.tableGroup.y;

    card.setDepth(80);

    if (highlightWinner) {
      this.addWinningCardGlow(card);
    }

    this.tweens.add({
      targets: card,
      scaleX: 0.04,
      duration: 130,
      delay,
      ease: "Sine.easeIn",
      onComplete: () => {
        const back = this.createCardBack();

        back.setPosition(card.x, card.y);
        back.setScale(0.04, startScale);
        back.setRotation(card.rotation);
        back.setDepth(80);
        this.tableGroup.add(back);
        card.destroy();

        this.tweens.add({
          targets: back,
          scaleX: startScale,
          duration: 130,
          ease: "Sine.easeOut",
          onComplete: () => {
            this.tweens.add({
              targets: back,
              x: targetX,
              y: targetY,
              scale: this.deckCardScale * this.uiScale,
              rotation: Phaser.Math.DegToRad(7),
              duration: 620,
              ease: "Cubic.easeIn",
              onComplete: () => {
                back.destroy();
              }
            });
          }
        });
      }
    });
  }

  private addWinningCardGlow(card: Phaser.GameObjects.Container): void {
    const glow = this.add.graphics();

    glow.fillStyle(0xfff0b0, 0.18);
    glow.fillRoundedRect(-48, -68, 96, 136, 14);
    glow.lineStyle(3, 0xffe8a8, 0.82);
    glow.strokeRoundedRect(-45, -65, 90, 130, 13);
    glow.lineStyle(1.4, 0xffffff, 0.48);
    glow.strokeRoundedRect(-39, -59, 78, 118, 10);
    glow.setDepth(-1);
    card.addAt(glow, 0);

    this.tweens.add({
      targets: glow,
      alpha: { from: 0.45, to: 1 },
      scaleX: { from: 0.96, to: 1.08 },
      scaleY: { from: 0.96, to: 1.08 },
      duration: 260,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut"
    });
  }

  private getHandCardTarget(cards: Card[], index: number): { x: number; y: number; scale: number; rotation: number } {
    const scale = this.getHandCardScale(cards.length);
    const spacing = this.getHandCardSpacing(cards.length, scale);
    const startX = -((cards.length - 1) * spacing) / 2;

    return {
      x: this.handGroup.x + startX + index * spacing,
      y: this.handGroup.y,
      scale,
      rotation: 0
    };
  }

  private getOpponentHandCardTarget(cards: Card[], index: number): { x: number; y: number; scale: number; rotation: number } {
    const spacing = Math.min(20, this.getViewWidth() / 12);
    const startX = -((cards.length - 1) * spacing) / 2;
    const middleIndex = (cards.length - 1) / 2;
    const spread = index - middleIndex;

    return {
      x: this.opponentHandGroup.x + startX + index * spacing,
      y: this.opponentHandGroup.y + Math.abs(spread) * 5,
      scale: 0.32 * this.uiScale,
      rotation: Phaser.Math.DegToRad(spread * 9)
    };
  }

  private renderHand(cards: Card[], enabled: boolean): void {
    const scale = this.getHandCardScale(cards.length);
    const spacing = this.getHandCardSpacing(cards.length, scale);
    const startX = -((cards.length - 1) * spacing) / 2;
    const middleIndex = (cards.length - 1) / 2;
    const activeCardIds = new Set<string>();

    cards.forEach((cardData, index) => {
      activeCardIds.add(cardData.id);

      if (this.animatingHandCardIds.has(cardData.id)) {
        this.destroyCachedHandCard(cardData.id);
        return;
      }

      const faceDown = Boolean(this.roomState?.isIronHand || this.faceDownHandCardIds.has(cardData.id));
      const signature = this.getHandCardSignature(enabled, faceDown);
      const cached = this.handCardObjects.get(cardData.id);
      const shouldAnimatePosition = Boolean(cached && cached.signature === signature);
      const card = cached?.signature === signature
        ? cached.container
        : this.replaceCachedHandCard(cardData.id, this.createCard(cardData, enabled, faceDown), signature);
      const spread = index - middleIndex;
      const targetX = startX + index * spacing;
      const targetY = Math.abs(spread) * 8 * this.uiScale;
      const targetRotation = Phaser.Math.DegToRad(spread * 8);

      card.setDepth(index);

      if (shouldAnimatePosition) {
        this.tweens.killTweensOf(card);
        this.tweens.add({
          targets: card,
          x: targetX,
          y: targetY,
          scale,
          rotation: targetRotation,
          duration: 420,
          ease: "Cubic.Out"
        });
      } else {
        card.setPosition(targetX, targetY);
        card.setScale(scale);
        card.setRotation(targetRotation);
      }
    });

    for (const cardId of Array.from(this.handCardObjects.keys())) {
      if (!activeCardIds.has(cardId)) {
        this.destroyCachedHandCard(cardId);
      }
    }

    this.handHintGroup.setPosition(0, 86 * scale);
    this.handHintGroup.setScale(this.uiScale);
    this.handHintGroup.setVisible(cards.length > 0 && enabled);
  }

  private getHandCardScale(cardCount: number): number {
    const maxScale = 1.74 * this.uiScale;
    const horizontalPadding = 28;
    const cardWidth = 80;

    if (cardCount <= 1) {
      return maxScale;
    }

    const maxWidth = Math.max(220, this.getViewWidth() - horizontalPadding * 2);
    const naturalWidth = cardWidth * maxScale + (cardCount - 1) * 104 * this.uiScale;

    return Math.min(maxScale, maxWidth / naturalWidth * maxScale);
  }

  private getHandCardSpacing(cardCount: number, cardScale: number): number {
    if (cardCount <= 1) {
      return 0;
    }

    const horizontalPadding = 28;
    const cardWidth = 80 * cardScale;
    const minGap = 10 * this.uiScale;
    const maxSpacing = 108 * this.uiScale;
    const availableWidth = Math.max(cardWidth, this.getViewWidth() - horizontalPadding * 2);
    const fitSpacing = (availableWidth - cardWidth) / (cardCount - 1);

    return Phaser.Math.Clamp(fitSpacing, cardWidth + minGap, maxSpacing);
  }

  private getHandCardSignature(enabled: boolean, faceDown: boolean): string {
    return `${enabled ? "enabled" : "disabled"}:${faceDown ? "back" : "front"}`;
  }

  private createHandHintGroup(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const topArrow = this.add.image(0, -20, "chevron-up-hint-icon")
      .setDisplaySize(34, 34);
    const bottomArrow = this.add.image(0, -8, "chevron-up-hint-icon")
      .setDisplaySize(34, 34)
      .setAlpha(0.72);

    const text = this.add.text(0, 28, "ARRASTE PARA JOGAR", {
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: "20px",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5);

    container.add([topArrow, bottomArrow, text]);
    container.setDepth(100);
    container.setVisible(false);
    this.tweens.add({
      targets: [topArrow, bottomArrow],
      y: "-=8",
      alpha: 0.55,
      yoyo: true,
      repeat: -1,
      duration: 520,
      ease: "Sine.InOut"
    });

    return container;
  }

  private replaceCachedHandCard(
    cardId: string,
    container: Phaser.GameObjects.Container,
    signature: string
  ): Phaser.GameObjects.Container {
    this.destroyCachedHandCard(cardId);
    this.handCardObjects.set(cardId, { container, signature });
    this.handGroup.add(container);
    return container;
  }

  private destroyCachedHandCard(cardId: string): void {
    const cached = this.handCardObjects.get(cardId);

    if (!cached) {
      return;
    }

    cached.container.destroy();
    this.handCardObjects.delete(cardId);
  }

  private clearCachedCardObjects(): void {
    for (const cardId of Array.from(this.handCardObjects.keys())) {
      this.destroyCachedHandCard(cardId);
    }

    for (const cardId of Array.from(this.tableCardObjects.keys())) {
      this.destroyCachedTableCard(cardId);
    }
  }

  private renderOpponentHand(cards: Card[]): void {
    this.opponentHandGroup.removeAll(true);

    const spacing = Math.min(20, this.getViewWidth() / 12);
    const startX = -((cards.length - 1) * spacing) / 2;
    const middleIndex = (cards.length - 1) / 2;

    cards.forEach((cardData, index) => {
      if (this.animatingHandCardIds.has(cardData.id)) {
        return;
      }

      const card = this.createCardBack();
      const spread = index - middleIndex;

      card.setPosition(startX + index * spacing, Math.abs(spread) * 5);
      card.setRotation(Phaser.Math.DegToRad(spread * 9));
      card.setScale(0.62 * this.uiScale);//Tamanho carta dos oponenetes
      this.opponentHandGroup.add(card);
    });
  }

  private createOpponentAvatar(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    this.opponentNameGroup = this.add.container(0, 0);

    const bg = this.add.circle(0, 0, 58, 0xffffff, 1)
      .setStrokeStyle(2, 0xffcf5a, 0.9);

    const avatar = this.add.image(0, 0, "opponent-avatar")
      .setDisplaySize(opponentAvatarPhotoSize, opponentAvatarPhotoSize);
    const avatarMask = this.make.graphics({}, false);

    avatarMask.fillStyle(0xffffff, 1);
    avatarMask.fillCircle(0, 0, opponentAvatarMaskRadius);
    avatar.setMask(avatarMask.createGeometryMask());
    this.opponentAvatarMaskShape = avatarMask;
    this.opponentAvatarImage = avatar;

    // caixa do nome
    const nameBox = this.add.graphics();
    this.opponentNameBox = nameBox;
    this.opponentTurnProgress = this.add.graphics();
    this.drawOpponentNameBox(false);

    const name = this.add.text(0, 108, "Oponente", {
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: "20px",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.opponentFootMarker = this.createFootMarker();
    this.opponentFootMarker.setPosition(37, -39);
    this.opponentNameText = name;
    this.opponentNameGroup.add([nameBox, this.opponentTurnProgress, name]);

    container.add([
      bg,
      avatar,
      this.opponentFootMarker
    ]);

    container.setDepth(8);

    return container;
  }

  private updateOpponentAvatarMaskPosition(): void {
    if (!this.opponentAvatarMaskShape || !this.opponentAvatarGroup) {
      return;
    }

    this.opponentAvatarMaskShape.setPosition(this.opponentAvatarGroup.x, this.opponentAvatarGroup.y);
  }

  private updateOpponentAvatar(opponent: RoomState["players"][number] | undefined): void {
    const avatarUrl = opponent?.avatarUrl ?? null;

    if (!avatarUrl) {
      this.currentOpponentAvatarUrl = null;
      this.opponentAvatarImage.setTexture("opponent-avatar");
      this.opponentAvatarImage.setDisplaySize(opponentAvatarPhotoSize, opponentAvatarPhotoSize);
      return;
    }

    if (this.currentOpponentAvatarUrl === avatarUrl) {
      return;
    }

    this.currentOpponentAvatarUrl = avatarUrl;
    const textureKey = `player-avatar-${this.hashText(avatarUrl)}`;

    if (this.textures.exists(textureKey)) {
      this.opponentAvatarImage.setTexture(textureKey);
      this.opponentAvatarImage.setDisplaySize(opponentAvatarPhotoSize, opponentAvatarPhotoSize);
      return;
    }

    const image = new Image();

    image.onload = () => {
      if (!this.textures.exists(textureKey)) {
        this.textures.addImage(textureKey, image);
      }

      if (this.currentOpponentAvatarUrl === avatarUrl) {
        this.opponentAvatarImage.setTexture(textureKey);
        this.opponentAvatarImage.setDisplaySize(opponentAvatarPhotoSize, opponentAvatarPhotoSize);
      }
    };
    image.src = avatarUrl;
  }

  private hashText(value: string): string {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
    }

    return Math.abs(hash).toString(36);
  }

  private createCardBack(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const width = 80;
    const height = 118;
    const shadow = this.add.graphics();
    const back = this.add.image(0, 0, currentCardBack).setDisplaySize(width, height);

    shadow.fillStyle(0x06130f, 0.34);
    shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, 10);

    container.add([shadow, back]);
    container.setSize(width, height);

    return container;
  }

  private createCard(card: Card, enabled: boolean, faceDown = false): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const width = 80;
    const height = 118;
    const radius = 10;
    const suitColor = this.suitColor(card.suit);
    const shadow = this.add.graphics();

    shadow.fillStyle(0x06130f, 0.34);
    shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, radius);

    if (faceDown) {
      const back = this.add.image(0, 0, currentCardBack).setDisplaySize(width, height);

      container.add([shadow, back]);
    } else {
      const face = this.add.graphics();

      face.fillStyle(0xfffbef, 1);
      face.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
      face.lineStyle(3, enabled ? 0xffcf5a : 0x3d2f22, 1);
      face.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
      face.lineStyle(1, 0xffffff, 0.65);
      face.strokeRoundedRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10, radius - 3);

      const cornerRank = this.add.text(-28, -44, card.rank, {
        color: suitColor,
        fontFamily: "Arial",
        fontSize: "17px",
        fontStyle: "bold"
      }).setOrigin(0.5);

      const cornerSuit = this.add.text(-28, -27, this.suitSymbol(card.suit), {
        color: suitColor,
        fontFamily: "Arial",
        fontSize: "16px",
        fontStyle: "bold"
      }).setOrigin(0.5);

      const centerSuit = this.add.text(0, -2, this.suitSymbol(card.suit), {
        color: suitColor,
        fontFamily: "Arial",
        fontSize: "42px",
        fontStyle: "bold"
      }).setOrigin(0.5);

      const bottomRank = this.add.text(28, 44, card.rank, {
        color: suitColor,
        fontFamily: "Arial",
        fontSize: "17px",
        fontStyle: "bold"
      }).setOrigin(0.5).setRotation(Math.PI);

      const bottomSuit = this.add.text(28, 27, this.suitSymbol(card.suit), {
        color: suitColor,
        fontFamily: "Arial",
        fontSize: "16px",
        fontStyle: "bold"
      }).setOrigin(0.5).setRotation(Math.PI);

      container.add([shadow, face, cornerRank, cornerSuit, centerSuit, bottomRank, bottomSuit]);
    }

    container.setSize(width, height);

    if (enabled) {
      let hasDragged = false;
      let hasPlayed = false;
      let isDragging = false;
      let isAnimatingToTable = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let dragStartRotation = 0;
      const playCard = () => {
        if (hasPlayed) {
          return;
        }

        hasPlayed = true;
        const shouldPlayFaceDown = this.faceDownHandCardIds.has(card.id);

        this.faceDownHandCardIds.delete(card.id);

        if (shouldPlayFaceDown) {
          this.pendingFaceDownTableCardIds.add(card.id);
        }

        this.playGameSound("card-place", 0.78);
        this.sendReliableAction("card:play", {
          roomId: this.roomId,
          cardId: card.id,
          faceDown: shouldPlayFaceDown
        });
      };

      container.setInteractive({ draggable: true, useHandCursor: true });
      this.input.setDraggable(container);
      container.on("dragstart", () => {
        hasDragged = false;
        isDragging = true;
        dragStartX = container.x;
        dragStartY = container.y;
        dragStartRotation = container.rotation;
        this.tweens.killTweensOf(container);
        container.setRotation(0);
        container.setDepth(20);
      });
      container.on("drag", (pointer: Phaser.Input.Pointer) => {
        hasDragged = true;
        container.setPosition(pointer.worldX - this.handGroup.x, pointer.worldY - this.handGroup.y);
      });
      container.on("dragend", () => {
        if (hasDragged && this.isHandCardReleasedInPlayZone(container.y)) {
          isAnimatingToTable = true;
          container.disableInteractive();
          this.tweens.killTweensOf(container);
          const targetPosition = this.getTableCardPosition(this.roomState?.self?.id ?? "", this.roomState?.table.length ?? 0, (this.roomState?.table.length ?? 0) + 1);

          this.tweens.add({
            targets: container,
            x: this.tableGroup.x + targetPosition.x - this.handGroup.x,
            y: this.tableGroup.y + targetPosition.y - this.handGroup.y,
            scale: this.tableCardScale * this.uiScale,
            duration: 520,
            ease: "Cubic.Out",
            onComplete: () => {
              isDragging = false;
              container.setDepth(0);
              playCard();
            }
          });
        } else {
          isDragging = false;
          container.setDepth(0);
          this.tweens.add({
            targets: container,
            x: dragStartX,
            y: dragStartY,
            rotation: dragStartRotation,
            duration: 160,
            ease: "Back.Out"
          });
        }
      });
      container.on("pointerup", () => {
        if (!hasDragged && !isAnimatingToTable) {
          if (this.canToggleFaceDownCard()) {
            this.toggleFaceDownCard(card.id);
            return;
          }

          playCard();
        }
      });
    }

    return container;
  }

  private isHandCardReleasedInPlayZone(cardLocalY: number): boolean {
    const selfId = this.roomState?.self?.id ?? "";
    const tableCount = this.roomState?.table.length ?? 0;
    const targetPosition = this.getTableCardPosition(selfId, tableCount, tableCount + 1);
    const tableLocalY = this.tableGroup.y + targetPosition.y - this.handGroup.y;
    const confirmLineY = Math.min(-64 * this.uiScale, tableLocalY / 2);

    return cardLocalY <= confirmLineY;
  }

  private suitSymbol(suit: Card["suit"]): string {
    return {
      clubs: "\u2663",
      hearts: "\u2665",
      spades: "\u2660",
      diamonds: "\u2666"
    }[suit];
  }

  private suitColor(suit: Card["suit"]): string {
    return suit === "hearts" || suit === "diamonds" ? "#b92727" : "#161616";
  }

  refreshCardBackSelection(): void {
    if (this.roomState) {
      this.renderState();
    }
  }
}

let game: Phaser.Game | null = null;
let currentTableBackground = getSelectedTableBackground();
let currentCardBack = getSelectedCardBack();
let resizeGameCanvas: (() => void) | null = null;

function getGameResolution(): number {
  return Phaser.Math.Clamp(window.devicePixelRatio || 1, 1, 2.5);
}

function getViewportWidth(): number {
  return Math.ceil(document.documentElement.clientWidth || window.innerWidth);
}

function getViewportHeight(): number {
  return Math.ceil(document.documentElement.clientHeight || window.innerHeight);
}

function getGamePixelWidth(): number {
  return Math.ceil(getViewportWidth() * getGameResolution());
}

function getGamePixelHeight(): number {
  return Math.ceil(getViewportHeight() * getGameResolution());
}

function applyGameCanvasSize(currentGame: Phaser.Game): void {
  currentGame.scale.setZoom(1 / getGameResolution());
  currentGame.scale.resize(getGamePixelWidth(), getGamePixelHeight());
}

function showHomeMenu(): void {
  document.getElementById("login")?.classList.add("is-hidden");
  document.getElementById("home")?.classList.remove("is-hidden");
  document.getElementById("profile")?.classList.add("is-hidden");
  document.getElementById("rank")?.classList.add("is-hidden");
  document.getElementById("settings")?.classList.add("is-hidden");
  document.getElementById("waiting-room")?.classList.add("is-hidden");
  document.getElementById("game")?.classList.add("is-hidden");
}

function showLoginMenu(): void {
  document.getElementById("login")?.classList.remove("is-hidden");
  document.getElementById("home")?.classList.add("is-hidden");
  document.getElementById("profile")?.classList.add("is-hidden");
  document.getElementById("rank")?.classList.add("is-hidden");
  document.getElementById("settings")?.classList.add("is-hidden");
  document.getElementById("waiting-room")?.classList.add("is-hidden");
  document.getElementById("game")?.classList.add("is-hidden");
}

function showSettingsMenu(): void {
  document.getElementById("login")?.classList.add("is-hidden");
  document.getElementById("home")?.classList.add("is-hidden");
  document.getElementById("profile")?.classList.add("is-hidden");
  document.getElementById("rank")?.classList.add("is-hidden");
  document.getElementById("settings")?.classList.remove("is-hidden");
  document.getElementById("waiting-room")?.classList.add("is-hidden");
  document.getElementById("game")?.classList.add("is-hidden");
  renderBackgroundOptions();
}

function showProfileMenu(): void {
  document.getElementById("login")?.classList.add("is-hidden");
  document.getElementById("home")?.classList.add("is-hidden");
  document.getElementById("profile")?.classList.remove("is-hidden");
  document.getElementById("rank")?.classList.add("is-hidden");
  document.getElementById("settings")?.classList.add("is-hidden");
  document.getElementById("waiting-room")?.classList.add("is-hidden");
  document.getElementById("game")?.classList.add("is-hidden");
  renderProfileForm();
}

function showRankMenu(): void {
  document.getElementById("login")?.classList.add("is-hidden");
  document.getElementById("home")?.classList.add("is-hidden");
  document.getElementById("profile")?.classList.add("is-hidden");
  document.getElementById("rank")?.classList.remove("is-hidden");
  document.getElementById("settings")?.classList.add("is-hidden");
  document.getElementById("waiting-room")?.classList.add("is-hidden");
  document.getElementById("game")?.classList.add("is-hidden");
  void renderRanking();
}

function showWaitingRoom(message = "Procurando outro jogador para iniciar a partida."): void {
  document.getElementById("login")?.classList.add("is-hidden");
  document.getElementById("home")?.classList.add("is-hidden");
  document.getElementById("profile")?.classList.add("is-hidden");
  document.getElementById("rank")?.classList.add("is-hidden");
  document.getElementById("settings")?.classList.add("is-hidden");
  document.getElementById("waiting-room")?.classList.remove("is-hidden");
  document.getElementById("game")?.classList.add("is-hidden");
  const waitingMessage = document.getElementById("waiting-message");

  if (waitingMessage) {
    waitingMessage.textContent = message;
  }
}

function showGameTable(): void {
  document.getElementById("login")?.classList.add("is-hidden");
  document.getElementById("home")?.classList.add("is-hidden");
  document.getElementById("profile")?.classList.add("is-hidden");
  document.getElementById("rank")?.classList.add("is-hidden");
  document.getElementById("settings")?.classList.add("is-hidden");
  document.getElementById("waiting-room")?.classList.add("is-hidden");
  document.getElementById("game")?.classList.remove("is-hidden");
}

function renderBackgroundOptions(): void {
  document.querySelectorAll<HTMLButtonElement>(".background-option").forEach((button) => {
    const rawBackgroundId = button.dataset.background ?? null;

    if (!isTableBackgroundId(rawBackgroundId)) {
      return;
    }

    const backgroundId = rawBackgroundId;
    const preview = button.querySelector<HTMLElement>(".background-preview");

    if (preview) {
      preview.style.backgroundImage = `url("${tableBackgrounds[backgroundId].url}")`;
    }

    button.classList.toggle("is-selected", backgroundId === currentTableBackground);
  });
}

function renderCardBackOptions(): void {
  document.querySelectorAll<HTMLButtonElement>(".card-back-option").forEach((button) => {
    const rawCardBackId = button.dataset.cardBack ?? null;

    if (!isCardBackId(rawCardBackId)) {
      return;
    }

    const cardBackId = rawCardBackId;
    const preview = button.querySelector<HTMLElement>(".card-back-preview");

    if (preview) {
      preview.style.backgroundImage = `url("${cardBacks[cardBackId].url}")`;
    }

    button.classList.toggle("is-selected", cardBackId === currentCardBack);
  });
}

async function renderRanking(): Promise<void> {
  const list = document.getElementById("rank-list");

  if (!list) {
    return;
  }

  list.innerHTML = '<p class="rank-empty">Carregando rank...</p>';

  try {
    const response = await fetch(`${serverUrl}/rank`);
    const payload = await response.json() as { ranking: RankingPlayer[] };
    const ranking = payload.ranking ?? [];

    if (ranking.length === 0) {
      list.innerHTML = '<p class="rank-empty">Ainda nao ha jogadores no rank.</p>';
      return;
    }

    list.replaceChildren(...ranking.map(createRankingRow));
  } catch {
    list.innerHTML = '<p class="rank-empty">Nao foi possivel carregar o rank.</p>';
  }
}

function createRankingRow(player: RankingPlayer): HTMLElement {
  const row = document.createElement("article");
  const avatar = document.createElement("img");
  const playerInfo = document.createElement("div");
  const name = document.createElement("div");
  const stats = document.createElement("div");
  const position = document.createElement("div");
  const points = document.createElement("div");

  row.className = "rank-row";
  position.className = "rank-position";
  avatar.className = "rank-avatar";
  playerInfo.className = "rank-player";
  name.className = "rank-name";
  stats.className = "rank-stats";
  points.className = "rank-points";

  position.textContent = `#${player.position}`;
  avatar.alt = "";
  avatar.src = player.avatarUrl || opponentAvatarUrl;
  name.textContent = player.name;
  stats.textContent = `${player.gamesWon} vitorias • ${player.gamesPlayed} jogos • ${player.handsWon} maos`;
  points.textContent = `${player.rankPoints} pts`;

  playerInfo.append(name, stats);
  row.append(position, avatar, playerInfo, points);

  return row;
}

function renderProfileForm(): void {
  const nameInput = document.getElementById("profile-name") as HTMLInputElement | null;
  const emailInput = document.getElementById("profile-email") as HTMLInputElement | null;
  const preview = document.getElementById("profile-preview") as HTMLImageElement | null;
  const message = document.getElementById("profile-message");

  if (nameInput) {
    nameInput.value = currentPlayerProfile?.name ?? "";
  }

  if (emailInput) {
    emailInput.value = currentPlayerProfile?.email ?? pendingProfileEmail;
  }

  if (preview) {
    preview.src = currentPlayerProfile?.avatarUrl ?? "";
  }

  if (message) {
    message.textContent = "";
  }
}

function setProfileMessage(message: string): void {
  const element = document.getElementById("profile-message");

  if (element) {
    element.textContent = message;
  }
}

function setLoginMessage(message: string): void {
  const element = document.getElementById("login-message");

  if (element) {
    element.textContent = message;
  }
}

async function loginWithEmail(event: Event): Promise<void> {
  event.preventDefault();

  const emailInput = document.getElementById("login-email") as HTMLInputElement | null;
  const email = emailInput?.value.trim().toLowerCase() ?? "";

  if (!email) {
    setLoginMessage("Digite seu email.");
    return;
  }

  setLoginMessage("Entrando...");

  try {
    const response = await fetch(`${serverUrl}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
    });
    const payload = await response.json() as { profile?: PlayerProfile; message?: string };

    if (response.status === 404) {
      currentPlayerProfile = null;
      pendingProfileEmail = email;
      setLoginMessage("");
      showProfileMenu();
      setProfileMessage("Email nao encontrado. Cadastre seu perfil.");
      return;
    }

    if (!response.ok || !payload.profile) {
      setLoginMessage(payload.message ?? "Nao foi possivel entrar.");
      return;
    }

    pendingProfileEmail = "";
    saveStoredProfile(payload.profile);
    showHomeMenu();
  } catch {
    setLoginMessage("Erro ao conectar com o servidor.");
  }
}

function readPhotoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Nao foi possivel ler a foto"));
    reader.readAsDataURL(file);
  });
}

async function handleProfilePhotoChange(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    setProfileMessage("Escolha um arquivo de imagem.");
    input.value = "";
    return;
  }

  const avatarUrl = await readPhotoFile(file);

  if (avatarUrl.length > 1_500_000) {
    setProfileMessage("Escolha uma foto menor.");
    input.value = "";
    return;
  }

  currentPlayerProfile = {
    token: playerToken,
    name: currentPlayerProfile?.name ?? "",
    email: currentPlayerProfile?.email ?? "",
    avatarUrl
  };

  const preview = document.getElementById("profile-preview") as HTMLImageElement | null;

  if (preview) {
    preview.src = avatarUrl;
  }
}

async function saveProfile(event: Event): Promise<void> {
  event.preventDefault();

  const nameInput = document.getElementById("profile-name") as HTMLInputElement | null;
  const emailInput = document.getElementById("profile-email") as HTMLInputElement | null;
  const name = nameInput?.value.trim() ?? "";
  const email = emailInput?.value.trim().toLowerCase() ?? "";
  const avatarUrl = currentPlayerProfile?.avatarUrl ?? "";

  if (!name || !email) {
    setProfileMessage("Preencha nome e email.");
    return;
  }

  if (!avatarUrl) {
    setProfileMessage("Escolha uma foto.");
    return;
  }

  setProfileMessage("Salvando...");

  try {
    const response = await fetch(`${serverUrl}/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token: playerToken,
        name,
        email,
        avatarUrl
      })
    });
    const payload = await response.json() as { profile?: PlayerProfile; message?: string };

    if (!response.ok || !payload.profile) {
      setProfileMessage(payload.message ?? "Nao foi possivel salvar o perfil.");
      return;
    }

    saveStoredProfile(payload.profile);
    pendingProfileEmail = "";
    renderProfileForm();
    setProfileMessage("Perfil salvo.");
    showHomeMenu();
  } catch {
    setProfileMessage("Erro ao conectar com o servidor.");
  }
}

function returnToMainMenu(): void {
  const currentGame = game;

  game = null;
  if (resizeGameCanvas) {
    window.removeEventListener("resize", resizeGameCanvas);
    window.removeEventListener("orientationchange", resizeGameCanvas);
    resizeGameCanvas = null;
  }
  showHomeMenu();
  currentGame?.destroy(true);
}

function leaveOnlineGame(): void {
  const tableScene = game?.scene.getScene("table");

  if (tableScene instanceof TableScene) {
    tableScene.leaveTable();
    return;
  }

  returnToMainMenu();
}

async function startOnlineGame(): Promise<void> {
  try {
    if (game) {
    return;
  }

  await fetchPlayerProfile().catch(() => currentPlayerProfile);
  void unlockAudioPlayback().catch(() => undefined);
  showWaitingRoom();

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#12372a",
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      zoom: 1 / getGameResolution(),
      width: getGamePixelWidth(),
      height: getGamePixelHeight()
    },
    render: {
      antialias: true,
      antialiasGL: true,
      pixelArt: false,
      roundPixels: true,
      powerPreference: "high-performance"
    },
    input: {
      activePointers: 3
    },
    scene: [TableScene]
  };

  game = new Phaser.Game(config);
  resizeGameCanvas = () => {
    if (game) {
      applyGameCanvasSize(game);
    }
  };
  window.addEventListener("resize", resizeGameCanvas);
  window.addEventListener("orientationchange", resizeGameCanvas);
  applyGameCanvasSize(game);
  } catch (error) {
    returnToMainMenu();
    alert("Ocorreu um erro ao iniciar o jogo. Por favor, tente novamente.");
  }
  
}

document.getElementById("play-online")?.addEventListener("click", () => {
  void unlockAudioPlayback().catch(() => undefined);
  void startOnlineGame();
});
document.getElementById("login-form")?.addEventListener("submit", (event) => {
  void loginWithEmail(event);
});
document.getElementById("open-profile")?.addEventListener("click", () => {
  void fetchPlayerProfile().finally(showProfileMenu);
});
document.getElementById("open-rank")?.addEventListener("click", showRankMenu);
document.getElementById("open-settings")?.addEventListener("click", showSettingsMenu);
document.getElementById("back-home")?.addEventListener("click", showHomeMenu);
document.getElementById("back-home-profile")?.addEventListener("click", showHomeMenu);
document.getElementById("back-home-rank")?.addEventListener("click", showHomeMenu);
document.getElementById("cancel-waiting")?.addEventListener("click", leaveOnlineGame);
document.getElementById("profile-form")?.addEventListener("submit", (event) => {
  void saveProfile(event);
});
document.getElementById("profile-photo")?.addEventListener("change", (event) => {
  void handleProfilePhotoChange(event);
});
document.querySelectorAll<HTMLButtonElement>(".background-option").forEach((button) => {
  button.addEventListener("click", () => {
    const rawBackgroundId = button.dataset.background ?? null;

    if (!isTableBackgroundId(rawBackgroundId)) {
      return;
    }

    const backgroundId = rawBackgroundId;
    currentTableBackground = backgroundId;
    saveSelectedTableBackground(backgroundId);
    renderBackgroundOptions();
  });
});
document.querySelectorAll<HTMLButtonElement>(".card-back-option").forEach((button) => {
  button.addEventListener("click", () => {
    const rawCardBackId = button.dataset.cardBack ?? null;

    if (!isCardBackId(rawCardBackId)) {
      return;
    }

    const cardBackId = rawCardBackId;
    currentCardBack = cardBackId;
    saveSelectedCardBack(cardBackId);
    renderCardBackOptions();
    (game?.scene.getScene("table") as TableScene | undefined)?.refreshCardBackSelection();
  });
});
renderBackgroundOptions();
renderCardBackOptions();
if (currentPlayerProfile) {
  showHomeMenu();
} else {
  showLoginMenu();
}
document.addEventListener("pointerdown", () => {
  if (!audioPlaybackUnlocked) {
    void unlockAudioPlayback().catch(() => undefined);
  }
});
