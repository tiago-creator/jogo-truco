import Phaser from "phaser";
import { io, type Socket } from "socket.io-client";
import type { Card, ClientToServerEvents, RoomState, ServerToClientEvents } from "@truco/shared";
import "./styles.css";
import opponentAvatarUrl from "./img/avatar/user-secret.svg";
import cardBackUrl from "./img/cartas/ivory-emerald.svg";
import arrowUpActionIconUrl from "./img/icons/arrow-up-action.svg";
import checkActionIconUrl from "./img/icons/check-action.svg";
import chevronUpHintIconUrl from "./img/icons/chevron-up-hint.svg";
import runningPlayerIconUrl from "./img/icons/running-player.svg";
import feltBurgundyUrl from "./img/table-backgrounds/felt-burgundy.png";
import feltCharcoalUrl from "./img/table-backgrounds/felt-charcoal.png";
import feltEmeraldUrl from "./img/table-backgrounds/felt-emerald.png";
import feltNavyUrl from "./img/table-backgrounds/felt-navy.png";
import feltTealUrl from "./img/table-backgrounds/felt-teal.png";

type TrucoSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type PlayerProfile = {
  token: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

const opponentAvatarPhotoSize = 106;
const opponentAvatarMaskRadius = 49;

const serverUrl = import.meta.env.VITE_SERVER_URL ?? "https://truco-1wfk.onrender.com";
const tableBackgrounds = {
  "felt-teal": { label: "Teal", url: feltTealUrl },
  "felt-emerald": { label: "Emerald", url: feltEmeraldUrl },
  "felt-navy": { label: "Navy", url: feltNavyUrl },
  "felt-burgundy": { label: "Burgundy", url: feltBurgundyUrl },
  "felt-charcoal": { label: "Charcoal", url: feltCharcoalUrl }
} as const;
const defaultTableBackground = "felt-teal";
const tableBackgroundStorageKey = "truco-table-background";
const profileStorageKey = "truco-player-profile";
const sessionProfileStorageKey = "truco-session-profile";
const playerTokenStorageKey = "truco-player-token";

type TableBackgroundId = keyof typeof tableBackgrounds;

function isTableBackgroundId(value: string | null): value is TableBackgroundId {
  return Boolean(value && value in tableBackgrounds);
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
  private animatingTableCardIds = new Set<string>();
  private animatingHandCardIds = new Set<string>();
  private faceDownHandCardIds = new Set<string>();
  private pendingFaceDownTableCardIds = new Set<string>();
  private handCardObjects = new Map<string, { container: Phaser.GameObjects.Container; signature: string }>();
  private tableCardObjects = new Map<string, { container: Phaser.GameObjects.Container; signature: string }>();
  private roomId = "";
  private playerName = getCurrentPlayerName();
  private status!: Phaser.GameObjects.Text;
  private scoreboardGroup!: Phaser.GameObjects.Container;
  private trucoButton!: Phaser.GameObjects.Container;
  private trucoButtonBg!: Phaser.GameObjects.Graphics;
  private trucoButtonText!: Phaser.GameObjects.Text;
  private trucoButtonSmallText!: Phaser.GameObjects.Text;
  private trucoButtonHitZone!: Phaser.GameObjects.Zone;
  private trucoResponseGroup!: Phaser.GameObjects.Container;
  private trucoResponseTitle!: Phaser.GameObjects.Text;
  private trucoResponseRaiseText!: Phaser.GameObjects.Text;
  private elevenHandGroup!: Phaser.GameObjects.Container;
  private handGroup!: Phaser.GameObjects.Container;
  private handHintGroup!: Phaser.GameObjects.Container;
  private opponentHandGroup!: Phaser.GameObjects.Container;
  private opponentAvatarGroup!: Phaser.GameObjects.Container;
  private opponentAvatarImage!: Phaser.GameObjects.Image;
  private opponentAvatarMaskShape!: Phaser.GameObjects.Graphics;
  private opponentNameText!: Phaser.GameObjects.Text;
  private currentOpponentAvatarUrl: string | null = null;
  private deckGroup!: Phaser.GameObjects.Container;
  private viraGroup!: Phaser.GameObjects.Container;
  private tableGroup!: Phaser.GameObjects.Container;
  private tableBackground!: Phaser.GameObjects.Image;
  private lastAnimatedTrucoValue: number | null = null;
  private delayedTrucoResponseKey: string | null = null;
  private visibleTrucoResponseKey: string | null = null;
  private trucoResponseDelayTimer: Phaser.Time.TimerEvent | null = null;
  private exitButton!: Phaser.GameObjects.Container;
  private exitButtonBg!: Phaser.GameObjects.Graphics;
  private exitButtonText!: Phaser.GameObjects.Text;
  private audioButton!: Phaser.GameObjects.Container;
  private audioButtonBg!: Phaser.GameObjects.Graphics;
  private audioButtonText!: Phaser.GameObjects.Text;
  private audioButtonHint!: Phaser.GameObjects.Text;
  private audioRecorder = new WavAudioRecorder();
  private isRecordingAudio = false;
  private audioRecordingSession = 0;
  private audioStopTimer: Phaser.Time.TimerEvent | null = null;
  constructor() {
    super("table");
  }

  
  preload(): void {
    for (const [backgroundId, background] of Object.entries(tableBackgrounds)) {
      this.load.image(backgroundId, background.url);
    }

    this.load.image("card-back", cardBackUrl);
    this.load.image("opponent-avatar", opponentAvatarUrl);
    this.load.image("arrow-up-action-icon", arrowUpActionIconUrl);
    this.load.image("check-action-icon", checkActionIconUrl);
    this.load.image("chevron-up-hint-icon", chevronUpHintIconUrl);
    this.load.image("running-player-icon", runningPlayerIconUrl);

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

    this.status = this.add.text(0, 0, "Conectando...", {
      color: "#f8f1d9",
      fontFamily: "Arial",
      fontSize: "16px"
    }).setOrigin(0.5);

    this.scoreboardGroup = this.add.container(0, 0);

    //#region Truco Button
    this.trucoButtonHitZone = this.add.zone(0, 0, 150, 160);
    this.trucoButtonBg = this.add.graphics();
    this.trucoButtonSmallText = this.add.text(0, 0, "PEDIR", {
      color: "#5f3900",
      fontFamily: "Arial",
      fontSize: "13px",
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
    this.trucoButtonHitZone.on("pointerup", () => {
      const selfPoints = this.roomState?.self?.points ?? 0;
      const lastRaiseWasMine = this.roomState?.lastTrucoRaise?.playerId === this.roomState?.self?.id;

      if (this.roomState?.status === "playing" && !this.roomState.trucoRequest && !lastRaiseWasMine && selfPoints !== 11 && this.roomState.handValue < 12) {
        this.socket.emit("truco:raise", { roomId: this.roomId });
        const value = {
          1: "TRUCO",
          3: "SEIS",
          6: "NOVE",
          9: "DOZE",
          12: "DOZE"
        }[this.roomState.handValue] ?? "TRUCO";
        this.playTrucoRaiseAnimation(this.roomState.self?.name ?? "Jogador",
          value);

      }
    });
    //#endregion

    this.trucoResponseGroup = this.createTrucoResponseGroup();
    this.elevenHandGroup = this.createElevenHandGroup();

    //#region Exit Button
this.exitButtonBg = this.add.graphics();

this.exitButtonText = this.add.text(0, 0, "X", {
  color: "#ffffff",
  fontFamily: "Arial Black",
  fontSize: "38px",
  fontStyle: "900"
}).setOrigin(0.5);

this.exitButton = this.add.container(0, 0, [
  this.exitButtonBg,
  this.exitButtonText
]);

this.drawExitButton();

const exitButtonHitZone = this.add.zone(0, 0, 84, 84);

this.exitButton.add(exitButtonHitZone);
this.exitButton.setSize(84, 84);

exitButtonHitZone.setInteractive({ useHandCursor: true });
exitButtonHitZone.on("pointerup", () => this.leaveTable());
//#endregion

    //#region Audio Button
    this.audioButtonBg = this.add.graphics();
    this.audioButtonText = this.add.text(0, -8, "AUDIO", {
      color: "#ffffff",
      fontFamily: "Arial Black",
      fontSize: "15px",
      fontStyle: "900"
    }).setOrigin(0.5);
    this.audioButtonHint = this.add.text(0, 13, "SEGURE", {
      color: "#fff3a3",
      fontFamily: "Arial",
      fontSize: "11px",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.audioButton = this.add.container(0, 0, [
      this.audioButtonBg,
      this.audioButtonText,
      this.audioButtonHint
    ]);
    const audioButtonHitZone = this.add.zone(0, 0, 104, 64);

    this.audioButton.add(audioButtonHitZone);
    this.audioButton.setSize(104, 64);
    audioButtonHitZone.setInteractive({ useHandCursor: true });
    audioButtonHitZone.on("pointerdown", () => {
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

    this.handGroup = this.add.container(0, 0);
    this.handHintGroup = this.createHandHintGroup();
    this.handGroup.add(this.handHintGroup);
    this.opponentHandGroup = this.add.container(0, 0);
    this.opponentAvatarGroup = this.createOpponentAvatar();
    this.deckGroup = this.add.container(0, 0);
    this.viraGroup = this.add.container(0, 0);
    this.tableGroup = this.add.container(0, 0);
    this.opponentHandGroup.setDepth(8);
    this.deckGroup.setDepth(10);
    this.viraGroup.setDepth(12);
    this.tableGroup.setDepth(20);
    this.handGroup.setDepth(40);
    this.trucoButton.setDepth(100);
    this.trucoButtonHitZone.setDepth(101);
    this.audioButton.setDepth(100);
    this.exitButton.setDepth(100);

    this.socket.on("connect", () => {
     this.socket.emit("room:join", {
  roomId: this.roomId,
  name: this.playerName,
  token: playerToken
});
    });

    this.socket.on("room:state", (state) => {
      this.previousRoomState = this.roomState;
      this.roomState = state;
      this.roomId = state.roomId;
      this.syncFaceDownHandCards();

      if (state.status === "waiting") {
        showWaitingRoom(state.message);
      }

      if (state.status === "playing") {
        showGameTable();
      }

      if (!state.lastTrucoRaise) {
        this.lastAnimatedTrucoValue = null;
      }

      const trucoResponseKey = this.getTrucoResponseKey(state);

      if (!trucoResponseKey) {
        this.delayedTrucoResponseKey = null;
        this.visibleTrucoResponseKey = null;
        this.trucoResponseDelayTimer?.remove(false);
        this.trucoResponseDelayTimer = null;
      }

      // animação do truco do oponente
      if (
        state.lastTrucoRaise &&
        state.lastTrucoRaise.playerId !== state.self?.id &&
        this.lastAnimatedTrucoValue !== state.lastTrucoRaise.value
      ) {
        this.lastAnimatedTrucoValue = state.lastTrucoRaise.value;

        this.playTrucoRaiseAnimation(
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

        if (trucoResponseKey) {
          this.delayTrucoResponseOptions(trucoResponseKey);
        }
      }

      this.animateDealIfNeeded();
      this.animateOpponentPlayIfNeeded();
      this.renderState();
    });

    this.socket.on("room:error", ({ message }) => {
      this.status.setText(message);

      if (this.roomState?.status !== "playing") {
        showWaitingRoom(message);
      }
    });

    this.socket.on("audio:message", ({ playerName, audio }) => {
      this.showOpponentSpeechBubble(`${playerName}: audio`);
      void playIncomingAudio(audio).catch(() => {
        this.status.setText("Toque uma vez na tela para liberar o audio");
      });
    });

    this.scale.on("resize", () => this.layout());
    this.sharpenExistingTexts();
    this.layout();
  }

  private getTextResolution(): number {
    return Phaser.Math.Clamp((window.devicePixelRatio || 1) * 1.75, 2, 4);
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

  private drawExitButton(): void {
    const g = this.exitButtonBg;

    g.clear();

    g.fillStyle(0x000000, 0.35);
    g.fillCircle(5, 7, 39);

    g.fillStyle(0x8b1e1e, 1);
    g.fillCircle(0, 0, 39);

    g.lineStyle(3, 0xffcf5a, 1);
    g.strokeCircle(0, 0, 39);

    g.fillStyle(0xffffff, 0.12);
    g.fillCircle(-11, -14, 12);
  }

  leaveTable(): void {
    this.audioRecorder.cancel();
    this.audioStopTimer?.remove(false);
    this.audioStopTimer = null;
    this.isRecordingAudio = false;
    this.audioRecordingSession += 1;

    if (this.roomState) {
      this.socket.emit("room:leave", {
        roomId: this.roomId
      });
    }

    this.socket.disconnect();
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

    g.clear();
    g.fillStyle(0x000000, 0.34);
    g.fillRoundedRect(-43, -23, 90, 52, 10);
    g.fillStyle(recording ? 0xb3261e : 0x0b4a3a, 1);
    g.fillRoundedRect(-48, -29, 90, 52, 10);
    g.lineStyle(3, recording ? 0xffffff : 0xffcf5a, 1);
    g.strokeRoundedRect(-48, -29, 90, 52, 10);
    g.fillStyle(0xffffff, recording ? 0.18 : 0.1);
    g.fillRoundedRect(-40, -24, 72, 12, 8);

    this.audioButtonText.setText(recording ? "SOLTE" : "AUDIO");
    this.audioButtonHint.setText(recording ? "ENVIAR" : "SEGURE");
  }

  private createTrucoResponseGroup(): Phaser.GameObjects.Container {
    const bg = this.add.graphics();

    bg.fillStyle(0x06130f, 0.92);
    bg.fillRoundedRect(-286, -122, 572, 244, 24);
    bg.lineStyle(3, 0xffcf5a, 1);
    bg.strokeRoundedRect(-286, -122, 572, 244, 24);

    const title = this.add.text(0, -78, "Pedido de truco", {
      color: "#fff3a3",
      fontFamily: "Arial Black",
      fontSize: "34px",
      fontStyle: "900"
    }).setOrigin(0.5);

    const reject = this.createTrucoResponseButton(-182, 44, "CORRER", 0x8b4a12, "reject");
    const accept = this.createTrucoResponseButton(0, 44, "ACEITAR", 0x1f7a2e, "accept");
    const raise = this.createTrucoResponseButton(182, 44, "AUMENTAR", 0x1976a8, "raise");
    const group = this.add.container(0, 0, [bg, title, reject.container, accept.container, raise.container]);

    this.trucoResponseTitle = title;
    this.trucoResponseRaiseText = raise.text;
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
      this.socket.emit("eleven-hand:respond", {
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

    bg.fillStyle(0x000000, 0.38);
    bg.fillRoundedRect(-76, -38, 160, 84, 12);

    const gradientColors = {
      reject: { topLeft: 0xf2a334, topRight: 0xa85b16, bottomLeft: 0x4a1e07, bottomRight: 0x160804 },
      accept: { topLeft: 0x66d05f, topRight: 0x238c35, bottomLeft: 0x0d3914, bottomRight: 0x061907 },
      raise: { topLeft: 0x68c9ff, topRight: 0x238ac9, bottomLeft: 0x0b3556, bottomRight: 0x041622 }
    }[action];

    bg.fillGradientStyle(
      gradientColors.topLeft,
      gradientColors.topRight,
      gradientColors.bottomLeft,
      gradientColors.bottomRight,
      1
    );
    bg.fillRoundedRect(-80, -42, 160, 84, 12);

    bg.lineStyle(3, 0xffffff, 0.22);
    bg.strokeRoundedRect(-80, -42, 160, 84, 12);

    bg.lineStyle(2, 0xffcf5a, action === "reject" ? 0.85 : 0.28);
    bg.strokeRoundedRect(-78, -40, 156, 80, 10);

    this.drawTrucoResponseIcon(bg, action);
    const runIcon = action === "reject"
      ? this.add.image(0, -16, "running-player-icon").setDisplaySize(42, 42)
      : null;
    const acceptIcon = action === "accept"
      ? this.add.image(0, -16, "check-action-icon").setDisplaySize(44, 44)
      : null;
    const raiseIcon = action === "raise"
      ? this.add.image(0, -17, "arrow-up-action-icon").setDisplaySize(42, 42)
      : null;

    const text = this.add.text(0, 15, label, {
      color: "#ffffff",
      fontFamily: "Arial Black",
      fontSize: "19px",
      fontStyle: "900",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5);
    const subtitle = action === "raise"
      ? this.add.text(0, 32, "+3 PONTOS", {
        color: "#d8f2ff",
        fontFamily: "Arial",
        fontSize: "10px",
        fontStyle: "bold"
      }).setOrigin(0.5)
      : null;

    const hitZone = this.add.zone(0, 0, 172, 94);
    const children = [bg, runIcon, acceptIcon, raiseIcon, text, subtitle, hitZone].filter(Boolean) as Phaser.GameObjects.GameObject[];
    const button = this.add.container(x, y, children);

    button.setName(`truco-response-${action}`);
    button.setSize(160, 84);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on("pointerup", () => {
      this.socket.emit("truco:respond", {
        roomId: this.roomId,
        action
      });
    });

    return { container: button, text };
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
      this.status.setText("Use HTTPS para liberar o microfone no celular");
      return;
    }

    try {
      const recordingSession = ++this.audioRecordingSession;

      this.isRecordingAudio = true;
      this.drawAudioButton();
      this.status.setText("Gravando audio...");
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
      this.status.setText("Permita o microfone para enviar audio");
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
      this.status.setText("Audio muito curto");
      return;
    }

    this.socket.emit("audio:send", {
      roomId: this.roomId,
      audio,
      mimeType: "audio/wav"
    });
    this.status.setText("Audio enviado");
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

    const text = this.add.text(-4, -13, message, {
      color: "#083f32",
      fontFamily: "Arial Black",
      fontSize: "22px",
      fontStyle: "900",
      stroke: "#ffffff",
      strokeThickness: 2
    }).setOrigin(0.5);

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

  private delayTrucoResponseOptions(key: string): void {
    this.delayedTrucoResponseKey = key;
    this.visibleTrucoResponseKey = null;
    this.trucoResponseDelayTimer?.remove(false);
    this.trucoResponseDelayTimer = this.time.delayedCall(1800, () => {
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

    g.fillStyle(enabled ? 0x083f32 : 0x444444, 1);
    g.fillPoints(points, true);

    g.lineStyle(5 * scale, 0xfff3a3, 1);
    g.strokePoints(points, true, true);

    g.lineStyle(2 * scale, 0xd7a94c, 1);
    g.strokePoints(points, true, true);

    this.drawMiniCardIcon(g, centerX - 28 * scale, buttonY + 58 * scale, -0.2, "7", "♦", "#b3261e", scale);
    this.drawMiniCardIcon(g, centerX, buttonY + 52 * scale, 0, "A", "♠", "#202124", scale);
    this.drawMiniCardIcon(g, centerX + 28 * scale, buttonY + 58 * scale, 0.2, "3", "♣", "#202124", scale);

    g.fillStyle(enabled ? 0xf7c948 : 0x999999, 1);
    g.fillRoundedRect(plateX, plateY, plateWidth, plateHeight, 14 * scale);

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

    this.trucoButton.setScale(1.0);
    this.trucoButton.setSize(buttonWidth, buttonHeight);
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
    const scoreboardWidth = Math.min(width - 24, 500 * this.uiScale);
    this.scoreboardGroup.setPosition(12 + scoreboardWidth / 2, safeTop + 45 * this.uiScale);
    this.status.setPosition(width / 2, safeTop + 106 * this.uiScale);
    this.actionBottom = Math.max(58, 78 * this.actionButtonScale);

    this.trucoButton.setPosition(width - 98 * this.actionButtonScale, height - this.actionBottom-30);
    this.trucoButtonHitZone.setPosition(
      this.trucoButton.x,
      this.trucoButton.y
    );
    this.trucoResponseGroup.setPosition(width / 2, height / 2 + 112 * this.uiScale);
    this.trucoResponseGroup.setScale(Math.min(this.uiScale, (width - 24) / 572));
    this.elevenHandGroup.setPosition(width / 2, height / 2 + 112 * this.uiScale);
    this.elevenHandGroup.setScale(Math.min(this.uiScale, (width - 24) / 420));
    this.audioButton.setScale(this.actionButtonScale * 2.18);
    this.audioButton.setPosition(130 * this.actionButtonScale, height - this.actionBottom);
    this.exitButton.setPosition(
  width - 54 * this.uiScale,
  60 * this.uiScale
);
    this.opponentHandGroup.setPosition(width / 2, safeTop + 198 * this.uiScale);
    this.opponentAvatarGroup.setPosition(width / 2, safeTop + 240 * this.uiScale);
    this.updateOpponentAvatarMaskPosition();
    this.viraGroup.setPosition(width / 2, height / 2 + 10 * this.uiScale);
    this.deckGroup.setPosition(width / 2 + 30 * this.uiScale, height / 2 + 12 * this.uiScale);
    this.tableGroup.setPosition(width / 2, height / 2 - 20 * this.uiScale);
    this.updateHandGroupPosition();
    this.renderState();
  }

  private renderState(): void {
    if (!this.roomState) {
      return;
    }

    const self = this.roomState.self;
    const opponent = this.roomState.players.find((player) => player.id !== self?.id);
    const isMyTurn = this.roomState.turnPlayerId === self?.id;

    this.opponentNameText.setText(opponent?.name ?? "Oponente");
    this.updateOpponentAvatar(opponent);

    this.status.setText(this.roomState.message);
    this.audioButton.setVisible(this.roomState.status === "playing");
    this.renderTrucoResponse();
    this.renderElevenHandDecision();

    this.renderScoreboard();
    this.renderTrucoButton();
    this.renderVira();
    this.renderDeck();
    this.renderTable();
    this.renderOpponentHand(opponent?.hand ?? []);
    this.updateHandGroupPosition();
    this.renderHand(self?.hand ?? [], isMyTurn && !this.roomState.trucoRequest && !this.roomState.elevenHandDecision);
    this.sharpenExistingTexts();
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

  private syncFaceDownHandCards(): void {
    const hand = this.roomState?.self?.hand ?? [];
    const handIds = new Set(hand.map((card) => card.id));
    const previousHandLength = this.previousRoomState?.self?.hand.length ?? 0;

    if (hand.length === 3 && previousHandLength !== 3) {
      this.faceDownHandCardIds.clear();
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

  private canToggleFaceDownCard(): boolean {
    return !this.roomState?.isIronHand && (this.roomState?.self?.hand.length ?? 0) < 3;
  }

  private toggleFaceDownCard(cardId: string): void {
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

  private playTrucoRaiseAnimation(playerName: string, value: string): void {
    const { width, height } = this.scale;
    const valueUpper = value.toUpperCase();
    const animationScale = 2;

    const container = this.add.container(width / 2, height / 2);
    container.setDepth(20000);
    container.setAlpha(0);
    container.setScale(0.35 * animationScale);

    const bg = this.add.graphics();

    // sombra externa
    bg.fillStyle(0x000000, 0.45);
    bg.fillRoundedRect(-165, -82, 330, 164, 28);

    // raios dourados atrás
    for (let i = 0; i < 18; i++) {
      const angle = Phaser.Math.DegToRad(i * 20);
      const x1 = Math.cos(angle) * 70;
      const y1 = Math.sin(angle) * 38;
      const x2 = Math.cos(angle) * 162;
      const y2 = Math.sin(angle) * 92;

      bg.lineStyle(3, 0xffcf5a, 0.22);
      bg.lineBetween(x1, y1, x2, y2);
    }

    // fundo principal
    bg.fillStyle(0x063629, 1);
    bg.fillRoundedRect(-145, -62, 290, 124, 24);

    // borda grossa
    bg.lineStyle(6, 0xffcf5a, 1);
    bg.strokeRoundedRect(-145, -62, 290, 124, 24);

    // borda interna clara
    bg.lineStyle(2, 0xfff3a3, 0.95);
    bg.strokeRoundedRect(-134, -51, 268, 102, 18);



    const starsLayout: Record<string, { top: number; bottom: number }> = {
      TRUCO: { top: 3, bottom: 0 },
      SEIS: { top: 3, bottom: 3 },
      NOVE: { top: 5, bottom: 4 },
      DOZE: { top: 6, bottom: 6 }
    };

    const layout = starsLayout[valueUpper] ?? starsLayout.TRUCO;

    const topStars = this.createCurvedStars(
      layout.top,
      0,
      -78,
      layout.top >= 5 ? 118 : 86,
      "top"
    );

    const bottomStars = layout.bottom > 0
      ? this.createCurvedStars(
        layout.bottom,
        0,
        78,
        layout.bottom >= 5 ? 118 : 86,
        "bottom"
      )
      : null;

    const title = this.add.text(0, -34, `${playerName} pediu`, {
      color: "#fff3a3",
      fontFamily: "Arial",
      fontSize: "21px",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5);

    const textGlow = this.add.text(0, 8, valueUpper, {
      color: "#ffcf5a",
      fontFamily: "Arial Black",
      fontSize: valueUpper === "TRUCO" ? "58px" : "62px",
      fontStyle: "900",
      stroke: "#000000",
      strokeThickness: 10
    }).setOrigin(0.5);

    textGlow.setAlpha(0.38);

    const text = this.add.text(0, 8, valueUpper, {
      color: "#ffffff",
      fontFamily: "Arial Black",
      fontSize: valueUpper === "TRUCO" ? "50px" : "54px",
      fontStyle: "900",
      stroke: "#7a3500",
      strokeThickness: 7,
      shadow: {
        offsetX: 0,
        offsetY: 4,
        color: "#000000",
        blur: 8,
        stroke: true,
        fill: true
      }
    }).setOrigin(0.5);

    const shine = this.add.graphics();
    shine.fillStyle(0xffffff, 0.18);
    shine.fillEllipse(-42, 8, 90, 18);
    shine.setRotation(-0.22);

    container.add(
      bottomStars
        ? [bg, topStars, bottomStars, title, textGlow, text]
        : [bg, topStars, title, textGlow, text]
    );

    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1.12 * animationScale,
      duration: 280,
      ease: "Back.Out",
      onComplete: () => {
        this.tweens.add({
          targets: container,
          scale: animationScale,
          duration: 130,
          ease: "Sine.Out"
        });

        this.tweens.add({
          targets: [topStars, bottomStars].filter(Boolean),
          scale: 1.08,
          yoyo: true,
          repeat: 2,
          duration: 180,
          ease: "Sine.InOut"
        });

        this.time.delayedCall(1000, () => {
          this.tweens.add({
            targets: container,
            alpha: 0,
            y: container.y - 70,
            scale: 0.82 * animationScale,
            duration: 340,
            ease: "Cubic.In",
            onComplete: () => container.destroy()
          });
        });
      }
    });

    this.cameras.main.shake(180, 0.006);
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
    if (!this.roomState?.self || this.roomState.status !== "playing") {
      return;
    }

    const previousSelfHandIds = new Set(this.previousRoomState?.self?.hand.map((card) => card.id) ?? []);
    const selfCards = this.roomState.self.hand.filter((card) => !previousSelfHandIds.has(card.id));
    const opponent = this.roomState.players.find((player) => player.id !== this.roomState?.self?.id);
    const previousOpponent = this.previousRoomState?.players.find((player) => player.id === opponent?.id);
    const previousOpponentHandIds = new Set(previousOpponent?.hand.map((card) => card.id) ?? []);
    const opponentCards = opponent?.hand.filter((card) => !previousOpponentHandIds.has(card.id)) ?? [];
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

    for (const item of cardsToAnimate) {
      this.animatingHandCardIds.add(item.card.id);
    }

    cardsToAnimate.forEach((item, index) => {
      const handIndex = item.hand.findIndex((card) => card.id === item.card.id);
      const fromX = this.deckGroup.x;
      const fromY = this.deckGroup.y;
      const target = item.owner === "self"
        ? this.getHandCardTarget(item.hand, handIndex)
        : this.getOpponentHandCardTarget(item.hand, handIndex);
      const animatedCard = this.createCardBack();

      animatedCard.setPosition(fromX, fromY);
      animatedCard.setScale(0.68 * this.uiScale);
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
        onComplete: () => {
          if (item.owner === "self") {
            this.revealDealtCard(animatedCard, item.card, target);
            return;
          }

          animatedCard.destroy();
          this.finishDealAnimation(item.card.id);
        }
      });
    });
  }

  private revealDealtCard(
    cardBack: Phaser.GameObjects.Container,
    card: Card,
    target: { x: number; y: number; scale: number; rotation: number }
  ): void {
    this.tweens.add({
      targets: cardBack,
      scaleX: 0,
      duration: 120,
      ease: "Sine.In",
      onComplete: () => {
        cardBack.destroy();

        const cardFace = this.createCard(card, false);
        cardFace.setPosition(target.x, target.y);
        cardFace.setRotation(target.rotation);
        cardFace.setScale(0, target.scale);
        cardFace.setDepth(70);

        this.tweens.add({
          targets: cardFace,
          scaleX: target.scale,
          duration: 140,
          ease: "Sine.Out",
          onComplete: () => {
            cardFace.destroy();
            this.finishDealAnimation(card.id);
          }
        });
      }
    });
  }

  private finishDealAnimation(cardId: string): void {
    this.animatingHandCardIds.delete(cardId);

    if (this.animatingHandCardIds.size === 0) {
      this.renderState();
    }
  }

  private renderTrucoButton(): void {
    const handValue = this.roomState?.handValue ?? 1;
    const isPlaying = this.roomState?.status === "playing";
    const selfPoints = this.roomState?.self?.points ?? 0;
    const hasElevenHand = Boolean(this.roomState?.isIronHand || this.roomState?.elevenHandDecision || this.roomState?.players.some((player) => player.points === 11));
    const lastRaiseWasMine = this.roomState?.lastTrucoRaise?.playerId === this.roomState?.self?.id;
    const label = {
      1: "Truco",
      3: "Seis",
      6: "Nove",
      9: "Doze",
      12: "Doze"
    }[handValue];
    const enabled = isPlaying && !hasElevenHand && !this.roomState?.trucoRequest && !lastRaiseWasMine && selfPoints !== 11 && handValue < 12;

    this.drawTrucoRaiseButton(label, enabled);
    this.setTrucoButtonInteractive(enabled);
  }

  private renderTrucoResponse(): void {
    const request = this.roomState?.trucoRequest;
    const responseKey = this.roomState ? this.getTrucoResponseKey(this.roomState) : null;
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

      this.trucoResponseTitle.setText(`Pedido de ${requestLabel}`);
      this.trucoResponseRaiseText.setText(raiseLabel);
      this.setTrucoResponseRaiseEnabled(request.requestedValue < 12);
    }

    this.trucoResponseGroup.setVisible(shouldRespond);
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

  private renderScoreboard(): void {
    this.scoreboardGroup.removeAll(true);

    const width = Math.min(this.getViewWidth() - 24, 500 * this.uiScale);
    const bg = this.add.rectangle(0, 0, width, 86 * this.uiScale, 0x0b261c, 0.82).setStrokeStyle(2, 0xf8f1d9, 0.35);
    const headers = ["Rodada", "Pontos", "Valendo", "Jogos"];
    const players = this.roomState?.players ?? [];
    const left = -width / 2 + 12;
    const columnStart = left + Math.min(200 * this.uiScale, width * 0.4);
    const columnGap = (width - (columnStart - left) - 12) / headers.length;

    this.scoreboardGroup.add(bg);

    headers.forEach((header, index) => {
      this.scoreboardGroup.add(this.add.text(columnStart + index * columnGap, -28 * this.uiScale, header, {
        color: "#f8f1d9",
        fontFamily: "Arial",
        fontSize: `${18 * this.uiScale}px`,
        fontStyle: "bold"
      }).setOrigin(0.5));
    });

    players.forEach((player, rowIndex) => {
      const y = -4 + rowIndex * 24 * this.uiScale;
      const isSelf = player.id === this.roomState?.self?.id;
      const name = `${isSelf ? "Voce" : player.name}`.slice(0, 14);
      const values = [player.roundWins, player.points, this.roomState?.handValue ?? 1, player.games];

      this.scoreboardGroup.add(this.add.text(left, y, name, {
        color: isSelf ? "#ffcf5a" : "#f8f1d9",
        fontFamily: "Arial",
        fontSize: `${22 * this.uiScale}px`,
        fontStyle: isSelf ? "bold" : "normal"
      }).setOrigin(0, 0.5));

      values.forEach((value, index) => {
        this.scoreboardGroup.add(this.add.text(columnStart + index * columnGap, y, String(value), {
          color: "#f8f1d9",
          fontFamily: "Arial",
          fontSize: `${22 * this.uiScale}px`
        }).setOrigin(0.5));
      });
    });
  }

  private renderVira(): void {
    this.viraGroup.removeAll(true);

    if (!this.roomState?.vira) {
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

    for (const cardId of Array.from(this.tableCardObjects.keys())) {
      if (!activeCardIds.has(cardId)) {
        this.destroyCachedTableCard(cardId);
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
      color: "#f8f1d9",
      fontFamily: "Arial Black",
      fontSize: "13px",
      fontStyle: "900",
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

    const bg = this.add.circle(0, 0, 50, 0xffffff, 1)
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

    nameBox.fillStyle(0x000000, 0.82);
    nameBox.fillRoundedRect(-56, 64, 112, 28, 8);

    nameBox.lineStyle(2, 0xffcf5a, 1);
    nameBox.strokeRoundedRect(-56, 64, 112, 28, 8);

    const name = this.add.text(0, 78, "Oponente", {
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: "14px",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.opponentNameText = name;

    container.add([
      bg,
      avatar,
      nameBox,
      name
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
    const back = this.add.image(0, 0, "card-back").setDisplaySize(width, height);

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
      const back = this.add.image(0, 0, "card-back").setDisplaySize(width, height);

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

        this.socket.emit("card:play", {
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
        if (hasDragged) {
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
}

let game: Phaser.Game | null = null;
let currentTableBackground = getSelectedTableBackground();
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
  document.getElementById("settings")?.classList.add("is-hidden");
  document.getElementById("waiting-room")?.classList.add("is-hidden");
  document.getElementById("game")?.classList.add("is-hidden");
}

function showLoginMenu(): void {
  document.getElementById("login")?.classList.remove("is-hidden");
  document.getElementById("home")?.classList.add("is-hidden");
  document.getElementById("profile")?.classList.add("is-hidden");
  document.getElementById("settings")?.classList.add("is-hidden");
  document.getElementById("waiting-room")?.classList.add("is-hidden");
  document.getElementById("game")?.classList.add("is-hidden");
}

function showSettingsMenu(): void {
  document.getElementById("login")?.classList.add("is-hidden");
  document.getElementById("home")?.classList.add("is-hidden");
  document.getElementById("profile")?.classList.add("is-hidden");
  document.getElementById("settings")?.classList.remove("is-hidden");
  document.getElementById("waiting-room")?.classList.add("is-hidden");
  document.getElementById("game")?.classList.add("is-hidden");
  renderBackgroundOptions();
}

function showProfileMenu(): void {
  document.getElementById("login")?.classList.add("is-hidden");
  document.getElementById("home")?.classList.add("is-hidden");
  document.getElementById("profile")?.classList.remove("is-hidden");
  document.getElementById("settings")?.classList.add("is-hidden");
  document.getElementById("waiting-room")?.classList.add("is-hidden");
  document.getElementById("game")?.classList.add("is-hidden");
  renderProfileForm();
}

function showWaitingRoom(message = "Procurando outro jogador para iniciar a partida."): void {
  document.getElementById("login")?.classList.add("is-hidden");
  document.getElementById("home")?.classList.add("is-hidden");
  document.getElementById("profile")?.classList.add("is-hidden");
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
  void startOnlineGame();
});
document.getElementById("login-form")?.addEventListener("submit", (event) => {
  void loginWithEmail(event);
});
document.getElementById("open-profile")?.addEventListener("click", () => {
  void fetchPlayerProfile().finally(showProfileMenu);
});
document.getElementById("open-settings")?.addEventListener("click", showSettingsMenu);
document.getElementById("back-home")?.addEventListener("click", showHomeMenu);
document.getElementById("back-home-profile")?.addEventListener("click", showHomeMenu);
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
renderBackgroundOptions();
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
