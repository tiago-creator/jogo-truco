import Phaser from "phaser";
import { io, type Socket } from "socket.io-client";
import type { Card, ClientToServerEvents, RoomState, ServerToClientEvents } from "@truco/shared";
import "./styles.css";
import opponentAvatarUrl from "./img/avatar/user-secret.svg";
import cardBackUrl from "./img/cartas/ivory-emerald.svg";

type TrucoSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const serverUrl = import.meta.env.VITE_SERVER_URL ?? `${window.location.protocol}//${window.location.hostname}:3000`;

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
  private handGroup!: Phaser.GameObjects.Container;
  private opponentHandGroup!: Phaser.GameObjects.Container;
  private opponentAvatarGroup!: Phaser.GameObjects.Container;
  private deckGroup!: Phaser.GameObjects.Container;
  private viraGroup!: Phaser.GameObjects.Container;
  private tableGroup!: Phaser.GameObjects.Container;

  constructor() {
    super("table");
  }

  preload(): void {
    this.load.image("card-back", cardBackUrl);
    this.load.image("opponent-avatar", opponentAvatarUrl);
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#12372a");
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
      if (this.roomState?.status === "playing" && this.roomState.handValue < 12) {
        this.socket.emit("truco:raise", { roomId: this.roomId });
      }
    });
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
        name: this.playerName
      });
    });

    this.socket.on("room:state", (state) => {
      this.previousRoomState = this.roomState;
      this.roomState = state;
      this.animateDealIfNeeded();
      this.animateOpponentPlayIfNeeded();
      this.renderState();
    });

    this.socket.on("room:error", ({ message }) => {
      this.status.setText(message);
    });

    this.scale.on("resize", () => this.layout());
    this.layout();
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

    this.trucoButton.each((child) => {
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

    this.scoreboardGroup.setPosition(width / 2, safeTop + 46 * this.uiScale);
    this.status.setPosition(width / 2, safeTop + 106 * this.uiScale);
    this.trucoButton.setPosition(width - 50 * this.uiScale, height - 100 * this.uiScale);
    this.trucoButtonHitZone.setPosition(
  this.trucoButton.x,
  this.trucoButton.y
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

    this.status.setText(this.roomState.status === "playing" ? (isMyTurn ? "Sua vez" : "Vez do oponente") : this.roomState.message);

    this.renderScoreboard();
    this.renderTrucoButton();
    this.renderVira();
    this.renderDeck();
    this.renderTable();
    this.renderOpponentHand(opponent?.hand ?? []);
    this.renderHand(self?.hand ?? [], isMyTurn);
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
    if (!this.previousRoomState || !this.roomState?.self || this.roomState.status !== "playing") {
      return;
    }

    const previousSelfHandIds = new Set(this.previousRoomState.self?.hand.map((card) => card.id) ?? []);
    const selfCards = this.roomState.self.hand.filter((card) => !previousSelfHandIds.has(card.id));
    const opponent = this.roomState.players.find((player) => player.id !== this.roomState?.self?.id);
    const previousOpponent = this.previousRoomState.players.find((player) => player.id === opponent?.id);
    const previousOpponentHandIds = new Set(previousOpponent?.hand.map((card) => card.id) ?? []);
    const opponentCards = opponent?.hand.filter((card) => !previousOpponentHandIds.has(card.id)) ?? [];
    const cardsToAnimate = [
      ...selfCards.map((card) => ({ card, owner: "self" as const, hand: this.roomState?.self?.hand ?? [] })),
      ...opponentCards.map((card) => ({ card, owner: "opponent" as const, hand: opponent?.hand ?? [] }))
    ];

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
    const label = {
      1: "Truco",
      3: "Seis",
      6: "Nove",
      9: "Doze",
      12: "Doze"
    }[handValue];
    const enabled = isPlaying && handValue < 12;

    this.drawTrucoRaiseButton(label, enabled);
    this.setTrucoButtonInteractive(enabled);
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
    const bg = this.add.circle(0, 0, 29, 0xffffff, 1).setStrokeStyle(2, 0xffcf5a, 0.9);
    const avatar = this.add.image(0, 0, "opponent-avatar").setDisplaySize(30, 30);

    container.add([bg, avatar]);
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
    antialias: true,
    pixelArt: false,
    powerPreference: "high-performance"
  },
  input: {
    activePointers: 3
  },
  scene: [TableScene]
});
