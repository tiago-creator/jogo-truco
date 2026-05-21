import Phaser from "phaser";
import { io, type Socket } from "socket.io-client";
import type { Card, ClientToServerEvents, RoomState, ServerToClientEvents } from "@truco/shared";
import "./styles.css";

type TrucoSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const serverUrl = import.meta.env.VITE_SERVER_URL ?? `${window.location.protocol}//${window.location.hostname}:3000`;

class TableScene extends Phaser.Scene {
  private socket!: TrucoSocket;
  private roomState: RoomState | null = null;
  private roomId = "mesa-1";
  private playerName = `Jogador ${Math.floor(Math.random() * 900 + 100)}`;
  private title!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private score!: Phaser.GameObjects.Text;
  private handGroup!: Phaser.GameObjects.Container;
  private tableGroup!: Phaser.GameObjects.Container;

  constructor() {
    super("table");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#12372a");
    this.socket = io(serverUrl, {
      transports: ["websocket"]
    });

    this.title = this.add.text(0, 0, "Truco Online", {
      color: "#f8f1d9",
      fontFamily: "Arial",
      fontSize: "26px",
      fontStyle: "bold"
    }).setOrigin(0.5);

    this.status = this.add.text(0, 0, "Conectando...", {
      color: "#f8f1d9",
      fontFamily: "Arial",
      fontSize: "16px"
    }).setOrigin(0.5);

    this.score = this.add.text(0, 0, "", {
      color: "#f8f1d9",
      fontFamily: "Arial",
      fontSize: "18px"
    }).setOrigin(0.5);

    this.handGroup = this.add.container(0, 0);
    this.tableGroup = this.add.container(0, 0);

    this.socket.on("connect", () => {
      this.socket.emit("room:join", {
        roomId: this.roomId,
        name: this.playerName
      });
    });

    this.socket.on("room:state", (state) => {
      this.roomState = state;
      this.renderState();
    });

    this.socket.on("room:error", ({ message }) => {
      this.status.setText(message);
    });

    this.scale.on("resize", () => this.layout());
    this.layout();
  }

  private layout(): void {
    const { width, height } = this.scale;
    const safeTop = 24;

    this.title.setPosition(width / 2, safeTop + 16);
    this.status.setPosition(width / 2, safeTop + 50);
    this.score.setPosition(width / 2, safeTop + 78);
    this.tableGroup.setPosition(width / 2, height / 2 - 20);
    this.handGroup.setPosition(width / 2, height - 118);
    this.renderState();
  }

  private renderState(): void {
    if (!this.roomState) {
      return;
    }

    const self = this.roomState.self;
    const opponent = this.roomState.players.find((player) => player.id !== self?.id);
    const myScore = self?.score ?? 0;
    const opponentScore = opponent?.score ?? 0;
    const isMyTurn = this.roomState.turnPlayerId === self?.id;

    this.status.setText(this.roomState.status === "playing" ? (isMyTurn ? "Sua vez" : "Vez do oponente") : this.roomState.message);
    this.score.setText(`${self?.name ?? "Voce"} ${myScore} x ${opponentScore} ${opponent?.name ?? "Aguardando"}`);

    this.renderTable();
    this.renderHand(self?.hand ?? [], isMyTurn);
  }

  private renderTable(): void {
    this.tableGroup.removeAll(true);

    const cards = this.roomState?.table ?? [];
    const spacing = 92;
    const startX = -((cards.length - 1) * spacing) / 2;

    cards.forEach((entry, index) => {
      const card = this.createCard(entry.card, false);
      card.setPosition(startX + index * spacing, 0);
      card.setScale(0.86);
      this.tableGroup.add(card);
    });
  }

  private renderHand(cards: Card[], enabled: boolean): void {
    this.handGroup.removeAll(true);

    const spacing = Math.min(104, this.scale.width / 3.8);
    const startX = -((cards.length - 1) * spacing) / 2;

    cards.forEach((cardData, index) => {
      const card = this.createCard(cardData, enabled);
      card.setPosition(startX + index * spacing, 0);
      this.handGroup.add(card);
    });
  }

  private createCard(card: Card, enabled: boolean): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const bg = this.add.rectangle(0, 0, 82, 116, 0xf8f1d9, 1);
    const border = this.add.rectangle(0, 0, 82, 116).setStrokeStyle(3, enabled ? 0xffcf5a : 0x3d2f22);
    const label = this.add.text(0, -10, card.rank, {
      color: "#2b2118",
      fontFamily: "Arial",
      fontSize: "30px",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const suit = this.add.text(0, 28, this.suitSymbol(card.suit), {
      color: card.suit === "hearts" || card.suit === "diamonds" ? "#b92727" : "#1c1c1c",
      fontFamily: "Arial",
      fontSize: "24px"
    }).setOrigin(0.5);

    container.add([bg, border, label, suit]);
    container.setSize(82, 116);

    if (enabled) {
      container.setInteractive({ draggable: true, useHandCursor: true });
      container.on("pointerover", () => this.tweens.add({ targets: container, y: container.y - 8, duration: 120, ease: "Sine.Out" }));
      container.on("pointerout", () => this.tweens.add({ targets: container, y: 0, duration: 120, ease: "Sine.Out" }));
      this.input.setDraggable(container);
      container.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        container.setPosition(dragX - this.handGroup.x, dragY - this.handGroup.y);
      });
      container.on("dragend", () => {
        if (container.y < -80) {
          this.socket.emit("card:play", {
            roomId: this.roomId,
            cardId: card.id
          });
        } else {
          this.tweens.add({ targets: container, x: container.input?.dragStartX ?? container.x, y: 0, duration: 160, ease: "Back.Out" });
        }
      });
      container.on("pointerup", () => {
        this.socket.emit("card:play", {
          roomId: this.roomId,
          cardId: card.id
        });
      });
    }

    return container;
  }

  private suitSymbol(suit: Card["suit"]): string {
    return {
      clubs: "Paus",
      hearts: "Copas",
      spades: "Espadas",
      diamonds: "Ouros"
    }[suit];
  }
}

new Phaser.Game({
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
    antialias: false,
    pixelArt: false,
    powerPreference: "high-performance"
  },
  input: {
    activePointers: 3
  },
  scene: [TableScene]
});
