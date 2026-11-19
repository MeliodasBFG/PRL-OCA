import React, { useEffect } from 'react';
import { useGameStore } from './stores/useGameStore';
import { soundEngine } from './audio/SoundEngine';
import { HeaderBar } from './components/HeaderBar';
import { QRModal } from './components/QRModal';
import { TeacherPanel } from './components/TeacherPanel';
import { SettingsModal } from './components/SettingsModal';
import { InstructionsModal } from './components/InstructionsModal';
import { QuestionBankEditor } from './components/QuestionBankEditor';
import { HomeScreen } from './screens/HomeScreen';
import { CreateJoinScreen } from './screens/CreateJoinScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { VictoryScreen } from './screens/VictoryScreen';
import { HistoryScreen } from './screens/HistoryScreen';

export const App: React.FC = () => {
  const {
    screen,
    highContrast,
    reducedMotion,
    setScreen,
    setCreateJoinTab,
    setCaptionToast,
  } = useGameStore();

  // Connect SoundEngine visual captions for accessibility
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    soundEngine.onCaption((caption) => {
      setCaptionToast(caption);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setCaptionToast(null);
      }, 2400);
    });
    return () => {
      soundEngine.onCaption(null);
      if (timer) clearTimeout(timer);
    };
  }, [setCaptionToast]);

  // Auto-open Join screen if URL has ?room=CODE
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        setCreateJoinTab('join');
        setScreen('create_join');
      }
    }
  }, [setCreateJoinTab, setScreen]);

  return (
    <div
      className={`app-shell screen-${screen} ${highContrast ? 'theme-high-contrast' : ''} ${
        reducedMotion ? 'theme-reduced-motion' : ''
      }`}
    >
      <HeaderBar />

      {screen === 'home' && <HomeScreen />}
      {screen === 'create_join' && <CreateJoinScreen />}
      {screen === 'lobby' && <LobbyScreen />}
      {screen === 'game' && <GameScreen />}
      {screen === 'victory' && <VictoryScreen />}
      {screen === 'history' && <HistoryScreen />}
      {screen === 'question_editor' && <QuestionBankEditor />}

      {/* Modales Globales */}
      <QRModal />
      <TeacherPanel />
      <SettingsModal />
      <InstructionsModal />
    </div>
  );
};

export default App;
