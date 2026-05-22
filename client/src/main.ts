import Phaser from "phaser";
import { io, type Socket } from "socket.io-client";
import type { Card, ClientToServerEvents, RoomState, ServerToClientEvents } from "@truco/shared";
import "./styles.css";
import opponentAvatarUrl from "./img/avatar/user-secret.svg";
import cardBackUrl from "./img/cartas/ivory-emerald.svg";
import feltBurgundyUrl from "./img/table-backgrounds/felt-burgundy.png";
import feltCharcoalUrl from "./img/table-backgrounds/felt-charcoal.png";
import feltEmeraldUrl from "./img/table-backgrounds/felt-emerald.png";
import feltNavyUrl from "./img/table-backgrounds/felt-navy.png";
import feltTealUrl from "./img/table-backgrounds/felt-teal.png";

type TrucoSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const serverUrl = 'https://truco-1wfk.onrender.com';//import.meta.env.VITE_SERVER_URL ?? `${window.location.protocol}//${window.location.hostname}:3000`;
const tableBackgrounds = {
  "felt-teal": { label: "Teal", url: feltTealUrl },
  "felt-emerald": { label: "Emerald", url: feltEmeraldUrl },
  "felt-navy": { label: "Navy", url: feltNavyUrl },
  "felt-burgundy": { label: "Burgundy", url: feltBurgundyUrl },
  "felt-charcoal": { label: "Charcoal", url: feltCharcoalUrl }
} as const;
const defaultTableBackground = "felt-teal";
const tableBackgroundStorageKey = "truco-table-background";

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
  const storageKey = "truco-player-token";

  try {
    const storedToken = localStorage.getItem(storageKey);

    if (storedToken) {
      return storedToken;
    }

    const newToken = createPlayerToken();

    localStorage.setItem(storageKey, newToken);
    return newToken;
  } catch {
    return createPlayerToken();
  }
}

const playerToken = getPlayerToken();

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
  private roomId = "mesa-1";
  private playerName = `Jogador ${Math.floor(Math.random() * 900 + 100)}`;
  private status!: Phaser.GameObjects.Text;
  private scoreboardGroup!: Phaser.GameObjects.Container;
  private trucoButton!: Phaser.GameObjects.Container;
  private trucoButtonBg!: Phaser.GameObjects.Graphics;
  private trucoButtonText!: Phaser.GameObjects.Text;
  private trucoButtonSmallText!: Phaser.GameObjects.Text;
  private trucoButtonHitZone!: Phaser.GameObjects.Zone;
  private trucoResponseGroup!: Phaser.GameObjects.Container;
  private trucoResponseRaiseText!: Phaser.GameObjects.Text;
  private handGroup!: Phaser.GameObjects.Container;
  private opponentHandGroup!: Phaser.GameObjects.Container;
  private opponentAvatarGroup!: Phaser.GameObjects.Container;
  private deckGroup!: Phaser.GameObjects.Container;
  private viraGroup!: Phaser.GameObjects.Container;
  private tableGroup!: Phaser.GameObjects.Container;
  private tableBackground!: Phaser.GameObjects.Image;
  private lastAnimatedTrucoValue: number | null = null;
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
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#12372a");
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

    //#region Exit Button
this.exitButtonBg = this.add.graphics();

this.exitButtonText = this.add.text(0, 0, "SAIR", {
  color: "#ffffff",
  fontFamily: "Arial Black",
  fontSize: "16px",
  fontStyle: "900"
}).setOrigin(0.5);

this.exitButton = this.add.container(0, 0, [
  this.exitButtonBg,
  this.exitButtonText
]);

this.drawExitButton();

const exitButtonHitZone = this.add.zone(0, 0, 98, 50);

