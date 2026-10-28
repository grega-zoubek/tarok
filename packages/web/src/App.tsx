import React, { useState } from 'react';
import { useTarokGame, type BotConfig, type RoundResult } from './hooks/useTarokGame';
import { PlayingCard } from './components/PlayingCard';
import {
  type Card,
  type Bid,
  BIDS,
  PASS,
  type PlayerId,
  ANNOUNCEMENTS,
  isTarokCard,
  canPlaceContra,
  isLegalBid,
  getLegalPlays,
  getKlopLegalPlays,
  getBarvniValatLegalPlays,
  cardKey,
} from '@tarok/engine';

const SUIT_SL: Record<string, string> = {
  hearts: 'srce',
  diamonds: 'kara',
  clubs: 'križ',
  spades: 'pik',
};

const BID_SL: Record<string, string> = {
  tri: 'Tri',
  dve: 'Dve',
  ena: 'Ena',
  solo_tri: 'Solo tri',
  solo_dve: 'Solo dve',
  solo_ena: 'Solo ena',
  berac: 'Berač',
  solo_brez: 'Solo brez',
  odprti_berac: 'Odprti berač',
  barvni_valat: 'Barvni valat',
  valat: 'Valat',
  klop: 'Klop',
};

const ANN_SL: Record<string, string> = {
  trula: 'Trula',
  kralji: 'Kralji',
  pagat_ultimo: 'Pagat ultimo',
  kralj_ultimo: 'Kralj ultimo',
  valat: 'Valat',
};

