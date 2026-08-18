import React, { useState } from 'react';
import { useTarokGame, type BotConfig, type RoundResult } from './hooks/useTarokGame';
import { PlayingCard } from './components/PlayingCard';
import { type Card, type Bid, BIDS, PASS, type PlayerId, ANNOUNCEMENTS, type AnnouncementType } from '@tarok/engine';

function App() {
  const game = useTarokGame();
  const { 
    gameState, 
    startGame, 
    HUMAN_PLAYER,
    playerNames,
    lastCapturedTrick,
    isProcessingTrick,
    isMovingCards,
    currentRound,
    maxRounds,
    history,
    roundScore,
    nextRound,
    playBid,
    playCall,
    playTalonPick,
    playDiscard,
    playAnnouncement,
    playAnnouncementPass,
    playCard
  } = game;

  const [selectedDiscards, setSelectedDiscards] = useState<Card[]>([]);
  const [humanName, setHumanName] = useState("Igralec");
  const [setupMaxRounds, setSetupMaxRounds] = useState(8);
  const [botConfigs, setBotConfigs] = useState<BotConfig[]>([
    { name: "Bot 1", difficulty: 3 },
    { name: "Bot 2", difficulty: 3 },
    { name: "Bot 3", difficulty: 3 },
  ]);

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
            onClick={() => startGame({ humanName, botConfigs, maxRounds: setupMaxRounds })}
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
        <h2 className="text-xl font-black text-yellow-400 mb-6 flex items-center gap-2">
           <span className="text-2xl">📊</span> REZULTATI
        </h2>
        
        <div className="flex-grow overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {history.length === 0 && (
            <p className="text-xs text-gray-500 italic text-center py-8">Ni odigranih iger.</p>
          )}
          {history.map((res: RoundResult, i: number) => (
            <div key={i} className={`p-3 rounded-lg border flex flex-col gap-1 transition-all hover:scale-[1.02] ${res.winnerTeam === "declarer" ? "bg-green-900/40 border-green-500/30" : "bg-red-900/40 border-red-500/30"}`}>
               <div className="flex justify-between items-center">
                 <span className="text-[10px] font-bold text-gray-400">#KROG {res.round}</span>
                 <span className={`text-xs font-black ${res.totalRadlci >= 0 ? "text-green-400" : "text-red-400"}`}>
                   {res.totalRadlci >= 0 ? `+${res.totalRadlci}` : res.totalRadlci} radlcev
                 </span>
               </div>
               <span className="text-sm font-bold text-yellow-100 uppercase tracking-tighter">{res.contract}</span>
               <span className="text-[10px] text-gray-300">Igra: {res.declarer} &bull; {res.points >= 0 ? "+" : ""}{res.points} točk</span>
            </div>
          ))}
        </div>

        {/* Total Score Footer */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex justify-between text-xs font-bold text-gray-400 mb-1">
             <span>KROG:</span>
             <span className="text-yellow-400">{currentRound} / {maxRounds}</span>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-grow flex flex-col p-4 relative">
        
        {/* HUD - HUD Top */}
        <div className="flex justify-between items-center bg-black/30 p-3 rounded-lg mb-4 border border-white/10 backdrop-blur-sm">
          <div className="flex flex-col">
            <span className="text-yellow-400 text-xs font-bold uppercase tracking-wider">Faza</span>
            <span className="text-lg font-bold">{gameState.phase === "playing" ? "IGRA" : gameState.phase.toUpperCase()}</span>
          </div>
          
          {/* Game Info Summary */}
          <div className="flex gap-4 items-center">
            <div className="text-center bg-yellow-500/10 px-4 py-1 rounded-full border border-yellow-500/20">
              <span className="text-yellow-400 text-xs block font-bold">POGODBA</span>
              <span className="text-sm font-black text-white">{gameState.contract?.toUpperCase() || "..."}</span>
            </div>

            {gameState.calledKing && (
              <div className="text-center bg-blue-500/10 px-4 py-1 rounded-full border border-blue-500/20">
                <span className="text-blue-400 text-xs block font-bold">KLICAN KRALJ</span>
                <span className="text-sm font-black text-white capitalize">
                  {gameState.calledKing.suit} {gameState.calledKing.suit === "hearts" ? "♥" : gameState.calledKing.suit === "diamonds" ? "♦" : gameState.calledKing.suit === "clubs" ? "♣" : "♠"}
                </span>
              </div>
            )}

            {gameState.announcementsRound && Object.values(gameState.announcementsRound.announcements).flat().length > 0 && (
              <div className="text-center bg-purple-500/10 px-4 py-1 rounded-full border border-purple-500/20">
                <span className="text-purple-400 text-xs block font-bold">NAPOVEDI</span>
                <div className="flex gap-1">
                  {Object.entries(gameState.announcementsRound.announcements).map(([pid, ann]) => 
                    ann.map((a, i) => (
                      <span key={`${pid}-${i}`} className="text-[10px] bg-purple-600 px-1 rounded text-white font-bold uppercase" title={playerNames[parseInt(pid)]}>
                        {a.type.replace('_',' ')}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}
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
              const labelClasses = `absolute p-2 px-4 rounded-full font-bold text-sm border-2 transition-all ${
                isCurrent ? "bg-yellow-400 text-green-900 border-white scale-110 shadow-lg z-20" : "bg-green-900/80 text-white border-green-700"
              }`;
              
              const layouts: Record<string, string> = {
                top: "top-[-50px]",
                bottom: "bottom-[-50px]",
                left: "left-[-80px]",
                right: "right-[-80px]"
              };

              return (
                <div key={id} className={`${labelClasses} ${layouts[pos]}`}>
                  {playerNames[id]} {gameState.declarer === id ? "★" : ""}
                </div>
              );
            })}

            {/* Cards on Table */}
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Current trick plays OR Finished trick during processing */}
              {(isProcessingTrick && lastCapturedTrick ? lastCapturedTrick.trick.plays : gameState.trickRound?.currentTrick.plays || []).map((play: any, idx: number) => {
                const pos = getPlayerPosition(play.playerId);
                
                // Define default rotations
                let positionStyles: string = "";
                switch(pos) {
                  case "bottom": positionStyles = "translate-y-24 rotate-0"; break;
                  case "top": positionStyles = "-translate-y-24 rotate-180"; break;
                  case "left": positionStyles = "-translate-x-24 -rotate-90"; break;
                  case "right": positionStyles = "translate-x-24 rotate-90"; break;
                }

                // If trick is complete and we are processing it, move cards toward winner
                if (isMovingCards && lastCapturedTrick) {
                  const winnerPos = getPlayerPosition(lastCapturedTrick.winner);
                  switch(winnerPos) {
                    case "bottom": positionStyles = "translate-y-[400px] opacity-0 scale-50"; break;
                    case "top": positionStyles = "translate-y-[-400px] opacity-0 scale-50"; break;
                    case "left": positionStyles = "translate-x-[-400px] opacity-0 scale-50"; break;
                    case "right": positionStyles = "translate-x-[400px] opacity-0 scale-50"; break;
                  }
                }
                
                return (
                  <div key={`${idx}-${play.playerId}`} className={`absolute transition-all duration-[1500ms] ease-in-out z-10 ${positionStyles}`}>
                    <PlayingCard card={play.card} disabled />
                  </div>
                );
              })}


            </div>

            {/* Interaction UI Overlays */}
            {isMyTurn && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <div className="pointer-events-auto bg-black/60 p-6 rounded-2xl border-2 border-yellow-500 shadow-2xl backdrop-blur-md">
                  
                  {gameState.phase === "bidding" && (
                    <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                      <p className="w-full text-center text-yellow-400 font-bold mb-2">LICITACIJA</p>
                      {BIDS.map(bid => (
                        <button key={bid} onClick={() => playBid(bid as Bid)} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded font-bold text-sm uppercase">{bid.replace('_',' ')}</button>
                      ))}
                      <button onClick={() => playBid(PASS)} className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded font-bold text-sm uppercase w-full mt-2">Naprej</button>
                    </div>
                )}

                  {gameState.phase === "calling" && (
                    <div className="flex flex-wrap justify-center gap-3">
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

                  {gameState.phase === "announcements" && (
                    <div className="text-center space-y-4">
                      <p className="text-yellow-400 font-bold mb-2">NAPOVEDI</p>
                      <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                        {ANNOUNCEMENTS.map(type => {
                          const alreadyAnnounced = gameState.announcementsRound?.announcements[HUMAN_PLAYER]?.some(a => a.type === type);
                          return (
                            <button 
                              key={type} 
                              disabled={alreadyAnnounced}
                              onClick={() => playAnnouncement(type)} 
                              className={`px-4 py-2 rounded font-bold text-sm uppercase transition-all ${alreadyAnnounced ? "bg-gray-600 opacity-50 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-500"}`}
                            >
                              {type.replace('_',' ')}
                            </button>
                          );
                        })}
                      </div>
                      <button onClick={() => playAnnouncementPass()} className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold w-full mt-4">KONČAJ / NAPREJ</button>
                    </div>
                  )}

                  {gameState.phase === "talon" && gameState.pickedTalonGroupIndex === undefined && (
                    <div className="flex flex-col gap-4">
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

                  {gameState.phase === "talon" && gameState.pickedTalonGroupIndex !== undefined && (
                    <div className="text-center space-y-4">
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
        {gameState.phase === "finished" && roundScore && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-lg">
             <div className="bg-green-900 p-8 rounded-3xl border-4 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.3)] text-center max-w-lg w-full transform animate-in fade-in zoom-in duration-500">
                <h2 className={`text-5xl font-black mb-2 uppercase tracking-tighter ${roundScore.isWin ? "text-yellow-400" : "text-red-400"}`}>
                  {roundScore.isWin ? "Zmaga! 🏆" : "Poraz! 💔"}
                </h2>
                <p className="text-xl text-yellow-100 mb-6 font-serif italic">{gameState.contract?.replace('_', ' ').toUpperCase()}</p>

                {/* Card points */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                   <div className={`p-4 rounded-2xl border-2 ${roundScore.isWin ? "bg-green-600/30 border-green-400" : "bg-black/20 border-white/10"}`}>
                      <span className="block text-xs font-bold text-gray-300 uppercase mb-1">Igralci</span>
                      <span className="text-3xl font-black">{roundScore.declarerTeam.cardPoints}</span>
                      <span className="block text-[10px] text-gray-400 mt-1">kart. točk</span>
                   </div>
                   <div className={`p-4 rounded-2xl border-2 ${!roundScore.isWin ? "bg-green-600/30 border-green-400" : "bg-black/20 border-white/10"}`}>
                      <span className="block text-xs font-bold text-gray-300 uppercase mb-1">Branilci</span>
                      <span className="text-3xl font-black">{roundScore.defendingTeam.cardPoints}</span>
                      <span className="block text-[10px] text-gray-400 mt-1">kart. točk</span>
                   </div>
                </div>

                {/* Bonuses breakdown */}
                {roundScore.bonuses.length > 0 && (
                  <div className="mb-4 bg-black/20 rounded-xl p-3 text-left space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Napovedi &amp; bonusi</p>
                    {roundScore.bonuses.map((b, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-gray-300 capitalize">
                          {b.announcedBy === "silent" ? "(tiho) " : ""}{b.type.replace("_", " ")}
                          {b.announcedBy !== "silent" && !b.achieved ? " ✗" : b.achieved ? " ✓" : ""}
                        </span>
                        <span className={b.radlci >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                          {b.radlci >= 0 ? "+" : ""}{b.radlci}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs border-t border-white/10 pt-1 mt-1">
                      <span className="text-gray-300">Pogodba ({gameState.contract?.replace("_"," ")})</span>
                      <span className={roundScore.contractRadlci >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                        {roundScore.contractRadlci >= 0 ? "+" : ""}{roundScore.contractRadlci}
                      </span>
                    </div>
                  </div>
                )}

                {/* Total radlci */}
                <div className="mb-8 flex flex-col items-center">
                   <span className={`text-6xl font-black drop-shadow-lg ${roundScore.totalRadlci >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {roundScore.totalRadlci >= 0 ? `+${roundScore.totalRadlci}` : roundScore.totalRadlci}
                   </span>
                   <span className="text-sm font-bold text-gray-300 uppercase tracking-widest mt-2">Skupaj radlcev</span>
                </div>

                <button 
                  onClick={nextRound}
                  className="w-full py-5 bg-yellow-500 text-green-900 font-black text-2xl rounded-2xl shadow-xl hover:bg-yellow-400 hover:scale-105 active:scale-95 transition-all"
                >
                  {currentRound < maxRounds ? "NASLEDNJI KROG" : "POGLEDAJ SKUPNI IZID"}
                </button>
             </div>
          </div>
        )}

        {/* Player Hand Area */}
        <div className="relative h-64 flex flex-col items-center justify-end">
          <div className={`mb-2 px-6 py-1 rounded-full text-sm font-bold border-2 transition-all ${isMyTurn ? "bg-yellow-400 text-green-900 border-white animate-pulse" : "bg-black/40 text-white/50 border-white/10"}`}>
              {isMyTurn ? "TI SI NA POTEZI" : `ČAKAŠ NA ${playerNames[gameState.currentPlayer!]?.toUpperCase()}`}
          </div>
          <div className="w-full flex justify-center items-center pb-4">
            <div className="flex -space-x-12 hover:space-x-2 transition-all duration-300 px-12 group">
              {myHand.map((card, idx) => {
                const isSelected = selectedDiscards.some(c => JSON.stringify(c) === JSON.stringify(card));
                return (
                  <div 
                    key={idx} 
                    className={`transition-all duration-200 transform ${isSelected ? "-translate-y-12 rotate-0 scale-110 z-50" : "hover:-translate-y-8 hover:z-40"}`}
                  >
                    <PlayingCard 
                      card={card} 
                      disabled={!isMyTurn}
                      onClick={() => handleCardClick(card)} 
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
