import React, { useState, useCallback } from 'react';
import { Channel, AppView } from './types';
import {
  INITIAL_CHANNELS,
  loadChannelsFromStorage,
  saveChannelsToStorage,
} from './utils/defaultChannels';
import { useTvRemote } from './hooks/useTvRemote';
import { DarkAppHeader } from './components/DarkAppHeader';
import { LiveChannelsSidebarView } from './components/LiveChannelsSidebarView';
import { MoviesOnDemandView } from './components/MoviesOnDemandView';
import { SettingsModal } from './components/SettingsModal';
import { RemoteSimulator } from './components/RemoteSimulator';
import { AndroidAdBlockModal } from './components/AndroidAdBlockModal';

export default function App() {
  // Saved Channels State
  const [channels, setChannels] = useState<Channel[]>(() => {
    const list = loadChannelsFromStorage();
    if (!list || list.length === 0) {
      return INITIAL_CHANNELS;
    }
    return list;
  });

  // Views & Active Channel State
  const [currentView, setCurrentView] = useState<AppView>('channels');
  const [activeChannel, setActiveChannel] = useState<Channel | null>(() => channels[0] || null);

  // Settings & Helpers Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [showAdBlockGuide, setShowAdBlockGuide] = useState<boolean>(false);

  // Save changes to storage whenever channel list changes
  const handleSaveChannels = useCallback((newList: Channel[]) => {
    setChannels(newList);
    saveChannelsToStorage(newList);
    if (newList.length > 0 && !activeChannel) {
      setActiveChannel(newList[0]);
    }
  }, [activeChannel]);

  // Editar canal diretamente
  const handleEditChannel = useCallback((ch: Channel) => {
    setEditingChannel(ch);
    setIsSettingsOpen(true);
  }, []);

  // Excluir canal diretamente
  const handleDeleteChannel = useCallback(
    (id: string, name: string) => {
      if (confirm(`Tem certeza que deseja remover o canal "${name}"?`)) {
        setChannels((prev) => {
          const updated = prev.filter((c) => c.id !== id);
          saveChannelsToStorage(updated);
          if (activeChannel?.id === id) {
            setActiveChannel(updated[0] || null);
          }
          return updated;
        });
      }
    },
    [activeChannel]
  );

  // Abrir modal para adicionar canal
  const handleAddNewChannel = useCallback(() => {
    setEditingChannel(null);
    setIsSettingsOpen(true);
  }, []);

  // Fechar modal de configurações
  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
    setEditingChannel(null);
  }, []);

  // Toggle favorite flag
  const handleToggleFavorite = useCallback(
    (channelId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setChannels((prev) => {
        const updated = prev.map((ch) =>
          ch.id === channelId ? { ...ch, isFavorite: !ch.isFavorite } : ch
        );
        saveChannelsToStorage(updated);
        return updated;
      });
    },
    []
  );

  // TV Remote Hook Navigation Logic for Android TV
  const handleRemoteUp = useCallback(() => {
    // Navigation logic handled within sidebar
  }, []);

  const handleRemoteDown = useCallback(() => {
    // Navigation logic handled within sidebar
  }, []);

  const handleRemoteLeft = useCallback(() => {
    // Left arrow navigation
  }, []);

  const handleRemoteRight = useCallback(() => {
    // Right arrow navigation
  }, []);

  const handleRemoteEnter = useCallback(() => {
    // OK button
  }, []);

  const handleRemoteBack = useCallback(() => {
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      setEditingChannel(null);
    } else if (isSimulatorOpen) {
      setIsSimulatorOpen(false);
    } else if (showAdBlockGuide) {
      setShowAdBlockGuide(false);
    }
  }, [isSettingsOpen, isSimulatorOpen, showAdBlockGuide]);

  const handleRemoteMenu = useCallback(() => {
    setIsSettingsOpen((prev) => !prev);
  }, []);

  const { triggerFeedback } = useTvRemote({
    onUp: handleRemoteUp,
    onDown: handleRemoteDown,
    onLeft: handleRemoteLeft,
    onRight: handleRemoteRight,
    onEnter: handleRemoteEnter,
    onBack: handleRemoteBack,
    onMenu: handleRemoteMenu,
  });

  return (
    <div className="flex flex-col h-screen w-screen bg-[#000000] text-white overflow-hidden font-sans select-none">
      {/* 1. Header with View Switcher (Canais vs Filmes) and Settings Icon ONLY */}
      <DarkAppHeader
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view)}
        onOpenSettings={() => {
          setEditingChannel(null);
          setIsSettingsOpen(true);
        }}
        onOpenAndroidGuide={() => setShowAdBlockGuide(true)}
        channelCount={channels.length}
      />

      {/* 2. Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* VIEW 1: Live Channels Screen (Identical layout to screenshot) */}
        {currentView === 'channels' && (
          <LiveChannelsSidebarView
            channels={channels}
            activeChannel={activeChannel}
            onSelectChannel={(selected) => setActiveChannel(selected)}
            onToggleFavorite={handleToggleFavorite}
            onEditChannel={handleEditChannel}
            onDeleteChannel={handleDeleteChannel}
            onAddNewChannel={handleAddNewChannel}
          />
        )}

        {/* VIEW 2: Movies / On Demand with Server + VID */}
        {currentView === 'movies' && (
          <MoviesOnDemandView />
        )}
      </main>

      {/* 3. Settings Modal (Includes Remote Guide that was moved off the main screen) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        channels={channels}
        onSaveChannels={handleSaveChannels}
        onOpenRemoteSimulator={() => setIsSimulatorOpen(true)}
        onOpenAdBlockGuide={() => setShowAdBlockGuide(true)}
        initialEditingChannel={editingChannel}
        initialTab="manage_channels"
      />

      {/* 4. Virtual Remote Simulator for testing without TV */}
      <RemoteSimulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onSendKey={(k) => triggerFeedback(k)}
      />

      {/* 5. Android TV Ad-Block Guide Modal */}
      <AndroidAdBlockModal
        isOpen={showAdBlockGuide}
        onClose={() => setShowAdBlockGuide(false)}
      />
    </div>
  );
}