function App() {
  const game = useTarokGame();
  const { 
    gameState, 
    startGame, 
    HUMAN_PLAYER,
    playerNames,
    playerRadlci,
    playerScores,
    lastCapturedTrick,
    isProcessingTrick,
    isMovingCards,
    showKlopTalon,
    currentRound,
    maxRounds,
    history,
    roundScore,
    nextRound,
    playBid,
    playCall,
    playTalonPick,
    playDiscard,
    playRaise,
    playAnnouncement,
    playAnnouncementPass,
    playContra,
    playCard,
    errorMessage,
    clearError
  } = game;

  const [selectedDiscards, setSelectedDiscards] = useState<Card[]>([]);
  const [showFinalScore, setShowFinalScore] = useState(false);
  const [humanName, setHumanName] = useState("Igralec");
  const [setupMaxRounds, setSetupMaxRounds] = useState(8);
  const [botConfigs, setBotConfigs] = useState<BotConfig[]>([
    { name: "Bot 1", difficulty: 3 },
    { name: "Bot 2", difficulty: 3 },
    { name: "Bot 3", difficulty: 3 },
  ]);

  const handleQuitGame = () => {
    sessionStorage.removeItem("tarokSession");
    window.location.reload();
  };

  // ── Final scoreboard (shown after last round) ──────────────────────────
  if (showFinalScore) {
    const totalPoints = history.reduce((sum, r) => sum + r.finalValue, 0);
    const wins = history.filter(r => r.winnerTeam === "declarer").length;
    return (
      <div className="flex items-center justify-center min-h-screen bg-green-900">
        <div className="bg-green-800 p-8 rounded-xl shadow-2xl border-4 border-yellow-600 w-full max-w-md overflow-y-auto max-h-screen">
          <h1 className="text-4xl font-black text-yellow-400 mb-2 text-center">KONČNI IZID</h1>
          <p className="text-center text-gray-300 mb-6 text-sm">{maxRounds} krogov odigranih</p>

          <div className={`text-center mb-6 p-4 rounded-2xl border-2 ${
            totalPoints >= 0 ? "bg-green-700/50 border-green-400" : "bg-red-900/50 border-red-400"
          }`}>
            <span className={`text-6xl font-black ${
              totalPoints >= 0 ? "text-green-300" : "text-red-300"
            }`}>{totalPoints >= 0 ? `+${totalPoints}` : totalPoints}</span>
            <p className="text-sm text-gray-300 mt-1 uppercase tracking-widest">Skupaj točk</p>
            <p className="text-xs text-gray-400 mt-1">{wins} zmag / {maxRounds - wins} porazov</p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
            {history.map((r, i) => (
              <div key={i} className={`flex justify-between items-center p-2 rounded-lg text-sm border ${
                r.winnerTeam === "declarer" ? "bg-green-900/40 border-green-700" :
                r.winnerTeam === "klop" ? "bg-yellow-900/30 border-yellow-700" :
                "bg-red-900/40 border-red-800"
              }`}>
                <span className="text-gray-400 text-xs w-8">#{r.round}</span>
                <span className="text-yellow-100 uppercase font-bold flex-1">{BID_SL[r.contract] ?? r.contract}</span>
                <span className="text-gray-300 text-xs">{r.declarer}</span>
                <span className={`font-black ml-3 ${
                  r.finalValue >= 0 ? "text-green-400" : "text-red-400"
                }`}>{r.finalValue >= 0 ? `+${r.finalValue}` : r.finalValue}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => { sessionStorage.removeItem("tarokSession"); window.location.reload(); }}
            className="w-full py-4 bg-yellow-500 text-green-900 font-black text-xl rounded-xl hover:bg-yellow-400 hover:scale-105 active:scale-95 transition-all"
          >
            NOVA IGRA
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-green-900">
        <div className="bg-green-800 p-8 rounded-xl shadow-2xl border-4 border-yellow-600 w-full max-w-md overflow-y-auto max-h-screen">
          <h1 className="text-6xl font-bold mb-8 text-yellow-400 drop-shadow-lg text-center font-serif">TAROK</h1>
          
          <div className="space-y-4 mb-8 text-left">
            <div>
              <label className="block text-sm font-bold text-yellow-200 mb-1">Tvoje ime:</label>
              <input 
                type="text" 
                value={humanName}
                onChange={(e) => setHumanName(e.target.value)}
                className="w-full p-2 rounded bg-green-700 text-white border border-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-yellow-200 mb-1">Dolžina igre (št. krogov):</label>
              <div className="flex gap-2">
                {[8, 12, 16].map(num => (
                  <button 
                    key={num}
                    onClick={() => setSetupMaxRounds(num)}
                    className={`flex-grow py-2 rounded font-bold border transition-colors ${setupMaxRounds === num ? "bg-yellow-500 text-green-900 border-white" : "bg-green-700 text-yellow-200 border-yellow-600"}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
            
            {botConfigs.map((bot, idx) => (
              <div key={idx} className="flex gap-2 p-2 bg-black/10 rounded border border-white/5">
                <div className="flex-grow">
                  <label className="block text-xs font-bold text-gray-300 mb-1">Nasprotnik {idx + 1}:</label>
                  <input 
                    type="text" 
                    value={bot.name}
                    onChange={(e) => {
                      const newConfigs = [...botConfigs];
                      newConfigs[idx]!.name = e.target.value;
                      setBotConfigs(newConfigs);
                    }}
                    className="w-full p-1 text-sm rounded bg-green-700 text-white border border-gray-500"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-gray-300 mb-1">Moč:</label>
                  <select 
                    value={bot.difficulty}
                    onChange={(e) => {
                      const newConfigs = [...botConfigs];
                      newConfigs[idx]!.difficulty = parseInt(e.target.value) as any;
                      setBotConfigs(newConfigs);
                    }}
                    className="w-full p-1 text-sm rounded bg-green-700 text-white border border-gray-500"
                  >
                    <option value="1">1 (Šibko)</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5 (Mojster)</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={() => { setShowFinalScore(false); startGame({ humanName, botConfigs, maxRounds: setupMaxRounds }); }}
            className="w-full py-4 bg-yellow-500 text-green-900 font-bold rounded-lg shadow-lg hover:bg-yellow-400 text-2xl transition-all hover:scale-105 active:scale-95"
          >
            Igraj!
          </button>
        </div>
      </div>
    );
  }

  const myHand = gameState?.hands?.[HUMAN_PLAYER] || [];
  const isMyTurn = gameState?.currentPlayer === HUMAN_PLAYER;

  const legalPlayKeys = (() => {
    if (!gameState || gameState.phase !== "playing" || !isMyTurn || !gameState.trickRound) {
      return null as Set<string> | null;
    }
    const trick = gameState.trickRound.currentTrick;
    const hand = myHand;
    const isNeg =
      gameState.contract === "klop" ||
      gameState.contract === "berac" ||
      gameState.contract === "odprti_berac";
    const legal =
      gameState.contract === "barvni_valat" && gameState.declarer === HUMAN_PLAYER
        ? getBarvniValatLegalPlays(hand, trick)
        : isNeg
          ? getKlopLegalPlays(hand, trick)
          : getLegalPlays(hand, trick);
    return new Set(legal.map(cardKey));
  })();

  const handleCardClick = (card: Card) => {
    if (!isMyTurn) return;

    if (gameState.phase === "playing") {
      playCard(card);
    } else if (gameState.phase === "talon" && gameState.pickedTalonGroupIndex !== undefined) {
      const isSelected = selectedDiscards.some(c => JSON.stringify(c) === JSON.stringify(card));
      if (isSelected) {
        setSelectedDiscards(selectedDiscards.filter(c => JSON.stringify(c) !== JSON.stringify(card)));
      } else {
        let exchangeCount = 3;
        if (gameState.contract === "dve" || gameState.contract === "solo_dve") exchangeCount = 2;
        if (gameState.contract === "ena" || gameState.contract === "solo_ena") exchangeCount = 1;
        
        if (selectedDiscards.length < exchangeCount) {
          setSelectedDiscards([...selectedDiscards, card]);
        }
      }
    }
  };

  const handleConfirmDiscard = () => {
    playDiscard(selectedDiscards);
    setSelectedDiscards([]);
  };

  const getPlayerPosition = (id: PlayerId) => {
    // Relative to human (Player 0) at the bottom
    const pos = (id - HUMAN_PLAYER + 4) % 4;
    switch (pos) {
      case 0: return "bottom";
      case 1: return "right";
      case 2: return "top";
      case 3: return "left";
      default: return "bottom";
    }
  };

  return (
    <div className="flex min-h-screen bg-green-800 text-white font-sans overflow-hidden">
      
      {/* Sidebar - History & Score */}
      <div className="w-64 bg-black/40 border-r border-white/10 p-4 flex flex-col backdrop-blur-md">
        <h2 className="text-xl font-black text-yellow-400 mb-4 flex items-center gap-2">
           <span className="text-2xl">📊</span> REZULTATI
        </h2>
        <button
          onClick={handleQuitGame}
          className="mb-4 w-full py-1 text-xs font-bold bg-red-900/40 hover:bg-red-800/60 border border-red-700/50 text-red-300 rounded-lg transition-colors"
          title="Zapusti igro in pojdi na začetek"
        >
          ✕ Zapusti igro
        </button>
        
        <div className="flex-grow overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {history.length === 0 && (
            <p className="text-xs text-gray-500 italic text-center py-8">Ni odigranih iger.</p>
          )}
          {history.map((res: RoundResult, i: number) => {
            const isKlop = res.winnerTeam === "klop";
            const isWin = res.winnerTeam === "declarer";
            const rowColor = isKlop
              ? "bg-yellow-900/30 border-yellow-600/30"
              : isWin
                ? "bg-green-900/40 border-green-500/30"
                : "bg-red-900/40 border-red-500/30";
            return (
              <div key={i} className={`p-3 rounded-lg border flex flex-col gap-1 transition-all hover:scale-[1.02] ${rowColor}`}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-400">#KROG {res.round}</span>
                  <span className={`text-xs font-black ${res.finalValue >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {res.finalValue >= 0 ? "+" : ""}{res.finalValue} točk
                  </span>
                </div>
                <span className="text-sm font-bold text-yellow-100 uppercase tracking-tighter">{BID_SL[res.contract] ?? res.contract}</span>
                <div className="flex justify-between text-[10px] text-gray-300">
                  <span>{res.declarer}</span>
                  {res.radlciUsed > 0 && <span className="text-orange-300">🔸{res.radlciUsed} radlc</span>}
                  {res.mondfang < 0 && <span className="text-red-400">mondfang</span>}
                  {res.newRadlciEarned > 0 && <span className="text-purple-300">+1 🔸</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Krog + seštevki + radlci */}
        <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
          {/* Krog */}
          <div className="flex justify-between text-xs font-bold text-gray-400">
            <span>KROG:</span>
            <span className="text-yellow-400">{currentRound} / {maxRounds}</span>
          </div>

          {/* Seštevki po igralcih */}
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Skupaj točk</div>
            {playerNames.map((name, i) => {
              const score = playerScores[i] ?? 0;
              const radlci = playerRadlci[i] ?? 0;
              const isHuman = i === HUMAN_PLAYER;
              return (
                <div key={i} className={`flex justify-between items-center py-[3px] px-1 rounded text-xs ${
                  isHuman ? "bg-yellow-400/10 border border-yellow-400/20" : ""
                }`}>
                  <span className={`truncate max-w-[100px] font-semibold ${
                    isHuman ? "text-yellow-200" : "text-gray-300"
                  }`}>
                    {name}{isHuman ? " ★" : ""}
                  </span>
                  <div className="flex items-center gap-1 ml-1">
                    {/* Radlci kot pike */}
                    {radlci > 0 && (
                      <span className="text-orange-400 text-[10px]">
                        {"🔸".repeat(Math.min(radlci, 4))}
                      </span>
                    )}
                    <span className={`font-black text-right min-w-[36px] ${
                      score > 0 ? "text-green-400" :
                      score < 0 ? "text-red-400" :
                      "text-gray-500"
                    }`}>
                      {score === 0 ? "—" : (score > 0 ? `+${score}` : `${score}`)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-grow flex flex-col p-4 relative">
        
        {/* HUD - HUD Top */}
        <div className="flex justify-between items-center bg-black/30 p-3 rounded-lg mb-4 border border-white/10 backdrop-blur-sm">
          <div className="flex flex-col">
            <span className="text-yellow-400 text-xs font-bold uppercase tracking-wider">Faza</span>
            <span className="text-lg font-bold">{
              ({ bidding: "LICITACIJA", calling: "KLICANJE", talon: "TALON", raising: "DVIG", announcements: "NAPOVEDI", playing: "IGRA", finished: "KONEC" } as const)[gameState.phase]
            }</span>
          </div>
          
          {/* Game Info Summary */}
          <div className="flex gap-4 items-center">
            <div className="text-center bg-yellow-500/10 px-4 py-1 rounded-full border border-yellow-500/20">
              <span className="text-yellow-400 text-xs block font-bold">POGODBA</span>
              <span className="text-sm font-black text-white">
                {gameState.contract ? (BID_SL[gameState.contract] ?? gameState.contract).toUpperCase() : "..."}
              </span>
            </div>
            {gameState.compulsoryKlop && gameState.phase === "bidding" && (
              <div className="text-center bg-orange-500/15 px-4 py-1 rounded-full border border-orange-500/30">
                <span className="text-orange-300 text-xs block font-bold">OBVEZNI KLOP</span>
              </div>
            )}

            {gameState.calledKing && (
              <div className="text-center bg-blue-500/10 px-4 py-1 rounded-full border border-blue-500/20">
                <span className="text-blue-400 text-xs block font-bold">KLICAN KRALJ</span>
                <span className="text-sm font-black text-white capitalize">
                  {SUIT_SL[gameState.calledKing.suit]} {gameState.calledKing.suit === "hearts" ? "♥" : gameState.calledKing.suit === "diamonds" ? "♦" : gameState.calledKing.suit === "clubs" ? "♣" : "♠"}
                </span>
              </div>
            )}

            {gameState.announcementsRound && (
              (Object.values(gameState.announcementsRound.announcements).flat().length > 0
                || (gameState.announcementsRound.gameMultiplier ?? 1) > 1) && (
              <div className="text-center bg-purple-500/10 px-4 py-1 rounded-full border border-purple-500/20">
                <span className="text-purple-400 text-xs block font-bold">NAPOVEDI</span>
                <div className="flex gap-1 flex-wrap justify-center">
                  {(gameState.announcementsRound.gameMultiplier ?? 1) > 1 && (
                    <span className="text-[10px] bg-orange-600 px-1 rounded text-white font-bold">
                      KONTRA×{gameState.announcementsRound.gameMultiplier}
                    </span>
                  )}
                  {Object.entries(gameState.announcementsRound.announcements).map(([pid, ann]) => 
                    ann.map((a, i) => (
                      <span key={`${pid}-${i}`} className="text-[10px] bg-purple-600 px-1 rounded text-white font-bold uppercase" title={playerNames[parseInt(pid)]}>
                        {ANN_SL[a.type] ?? a.type}{a.multiplierLevel > 1 ? ` ×${a.multiplierLevel}` : ""}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col text-right">
            <span className="text-yellow-400 text-xs font-bold uppercase tracking-wider">Na potezi</span>
            <span className="text-lg font-bold text-yellow-300">
              {gameState.currentPlayer !== undefined ? playerNames[gameState.currentPlayer] : "Nihče"}
            </span>
          </div>
        </div>

        {/* Main Table Area */}
        <div className="flex-grow relative flex items-center justify-center">
          
          {/* Table itself */}
          <div className="w-[500px] h-[500px] bg-green-700/50 rounded-full border-[12px] border-green-900 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] relative flex items-center justify-center">
            
            {/* Player Labels */}
            {[0, 1, 2, 3].map((id) => {
              const pos = getPlayerPosition(id as PlayerId);
              const isCurrent = gameState.currentPlayer === id;
              
              // Licitacija: preveri zadnjo akcijo tega igralca
              const lastBid = [...gameState.bids].reverse().find(b => b.playerId === id);
              
              // Oznaka za rufanega kralja
              const isPartner = gameState.teams?.declarerTeam.includes(id) && id !== gameState.declarer;
              const playedCalledKing = (plays: readonly { playerId: PlayerId; card: Card }[]) =>
                plays.some(p => p.playerId === id && !isTarokCard(p.card) && p.card.rank === "king" && p.card.suit === gameState.calledKing?.suit);
              const hasPlayedCalledKing = isPartner && (
                gameState.trickRound?.capturedTricks.some(ct => playedCalledKing(ct.trick.plays))
                || (gameState.trickRound?.currentTrick ? playedCalledKing(gameState.trickRound.currentTrick.plays) : false)
              );

              // Prikaži licitacijo do začetka igre
              const showBid = gameState.phase !== "playing" && gameState.phase !== "finished" && lastBid;
              
              const layouts: Record<string, string> = {
                top: "top-[-60px] flex-col-reverse",
                bottom: "bottom-[-60px] flex-col",
                left: "left-[-120px] flex-row-reverse",
                right: "right-[-120px] flex-row"
              };

              return (
                <div key={id} className={`flex items-center justify-center absolute gap-2 ${layouts[pos]}`}>
                  {/* Name Label */}
                  <div className={`font-black text-xl tracking-tighter transition-all duration-300 drop-shadow-md ${
                    isCurrent ? "text-yellow-400 scale-110 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" : "text-white opacity-80"
                  }`}>
                    {playerNames[id]} 
                    {gameState.declarer === id ? <span className="ml-1 text-yellow-500 text-sm">★</span> : ""}
                    {hasPlayedCalledKing ? <span className="ml-1">👑</span> : ""}
                  </div>

                  {/* Bid Badge */}
                  {showBid && (
                    <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase shadow-lg border transition-all ${
                      lastBid.action === PASS 
                        ? "bg-red-950/60 text-red-400 border-red-500/30" 
                        : "bg-blue-700 text-white border-blue-400 animate-pulse"
                    }`}>
                      {lastBid.action === PASS ? "naprej" : (BID_SL[lastBid.action] ?? lastBid.action)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Odprti berač: odkrita roka deklaranta */}
            {gameState.contract === "odprti_berac" && gameState.declarer !== undefined && gameState.phase === "playing" && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-black/50 px-3 py-2 rounded-xl border border-red-400/40">
                <p className="text-[10px] text-red-300 font-bold uppercase text-center mb-1">
                  Odprta roka — {playerNames[gameState.declarer]}
                </p>
                <div className="flex gap-0.5 justify-center max-w-[280px] flex-wrap">
                  {(gameState.hands[gameState.declarer] ?? []).map((card, i) => (
                    <PlayingCard key={i} card={card} disabled size="sm" />
                  ))}
                </div>
              </div>
            )}

            {/* Odkriti odloženi taroki */}
            {gameState.discardedCards.length > 0 && gameState.discardedCards.some(c => isTarokCard(c)) && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-black/40 px-2 py-1 rounded-lg border border-yellow-500/30">
                <p className="text-[9px] text-yellow-300 font-bold uppercase text-center">Odloženi taroki</p>
                <div className="flex gap-0.5 justify-center">
                  {gameState.discardedCards.filter(c => isTarokCard(c)).map((card, i) => (
                    <PlayingCard key={i} card={card} disabled size="sm" />
                  ))}
                </div>
              </div>
            )}

            {gameState.contract === "berac" || gameState.contract === "odprti_berac" ? (
              <div className="absolute w-32 h-32 bg-red-900/10 rounded-full border border-red-500/5 flex items-center justify-center pointer-events-none">
                <span className="text-[40px] opacity-10 font-black text-white select-none">🚫</span>
              </div>
            ) : null}

            {/* Cards on Table */}
            <div className="relative w-full h-full flex items-center justify-center">

              {/* Klop: talon karta za ta štih (prvih 6 štihov) */}
              {gameState.contract === "klop" && gameState.trickRound && (() => {
                const capturedN = gameState.trickRound.capturedTricks.length;
                // Talon karta se prikaže samo ko se krog procesira (po 4 kartah) in je showKlopTalon true
                if (!isProcessingTrick || !showKlopTalon) return null;

                const talonIdx = capturedN - 1;
                const talonCard = talonIdx >= 0 && talonIdx < 6
                  ? gameState.talon[talonIdx]
                  : undefined;
                if (!talonCard) return null;

                // Animacija pridrsavanja na sredino
                return (
                  <div className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-20 transition-all duration-700 ease-out ${
                    showKlopTalon ? "top-1/2 -translate-y-1/2 scale-100 opacity-100" : "top-[-100px] scale-50 opacity-0"
                  }`}>
                    <span className="text-[9px] font-black text-yellow-300 bg-black/60 px-2 py-0.5 rounded-full mb-1">
                      TALON {talonIdx + 1}
                    </span>
                    <PlayingCard card={talonCard} disabled />
                  </div>
                );
              })()}

              {/* Current trick plays OR Finished trick during processing */}
              {(isProcessingTrick && lastCapturedTrick ? lastCapturedTrick.trick.plays : (gameState.trickRound?.currentTrick?.plays ?? [])).map((play: any, idx: number) => {
                const pos = getPlayerPosition(play.playerId);

                // Pozicija karte na mizi glede na položaj igralca
                // Vse karte so vedno obrnjene proti človeku (rotate-0)
                let translateStyle = "";
                switch (pos) {
                  case "bottom": translateStyle = "translate-y-24";  break;
                  case "top":    translateStyle = "-translate-y-24"; break;
                  case "left":   translateStyle = "-translate-x-24"; break;
                  case "right":  translateStyle = "translate-x-24";  break;
                }

                // Animacija letenja kart proti zmagovalcu
                let flyStyle = "";
                if (isMovingCards && lastCapturedTrick) {
                  const winnerPos = getPlayerPosition(lastCapturedTrick.winner);
                  switch (winnerPos) {
                    case "bottom": flyStyle = "translate-y-[400px] opacity-0 scale-50"; break;
                    case "top":    flyStyle = "-translate-y-[400px] opacity-0 scale-50"; break;
                    case "left":   flyStyle = "-translate-x-[400px] opacity-0 scale-50"; break;
                    case "right":  flyStyle = "translate-x-[400px] opacity-0 scale-50";  break;
                  }
                }
                
                const positionStyles = flyStyle || translateStyle;

                return (
                  <div
                    key={`${idx}-${play.playerId}`}
                    className={`absolute transition-all duration-[1500ms] ease-in-out z-10 ${positionStyles}`}
                  >
                    <PlayingCard card={play.card} disabled />
                  </div>
                );
              })}


            </div>

            {/* Interaction UI Overlays */}
            {/* Talon overlay za bota — prikaže se ko bot izbira talon (samo če so talonGroups napolnjene) */}
            {gameState.phase === "talon" && !isMyTurn && gameState.talonGroups.length > 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/60 backdrop-blur-sm">
                <div className="bg-black/70 p-6 rounded-2xl border-2 border-white/20 shadow-2xl text-center max-w-lg w-full">
                  <p className="text-yellow-400 font-bold text-lg mb-1 uppercase tracking-widest">
                    {playerNames[gameState.currentPlayer!]} — Talon
                  </p>

                  {gameState.pickedTalonGroupIndex === undefined ? (
                    // Bot še ni izbral kupčka
                    <>
                      <p className="text-gray-400 text-sm mb-4 italic">Izbira kupček...</p>
                      <div className="flex justify-center gap-6">
                        {gameState.talonGroups.map((group, idx) => (
                          <div key={idx} className="flex flex-col items-center gap-2 opacity-70">
                            <div className="flex gap-1">
                              {group.map((_card, ci) => (
                                <PlayingCard key={ci} faceDown disabled size="sm" />
                              ))}
                            </div>
                            <span className="text-xs text-gray-400 font-bold">Kupček {idx + 1}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    // Bot je že izbral kupček — prikaži katere karte je vzel
                    <>
                      <p className="text-green-300 font-bold text-sm mb-3">
                        Vzel kupček {gameState.pickedTalonGroupIndex + 1}:
                      </p>
                      <div className="flex justify-center gap-2 mb-4">
                        {gameState.talonGroups[gameState.pickedTalonGroupIndex]?.map((card, i) => (
                          <div key={i} className="scale-110">
                            <PlayingCard card={card} disabled />
                          </div>
                        ))}
                      </div>
                      {/* Preostali kupčki gredo branilcem */}
                      <div className="flex flex-col items-center gap-1 opacity-40">
                        <p className="text-[10px] text-gray-400 uppercase">Preostanek gre branilcem:</p>
                        <div className="flex gap-1 justify-center">
                          {gameState.talonGroups.map((group, gIdx) => {
                            if (gIdx === gameState.pickedTalonGroupIndex) return null;
                            return group.map((card, cIdx) => (
                              <PlayingCard key={`${gIdx}-${cIdx}`} card={card} disabled size="sm" />
                            ));
                          })}
                        </div>
                      </div>
                      <p className="text-gray-500 text-xs italic mt-3">Bot izbira zaloge...</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {isMyTurn && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none flex-col">
                {gameState.phase === "bidding" && (() => {
                  const mockRound = {
                    playerOrder: gameState.playerOrder,
                    forehand: gameState.forehand,
                    currentPlayerIndex: gameState.playerOrder.indexOf(HUMAN_PLAYER),
                    bids: gameState.bids,
                    passedPlayers: gameState.passedPlayers,
                    currentHighestBid: gameState.contract && gameState.contract !== "klop"
                      ? { playerId: gameState.declarer!, bid: gameState.contract as Bid }
                      : undefined,
                    isFinished: false,
                    compulsoryKlop: gameState.compulsoryKlop,
                  };
                  return (
                  <div className="flex flex-wrap justify-center gap-3 pointer-events-auto bg-black/60 py-20 px-8 rounded-2xl border-2 border-yellow-500 shadow-2xl backdrop-blur-md mb-4">
                    <p className="w-full text-center text-yellow-400 font-bold mb-3 text-xl">LICITACIJA</p>
                    {gameState.compulsoryKlop && (
                      <p className="w-full text-center text-orange-300 text-sm mb-2 font-bold">
                        Obvezni klop — dovoljene so samo licitacije od solo brez navzgor
                      </p>
                    )}
                    {BIDS.map(bid => {
                      const legal = isLegalBid(mockRound, HUMAN_PLAYER, bid, gameState.compulsoryKlop);
                      return (
                      <button
                        key={bid}
                        disabled={!legal}
                        onClick={() => playBid(bid as Bid)}
                        className={`px-6 py-2 rounded font-bold text-base uppercase ${legal ? "bg-blue-600 hover:bg-blue-500" : "bg-gray-700 opacity-40 cursor-not-allowed"}`}
                      >
                        {BID_SL[bid] ?? bid}
                      </button>
                    );})}
                    <button onClick={() => playBid(PASS)} className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded font-bold text-base uppercase w-full mt-3">Naprej</button>
                  </div>
                  );
                })()}

                <div className="pointer-events-auto">
                  {gameState.phase === "calling" && (
                    <div className="bg-black/60 p-6 rounded-2xl border-2 border-yellow-500 shadow-2xl backdrop-blur-md flex flex-wrap justify-center gap-3">
                      <p className="w-full text-center text-yellow-400 font-bold mb-2">KLIČI KRALJA</p>
                      {["hearts", "diamonds", "clubs", "spades"].map(suit => (
                        <button key={suit} onClick={() => playCall(suit as any)} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                          <span className="text-4xl">
                            {suit === "hearts" ? "♥" : suit === "diamonds" ? "♦" : suit === "clubs" ? "♣" : "♠"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {gameState.phase === "announcements" && gameState.announcementsRound && (() => {
                    const declarerTeam = gameState.teams?.declarerTeam ?? (gameState.declarer !== undefined ? [gameState.declarer] : []);
                    const round = gameState.announcementsRound;
                    const canGame = canPlaceContra(round, HUMAN_PLAYER, "game", declarerTeam);
                    const contraTargets = [
                      ...(canGame ? (["game"] as const) : []),
                      ...ANNOUNCEMENTS.filter((t) => canPlaceContra(round, HUMAN_PLAYER, t, declarerTeam)),
                    ];
                    return (
                    <div className="bg-black/60 p-6 rounded-2xl border-2 border-yellow-500 shadow-2xl backdrop-blur-md text-center space-y-4">
                      <p className="text-yellow-400 font-bold mb-2">NAPOVEDI</p>
                      <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                        {ANNOUNCEMENTS.map(type => {
                          const alreadyAnnounced = round.announcements[HUMAN_PLAYER]?.some(a => a.type === type);
                          return (
                            <button 
                              key={type} 
                              disabled={alreadyAnnounced}
                              onClick={() => playAnnouncement(type)} 
                              className={`px-4 py-2 rounded font-bold text-sm uppercase transition-all ${alreadyAnnounced ? "bg-gray-600 opacity-50 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-500"}`}
                            >
                              {ANN_SL[type] ?? type}
                            </button>
                          );
                        })}
                      </div>
                      {contraTargets.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2 max-w-sm pt-2 border-t border-white/10">
                          <p className="w-full text-orange-300 text-xs font-bold uppercase">Kontra</p>
                          {contraTargets.map((t) => (
                            <button
                              key={t}
                              onClick={() => playContra(t)}
                              className="px-3 py-1.5 rounded font-bold text-xs uppercase bg-orange-600 hover:bg-orange-500"
                            >
                              {t === "game" ? "Igra" : (ANN_SL[t] ?? t)}
                            </button>
                          ))}
                        </div>
                      )}
                      <button onClick={() => playAnnouncementPass()} className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold w-full mt-4">KONČAJ / NAPREJ</button>
                    </div>
                    );
                  })()}

                  {gameState.phase === "talon" && gameState.pickedTalonGroupIndex === undefined && (
                    <div className="bg-black/60 p-6 rounded-2xl border-2 border-yellow-500 shadow-2xl backdrop-blur-md flex flex-col gap-4">
                      <p className="text-yellow-400 font-bold text-center uppercase tracking-widest">Izberi kupček</p>
                      <div className="flex gap-6 justify-center">
                          {gameState.talonGroups.map((group, idx) => (
                            <button key={idx} onClick={() => playTalonPick(idx)} className="group relative">
                              <div className="flex flex-col items-center">
                                <div className="flex -space-x-12 mb-4 group-hover:-space-x-2 transition-all duration-300">
                                    {group.map((card, ci) => (
                                      <div key={ci} className="transform group-hover:scale-105 transition-transform">
                                        <PlayingCard card={card} disabled />
                                      </div>
                                    ))}
                                </div>
                                <div className="px-6 py-2 bg-purple-600 group-hover:bg-purple-500 rounded-full font-black text-xl border-2 border-purple-400 shadow-lg">
                                  KUPČEK {idx + 1}
                                </div>
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {gameState.phase === "raising" && (
                    <div className="bg-black/60 p-6 rounded-2xl border-2 border-yellow-500 shadow-2xl backdrop-blur-md text-center space-y-4 max-w-sm">
                      <p className="text-yellow-400 font-bold uppercase tracking-widest text-lg">Dvigni pogodbo?</p>
                      <p className="text-sm text-gray-200">
                        Solo si lahko po talonu dvigneš v <span className="text-yellow-300 font-bold">barvni valat</span>
                        (taroki niso aduti, moraš vzeti vse štihe).
                      </p>
                      <button
                        onClick={() => playRaise(true)}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-black text-lg"
                      >
                        BARVNI VALAT (125)
                      </button>
                      <button
                        onClick={() => playRaise(false)}
                        className="w-full py-3 bg-blue-700 hover:bg-blue-600 rounded-xl font-bold"
                      >
                        Ohrani {(gameState.contract ? BID_SL[gameState.contract] : "solo")?.toUpperCase()}
                      </button>
                    </div>
                  )}

                  {gameState.phase === "talon" && gameState.pickedTalonGroupIndex !== undefined && (
                    <div className="bg-black/60 p-6 rounded-2xl border-2 border-yellow-500 shadow-2xl backdrop-blur-md text-center space-y-4">
                      <p className="text-yellow-400 font-bold uppercase tracking-widest">Tvoj izbrani kupček</p>
                      <div className="flex justify-center gap-4 py-4 bg-white/5 rounded-xl border border-white/10">
                          {gameState.talonGroups[gameState.pickedTalonGroupIndex]?.map((card, i) => (
                            <div key={i} className="transform scale-110">
                              <PlayingCard card={card} disabled />
                            </div>
                          ))}
                      </div>
                      
                      {/* Show remaining talon cards for context */}
                      <div className="flex flex-col items-center gap-1 opacity-50">
                          <p className="text-[10px] text-gray-400 uppercase">Preostanek talona (gre branilcem):</p>
                          <div className="flex gap-2">
                            {gameState.talonGroups.map((group, gIdx) => {
                              if (gIdx === gameState.pickedTalonGroupIndex) return null;
                              return group.map((card, cIdx) => (
                                <div key={`${gIdx}-${cIdx}`} className="scale-50 -mx-8">
                                  <PlayingCard card={card} disabled />
                                </div>
                              ));
                            })}
                          </div>
                      </div>

                      <div className="pt-4 border-t border-white/10">
                          <p className="text-sm text-yellow-100 font-medium mb-4 italic">Zdaj izberi {
                            gameState.contract === "ena" || gameState.contract === "solo_ena" ? "1 karto" :
                            gameState.contract === "dve" || gameState.contract === "solo_dve" ? "2 karti" : "3 karte"
                          } iz svoje roke, ki jih želiš založiti.</p>
                          <button 
                            disabled={selectedDiscards.length !== (
                              gameState.contract?.includes("ena") ? 1 : 
                              gameState.contract?.includes("dve") ? 2 : 3
                            )}
                            onClick={handleConfirmDiscard} 
                            className={`w-full py-4 rounded-xl font-black text-xl transition-all ${
                              selectedDiscards.length === (gameState.contract?.includes("ena") ? 1 : gameState.contract?.includes("dve") ? 2 : 3) 
                              ? "bg-green-600 hover:bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:scale-[1.02]" 
                              : "bg-gray-700 opacity-50 cursor-not-allowed"
                            }`}
                          >
                            POTRDI ZALOG ({selectedDiscards.length})
                          </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          )}
          </div>
        </div>

        {/* Round Finished Overlay */}
        {gameState.phase === "finished" && roundScore && (() => {
          const isKlop = gameState.contract === "klop";
          const isNoDiff = ["berac","odprti_berac","barvni_valat","solo_brez","valat"].includes(gameState.contract ?? "");
          const currentResult = history[history.length - 1];
          const declarerTeamNames = gameState.teams?.declarerTeam.map(pid => playerNames[pid] ?? `Igralec ${pid}`).join(" + ") ?? "";
          const defenderTeamNames = gameState.teams?.defendingTeam?.map(pid => playerNames[pid] ?? `Igralec ${pid}`).join(" + ") ?? "";

          return (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-lg">
             <div className="bg-green-900 p-6 rounded-3xl border-4 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.3)] text-center max-w-lg w-full overflow-y-auto max-h-[90vh]">

                {/* Klop prikaz */}
                {isKlop ? (
                  <>
                    <h2 className="text-4xl font-black mb-2 text-yellow-400">KLOP</h2>
                    <div className="mb-4 bg-black/20 rounded-xl p-3 text-left space-y-2">
                      {playerNames.map((name, i) => {
                        const pts = roundScore.klopPlayerPoints?.[i] ?? 0;
                        const isWinner = roundScore.klopWinners?.includes(i);
                        const isLoser = roundScore.klopLosers?.includes(i);
                        return (
                          <div key={i} className={`flex justify-between text-sm p-2 rounded-lg border ${
                            isWinner ? "bg-green-800/40 border-green-500" :
                            isLoser  ? "bg-red-900/40 border-red-500" :
                            "bg-black/10 border-white/5"
                          }`}>
                            <span className="font-bold text-yellow-100">{name}</span>
                            <span className="font-black">
                              {isWinner ? <span className="text-green-400">+70 🏆</span> :
                               isLoser  ? <span className="text-red-400">−70 💔</span> :
                               <span className="text-gray-300">−{pts}</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {roundScore.newRadlciEarned > 0 && (
                      <p className="text-purple-300 text-sm mb-4">🔸 Vsi dobijo +1 radlc za naslednjo igro</p>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className={`text-5xl font-black mb-1 uppercase tracking-tighter ${roundScore.isWin ? "text-yellow-400" : "text-red-400"}`}>
                      {roundScore.isWin ? "Zmaga! 🏆" : "Poraz! 💔"}
                    </h2>
                    <p className="text-xl text-yellow-100 mb-4 font-serif italic">
                      {(gameState.contract ? BID_SL[gameState.contract] ?? gameState.contract : "").toUpperCase()}
                    </p>

                    {/* Točke kart — samo za igre z razliko */}
                    {!isNoDiff && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className={`p-4 rounded-2xl border-2 ${roundScore.isWin ? "bg-green-600/30 border-green-400" : "bg-black/20 border-white/10"}`}>
                          <span className="block text-[10px] font-bold text-gray-300 uppercase mb-1 truncate" title={declarerTeamNames}>{declarerTeamNames}</span>
                          <span className="text-3xl font-black">{roundScore.declarerTeam.cardPoints}</span>
                          <span className="block text-[10px] text-gray-400 mt-1">kart. točk</span>
                        </div>
                        <div className={`p-4 rounded-2xl border-2 ${!roundScore.isWin ? "bg-green-600/30 border-green-400" : "bg-black/20 border-white/10"}`}>
                          <span className="block text-[10px] font-bold text-gray-300 uppercase mb-1 truncate" title={defenderTeamNames}>{defenderTeamNames}</span>
                          <span className="text-3xl font-black">{roundScore.defendingTeam.cardPoints}</span>
                          <span className="block text-[10px] text-gray-400 mt-1">kart. točk</span>
                        </div>
                      </div>
                    )}

                    {/* Obračun */}
                    <div className="mb-4 bg-black/20 rounded-xl p-3 text-left space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Obračun</p>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-300">Pogodba ({gameState.contract ? BID_SL[gameState.contract] ?? gameState.contract : ""})</span>
                        <span className={roundScore.contractValue >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                          {roundScore.contractValue >= 0 ? "+" : ""}{roundScore.contractValue}
                        </span>
                      </div>
                      {!isNoDiff && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-300">
                            Razlika ({roundScore.declarerTeam.cardPoints} točk → zaokr. {Math.round(roundScore.declarerTeam.cardPoints/5)*5} − 35)
                          </span>
                          <span className={roundScore.razlika >= 0 ? "text-green-300" : "text-red-300"}>
                            {roundScore.razlika >= 0 ? "+" : ""}{roundScore.razlika}
                          </span>
                        </div>
                      )}
                      {roundScore.bonuses.map((b, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-300 capitalize">
                            {b.announcedBy === "silent" ? "🤐 " : b.achieved ? "✅ " : "❌ "}
                            {ANN_SL[b.type] ?? b.type}
                            {b.announcedBy !== "silent" ? ` (${b.announcedBy === "declarer" ? "napoved" : "bran. napoved"})` : " (tiho)"}
                          </span>
                          <span className={b.value >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                            {b.value >= 0 ? "+" : ""}{b.value}
                          </span>
                        </div>
                      ))}
                      {currentResult && currentResult.radlciUsed > 0 && (
                        <div className="flex justify-between text-xs border-t border-white/10 pt-1 mt-1">
                          <span className="text-orange-300">🔸 Radlci ×{Math.pow(2, currentResult.radlciUsed)} ({currentResult.radlciUsed} radlc)</span>
                          <span className="text-orange-300 font-bold">×{Math.pow(2, currentResult.radlciUsed)}</span>
                        </div>
                      )}
                      {roundScore.mondfang < 0 && (
                        <div className="flex justify-between text-xs border-t border-white/10 pt-1 mt-1">
                          <span className="text-red-400">⚠️ Mondfang (izguba monda)</span>
                          <span className="text-red-400 font-bold">{roundScore.mondfang}</span>
                        </div>
                      )}
                    </div>
                    {roundScore.newRadlciEarned > 0 && (
                      <p className="text-purple-300 text-sm mb-3">🔸 Vsi dobijo +1 radlc za naslednjo igro</p>
                    )}
                  </>
                )}

                {/* Skupaj */}
                {!isKlop && (
                <div className="mb-6 flex flex-col items-center">
                   <span className={`text-6xl font-black drop-shadow-lg ${(currentResult?.finalValue ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {(currentResult?.finalValue ?? 0) >= 0 ? "+" : ""}{currentResult?.finalValue ?? 0}
                   </span>
                   <span className="text-sm font-bold text-gray-300 uppercase tracking-widest mt-1">Skupaj točk</span>
                </div>
                )}

                {currentRound < maxRounds ? (
                  <button 
                    onClick={nextRound}
                    className="w-full py-4 bg-yellow-500 text-green-900 font-black text-2xl rounded-2xl shadow-xl hover:bg-yellow-400 hover:scale-105 active:scale-95 transition-all"
                  >
                    NASLEDNJI KROG
                  </button>
                ) : (
                  <button
                    onClick={() => setShowFinalScore(true)}
                    className="w-full py-4 bg-yellow-500 text-green-900 font-black text-2xl rounded-2xl shadow-xl hover:bg-yellow-400 hover:scale-105 active:scale-95 transition-all"
                  >
                    POGLEDAJ SKUPNI IZID
                  </button>
                )}
             </div>
          </div>
          );
        })()}

        {/* Player Hand Area */}
        <div className="relative flex flex-col items-center justify-end pb-2">
          <div className={`mb-2 px-6 py-1 rounded-full text-sm font-bold border-2 transition-all ${isMyTurn ? "bg-yellow-400 text-green-900 border-white animate-pulse" : "bg-black/40 text-white/50 border-white/10"}`}>
              {gameState.phase === "finished"
            ? "IGRA ZAKLJUČENA"
            : isMyTurn
              ? "TI SI NA POTEZI"
              : `ČAKAŠ NA ${playerNames[gameState.currentPlayer ?? -1]?.toUpperCase() ?? "..."}`}
          </div>
          {/* Scrollable hand — only cards zoom on hover, not the wrapper */}
          <div className="w-full overflow-x-auto pb-2">
            <div className="flex justify-center items-end min-w-max mx-auto px-4"
                 style={{ gap: myHand.length > 10 ? '-20px' : '2px' }}>
              {myHand.map((card, idx) => {
                const isSelected = selectedDiscards.some(c => JSON.stringify(c) === JSON.stringify(card));
                const isIllegal =
                  legalPlayKeys !== null && !legalPlayKeys.has(cardKey(card));
                const canClick =
                  isMyTurn &&
                  (gameState.phase !== "playing" || !isIllegal);
                return (
                  <div
                    key={idx}
                    style={{ marginLeft: myHand.length > 8 ? '-28px' : '2px' }}
                    className={`transition-all duration-200 transform flex-shrink-0 ${
                      isSelected
                        ? "-translate-y-10 scale-105 z-50 drop-shadow-xl"
                        : canClick
                          ? "hover:-translate-y-8 hover:scale-105 hover:z-40 cursor-pointer"
                          : ""
                    } ${isIllegal ? "opacity-35 grayscale pointer-events-none" : ""}`}
                  >
                    <PlayingCard
                      card={card}
                      disabled={!canClick}
                      onClick={() => handleCardClick(card)} 
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Error Message Overlay */}
      {errorMessage && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] bg-black/70 backdrop-blur-sm" onClick={clearError}>
          <div className="bg-red-900 border-4 border-red-500 rounded-2xl p-8 shadow-2xl max-w-md mx-4 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-2xl font-black text-red-200 mb-4">Napaka</h3>
              <p className="text-red-100 text-lg mb-6">{errorMessage}</p>
              <button
                onClick={clearError}
                className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors"
              >
                V redu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