this.exitButton.add(exitButtonHitZone);
this.exitButton.setSize(98, 50);

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
    this.opponentHandGroup = this.add.container(0, 0);
    this.opponentAvatarGroup = this.createOpponentAvatar();
    this.deckGroup = this.add.container(0, 0);
    this.viraGroup = this.add.container(0, 0);
    this.tableGroup = this.add.container(0, 0);

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

      if (state.status === "waiting") {
        showWaitingRoom(state.message);
      }

      if (state.status === "playing") {
        showGameTable();
      }

      if (!state.lastTrucoRaise) {
        this.lastAnimatedTrucoValue = null;
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
    this.layout();
  }

  private drawExitButton(): void {
    const g = this.exitButtonBg;

    g.clear();

    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-42, -16, 84, 34, 12);

    g.fillStyle(0x8b1e1e, 1);
    g.fillRoundedRect(-46, -20, 84, 34, 12);

    g.lineStyle(3, 0xffcf5a, 1);
    g.strokeRoundedRect(-46, -20, 84, 34, 12);

    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(-40, -16, 72, 10, 8);
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
    bg.fillRoundedRect(-166, -72, 332, 144, 18);
    bg.lineStyle(3, 0xffcf5a, 1);
    bg.strokeRoundedRect(-166, -72, 332, 144, 18);

    const title = this.add.text(0, -46, "Pedido de truco", {
      color: "#fff3a3",
      fontFamily: "Arial Black",
      fontSize: "20px",
      fontStyle: "900"
    }).setOrigin(0.5);

    const accept = this.createTrucoResponseButton(-104, 28, "ACEITAR", 0x0b7a4b, "accept");
    const reject = this.createTrucoResponseButton(0, 28, "CORRER", 0x8b1e1e, "reject");
    const raise = this.createTrucoResponseButton(104, 28, "SEIS", 0x7a4b00, "raise");
    const group = this.add.container(0, 0, [bg, title, accept.container, reject.container, raise.container]);

    this.trucoResponseRaiseText = raise.text;
    group.setDepth(15000);
    group.setVisible(false);

    return group;
  }

  private createTrucoResponseButton(
    x: number,
    y: number,
    label: string,
    color: number,
    action: "accept" | "reject" | "raise"
  ): { container: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text } {
    const bg = this.add.graphics();

    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-46, -24, 92, 48, 10);
    bg.lineStyle(2, 0xfff3a3, 1);
    bg.strokeRoundedRect(-46, -24, 92, 48, 10);

    const text = this.add.text(0, 0, label, {
      color: "#ffffff",
      fontFamily: "Arial Black",
      fontSize: "13px",
      fontStyle: "900"
    }).setOrigin(0.5);

    const hitZone = this.add.zone(0, 0, 96, 54);
    const button = this.add.container(x, y, [bg, text, hitZone]);

    button.setSize(92, 48);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on("pointerup", () => {
      this.socket.emit("truco:respond", {
        roomId: this.roomId,
        action
      });
    });

    return { container: button, text };
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
  private drawTrucoRaiseButton(value: string, enabled: boolean): void {
    const scale = this.uiScale;
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

    this.trucoButton.setScale(0.60 * scale);
    this.trucoButton.setSize(buttonWidth, buttonHeight);
  }

  private uiScale = 1;

  private updateUiScale(): void {
    const { width, height } = this.scale;

    const baseWidth = 390;
    const baseHeight = 844;

    const scaleX = width / baseWidth;
    const scaleY = height / baseHeight;

    this.uiScale = Phaser.Math.Clamp(Math.min(scaleX, scaleY), 0.82, 1.08);
  }

  private layout(): void {
    this.updateUiScale();

    const { width, height } = this.scale;
    const safeTop = 12 * this.uiScale;
    const backgroundScale = Math.max(
      width / this.tableBackground.width,
      height / this.tableBackground.height
    );

    this.tableBackground.setPosition(width / 2, height / 2);
    this.tableBackground.setScale(backgroundScale);
    this.scoreboardGroup.setPosition(width / 2, safeTop + 46 * this.uiScale);
    this.status.setPosition(width / 2, safeTop + 106 * this.uiScale);
    this.trucoButton.setPosition(width - 50 * this.uiScale, height - 100 * this.uiScale);
    this.trucoButtonHitZone.setPosition(
      this.trucoButton.x,
      this.trucoButton.y
    );
    this.trucoResponseGroup.setPosition(width / 2, height / 2 + 112 * this.uiScale);
    this.trucoResponseGroup.setScale(this.uiScale);
    this.audioButton.setPosition(58 * this.uiScale, height - 100 * this.uiScale);
    this.exitButton.setPosition(
  width - 58 * this.uiScale,
  34 * this.uiScale
);
    this.opponentHandGroup.setPosition(width / 2, safeTop + 148 * this.uiScale);
    this.opponentAvatarGroup.setPosition(width / 2, safeTop + 182 * this.uiScale);
    this.viraGroup.setPosition(width / 2, height / 2 + 10 * this.uiScale);
    this.deckGroup.setPosition(width / 2 + 30 * this.uiScale, height / 2 + 12 * this.uiScale);
    this.tableGroup.setPosition(width / 2, height / 2 - 20 * this.uiScale);
    this.handGroup.setPosition(width / 2, height - 82 * this.uiScale);
    this.renderState();
  }

  private renderState(): void {
    if (!this.roomState) {
      return;
    }

    const self = this.roomState.self;
    const opponent = this.roomState.players.find((player) => player.id !== self?.id);
    const isMyTurn = this.roomState.turnPlayerId === self?.id;

    const opponentName = this.opponentAvatarGroup.list[3] as Phaser.GameObjects.Text;

    if (opponentName) {
      opponentName.setText(opponent?.name ?? "Oponente");
    }

    this.status.setText(this.roomState.message);
    this.audioButton.setVisible(this.roomState.status === "playing");
    this.renderTrucoResponse();

    this.renderScoreboard();
    this.renderTrucoButton();
    this.renderVira();
    this.renderDeck();
    this.renderTable();
    this.renderOpponentHand(opponent?.hand ?? []);
    this.renderHand(self?.hand ?? [], isMyTurn && !this.roomState.trucoRequest);
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

    const container = this.add.container(width / 2, height / 2);
    container.setDepth(20000);
    container.setAlpha(0);
    container.setScale(0.35);

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
      scale: 1.12,
      duration: 280,
      ease: "Back.Out",
      onComplete: () => {
        this.tweens.add({
          targets: container,
          scale: 1,
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
            scale: 0.82,
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
    const opponentSpacing = Math.min(82, this.scale.width / 4.8);
    const opponentStartX = -((opponentCardCount - 1) * opponentSpacing) / 2;
    const fromX = this.opponentHandGroup.x + opponentStartX + Math.max(previousCardIndex, 0) * opponentSpacing;
    const fromY = this.opponentHandGroup.y;
    const targetPosition = this.getTableCardPosition(playedEntry.playerId, currentTable.length - 1, currentTable.length);
    const toX = this.tableGroup.x + targetPosition.x;
    const toY = this.tableGroup.y + targetPosition.y;
    const animatedCard = this.createCard(playedEntry.card, false);

    this.animatingTableCardIds.add(playedEntry.card.id);
    animatedCard.setPosition(fromX, fromY);
    animatedCard.setScale(0.72 * this.uiScale);
    animatedCard.setDepth(30);

    this.tweens.add({
      targets: animatedCard,
      x: toX,
      y: toY,
      scale: 0.68 * this.uiScale,
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
    const lastRaiseWasMine = this.roomState?.lastTrucoRaise?.playerId === this.roomState?.self?.id;
    const label = {
      1: "Truco",
      3: "Seis",
      6: "Nove",
      9: "Doze",
      12: "Doze"
    }[handValue];
    const enabled = isPlaying && !this.roomState?.trucoRequest && !lastRaiseWasMine && selfPoints !== 11 && handValue < 12;

    this.drawTrucoRaiseButton(label, enabled);
    this.setTrucoButtonInteractive(enabled);
  }

  private renderTrucoResponse(): void {
    const request = this.roomState?.trucoRequest;
    const selfId = this.roomState?.self?.id;
    const shouldRespond = Boolean(request && request.responderPlayerId === selfId);

    if (request) {
      const raiseLabel = {
        3: "SEIS",
        6: "NOVE",
        9: "DOZE",
        12: "DOZE"
      }[request.requestedValue];

      this.trucoResponseRaiseText.setText(raiseLabel);
    }

    this.trucoResponseGroup.setVisible(shouldRespond);
  }

  private setTrucoButtonInteractive(enabled: boolean): void {
    const width = 100 * this.uiScale;
    const height = 100 * this.uiScale;

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

    const width = Math.min(this.scale.width - 24, 430);
    const bg = this.add.rectangle(0, 0, width, 92, 0x0b261c, 0.82).setStrokeStyle(2, 0xf8f1d9, 0.35);
    const headers = ["Rodada", "Pontos", "Valendo", "Jogos"];
    const players = this.roomState?.players ?? [];
    const left = -width / 2 + 12;
    const columnStart = left + Math.min(142, width * 0.34);
    const columnGap = (width - (columnStart - left) - 12) / headers.length;

    this.scoreboardGroup.add(bg);

    headers.forEach((header, index) => {
      this.scoreboardGroup.add(this.add.text(columnStart + index * columnGap, -34, header, {
        color: "#f8f1d9",
        fontFamily: "Arial",
        fontSize: "12px",
        fontStyle: "bold"
      }).setOrigin(0.5));
    });

    players.forEach((player, rowIndex) => {
      const y = -8 + rowIndex * 28;
      const isSelf = player.id === this.roomState?.self?.id;
      const name = `${isSelf ? "Voce" : player.name}`.slice(0, 14);
      const values = [player.roundWins, player.points, this.roomState?.handValue ?? 1, player.games];

      this.scoreboardGroup.add(this.add.text(left, y, name, {
        color: isSelf ? "#ffcf5a" : "#f8f1d9",
        fontFamily: "Arial",
        fontSize: "13px",
        fontStyle: isSelf ? "bold" : "normal"
      }).setOrigin(0, 0.5));

      values.forEach((value, index) => {
        this.scoreboardGroup.add(this.add.text(columnStart + index * columnGap, y, String(value), {
          color: "#f8f1d9",
          fontFamily: "Arial",
          fontSize: "14px"
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
    card.setScale(0.68 * this.uiScale);

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
      card.setScale(0.68 * this.uiScale);
      card.setRotation(Phaser.Math.DegToRad(3));
      card.setDepth(12 + index);
      this.deckGroup.add(card);
    }

    this.deckGroup.setDepth(12);
  }

  private renderTable(): void {
    this.tableGroup.removeAll(true);

    const cards = this.roomState?.table ?? [];

    cards.forEach((entry, index) => {
      if (this.animatingTableCardIds.has(entry.card.id)) {
        return;
      }

      const card = this.createCard(entry.card, false);
      const position = this.getTableCardPosition(entry.playerId, index, cards.length);

      card.setPosition(position.x, position.y);
      card.setScale(0.68 * this.uiScale);
      this.tableGroup.add(card);
    });
  }

  private getTableCardPosition(playerId: string, fallbackIndex: number, tableCardCount: number): { x: number; y: number } {
    const isSelf = playerId === this.roomState?.self?.id;

    if (isSelf) {
      return { x: 0, y: 120 * this.uiScale };
    }

    if (this.roomState?.self) {
      return { x: 0, y: -60 * this.uiScale };
    }

    const spacing = 92 * this.uiScale;
    const startX = -((tableCardCount - 1) * spacing) / 2;

    return { x: startX + fallbackIndex * spacing, y: 120 * this.uiScale };
  }

  private getHandCardTarget(cards: Card[], index: number): { x: number; y: number; scale: number; rotation: number } {
    const spacing = Math.min(104 * this.uiScale, this.scale.width / 5.6);
    const startX = -((cards.length - 1) * spacing) / 2;

    return {
      x: this.handGroup.x + startX + index * spacing,
      y: this.handGroup.y,
      scale: 1 * this.uiScale,
      rotation: 0
    };
  }

  private getOpponentHandCardTarget(cards: Card[], index: number): { x: number; y: number; scale: number; rotation: number } {
    const spacing = Math.min(20, this.scale.width / 12);
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
    this.handGroup.removeAll(true);

    const spacing = Math.min(104 * this.uiScale, this.scale.width / 5.6);
    const startX = -((cards.length - 1) * spacing) / 2;

    cards.forEach((cardData, index) => {
      if (this.animatingHandCardIds.has(cardData.id)) {
        return;
      }

      const card = this.createCard(cardData, enabled);
      card.setPosition(startX + index * spacing, 0);
      card.setScale(1 * this.uiScale);
      this.handGroup.add(card);
    });
  }

  private renderOpponentHand(cards: Card[]): void {
    this.opponentHandGroup.removeAll(true);

    const spacing = Math.min(20, this.scale.width / 12);
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
      card.setScale(0.32 * this.uiScale);//Tamanho carta dos oponenetes
      this.opponentHandGroup.add(card);
    });
  }

  private createOpponentAvatar(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);

    const bg = this.add.circle(0, 0, 29, 0xffffff, 1)
      .setStrokeStyle(2, 0xffcf5a, 0.9);

    const avatar = this.add.image(0, 0, "opponent-avatar")
      .setDisplaySize(30, 30);

    // caixa do nome
    const nameBox = this.add.graphics();

    nameBox.fillStyle(0x000000, 0.82);
    nameBox.fillRoundedRect(-56, 34, 112, 28, 8);

    nameBox.lineStyle(2, 0xffcf5a, 1);
    nameBox.strokeRoundedRect(-56, 34, 112, 28, 8);

    const name = this.add.text(0, 48, "Oponente", {
      color: "#ffffff",
      fontFamily: "Arial",
      fontSize: "14px",
      fontStyle: "bold"
    }).setOrigin(0.5);

    container.add([
      bg,
      avatar,
      nameBox,
      name
    ]);

    container.setDepth(8);

    return container;
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

  private createCard(card: Card, enabled: boolean): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const width = 80;
    const height = 118;
    const radius = 10;
    const suitColor = this.suitColor(card.suit);
    const shadow = this.add.graphics();
    const face = this.add.graphics();

    shadow.fillStyle(0x06130f, 0.34);
    shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, radius);

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
    container.setSize(width, height);

    if (enabled) {
      let hasDragged = false;
      let hasPlayed = false;
      let isDragging = false;
      let isAnimatingToTable = false;
      const playCard = () => {
        if (hasPlayed) {
          return;
        }

        hasPlayed = true;
        this.socket.emit("card:play", {
          roomId: this.roomId,
          cardId: card.id
        });
      };

      container.setInteractive({ draggable: true, useHandCursor: true });
      this.input.setDraggable(container);
      container.on("dragstart", () => {
        hasDragged = false;
        isDragging = true;
        this.tweens.killTweensOf(container);
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
            scale: 0.68 * this.uiScale,
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
          this.tweens.add({ targets: container, x: container.input?.dragStartX ?? container.x, y: 0, duration: 160, ease: "Back.Out" });
        }
      });
      container.on("pointerup", () => {
        if (!hasDragged && !isAnimatingToTable) {
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

function showHomeMenu(): void {
  document.getElementById("home")?.classList.remove("is-hidden");
  document.getElementById("settings")?.classList.add("is-hidden");
  document.getElementById("waiting-room")?.classList.add("is-hidden");
  document.getElementById("game")?.classList.add("is-hidden");
}

function showSettingsMenu(): void {
  document.getElementById("home")?.classList.add("is-hidden");
  document.getElementById("settings")?.classList.remove("is-hidden");
  document.getElementById("waiting-room")?.classList.add("is-hidden");
  document.getElementById("game")?.classList.add("is-hidden");
  renderBackgroundOptions();
}

function showWaitingRoom(message = "Procurando outro jogador para iniciar a partida."): void {
  document.getElementById("home")?.classList.add("is-hidden");
  document.getElementById("settings")?.classList.add("is-hidden");
  document.getElementById("waiting-room")?.classList.remove("is-hidden");
  document.getElementById("game")?.classList.add("is-hidden");
  const waitingMessage = document.getElementById("waiting-message");

  if (waitingMessage) {
    waitingMessage.textContent = message;
  }
}

function showGameTable(): void {
  document.getElementById("home")?.classList.add("is-hidden");
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

function returnToMainMenu(): void {
  const currentGame = game;

  game = null;
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

function startOnlineGame(): void {
  try {
    if (game) {
    return;
  }

  void unlockAudioPlayback().catch(() => undefined);
  showWaitingRoom();

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#12372a",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: window.innerWidth,
      height: window.innerHeight
    },
    render: {
      antialias: true,
      pixelArt: false,
      powerPreference: "high-performance"
    },
    input: {
      activePointers: 3
    },
    scene: [TableScene]
  });
  } catch (error) {
    returnToMainMenu();
    alert("Ocorreu um erro ao iniciar o jogo. Por favor, tente novamente.");
  }
  
}

document.getElementById("play-online")?.addEventListener("click", startOnlineGame);
document.getElementById("open-settings")?.addEventListener("click", showSettingsMenu);
document.getElementById("back-home")?.addEventListener("click", showHomeMenu);
document.getElementById("cancel-waiting")?.addEventListener("click", leaveOnlineGame);
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
document.addEventListener("pointerdown", () => {
  if (!audioPlaybackUnlocked) {
    void unlockAudioPlayback().catch(() => undefined);
  }
});
